package dev.jonasludorf.cast

import android.content.Context
import livekit.org.webrtc.CapturerObserver
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoCapturer
import livekit.org.webrtc.VideoFrame
import livekit.org.webrtc.VideoSink

/**
 * Passes the frames of the standby capture to the track that is published while casting. LiveKit stops and
 * disposes published tracks when the room disconnects (e.g. "End cast" on the website); with this relay that only
 * hits the relay track, and the screen capture keeps running for the next start code.
 */
class FrameRelay : VideoCapturer, VideoSink {
    @Volatile
    private var observer: CapturerObserver? = null

    @Volatile
    private var running = false

    override fun initialize(helper: SurfaceTextureHelper?, context: Context?, observer: CapturerObserver) {
        this.observer = observer
    }

    override fun startCapture(width: Int, height: Int, framerate: Int) {
        running = true
        observer?.onCapturerStarted(true)
    }

    override fun stopCapture() {
        running = false
        observer?.onCapturerStopped()
    }

    override fun changeCaptureFormat(width: Int, height: Int, framerate: Int) = Unit

    override fun dispose() {
        running = false
        observer = null
    }

    override fun isScreencast() = true

    override fun onFrame(frame: VideoFrame) {
        if (running) observer?.onFrameCaptured(frame)
    }
}
