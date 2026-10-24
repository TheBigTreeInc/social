package com.thebigtree.tavi

import android.app.Activity
import android.app.DownloadManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import app.tauri.JSObject
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

@InvokeArg
class InstallReleaseArgs {
    lateinit var url: String
}

/**
 * Official-asset-only Android updater. All verification happens natively before
 * PackageInstaller is allowed to receive the APK. Never opens ACTION_VIEW,
 * never installs without OS approval, and never accepts a caller-supplied path.
 * A self-test downloads and validates the APK without creating an install session.
 */
@TauriPlugin
class TaviUpdaterPlugin(private val activity: Activity): Plugin(activity) {
    private val official = Regex("""^https://github\.com/TheBigTreeInc/social/releases/download/v([0-9]+\.[0-9]+\.[0-9]+)/tavi-android-arm64-v\1\.apk$""")
    private val prefs by lazy { activity.getSharedPreferences("tavi.android.updater.v2", Context.MODE_PRIVATE) }
    private val manager by lazy { activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager }
    private var active = false
    private var receiver: BroadcastReceiver? = null

    private fun installed(): PackageInfo = if (Build.VERSION.SDK_INT >= 33) {
        activity.packageManager.getPackageInfo(activity.packageName, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
    } else {
        @Suppress("DEPRECATION")
        activity.packageManager.getPackageInfo(activity.packageName,
            if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
    }

    private fun versionCode(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode
        else { @Suppress("DEPRECATION") info.versionCode.toLong() }

    private fun signatures(info: PackageInfo): List<ByteArray> {
        if (Build.VERSION.SDK_INT >= 28) {
            val signing = info.signingInfo ?: return emptyList()
            return (if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory)
                .orEmpty().map { it.toByteArray() }
        }
        @Suppress("DEPRECATION")
        return info.signatures.orEmpty().map { it.toByteArray() }
    }

    private fun archive(file: File): PackageInfo? {
        @Suppress("DEPRECATION")
        return activity.packageManager.getPackageArchiveInfo(file.absolutePath,
            if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
    }

    private fun sameSigner(current: PackageInfo, next: PackageInfo): Boolean {
        val existing = signatures(current)
        val candidate = signatures(next)
        // Never interpret unavailable signing information as a match.
        return existing.isNotEmpty() && candidate.isNotEmpty() &&
            candidate.all { b -> existing.any { a -> MessageDigest.isEqual(a, b) } }
    }

    private fun readyForInstall(): Boolean = Build.VERSION.SDK_INT < 26 || activity.packageManager.canRequestPackageInstalls()

    private fun status(stage: String, code: String = "", note: String = "", version: String = "") {
        // Do not store/log URLs, usernames, filenames or third-party exception messages.
        prefs.edit().putString("stage", stage).putString("code", code)
            .putString("note", note).putString("release", version).apply()
        val payload = JSObject()
        payload.put("stage", stage)
        payload.put("code", code)
        payload.put("note", note)
        payload.put("version", version)
        payload.put("permission", if (readyForInstall()) "granted" else "required")
        trigger("status", payload)
    }

    private fun payload(): JSObject {
        val oldStage = prefs.getString("stage", "idle") ?: "idle"
        val wanted = prefs.getString("release", "") ?: ""
        if (wanted.isNotEmpty() && oldStage in setOf("install_pending", "awaiting_approval") && installed().versionName == wanted)
            prefs.edit().putString("stage", "installed").putString("note", "New Tavi version installed").apply()
        return JSObject().apply {
        put("stage", prefs.getString("stage", "idle") ?: "idle")
        put("code", prefs.getString("code", "") ?: "")
        put("note", prefs.getString("note", "") ?: "")
        put("version", prefs.getString("release", "") ?: "")
        put("permission", if (readyForInstall()) "granted" else "required")
        put("installedVersion", installed().versionName ?: "unknown")
        put("androidApi", Build.VERSION.SDK_INT)
        put("testing", active)
        }
    }

    @Command
    fun updateStatus(invoke: Invoke) { invoke.resolve(payload()) }

    @Command
    fun testRelease(invoke: Invoke) { begin(invoke, dryRun = true) }

    @Command
    fun installRelease(invoke: Invoke) { begin(invoke, dryRun = false) }

    private fun begin(invoke: Invoke, dryRun: Boolean) {
        val url = try { invoke.parseArgs(InstallReleaseArgs::class.java).url } catch (_: Exception) { "" }
        val match = official.matchEntire(url)
        if (match == null) { invoke.reject("Invalid official Tavi release URL"); return }
        val version = match.groupValues[1]
        if (active) { invoke.reject("An Android updater check is already running"); return }
        if (!dryRun && !readyForInstall()) {
            status("permission_required", "unknown_sources", "Allow installs from Tavi, then press Update again", version)
            try { activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))) }
            catch (_: Exception) { status("failed", "permission_screen", "Open Android settings and allow installing apps from Tavi", version) }
            invoke.reject("Permission required: allow Tavi to install updates, then try again")
            return
        }
        val downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        if (downloadDir == null) { status("failed", "storage", "Private download storage unavailable", version); invoke.reject("Updater storage unavailable"); return }
        val target = "tavi-official-$version.apk"
        val file = File(downloadDir, target)
        if (file.exists() && !file.delete()) { status("failed", "storage", "Cannot clear previous update download", version); invoke.reject("Unable to prepare update download"); return }
        active = true
        status("downloading", "", if (dryRun) "Self-test: downloading official APK (no installation)" else "Downloading official APK", version)
        // Register before enqueue; DownloadManager might finish quickly from cache.
        var downloadId = -1L
        val listener = object: BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE ||
                    intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != downloadId) return
                stopDownloadListener(this)
                active = false
                try {
                    val cursor = manager.query(DownloadManager.Query().setFilterById(downloadId))
                    val success = cursor.use { c -> c != null && c.moveToFirst() &&
                        c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL }
                    if (!success) { status("failed", "download", "APK download failed; check network/storage", version); return }
                    status("verifying", "", "Checking APK package, version, and signature", version)
                    val result = verifyApk(file, version, dryRun)
                    if (result != null) { status("failed", result, messageFor(result), version); return }
                    if (dryRun) {
                        // No install session, no confirmation screen, and no APK retained by the self-test.
                        if (!file.delete()) {
                            status("failed", "cleanup", "Self-test verified but could not remove its downloaded APK", version)
                        } else {
                            status("verified", "", "Package and signing certificate verified; no installation attempted", version)
                        }
                    } else {
                        beginSession(file, version)
                    }
                } catch (_: Exception) {
                    status("failed", "verification", "APK verification/installation could not complete", version)
                } finally { try { manager.remove(downloadId) } catch (_: Exception) {} }
            }
        }
        try {
            register(listener, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), exported = true)
            receiver = listener
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Tavi official update")
                .setDescription(if (dryRun) "Checking the signed Tavi APK; no installation" else "Downloading Tavi release")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, target)
            downloadId = manager.enqueue(request)
            invoke.resolve(payload())
        } catch (_: Exception) {
            stopDownloadListener(listener)
            active = false
            status("failed", "download_start", "Android could not start the download", version)
            invoke.reject("Android DownloadManager unavailable")
        }
    }

    private fun messageFor(code: String) = when (code) {
        "empty_apk" -> "APK incomplete or unavailable"
        "package_mismatch" -> "APK is not the installed Tavi application"
        "signature_mismatch" -> "APK signing certificate differs from installed Tavi"
        "version_mismatch" -> "APK version does not match the release tag"
        "not_newer" -> "APK is not newer than installed Tavi"
        else -> "APK could not be verified"
    }

    private fun verifyApk(file: File, version: String, dryRun: Boolean): String? {
        if (!file.isFile || file.length() < 1_000_000) return "empty_apk"
        val candidate = archive(file) ?: return "package_mismatch"
        val current = installed()
        if (candidate.packageName != activity.packageName) return "package_mismatch"
        if (candidate.versionName != version) return "version_mismatch"
        if (!sameSigner(current, candidate)) return "signature_mismatch"
        if (!dryRun && versionCode(candidate) <= versionCode(current)) return "not_newer"
        return null
    }

    private fun beginSession(file: File, version: String) {
        if (!readyForInstall()) { status("failed", "unknown_sources", "Allow Tavi to request installation", version); return }
        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(activity.packageName)
        params.setSize(file.length())
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
        var id = -1
        try {
            id = installer.createSession(params)
            installer.openSession(id).use { session ->
                FileInputStream(file).use { input ->
                    session.openWrite("tavi-release.apk", 0, file.length()).use { output ->
                        input.copyTo(output)
                        session.fsync(output)
                    }
                }
                // Android 14+ requires an explicit target for mutable PendingIntents.
                // The manifest receiver survives process recreation and persists the outcome.
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val intent = Intent(activity, TaviInstallResultReceiver::class.java).apply {
                    action = "${activity.packageName}.TAVI_INSTALL_RESULT"
                    putExtra("tavi_version", version)
                }
                val callback = PendingIntent.getBroadcast(activity, id, intent, flags)
                status("install_pending", "", "Submitting verified APK to Android PackageInstaller", version)
                session.commit(callback.intentSender)
            }
        } catch (_: Exception) {
            if (id != -1) try { installer.abandonSession(id) } catch (_: Exception) {}
            status("failed", "installer_session", "Android could not create or commit an installation session", version)
        } finally { file.delete() }
    }

    private fun register(listener: BroadcastReceiver, filter: IntentFilter, exported: Boolean) {
        if (Build.VERSION.SDK_INT >= 33) activity.registerReceiver(listener, filter,
            if (exported) Context.RECEIVER_EXPORTED else Context.RECEIVER_NOT_EXPORTED)
        else { @Suppress("DEPRECATION") activity.registerReceiver(listener, filter) }
    }
    private fun stopDownloadListener(listener: BroadcastReceiver) {
        try { activity.unregisterReceiver(listener) } catch (_: Exception) {}
        if (receiver === listener) receiver = null
    }
}
