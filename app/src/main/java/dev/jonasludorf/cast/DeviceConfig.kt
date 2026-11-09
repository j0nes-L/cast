package dev.jonasludorf.cast

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Thrown when the server no longer accepts this headset's credentials. */
class NotSetUpException : Exception("The credentials of this headset are no longer valid. Run the setup script again.")

/** Credentials of this headset, written by the setup script (app/setup.ps1). */
data class DeviceConfig(val server: String, val deviceId: String, val deviceSecret: String, val name: String) {

    /** Asks the cast website for a LiveKit token. Blocking, call off the main thread. */
    fun fetchToken(): Pair<String, String> {
        val connection = URL("$server/api/token/device").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("deviceId", deviceId).put("deviceSecret", deviceSecret).toString()
            connection.outputStream.use { it.write(body.toByteArray()) }
            when (val status = connection.responseCode) {
                200 -> Unit
                401 -> throw NotSetUpException()
                else -> throw IllegalStateException("Token request failed (HTTP $status)")
            }
            val json = JSONObject(connection.inputStream.bufferedReader().readText())
            return json.getString("url") to json.getString("token")
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val PREFS = "device"
        private const val PRODUCTION_SERVER = "https://cast.nwdl.org"

        /** The stored credentials; takes over a cast.json pushed by the setup script first. */
        fun load(context: Context): DeviceConfig? {
            importPushedFile(context)
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return DeviceConfig(
                prefs.getString("server", null) ?: return null,
                prefs.getString("deviceId", null) ?: return null,
                prefs.getString("deviceSecret", null) ?: return null,
                prefs.getString("name", null) ?: return null,
            )
        }

        fun clear(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()

        // The setup script can only write to the app's external files folder; the secret should not stay there.
        private fun importPushedFile(context: Context) {
            val file = File(context.getExternalFilesDir(null), "cast.json")
            if (!file.exists()) return
            runCatching {
                val json = JSONObject(file.readText())
                val server = json.getString("server").trimEnd('/')
                // Release builds only talk to cast.nwdl.org, whatever the file says
                if (BuildConfig.DEBUG || server == PRODUCTION_SERVER) {
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                        .putString("server", server)
                        .putString("deviceId", json.getString("deviceId"))
                        .putString("deviceSecret", json.getString("deviceSecret"))
                        .putString("name", json.getString("name"))
                        .commit()
                }
            }
            file.delete()
        }
    }
}
