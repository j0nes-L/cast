package dev.jonasludorf.cast

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import dev.jonasludorf.cast.CastSession.State
import kotlinx.coroutines.launch
import java.net.URL

/** One button starts and stops casting. */
class MainActivity : ComponentActivity() {

    companion object {
        private const val NOT_SET_UP = "Connect this headset to a PC and set it up on the website's Headsets page."
    }

    private lateinit var dot: View
    private lateinit var name: TextView
    private lateinit var state: TextView
    private lateinit var message: TextView
    private lateinit var buttons: View
    private lateinit var primary: ImageButton
    private lateinit var instance: TextView
    // A message from the consent or permission flow, shown until the state changes
    private var localMessage: String? = null

    // Must be registered before onCreate
    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            CastSession.startCasting(this, data)
        } else {
            localMessage = "Screen capture was not allowed."
            render()
        }
    }

    private val microphone = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.RECORD_AUDIO] == true) {
            askForScreenCapture()
        } else {
            localMessage = "Microphone permission is needed for casting."
            render()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        dot = findViewById(R.id.dot)
        name = findViewById(R.id.name)
        state = findViewById(R.id.state)
        message = findViewById(R.id.message)
        buttons = findViewById(R.id.buttons)
        primary = findViewById(R.id.primary)
        instance = findViewById(R.id.instance)
        primary.setOnClickListener {
            if (CastSession.status.value.state == State.Off) startCasting() else CastSession.stopCasting()
        }
        lifecycleScope.launch { CastSession.status.collect { render() } }
    }

    override fun onResume() {
        super.onResume()
        render() // the setup may have just written the credentials
    }

    // Circle: red off or not set up, yellow starting, green live. The button is an icon with a description.
    private fun render() {
        val config = DeviceConfig.load(this)
        buttons.visibility = if (config != null) View.VISIBLE else View.GONE
        instance.text = config?.let { URL(it.server).authority }
        instance.visibility = if (config != null) View.VISIBLE else View.GONE
        if (config == null) {
            show(R.color.bad, "Not set up", null, NOT_SET_UP)
            return
        }
        val (current, sessionMessage) = CastSession.status.value
        if (current != State.Off) localMessage = null
        val text = sessionMessage ?: localMessage
        when (current) {
            State.Off -> show(R.color.bad, config.name, "Off", text)
            State.Starting -> show(R.color.warn, config.name, "Starting…", text)
            State.Casting -> show(R.color.ok, config.name, "Live", text)
        }
        val casting = current != State.Off
        primary.setImageResource(if (casting) R.drawable.ic_stop else R.drawable.ic_play)
        primary.background = Brutal.button(this, getColor(if (casting) R.color.bad else R.color.ok))
        primary.imageTintList = ColorStateList.valueOf(getColor(if (casting) R.color.surface else R.color.ink))
        primary.contentDescription = if (casting) "Stop casting" else "Start casting"
        primary.isEnabled = current != State.Starting
        primary.alpha = if (primary.isEnabled) 1f else 0.45f
    }

    private fun show(color: Int, title: String, stateText: String?, messageText: String?) {
        dot.background = Brutal.dot(this, getColor(color))
        name.text = title
        state.text = stateText
        state.visibility = if (stateText != null) View.VISIBLE else View.GONE
        message.text = messageText
        message.visibility = if (messageText != null) View.VISIBLE else View.GONE
    }

    private fun startCasting() {
        if (DeviceConfig.load(this) == null || CastSession.status.value.state != State.Off) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) askForScreenCapture()
        else microphone.launch(arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS))
    }

    // With the setup's PROJECT_MEDIA app op the system answers this without showing a dialog
    private fun askForScreenCapture() {
        val manager = getSystemService(MediaProjectionManager::class.java)
        // Always the whole view: the consent dialog then offers no choice of a single app
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        } else {
            manager.createScreenCaptureIntent()
        }
        consent.launch(intent)
    }
}
