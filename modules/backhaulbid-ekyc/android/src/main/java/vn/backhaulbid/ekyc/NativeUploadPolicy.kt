package vn.backhaulbid.ekyc

import java.net.URI

/** Native evidence may use cleartext only in explicitly configured local debug builds. */
internal object NativeUploadPolicy {
    /** Restricts cleartext uploads to explicit debug hosts and requires HTTPS otherwise. */
    fun requireAllowedOrigin(base: URI, debug: Boolean, configuredDebugOrigin: String) {
        require(isOrigin(base)) { "Invalid API origin" }
        val configured = runCatching { URI(configuredDebugOrigin) }.getOrNull()
        val configuredLan = configured != null && isOrigin(configured) && configured.scheme == "http" &&
            isPrivateIpv4(configured.host) && base.host == configured.host && base.port == configured.port
        require(base.scheme == "https" || (debug && base.scheme == "http" &&
            (base.host in listOf("10.0.2.2", "localhost", "127.0.0.1") || configuredLan))) { "HTTPS is required" }
    }

    /** Checks that a URI contains only an origin and no credentials or request path. */
    private fun isOrigin(value: URI) = value.host != null && value.rawUserInfo == null &&
        value.rawQuery == null && value.rawFragment == null &&
        (value.rawPath.isNullOrEmpty() || value.rawPath == "/") && value.port in -1..65535

    /** Recognizes canonical private IPv4 addresses allowed by local debug configuration. */
    private fun isPrivateIpv4(host: String): Boolean {
        val parts = host.split('.')
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 } || octets.joinToString(".") != host) return false
        return octets[0] == 10 || (octets[0] == 172 && octets[1] in 16..31) ||
            (octets[0] == 192 && octets[1] == 168)
    }
}
