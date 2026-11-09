package dev.jonasludorf.cast

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.zxing.BinaryBitmap
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import livekit.org.webrtc.VideoFrame
import livekit.org.webrtc.VideoSink
import java.util.concurrent.Executors

/** Looks for QR codes in the captured screen, about twice a second, decoding off the capture thread. */
class FrameQrReader(private val onCode: (String) -> Unit) : VideoSink {
    private val decoder = QRCodeReader()
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var busy = false
    private var lastFrame = 0L

    override fun onFrame(frame: VideoFrame) {
        val now = SystemClock.elapsedRealtime()
        if (busy || now - lastFrame < 500) return
        lastFrame = now
        val i420 = frame.buffer.toI420() ?: return // GPU texture to memory; only the luminance plane is needed
        val width = i420.width
        val height = i420.height
        val luma = ByteArray(width * height)
        val plane = i420.dataY
        for (row in 0 until height) {
            plane.position(row * i420.strideY)
            plane.get(luma, row * width, width)
        }
        i420.release()

        busy = true
        worker.execute {
            try {
                val source = PlanarYUVLuminanceSource(luma, width, height, 0, 0, width, height, false)
                val text = decoder.decode(BinaryBitmap(HybridBinarizer(source))).text
                main.post { onCode(text) }
            } catch (_: ReaderException) {
                // no code in this frame
            } finally {
                decoder.reset()
                busy = false
            }
        }
    }
}
