package org.nwdl.cast

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.nwdl.cast.CastSession.State

class MainActivity : ComponentActivity() {

    companion object {
        /** Set by [BootReceiver]: enter standby and get out of the way. */
        const val EXTRA_AUTOSTART = "autostart"

        private const val NOT_SET_UP = "This headset is not set up for NWDL Cast yet.\n\n" +
            "Connect it to a PC and run the setup script (app/setup.ps1, see cast.nwdl.org)."
    }

    private lateinit var status: TextView
    private lateinit var primary: Button
    private lateinit var quit: Button
    private var askedForCapture = false

    // Must be registered before onCreate
    private val consent = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            CastSession.enterStandby(this, data)
            if (intent.getBooleanExtra(EXTRA_AUTOSTART, false)) moveTaskToBack(true)
        } else {
            status.text = "Screen capture was not allowed."
        }
    }

    private val microphone = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.RECORD_AUDIO] == true) askForScreenCapture()
        else status.text = "Microphone permission is needed for casting."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        status = findViewById(R.id.status)
        primary = findViewById(R.id.start)
        quit = findViewById(R.id.stop)
        quit.text = "Quit"

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

    private fun render() {
        val config = DeviceConfig.load(this)
        primary.visibility = if (config != null) View.VISIBLE else View.GONE
        quit.visibility = if (config != null) View.VISIBLE else View.GONE
        if (config == null) {
            status.text = NOT_SET_UP
            return
        }
        val (state, message) = CastSession.status.value
        val text = when (state) {
            State.Off -> "Not running."
            State.Standby -> "Ready as ${config.name}.\nShow the start code to this headset, or press Start casting."
            State.Starting -> "Starting…"
            State.Casting -> "Casting as ${config.name}.\nYou can switch to another app now."
        }
        status.text = listOfNotNull(message, text).joinToString("\n\n")
        primary.text = when (state) {
            State.Off -> "Start standby"
            State.Standby -> "Start casting"
            State.Starting -> "Starting…"
            State.Casting -> "Stop casting"
        }
        primary.isEnabled = state != State.Starting
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
