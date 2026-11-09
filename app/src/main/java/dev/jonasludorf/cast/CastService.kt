package dev.jonasludorf.cast

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder

/**
 * Foreground service that keeps the screen capture (standby and casting) and the microphone alive while
 * another app is in front. Android only grants the screen capture once such a service runs.
 */
class CastService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(
            NOTIFICATION_ID,
            notification(this, live = false),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
        )
        CastSession.onServiceStarted()
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL = "cast"
        private const val NOTIFICATION_ID = 1

        fun start(context: Context) = context.startForegroundService(Intent(context, CastService::class.java))

        fun stop(context: Context) = context.stopService(Intent(context, CastService::class.java))

        /** Switches the notification between standby and live. */
        fun update(context: Context, live: Boolean) =
            context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(context, live))

        private fun notification(context: Context, live: Boolean): Notification {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Casting", NotificationManager.IMPORTANCE_LOW))
            val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            return Notification.Builder(context, CHANNEL)
                .setContentTitle(if (live) "Cast is live" else "Cast is ready")
                .setContentText(if (live) "What you see and hear is being shared." else "Show a start code to start casting.")
                .setSmallIcon(android.R.drawable.presence_video_online)
                .setContentIntent(open)
                .setOngoing(true)
                .build()
        }
    }
}
