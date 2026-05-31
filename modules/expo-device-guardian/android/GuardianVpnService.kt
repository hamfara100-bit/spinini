package expo.modules.deviceguardian

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer

class GuardianVpnService : VpnService() {

    companion object {
        const val ACTION_START = "expo.modules.deviceguardian.START_VPN"
        const val ACTION_STOP = "expo.modules.deviceguardian.STOP_VPN"
        const val NOTIFICATION_CHANNEL_ID = "guardian_vpn"
        const val NOTIFICATION_ID = 1001
        const val DEFAULT_UPSTREAM_DNS = "1.1.1.1"
        const val DNS_PORT = 53

        @Volatile
        var isRunning: Boolean = false
            private set

        private val EXPLICIT_DOMAINS = setOf(
            "pornhub.com", "xvideos.com", "xhamster.com", "redtube.com",
            "youporn.com", "tube8.com", "xtube.com", "spankwire.com"
        )
        private val VIOLENCE_DOMAINS = setOf(
            "bestgore.com", "liveleak.com", "goregrish.com", "kaotic.com"
        )
        private val GAMBLING_DOMAINS = setOf(
            "bet365.com", "draftkings.com", "fanduel.com", "betmgm.com",
            "caesarssportsbook.com", "pointsbet.com"
        )
        private val ADS_DOMAINS = setOf(
            "doubleclick.net", "googlesyndication.com", "adnxs.com",
            "adsystem.com", "moatads.com", "scorecardresearch.com"
        )
    }

    private var tunFd: ParcelFileDescriptor? = null
    private var dnsThread: Thread? = null
    private var config: JSONObject? = null

    private val prefs: SharedPreferences by lazy {
        applicationContext.getSharedPreferences(
            DeviceGuardianModule.PREFS_NAME,
            Context.MODE_PRIVATE
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val configJson = prefs.getString(DeviceGuardianModule.KEY_VPN_CONFIG, null)
        config = if (configJson != null) {
            try { JSONObject(configJson) } catch (e: Exception) { JSONObject() }
        } else {
            JSONObject()
        }

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        setupVpn()
        return START_STICKY
    }

    private fun setupVpn() {
        try {
            val dnsServer = config?.optString("dnsServer", "").takeIf { !it.isNullOrEmpty() }
                ?: DEFAULT_UPSTREAM_DNS

            val builder = Builder()
                .addAddress("10.0.0.2", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("10.0.0.1")
                .setSession("FamilyGuard VPN")
                .setBlocking(false)

            tunFd = builder.establish() ?: run {
                isRunning = false
                return
            }

            isRunning = true

            dnsThread = Thread {
                runDnsProxy(tunFd!!, dnsServer)
            }.also {
                it.isDaemon = true
                it.name = "GuardianDnsProxy"
                it.start()
            }
        } catch (e: Exception) {
            isRunning = false
        }
    }

    private fun runDnsProxy(tun: ParcelFileDescriptor, upstreamDns: String) {
        val inputStream = FileInputStream(tun.fileDescriptor)
        val outputStream = FileOutputStream(tun.fileDescriptor)

        val packet = ByteBuffer.allocate(32767)
        val rawPacket = ByteArray(32767)

        try {
            while (!Thread.currentThread().isInterrupted) {
                packet.clear()
                val bytesRead = inputStream.read(rawPacket)
                if (bytesRead <= 0) continue

                packet.put(rawPacket, 0, bytesRead)
                packet.flip()

                // Parse IPv4 header to check for UDP/DNS
                if (bytesRead < 20) continue
                val ipVersion = (rawPacket[0].toInt() and 0xF0) shr 4
                if (ipVersion != 4) continue

                val protocol = rawPacket[9].toInt() and 0xFF
                if (protocol != 17) { // UDP = 17
                    outputStream.write(rawPacket, 0, bytesRead)
                    continue
                }

                val ipHeaderLen = (rawPacket[0].toInt() and 0x0F) * 4
                if (bytesRead < ipHeaderLen + 8) continue

                val destPort = ((rawPacket[ipHeaderLen + 2].toInt() and 0xFF) shl 8) or
                        (rawPacket[ipHeaderLen + 3].toInt() and 0xFF)

                if (destPort != DNS_PORT) {
                    outputStream.write(rawPacket, 0, bytesRead)
                    continue
                }

                val udpPayloadOffset = ipHeaderLen + 8
                val udpPayloadLen = bytesRead - udpPayloadOffset
                if (udpPayloadLen < 12) continue

                val dnsPayload = rawPacket.copyOfRange(udpPayloadOffset, bytesRead)
                val domain = parseDnsQueryDomain(dnsPayload)

                if (domain != null && isBlocked(domain)) {
                    val nxdomainResponse = buildNxdomainResponse(dnsPayload)
                    val responsePacket = wrapDnsInUdpIp(
                        nxdomainResponse,
                        rawPacket,
                        ipHeaderLen,
                        udpPayloadOffset
                    )
                    outputStream.write(responsePacket)
                } else {
                    val response = forwardDns(dnsPayload, upstreamDns)
                    if (response != null) {
                        val responsePacket = wrapDnsInUdpIp(
                            response,
                            rawPacket,
                            ipHeaderLen,
                            udpPayloadOffset
                        )
                        outputStream.write(responsePacket)
                    }
                }
            }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (e: Exception) {
            // Thread exits on error or service stop
        }
    }

    private fun parseDnsQueryDomain(dns: ByteArray): String? {
        return try {
            // DNS header is 12 bytes; QNAME starts at offset 12
            var offset = 12
            val labels = mutableListOf<String>()
            while (offset < dns.size) {
                val len = dns[offset].toInt() and 0xFF
                if (len == 0) break
                offset++
                if (offset + len > dns.size) return null
                labels.add(String(dns, offset, len, Charsets.US_ASCII))
                offset += len
            }
            if (labels.isEmpty()) null else labels.joinToString(".")
        } catch (e: Exception) {
            null
        }
    }

    private fun buildNxdomainResponse(query: ByteArray): ByteArray {
        val response = query.copyOf()
        if (response.size < 2) return response
        // Set QR=1 (response), Opcode=0, AA=0, TC=0, RD=1, RA=1, RCODE=3 (NXDOMAIN)
        response[2] = 0x81.toByte() // QR=1, RD=1
        response[3] = 0x83.toByte() // RA=1, RCODE=3
        // Zero out answer/authority/additional counts
        if (response.size >= 12) {
            response[6] = 0; response[7] = 0   // ANCOUNT
            response[8] = 0; response[9] = 0   // NSCOUNT
            response[10] = 0; response[11] = 0 // ARCOUNT
        }
        return response
    }

    private fun forwardDns(query: ByteArray, upstreamDns: String): ByteArray? {
        return try {
            val socket = DatagramSocket()
            socket.soTimeout = 3000
            protect(socket)
            val upstream = InetAddress.getByName(upstreamDns)
            val sendPacket = DatagramPacket(query, query.size, upstream, DNS_PORT)
            socket.send(sendPacket)
            val buf = ByteArray(4096)
            val recvPacket = DatagramPacket(buf, buf.size)
            socket.receive(recvPacket)
            socket.close()
            buf.copyOf(recvPacket.length)
        } catch (e: Exception) {
            null
        }
    }

    private fun wrapDnsInUdpIp(
        dnsPayload: ByteArray,
        originalRaw: ByteArray,
        ipHeaderLen: Int,
        udpPayloadOffset: Int
    ): ByteArray {
        // Build a minimal IPv4 + UDP response by swapping src/dst and recalculating lengths
        val totalLen = ipHeaderLen + 8 + dnsPayload.size
        val result = ByteArray(totalLen)

        // Copy original IP header and swap src/dst addresses
        System.arraycopy(originalRaw, 0, result, 0, ipHeaderLen)
        // Swap src (12-15) and dst (16-19)
        System.arraycopy(originalRaw, 16, result, 12, 4) // new src = original dst
        System.arraycopy(originalRaw, 12, result, 16, 4) // new dst = original src
        // Update total length
        result[2] = ((totalLen shr 8) and 0xFF).toByte()
        result[3] = (totalLen and 0xFF).toByte()
        // Clear checksum — OS will recompute or we leave as 0 for loopback
        result[10] = 0; result[11] = 0

        // UDP header: swap src/dst ports
        result[ipHeaderLen] = originalRaw[udpPayloadOffset - 6]     // src port hi (was dst)
        result[ipHeaderLen + 1] = originalRaw[udpPayloadOffset - 5] // src port lo
        result[ipHeaderLen + 2] = originalRaw[udpPayloadOffset - 8] // dst port hi (was src)
        result[ipHeaderLen + 3] = originalRaw[udpPayloadOffset - 7] // dst port lo
        val udpLen = 8 + dnsPayload.size
        result[ipHeaderLen + 4] = ((udpLen shr 8) and 0xFF).toByte()
        result[ipHeaderLen + 5] = (udpLen and 0xFF).toByte()
        result[ipHeaderLen + 6] = 0; result[ipHeaderLen + 7] = 0 // checksum

        System.arraycopy(dnsPayload, 0, result, ipHeaderLen + 8, dnsPayload.size)
        return result
    }

    fun isBlocked(domain: String): Boolean {
        val lowerDomain = domain.lowercase()

        val cfg = config ?: return false

        val allowedArray = cfg.optJSONArray("customAllowedDomains")
        if (allowedArray != null) {
            for (i in 0 until allowedArray.length()) {
                val allowed = allowedArray.optString(i).lowercase()
                if (lowerDomain == allowed || lowerDomain.endsWith(".$allowed")) return false
            }
        }

        val blockedArray = cfg.optJSONArray("customBlockedDomains")
        if (blockedArray != null) {
            for (i in 0 until blockedArray.length()) {
                val blocked = blockedArray.optString(i).lowercase()
                if (lowerDomain == blocked || lowerDomain.endsWith(".$blocked")) return true
            }
        }

        val categories = cfg.optJSONArray("blocklistCategories")
        if (categories != null) {
            for (i in 0 until categories.length()) {
                val cat = categories.optString(i)
                val domainSet = when (cat) {
                    "explicit" -> EXPLICIT_DOMAINS
                    "violence" -> VIOLENCE_DOMAINS
                    "gambling" -> GAMBLING_DOMAINS
                    "ads" -> ADS_DOMAINS
                    else -> emptySet()
                }
                for (blocked in domainSet) {
                    if (lowerDomain == blocked || lowerDomain.endsWith(".$blocked")) return true
                }
            }
        }

        return false
    }

    override fun onDestroy() {
        isRunning = false
        dnsThread?.interrupt()
        dnsThread = null
        try {
            tunFd?.close()
        } catch (e: Exception) {
            // ignore
        }
        tunFd = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "FamilyGuard VPN",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active content filtering VPN"
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("FamilyGuard Active")
            .setContentText("Content filtering is running")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
