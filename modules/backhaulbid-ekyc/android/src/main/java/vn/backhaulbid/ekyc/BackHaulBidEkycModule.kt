package vn.backhaulbid.ekyc

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import vn.cccd.bacreader.sdk.*
import vn.cccd.bacreader.domain.LdsEvidencePart
import java.net.HttpURLConnection
import java.net.URI
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

/** Authenticated host adapter. Only status/receipt metadata crosses the JS bridge. */
class BackHaulBidEkycModule : Module() {
    private val inputs = ConcurrentHashMap<String, CaptureRequest>()
    private val receipts = ConcurrentHashMap<String, Pair<String, CaptureOutcome>>()
    private val uploads = ConcurrentHashMap<String, HttpURLConnection>()
    private lateinit var launcher: AppContextActivityResultLauncher<String, CaptureOutcome>
    private val contract = EkycSdk.captureContract()
    @Volatile private var owner: String? = null
    @Volatile private var launching = false

    /** Declares the authenticated capture, capability, cancellation and upload bridge methods. */
    override fun definition() = ModuleDefinition {
        Name("BackHaulBidEkyc")
        /** Generates a fresh nonce used to bind the paired phone to its capture session. */
        AsyncFunction("newDeviceNonce") { UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "") }
        /** Starts and parses the Android capture Activity lifecycle for the native SDK. */
        RegisterActivityContracts {
            launcher = registerForActivityResult(object : AppContextActivityResultContract<String, CaptureOutcome> {
                /** Rehydrates the validated capture request before launching the native screen. */
                override fun createIntent(context: Context, input: String): Intent {
                    val request = inputs[input] ?: error("Capture context lost")
                    return contract.createIntent(context, request)
                }
                /** Converts Activity results to a typed outcome or a recreated-host failure. */
                override fun parseResult(input: String, resultCode: Int, intent: Intent?): CaptureOutcome {
                    if (!inputs.containsKey(input)) return CaptureOutcome(CaptureStatus.FAILED, "", "", CaptureError.HOST_RECREATED)
                    return contract.parseResult(resultCode, intent)
                }
            }) { input, result ->
                inputs.remove(input)?.let { EkycSdk.cancel(it.accountId) }
                result.evidenceHandle?.let { handle -> owner?.let { EkycSdk.dispose(handle, it) } }
                launching = false
            }
        }
        /** Reports device capabilities without claiming production assurance. */
        AsyncFunction("capabilities") {
            val c = EkycSdk.capabilities(requireNotNull(appContext.reactContext))
            mapOf("nfcSupported" to c.nfcSupported, "nfcEnabled" to c.nfcEnabled,
                "cameraSupported" to c.cameraSupported, "modelsAvailable" to c.developmentModelsAvailable,
                "productionAssuranceAvailable" to false, "sdkVersion" to EkycSdk.VERSION)
        }
        /** Binds native capture state to the currently authenticated application account. */
        AsyncFunction("setAccount") Coroutine { accountId: String? ->
            withContext(Dispatchers.Main) {
                if (owner != accountId) { clearOwner(); owner = accountId }
            }
        }
        /** Starts capture for a server-approved session and retains only its scoped evidence handle. */
        AsyncFunction("capture") Coroutine { options: Map<String, String> ->
            val request = CaptureRequest(
                options.getValue("sessionId"), options.getValue("accountId"),
                CaptureRole.valueOf(options.getValue("role")), options.getValue("expiresAtMillis").toLong(),
                options.getValue("policyVersion"))
            val key = UUID.randomUUID().toString()
            withContext(Dispatchers.Main) {
                check(owner == request.accountId) { "Account changed" }
                check(!launching) { "Capture busy" }
                // A new capture disposes a previous unsent capture for this account.
                receipts.values.filter { it.first == request.accountId }.forEach { (_, result) ->
                    result.evidenceHandle?.let { EkycSdk.dispose(it, request.accountId) }
                }
                receipts.clear()
                launching = true
                inputs[key] = request
            }
            try {
                val result = withContext(Dispatchers.Main) { launcher.launch(key) }
                if (owner != request.accountId) {
                    result.evidenceHandle?.let { EkycSdk.dispose(it, request.accountId) }
                    error("Account changed")
                }
                if (result.status == CaptureStatus.CAPTURED && result.evidenceHandle != null) {
                    receipts[result.sessionId] = request.accountId to result
                }
                safeResult(result)
            } finally { inputs.remove(key); launching = false }
        }
        /** Cancels capture state and disposes resources owned by the current account. */
        AsyncFunction("cancel") Coroutine { -> withContext(Dispatchers.Main) { clearOwner() } }
        /** Uploads captured evidence with the session-scoped grant over the allowed API origin. */
        AsyncFunction("upload") Coroutine { options: Map<String, String> ->
            withContext(Dispatchers.IO) { upload(options) }
        }
        /** Clears capture state when the host destroys the native module. */
        OnDestroy { clearOwner() }
    }

    /** Exposes status metadata while keeping images and identity fields out of the JS bridge. */
    private fun safeResult(result: CaptureOutcome) = mapOf(
        "status" to result.status.name, "sessionId" to result.sessionId,
        "attemptId" to result.attemptId, "error" to result.error?.name, "requiresServerReview" to true,
        "conclusion" to result.conclusion.name, "checks" to result.checks)

    /** Disconnects uploads and erases native capture material for the current account. */
    private fun clearOwner() {
        uploads.values.forEach { it.disconnect() }; uploads.clear()
        owner?.let { EkycSdk.cancel(it); EkycSdk.disposeAccount(it) }
        inputs.clear(); receipts.clear()
    }

    /** Uploads encrypted evidence and validates the server receipt before disposing native data. */
    private fun upload(options: Map<String, String>): Map<String, String> {
        val accountId = options.getValue("accountId")
        check(owner == accountId) { "Account changed" }
        val sessionId = UUID.fromString(options.getValue("sessionId")).toString()
        val receipt = receipts[sessionId]?.takeIf { it.first == accountId }?.second ?: error("Capture unavailable")
        val handle = receipt.evidenceHandle ?: error("Capture unavailable")
        val base = URI(options.getValue("apiBaseUrl"))
        val debug = requireNotNull(appContext.reactContext).applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        NativeUploadPolicy.requireAllowedOrigin(base, debug, BuildConfig.LOCAL_TEST_API_ORIGIN)
        // Query before re-upload: the server may have committed proof while the ACK was lost.
        recoveredReceipt(base, sessionId, receipt, options)?.let {
            check(owner == accountId) { "Account changed" }
            EkycSdk.dispose(handle, accountId); receipts.remove(sessionId)
            return it
        }
        val boundary = "bhb-${UUID.randomUUID()}"
        val connection = base.resolve("/api/v1/representative-verifications/sessions/$sessionId/evidence").toURL().openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15_000
        connection.readTimeout = 60_000
        connection.doOutput = true
        connection.setChunkedStreamingMode(64 * 1024)
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        for ((header, key) in mapOf("Authorization" to "accessToken", "X-Device-Nonce" to "deviceNonce",
            "X-Upload-Grant" to "uploadGrant")) {
            val value = options.getValue(key)
            require(value.length in 1..8192 && !value.contains('\r') && !value.contains('\n'))
            connection.setRequestProperty(header, if (header == "Authorization") "Bearer $value" else value)
        }
        connection.setRequestProperty("X-Attempt-Id", receipt.attemptId)
        require(receipt.consentVersion == "nfc-review-v2") { "Update the app and accept the evidence retention policy" }
        connection.setRequestProperty("X-Evidence-Consent", receipt.consentVersion)
        val captureReport = JSONObject().put("sessionId", sessionId).put("attemptId", receipt.attemptId)
            .put("policyVersion", receipt.consentVersion).put("conclusion", receipt.conclusion.name)
            .put("checks", JSONObject(receipt.checks))
        connection.setRequestProperty("X-Capture-Report", java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString(captureReport.toString().toByteArray(Charsets.UTF_8)))
        uploads[sessionId] = connection
        try {
            connection.outputStream.use { output ->
                /** Writes one multipart section after confirming the same account is still active. */
                fun part(name: String, type: String, write: () -> Unit) {
                    check(owner == accountId) { "Account changed" }
                    output.write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"; filename=\"$name\"\r\nContent-Type: $type\r\n\r\n".toByteArray())
                    write(); output.write("\r\n".toByteArray())
                }
                for (proofPart in LdsEvidencePart.entries) part(proofPart.name.lowercase(), "application/octet-stream") {
                    EkycSdk.writeCardEvidence(handle, accountId, receipt.attemptId, proofPart, output)
                }
                for ((name, photo) in mapOf("front" to CapturePhotoPart.DOCUMENT_FRONT,
                    "back" to CapturePhotoPart.DOCUMENT_BACK, "selfie" to CapturePhotoPart.SELFIE)) {
                    part(name, "image/jpeg") { EkycSdk.writePhotoEvidence(handle, accountId, receipt.attemptId, photo, output) }
                }
                output.write("--$boundary--\r\n".toByteArray())
            }
            val code = connection.responseCode
            if (code == 401) throw CodedException("ERR_EKYC_AUTH_REQUIRED", "Phiên đăng nhập cần được làm mới.", null)
            check(code in 200..299) { "Upload failed ($code)" }
            val body = connection.inputStream.use { input ->
                val bounded = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(bounded.size() + count <= 16_384) { "Invalid receipt" }
                    bounded.write(buffer, 0, count)
                }
                bounded.toByteArray()
            }
            require(body.size <= 16_384) { "Invalid receipt" }
            val result = JSONObject(String(body, Charsets.UTF_8))
            check(owner == accountId) { "Account changed" }
            require(result.getString("sessionId") == sessionId && result.getString("attemptId") == receipt.attemptId)
            require(result.getString("status") in setOf("PENDING", "VERIFIED", "REJECTED")) { "Invalid receipt status" }
            require(result.getString("conclusion") == receipt.conclusion.name) { "Capture conclusion mismatch" }
            val receiptId = UUID.fromString(result.getString("receiptId")).toString()
            EkycSdk.dispose(handle, accountId); receipts.remove(sessionId)
            return mapOf("sessionId" to sessionId, "attemptId" to receipt.attemptId,
                "receiptId" to receiptId, "status" to result.getString("status"), "conclusion" to result.getString("conclusion"),
                "verificationMethod" to result.getString("verificationMethod"))
        } finally { uploads.remove(sessionId); connection.disconnect() }
    }

    /** Recovers a server-committed receipt when an earlier upload acknowledgment was lost. */
    private fun recoveredReceipt(base: URI, sessionId: String, receipt: CaptureOutcome, options: Map<String, String>): Map<String, String>? {
        val connection = base.resolve("/api/v1/representative-verifications/sessions/$sessionId/receipt").toURL().openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15_000; connection.readTimeout = 15_000
        for ((header, key) in mapOf("Authorization" to "accessToken", "X-Device-Nonce" to "deviceNonce", "X-Upload-Grant" to "uploadGrant")) {
            val value = options.getValue(key)
            require(value.length in 1..8192 && !value.contains('\r') && !value.contains('\n'))
            connection.setRequestProperty(header, if (header == "Authorization") "Bearer $value" else value)
        }
        connection.setRequestProperty("X-Attempt-Id", receipt.attemptId)
        uploads[sessionId] = connection
        try {
            val code = connection.responseCode
            if (code == 401) throw CodedException("ERR_EKYC_AUTH_REQUIRED", "Phiên đăng nhập cần được làm mới.", null)
            if (code == 404) return null
            check(code == 200) { "Receipt unavailable ($code)" }
            val bytes = ByteArray(16_384)
            val count = connection.inputStream.use { input ->
                var total = 0
                while (total < bytes.size) {
                    val length = input.read(bytes, total, bytes.size - total)
                    if (length < 0) return@use total
                    total += length
                }
                check(input.read() == -1) { "Invalid receipt" }; total
            }
            val result = JSONObject(String(bytes, 0, count, Charsets.UTF_8))
            require(result.getString("sessionId") == sessionId && result.getString("attemptId") == receipt.attemptId && result.getString("status") in setOf("PENDING", "VERIFIED", "REJECTED"))
            require(result.getString("conclusion") == receipt.conclusion.name) { "Capture conclusion mismatch" }
            val receiptId = UUID.fromString(result.getString("receiptId")).toString()
            return mapOf("sessionId" to sessionId, "attemptId" to receipt.attemptId, "receiptId" to receiptId,
                "status" to result.getString("status"), "conclusion" to result.getString("conclusion"),
                "verificationMethod" to result.getString("verificationMethod"))
        } finally { uploads.remove(sessionId); connection.disconnect() }
    }
}
