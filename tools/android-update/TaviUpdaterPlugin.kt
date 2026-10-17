package com.thebigtree.tavi

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class InstallReleaseArgs {
    lateinit var url: String
}

/** No arbitrary URL downloads: release asset must belong to the Tavi repository. */
@TauriPlugin
class TaviUpdaterPlugin(private val activity: Activity): Plugin(activity) {
    private val urlPattern = Regex("""^https://github\.com/TheBigTreeInc/social/releases/download/v([0-9]+\.[0-9]+\.[0-9]+)/tavi-android-arm64-v\1\.apk$""")

    @Command
    fun installRelease(invoke: Invoke) {
        val url = try { invoke.parseArgs(InstallReleaseArgs::class.java).url } catch (_: Exception) { "" }
        if (!urlPattern.matches(url)) {
            invoke.reject("Invalid official Tavi Android release URL")
            return
        }
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + activity.packageName)))
            invoke.reject("Allow Tavi to install updates, then select Update again")
            return
        }
        val manager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val target = "tavi-update.apk"
        val directory = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        if (directory == null) { invoke.reject("Android download storage unavailable"); return }
        val apkFile = File(directory, target)
        if (apkFile.exists()) apkFile.delete()
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Tavi update")
            .setDescription("Downloading the official Tavi Android release")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, target)
        val downloadId = try { manager.enqueue(request) } catch (error: Exception) {
            invoke.reject("Unable to start update download: " + error.message); return
        }
        val receiver = object: BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE ||
                    intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return
                try {
                    activity.unregisterReceiver(this)
                    val cursor = manager.query(DownloadManager.Query().setFilterById(downloadId))
                    val successful = cursor.use { it != null && it.moveToFirst() &&
                        it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL }
                    if (!successful || !apkFile.isFile || apkFile.length() < 1_000_000L) return
                    val apkUri = FileProvider.getUriForFile(activity,
                        activity.packageName + ".taviupdates", apkFile)
                    val install = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(apkUri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(install) // Android always asks for installation approval
                } catch (_: Exception) {
                    // DownloadManager notification remains available; do not silently install.
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            activity.registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }
        invoke.resolve()
    }
}
