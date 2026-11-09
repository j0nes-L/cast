package dev.jonasludorf.cast

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import io.livekit.android.LiveKit
import io.livekit.android.RoomOptions
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.events.DisconnectReason
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.room.Room
import io.livekit.android.room.participant.VideoTrackPublishOptions
import io.livekit.android.room.track.CustomVideoPreset
import io.livekit.android.room.track.LocalAudioTrack
import io.livekit.android.room.track.LocalScreencastVideoTrack
import io.livekit.android.room.track.LocalVideoTrackOptions
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoCaptureParameter
import io.livekit.android.room.track.VideoCodec
import io.livekit.android.room.track.VideoEncoding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Standby: the screen is captured locally (nothing is sent) and searched for start codes.
 * Casting: the capture is published to the cast room, with microphone and app sound.
 * Lives as long as the process; [CastService] keeps the process alive.
 */
object CastSession {
    enum class State { Off, Standby, Starting, Casting }

    data class Status(val state: State, val message: String? = null)

    private const val FPS = 60
    private const val APP_SOUND_GAIN = 0.5f
    private const val QR_COOLDOWN_MS = 3_000L
    private const val START_CODE = "cast:start"
    private const val STOP_CODE = "cast:stop"
    private const val PREFS = "session"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _status = MutableStateFlow(Status(State.Off))
    val status: StateFlow<Status> = _status

    private lateinit var app: Context
    private var projectionData: Intent? = null
    private var room: Room? = null
    private var screen: LocalScreencastVideoTrack? = null // standby capture, never published
    private var relay: FrameRelay? = null // feeds the published track while casting
    private var appSound: ScreenAudioCapturer? = null
    private var roomEvents: Job? = null
    private var lastQrAction = 0L
    private val qrReader = FrameQrReader(::onQrCode)

    private val captureOptions = LocalVideoTrackOptions(isScreencast = true, captureParams = VideoCaptureParameter(1280, 720, FPS))

    // Three layers so that the server can give each viewer what its connection and tile size allow.
    private val publishOptions = VideoTrackPublishOptions(
        name = "screen",
        source = Track.Source.SCREEN_SHARE,
        videoEncoding = VideoEncoding(3_000_000, FPS),
        videoCodec = VideoCodec.H264.codecName, // hardware encoder on the Quest
        simulcast = true,
        simulcastLayers = listOf(
            CustomVideoPreset(VideoCaptureParameter(320, 180, 30), VideoEncoding(300_000, 30)),
            CustomVideoPreset(VideoCaptureParameter(640, 360, FPS), VideoEncoding(1_200_000, FPS)),
        ),
    )

    /** Whether the app returns to standby after a reboot: from the first standby until Quit. */
    fun autostart(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("autostart", false)

    private fun setAutostart(on: Boolean) = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("autostart", on).apply()

    /** Enters standby. [projectionData] is the result of the screen capture consent. */
    fun enterStandby(context: Context, projectionData: Intent) {
        if (_status.value.state != State.Off || this.projectionData != null) return
        app = context.applicationContext
        this.projectionData = projectionData
        CastService.start(app) // continues in onServiceStarted: the capture needs the running foreground service
    }

    internal fun onServiceStarted() {
        val data = projectionData ?: return
        projectionData = null
        try {
            val room = room ?: LiveKit.create(app, RoomOptions(dynacast = true)).also { room = it }
            val track = room.localParticipant.createScreencastTrack("screen", data, captureOptions) {
                scope.launch { onCaptureStopped() }
            }
            screen = track
            track.startCapture()
            track.addRenderer(qrReader)
            setAutostart(true)
            set(State.Standby)
        } catch (e: Exception) {
            shutDown()
            set(State.Off, "Could not start the screen capture: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    fun startCasting() {
        val track = screen ?: return
        if (_status.value.state != State.Standby) return
        set(State.Starting)
        scope.launch {
            try {
                val config = DeviceConfig.load(app) ?: throw IllegalStateException("This headset is not set up.")
                val (url, token) = withContext(Dispatchers.IO) { config.fetchToken() }
                val room = room!!
                room.connect(url, token)
                roomEvents = scope.launch { room.events.collect { if (it is RoomEvent.Disconnected) onDisconnected(it) } }
                val local = room.localParticipant
                val relay = FrameRelay().also { relay = it }
                val published = local.createVideoTrack("screen", relay, captureOptions)
                published.startCapture()
                track.addRenderer(relay)
                local.publishVideoTrack(published, publishOptions)
                local.setMicrophoneEnabled(true)
                // App sound goes into the microphone track; the viewer plays both together
                val mic = local.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack
                appSound = ScreenAudioCapturer.createFromScreenShareTrack(track)?.also {
                    it.gain = APP_SOUND_GAIN
                    mic?.setAudioBufferCallback(it)
                }
                CastService.update(app, live = true)
                set(State.Casting)
            } catch (e: Exception) {
                leaveRoom()
                if (e is NotSetUpException) DeviceConfig.clear(app)
                set(State.Standby, "Casting failed: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Back to standby; the capture keeps running for the next start code. */
    fun stopCasting(message: String? = null) {
        if (_status.value.state != State.Casting) return
        leaveRoom()
        set(State.Standby, message)
    }

    /** Stops everything until the app is opened again, also after reboots. */
    fun quit(context: Context) {
        app = context.applicationContext
        shutDown()
        setAutostart(false)
        set(State.Off)
    }

    private fun onDisconnected(event: RoomEvent.Disconnected) {
        if (_status.value.state != State.Casting) return
        leaveRoom()
        set(State.Standby, if (event.reason == DisconnectReason.PARTICIPANT_REMOVED) "Cast ended from the website." else "Connection lost.")
    }

    // The system ended the capture, e.g. for Meta's own casting
    private fun onCaptureStopped() {
        if (screen == null) return
        shutDown()
        set(State.Off, "The screen capture was stopped. Open the app to return to standby.")
    }

    private fun onQrCode(text: String) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastQrAction < QR_COOLDOWN_MS) return
        when (text.trim()) {
            START_CODE -> if (_status.value.state == State.Standby) {
                lastQrAction = now
                startCasting()
            }
            STOP_CODE -> if (_status.value.state == State.Casting) {
                lastQrAction = now
                stopCasting()
            }
        }
    }

    private fun leaveRoom() {
        roomEvents?.cancel() // our own disconnect below is not an "ended" event
        roomEvents = null
        val room = room ?: return
        val local = room.localParticipant
        (local.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack)?.setAudioBufferCallback(null)
        appSound?.releaseAudioResources()
        appSound = null
        relay?.let { screen?.removeRenderer(it) }
        relay = null
        room.disconnect() // stops and disposes the published tracks; the standby capture is not one of them
        if (screen != null) CastService.update(app, live = false)
    }

    private fun shutDown() {
        leaveRoom()
        screen?.let {
            it.removeRenderer(qrReader)
            it.stop()
            it.dispose()
        }
        screen = null
        room?.release()
        room = null
        projectionData = null
        CastService.stop(app)
    }

    private fun set(state: State, message: String? = null) {
        _status.value = Status(state, message)
    }
}
