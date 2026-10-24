package com.thebigtree.tavi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/** Explicit, non-exported PackageInstaller callback. Works after activity restart. */
class TaviInstallResultReceiver: BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val version = intent.getStringExtra("tavi_version")?.takeIf { it.matches(Regex("""[0-9]+\.[0-9]+\.[0-9]+""")) } ?: return
        val result = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val prefs = context.getSharedPreferences("tavi.android.updater.v2", Context.MODE_PRIVATE)
        var stage = "failed"
        var code = "installer_failure"
        var note = "Android could not finish the update"
        if (result == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val approval: Intent? = if (Build.VERSION.SDK_INT >= 33)
                intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
            else { @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_INTENT) }
            if (approval != null) {
                try {
                    context.startActivity(approval.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    stage = "awaiting_approval"
                    code = ""
                    note = "Approve installation in the Android system prompt"
                } catch (_: Exception) {
                    code = "approval_unavailable"
                    note = "Android installation approval could not open"
                }
            } else {
                code = "approval_unavailable"
                note = "Android did not offer installation approval"
            }
        } else if (result == PackageInstaller.STATUS_SUCCESS) {
            stage = "installed"
            code = ""
            note = "Android completed the Tavi update"
        } else {
            code = when (result) {
                PackageInstaller.STATUS_FAILURE_ABORTED -> "cancelled"
                PackageInstaller.STATUS_FAILURE_BLOCKED -> "blocked"
                PackageInstaller.STATUS_FAILURE_CONFLICT -> "conflict"
                PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "incompatible"
                PackageInstaller.STATUS_FAILURE_INVALID -> "invalid_apk"
                PackageInstaller.STATUS_FAILURE_STORAGE -> "storage"
                else -> "installer_failure"
            }
            if (code == "cancelled") stage = "cancelled"
            note = "Android installer did not complete ($code)"
        }
        prefs.edit().putString("stage", stage).putString("code", code)
            .putString("note", note).putString("release", version).apply()
    }
}
