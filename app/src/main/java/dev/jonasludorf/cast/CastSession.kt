package dev.jonasludorf.cast

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import androidx.core.content.ContextCompat
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
import io.livekit.android.room.track.LocalVideoTrackOptions
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoCaptureParameter
import io.livekit.android.room.track.VideoCodec
import io.livekit.android.room.track.VideoEncoding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Casting: the screen is captured only while casting and published to the cast room, with microphone and app sound.
 * Lives as long as the process; [CastService] keeps it alive while casting.
 */
object CastSession {
    enum class State { Off, Starting, Casting }

    data class Status(val state: State, val message: String? = null)

    private const val FPS = 60
    private const val APP_SOUND_GAIN = 0.5f
    private const val OFF_LIMIT_MS = 30 * 60_000L
    private const val OFF_MESSAGE = "Cast ended: the headset was off for 30 minutes."

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _status = MutableStateFlow(Status(State.Off))
    val status: StateFlow<Status> = _status

    private lateinit var app: Context
    private var projectionData: Intent? = null
    private var room: Room? = null
    private var appSound: ScreenAudioCapturer? = null
    private var roomEvents: Job? = null
    private var offTimer: Job? = null
    private var offSince = 0L

    // The display goes off when the headset is taken off (and when it sleeps): a cast nobody wears ends after
    // OFF_LIMIT_MS, if the connection has not dropped before
    private val display = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val timer = offTimer
            if (intent.action == Intent.ACTION_SCREEN_OFF) {
                if (timer != null) return
                offSince = SystemClock.elapsedRealtime()
                offTimer = scope.launch {
                    delay(OFF_LIMIT_MS)
                    stopCasting(OFF_MESSAGE)
                }
            } else if (timer != null) {
                timer.cancel()
                offTimer = null
                // The timer stands still while the headset sleeps; the real time does not
                if (SystemClock.elapsedRealtime() - offSince >= OFF_LIMIT_MS) stopCasting(OFF_MESSAGE)
            }
        }
    }

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

    /** Starts casting. [projectionData] is the result of the screen capture consent. */
    fun startCasting(context: Context, projectionData: Intent) {
        if (_status.value.state != State.Off) return
        app = context.applicationContext
        this.projectionData = projectionData
        set(State.Starting)
        CastService.start(app) // continues in onServiceStarted: the capture needs the running foreground service
    }

    internal fun onServiceStarted() {
        val data = projectionData ?: return
        projectionData = null
        scope.launch {
            try {
                val config = DeviceConfig.load(app) ?: throw IllegalStateException("This headset is not set up.")
                val (url, token) = withContext(Dispatchers.IO) { config.fetchToken() }
                val room = LiveKit.create(app, RoomOptions(dynacast = true)).also { room = it }
                room.connect(url, token)
                roomEvents = scope.launch { room.events.collect { if (it is RoomEvent.Disconnected) onDisconnected(it) } }
                val local = room.localParticipant
                val screen = local.createScreencastTrack("screen", data, captureOptions) { scope.launch { onCaptureStopped() } }
                screen.startCapture()
                local.publishVideoTrack(screen, publishOptions)
                local.setMicrophoneEnabled(true)
                // App sound goes into the microphone track; the viewer plays both together
                val mic = local.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack
                appSound = ScreenAudioCapturer.createFromScreenShareTrack(screen)?.also {
                    it.gain = APP_SOUND_GAIN
                    mic?.setAudioBufferCallback(it)
                }
                val displayEvents = IntentFilter(Intent.ACTION_SCREEN_OFF).apply { addAction(Intent.ACTION_SCREEN_ON) }
                ContextCompat.registerReceiver(app, display, displayEvents, ContextCompat.RECEIVER_NOT_EXPORTED)
                set(State.Casting)
            } catch (e: Exception) {
                shutDown()
                if (e is NotSetUpException) DeviceConfig.clear(app)
                set(State.Off, "Casting failed: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    fun stopCasting(message: String? = null) {
        if (_status.value.state == State.Off) return
        shutDown()
        set(State.Off, message)
    }

    private fun onDisconnected(event: RoomEvent.Disconnected) =
        stopCasting(if (event.reason == DisconnectReason.PARTICIPANT_REMOVED) "Cast ended from the website." else "Connection lost.")

    // The system ended the capture, e.g. for Meta's own casting
    private fun onCaptureStopped() = stopCasting("The screen capture was stopped.")

    private fun shutDown() {
        roomEvents?.cancel() // our own disconnect below is not an "ended" event
        roomEvents = null
        runCatching { app.unregisterReceiver(display) } // not registered when the start failed early
        offTimer?.cancel()
        offTimer = null
        room?.let {
            (it.localParticipant.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack)?.setAudioBufferCallback(null)
            it.disconnect() // stops and disposes the published tracks, which ends the screen capture
            it.release()
        }
        room = null
        appSound?.releaseAudioResources()
        appSound = null
        projectionData = null
        CastService.stop(app)
    }

    private fun set(state: State, message: String? = null) {
        _status.value = Status(state, message)
    }
}
