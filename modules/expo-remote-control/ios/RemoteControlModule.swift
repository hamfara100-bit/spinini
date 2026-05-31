// RemoteControlModule.swift
// expo-remote-control
//
// Provides screen mirroring (host) and remote viewing (viewer) for iOS.
//
// IMPORTANT — iOS touch injection limitation:
// iOS sandboxing prevents any third-party app from programmatically injecting
// touch events into another app or the system UI.  The `sendCommand` method
// will forward the command JSON to the connected host over the WebSocket so
// the host app can receive it via the "RCCommand" JS event, but actual gesture
// injection is a no-op on iOS.  Only Android (via AccessibilityService) can
// truly inject gestures system-wide.

import Foundation
import ReplayKit
import UIKit

@objc(RemoteControlModule)
class RemoteControlModule: RCTEventEmitter {

    // MARK: - Supported events

    @objc override func supportedEvents() -> [String]! {
        return ["RCFrame", "RCCommand", "RCState"]
    }

    @objc override static func requiresMainQueueSetup() -> Bool { false }

    // MARK: - Internal state

    private var sessionId: String = ""
    private var sessionRole: String = "viewer"   // "host" | "viewer"
    private var connectionState: String = "idle"
    private var peerDeviceName: String = ""
    private var startedAt: String = ""
    private var jpegQuality: CGFloat = 0.6
    private var targetFps: Int = 15

    /// Viewer-side WebSocket task (URLSessionWebSocketTask, iOS 13+)
    private var wsTask: URLSessionWebSocketTask?
    private var wsSession: URLSession?

    /// Host-side WebSocket server (minimal raw TCP, same RFC 6455 protocol as Android).
    private var hostServer: SwiftWebSocketServer?

    // MARK: - Helper: emit state event

    private func emitState(_ state: String) {
        connectionState = state
        sendEvent(withName: "RCState", body: ["state": state])
    }

    // MARK: - requestScreenCapturePermission

    /// On iOS, screen recording permission is presented by the system when
    /// `startRecording` is first called.  This method triggers that dialog
    /// proactively so the UX feels intentional.
    @objc func requestScreenCapturePermission(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 11.0, *) {
            let recorder = RPScreenRecorder.shared()
            guard recorder.isAvailable else {
                resolve(false)
                return
            }
            // Calling startRecording surfaces the system permission dialog.
            // We immediately stop once we have consent.
            recorder.startRecording { [weak self] error in
                if let error = error {
                    // The user may have denied, or recording is unavailable.
                    resolve(false)
                    return
                }
                recorder.stopRecording { _, _ in }
                resolve(true)
            }
        } else {
            resolve(false)
        }
    }

    // MARK: - isScreenCaptureAvailable

    @objc func isScreenCaptureAvailable(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 11.0, *) {
            resolve(RPScreenRecorder.shared().isAvailable)
        } else {
            resolve(false)
        }
    }

    // MARK: - startHostSession

    @objc func startHostSession(
        _ sessionId: String,
        frameInfoJson: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 11.0, *) {
            self.sessionId = sessionId
            self.sessionRole = "host"
            self.startedAt = ISO8601DateFormatter().string(from: Date())
            emitState("connecting")

            // Parse frameInfo for quality / fps settings
            if let data = frameInfoJson.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let q = json["quality"] as? Int { jpegQuality = CGFloat(q) / 100.0 }
                if let f = json["fps"] as? Int { targetFps = max(1, min(60, f)) }
            }

            let recorder = RPScreenRecorder.shared()
            guard recorder.isAvailable else {
                reject("UNAVAILABLE", "RPScreenRecorder not available on this device", nil)
                return
            }

            // Start the host WebSocket server so viewers can connect
            hostServer = SwiftWebSocketServer(port: 9876, onMessage: { [weak self] msg in
                self?.handleCommandFromWs(msg)
            })
            hostServer?.start()

            // captureInterval controls how often we emit frames
            let captureInterval: TimeInterval = 1.0 / Double(targetFps)
            var lastCaptureTime: CFTimeInterval = 0

            recorder.startCapture(handler: { [weak self] sampleBuffer, bufferType, error in
                guard let self = self, error == nil else { return }
                guard bufferType == .video else { return }

                let now = CACurrentMediaTime()
                guard now - lastCaptureTime >= captureInterval else { return }
                lastCaptureTime = now

                // Convert CMSampleBuffer → UIImage → JPEG → Base64
                guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
                let ciImage = CIImage(cvPixelBuffer: imageBuffer)
                let context = CIContext(options: nil)
                guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
                let uiImage = UIImage(cgImage: cgImage)
                guard let jpegData = uiImage.jpegData(compressionQuality: self.jpegQuality) else { return }
                let b64 = jpegData.base64EncodedString()

                // Emit to local JS listeners
                self.sendEvent(withName: "RCFrame", body: ["data": b64])
                // Broadcast to WebSocket viewers
                self.hostServer?.broadcast(b64)

            }, completionHandler: { [weak self] error in
                if let error = error {
                    self?.emitState("error")
                    reject("CAPTURE_FAILED", error.localizedDescription, error)
                } else {
                    self?.emitState("connected")
                    resolve(true)
                }
            })
        } else {
            reject("UNSUPPORTED", "Screen capture requires iOS 11+", nil)
        }
    }

    // MARK: - stopHostSession

    @objc func stopHostSession(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 11.0, *) {
            RPScreenRecorder.shared().stopCapture { [weak self] error in
                self?.hostServer?.stop()
                self?.hostServer = nil
                self?.emitState("disconnected")
                resolve(nil)
            }
        } else {
            resolve(nil)
        }
    }

    // MARK: - startViewerSession

    @objc func startViewerSession(
        _ sessionId: String,
        serverUrl: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        self.sessionId = sessionId
        self.sessionRole = "viewer"
        self.startedAt = ISO8601DateFormatter().string(from: Date())
        emitState("connecting")

        guard #available(iOS 13.0, *) else {
            reject("UNSUPPORTED", "WebSocket viewer requires iOS 13+", nil)
            return
        }

        guard let url = URL(string: "ws://\(serverUrl):9876") else {
            reject("BAD_URL", "Invalid server URL: \(serverUrl)", nil)
            return
        }

        wsSession = URLSession(configuration: .default)
        wsTask = wsSession?.webSocketTask(with: url)
        wsTask?.resume()

        emitState("connected")
        resolve(true)

        // Start receiving frames in a recursive loop
        receiveNextFrame()
    }

    @available(iOS 13.0, *)
    private func receiveNextFrame() {
        wsTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.sendEvent(withName: "RCFrame", body: ["data": text])
                case .data(let data):
                    let b64 = data.base64EncodedString()
                    self.sendEvent(withName: "RCFrame", body: ["data": b64])
                @unknown default:
                    break
                }
                self.receiveNextFrame()
            case .failure:
                self.emitState("disconnected")
            }
        }
    }

    // MARK: - stopViewerSession

    @objc func stopViewerSession(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 13.0, *) {
            wsTask?.cancel(with: .goingAway, reason: nil)
        }
        wsTask = nil
        wsSession = nil
        emitState("disconnected")
        resolve(nil)
    }

    // MARK: - sendCommand

    /// Send a RemoteCommand JSON string from the viewer to the host over WebSocket.
    ///
    /// NOTE: iOS sandboxing means the host cannot inject the received gesture into
    /// another app or the system UI.  The command is delivered to the host's JS layer
    /// via the "RCCommand" event so app-level handling (e.g., in-app remote control)
    /// is still possible.  System-wide gesture injection is an Android-only capability.
    @objc func sendCommand(
        _ commandJson: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 13.0, *) else {
            resolve(nil)
            return
        }
        guard let task = wsTask else {
            resolve(nil)
            return
        }
        task.send(.string(commandJson)) { error in
            if let error = error {
                reject("SEND_FAILED", error.localizedDescription, error)
            } else {
                resolve(nil)
            }
        }
    }

    // MARK: - getSessionInfo

    @objc func getSessionInfo(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve([
            "sessionId": sessionId,
            "role": sessionRole,
            "state": connectionState,
            "peerDeviceName": peerDeviceName,
            "startedAt": startedAt,
        ])
    }

    // MARK: - setFrameQuality

    @objc func setFrameQuality(
        _ quality: Double,
        fps: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        jpegQuality = CGFloat(max(1, min(100, Int(quality)))) / 100.0
        targetFps = max(1, min(60, Int(fps)))
        resolve(nil)
    }

    // MARK: - Private: handle command received from host-side WebSocket server

    private func handleCommandFromWs(_ json: String) {
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        // Surface to JS — gesture injection is NOT possible on iOS
        sendEvent(withName: "RCCommand", body: obj)
    }
}

// =============================================================================
// SwiftWebSocketServer — minimal RFC 6455 TCP server (text frames only)
// Mirrors the Android SimpleWebSocketServer; avoids any third-party dependency.
// =============================================================================

private class SwiftWebSocketServer {
    private let port: UInt16
    private let onMessage: (String) -> Void
    private var serverFD: Int32 = -1
    private var running = false
    private var clientSockets = [Int32]()
    private let lock = NSLock()

    init(port: UInt16, onMessage: @escaping (String) -> Void) {
        self.port = port
        self.onMessage = onMessage
    }

    func start() {
        running = true
        DispatchQueue.global(qos: .background).async { [weak self] in
            self?.runAcceptLoop()
        }
    }

    func stop() {
        running = false
        lock.lock()
        for fd in clientSockets { Darwin.close(fd) }
        clientSockets.removeAll()
        lock.unlock()
        if serverFD != -1 { Darwin.close(serverFD); serverFD = -1 }
    }

    func broadcast(_ text: String) {
        guard let frame = encodeTextFrame(text) else { return }
        lock.lock()
        let sockets = clientSockets
        lock.unlock()
        var dead = [Int32]()
        for fd in sockets {
            let sent = frame.withUnsafeBytes { Darwin.write(fd, $0.baseAddress!, frame.count) }
            if sent <= 0 { dead.append(fd) }
        }
        if !dead.isEmpty {
            lock.lock()
            clientSockets.removeAll { dead.contains($0) }
            lock.unlock()
            dead.forEach { Darwin.close($0) }
        }
    }

    // MARK: - Private

    private func runAcceptLoop() {
        serverFD = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard serverFD != -1 else { return }

        var opt: Int32 = 1
        setsockopt(serverFD, SOL_SOCKET, SO_REUSEADDR, &opt, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr = in_addr(s_addr: INADDR_ANY)
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)

        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(serverFD, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindResult == 0 else { return }
        guard Darwin.listen(serverFD, 5) == 0 else { return }

        while running {
            let clientFD = Darwin.accept(serverFD, nil, nil)
            guard clientFD != -1 else { break }
            DispatchQueue.global(qos: .background).async { [weak self] in
                self?.handleClient(clientFD)
            }
        }
    }

    private func handleClient(_ fd: Int32) {
        defer {
            lock.lock(); clientSockets.removeAll { $0 == fd }; lock.unlock()
            Darwin.close(fd)
        }

        // Read HTTP upgrade request
        var headerData = Data()
        var buf = [UInt8](repeating: 0, count: 1)
        while !headerData.hasSuffix([0x0D, 0x0A, 0x0D, 0x0A]) {
            let n = Darwin.read(fd, &buf, 1)
            guard n > 0 else { return }
            headerData.append(contentsOf: buf)
            if headerData.count > 8192 { return }
        }

        guard let request = String(data: headerData, encoding: .utf8) else { return }
        guard let keyRange = request.range(of: "Sec-WebSocket-Key: ") else { return }
        let afterKey = request[keyRange.upperBound...]
        guard let lineEnd = afterKey.range(of: "\r\n") else { return }
        let wsKey = String(afterKey[..<lineEnd.lowerBound])

        let magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        let acceptInput = (wsKey + magic).data(using: .ascii)!
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
        acceptInput.withUnsafeBytes { CC_SHA1($0.baseAddress, CC_LONG(acceptInput.count), &digest) }
        let acceptKey = Data(digest).base64EncodedString()

        let response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: \(acceptKey)\r\n\r\n"
        guard let responseData = response.data(using: .ascii) else { return }
        responseData.withUnsafeBytes { Darwin.write(fd, $0.baseAddress!, responseData.count) }

        lock.lock(); clientSockets.append(fd); lock.unlock()

        // Read frames
        while running {
            guard let text = readTextFrame(fd: fd) else { break }
            onMessage(text)
        }
    }

    private func readTextFrame(fd: Int32) -> String? {
        func readByte() -> UInt8? {
            var b: UInt8 = 0
            return Darwin.read(fd, &b, 1) == 1 ? b : nil
        }
        func readBytes(_ n: Int) -> Data? {
            var data = Data(count: n)
            var offset = 0
            while offset < n {
                let r = data.withUnsafeMutableBytes {
                    Darwin.read(fd, $0.baseAddress!.advanced(by: offset), n - offset)
                }
                guard r > 0 else { return nil }
                offset += r
            }
            return data
        }

        guard let b0 = readByte(), let b1 = readByte() else { return nil }
        let masked = (b1 & 0x80) != 0
        var length = Int(b1 & 0x7F)
        if length == 126 {
            guard let ext = readBytes(2) else { return nil }
            length = Int(ext[0]) << 8 | Int(ext[1])
        } else if length == 127 {
            guard let ext = readBytes(8) else { return nil }
            length = ext.reduce(0) { ($0 << 8) | Int($1) }
        }
        let mask: Data? = masked ? readBytes(4) : nil
        guard var payload = readBytes(length) else { return nil }
        if let mask = mask {
            for i in 0..<payload.count {
                payload[i] ^= mask[i % 4]
            }
        }
        _ = b0 // opcode / FIN — we trust it's a text frame
        return String(data: payload, encoding: .utf8)
    }

    private func encodeTextFrame(_ text: String) -> Data? {
        guard let payload = text.data(using: .utf8) else { return nil }
        let len = payload.count
        var header = Data()
        header.append(0x81) // FIN + text opcode
        if len <= 125 {
            header.append(UInt8(len))
        } else if len <= 65535 {
            header.append(126)
            header.append(UInt8((len >> 8) & 0xFF))
            header.append(UInt8(len & 0xFF))
        } else {
            header.append(127)
            for i in stride(from: 56, through: 0, by: -8) {
                header.append(UInt8((len >> i) & 0xFF))
            }
        }
        return header + payload
    }
}

// CommonCrypto is used for SHA-1 in the WebSocket handshake
import CommonCrypto
