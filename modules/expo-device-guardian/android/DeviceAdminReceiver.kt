package expo.modules.deviceguardian

import android.content.Context
import android.content.Intent

class DeviceAdminReceiver : android.app.admin.DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {}
    override fun onDisabled(context: Context, intent: Intent) {}
}
