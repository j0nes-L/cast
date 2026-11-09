package dev.jonasludorf.cast

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.content.res.ColorStateList
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import dev.jonasludorf.cast.CastSession.State

class MainActivity : ComponentActivity() {

    companion object {
        /** Set by [BootReceiver]: enter standby and get out of the way. */
        const val EXTRA_AUTOSTART = "autostart"

        private const val NOT_SET_UP = "Connect this headset to a PC and run the setup script (setup.ps1)."
    }

    private lateinit var dot: View
    private lateinit var name: TextView
    private lateinit var state: TextView
    private lateinit var message: TextView
    private lateinit var buttons: View
    private lateinit var primary: ImageButton
    private lateinit var quit: ImageButton
    private var askedForCapture = false
    // A message from the consent or permission flow, shown until the state changes
    private var localMessage: String? = null

    // Must be registered before onCreate
    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            CastSession.enterStandby(this, data)
            if (intent.getBooleanExtra(EXTRA_AUTOSTART, false)) moveTaskToBack(true)
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
        quit = findViewById(R.id.quit)
        quit.background = Brutal.button(this, getColor(R.color.surface))
        quit.imageTintList = ColorStateList.valueOf(getColor(R.color.ink))

        primary.setOnClickListener {
            when (CastSession.status.value.state) {
                State.Off -> {
                    askedForCapture = false
                    enterStandby()
                }
                State.Standby -> CastSession.startCasting()
                State.Casting -> CastSession.stopCasting()
                State.Starting -> Unit
            }
        }
        quit.setOnClickListener {
            CastSession.quit(this)
            finish()
        }

        lifecycleScope.launch { CastSession.status.collect { render() } }
        enterStandby() // opening the app means: be ready
    }

    override fun onResume() {
        super.onResume()
        render() // the setup script may have just written the credentials
    }

    // Circle: red off or not set up, yellow standby/starting, green live. Buttons are icons with a description.
    private fun render() {
        val config = DeviceConfig.load(this)
        buttons.visibility = if (config != null) View.VISIBLE else View.GONE
        if (config == null) {
            show(R.color.bad, "Not set up", null, NOT_SET_UP)
            return
        }
        val (current, sessionMessage) = CastSession.status.value
        if (sessionMessage != null || current != State.Off) localMessage = null
        val text = sessionMessage ?: localMessage
        when (current) {
            State.Off -> show(R.color.bad, config.name, "Off", text)
            State.Standby -> show(R.color.warn, config.name, "Standby · show the start code", text)
            State.Starting -> show(R.color.warn, config.name, "Starting…", text)
            State.Casting -> show(R.color.ok, config.name, "Live", text)
        }
        val (icon, face, iconColor, description) = when (current) {
            State.Off -> Quad(R.drawable.ic_cast, R.color.surface, R.color.ink, "Start standby")
            State.Standby, State.Starting -> Quad(R.drawable.ic_play, R.color.ok, R.color.ink, "Start casting")
            State.Casting -> Quad(R.drawable.ic_stop, R.color.bad, R.color.surface, "Stop casting")
        }
        primary.setImageResource(icon)
        primary.background = Brutal.button(this, getColor(face))
        primary.imageTintList = ColorStateList.valueOf(getColor(iconColor))
        primary.contentDescription = description
        primary.isEnabled = current != State.Starting
        primary.alpha = if (primary.isEnabled) 1f else 0.45f
    }

    private data class Quad(val icon: Int, val face: Int, val iconColor: Int, val description: String)

    private fun show(color: Int, title: String, stateText: String?, messageText: String?) {
        dot.background = Brutal.dot(this, getColor(color))
        name.text = title
        state.text = stateText
        state.visibility = if (stateText != null) View.VISIBLE else View.GONE
        message.text = messageText
        message.visibility = if (messageText != null) View.VISIBLE else View.GONE
    }

    private fun enterStandby() {
        if (DeviceConfig.load(this) == null || CastSession.status.value.state != State.Off || askedForCapture) return
        askedForCapture = true
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) askForScreenCapture()
        else microphone.launch(arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS))
    }

    // With the setup script's PROJECT_MEDIA app op the system answers this without showing a dialog
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
