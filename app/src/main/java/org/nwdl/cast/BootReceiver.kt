package org.nwdl.cast

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Brings the app back into standby after a reboot, until it is quit. Horizon OS (tested on v207) allows this
 * activity start from the boot broadcast; plain Android would need SYSTEM_ALERT_WINDOW.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!CastSession.autostart(context) || DeviceConfig.load(context) == null) return
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(MainActivity.EXTRA_AUTOSTART, true),
        )
    }
}
