import Foundation
import AVFoundation
import MediaPlayer
import UIKit
import Capacitor

@objc(MonochromeNativePlugin)
public class MonochromeNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MonochromeNativePlugin"
    public let jsName = "MonochromeNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "playTrack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveDownloadedFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listDownloads", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerHaptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSystemCapabilities", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVPlayer?
    private var timeObserverToken: Any?
    private var itemEndObserver: NSObjectProtocol?
    private var itemFailObserver: NSObjectProtocol?
    private var itemStatusObservation: NSKeyValueObservation?
    private var rateObservation: NSKeyValueObservation?
    private var isPlayingNative: Bool = false
    private var currentReportedIsPlaying: Bool = false
    private var wasPlayingBeforeInterruption: Bool = false
    private var currentTitle: String = "FlacLess"
    private var currentArtist: String = ""
    private var currentAlbum: String = ""
    private var currentArtworkUrl: String = ""
    private var cachedArtworkImage: UIImage?
    private var cachedArtworkUrl: String = ""
    private var artworkTask: URLSessionDataTask?

    override public func load() {
        super.load()
        configureAudioSession()
        configureRemoteCommands()
        registerLifecycleObservers()
    }

    deinit {
        cleanupPlayerObservers()
        NotificationCenter.default.removeObserver(self)
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playback,
                mode: .default,
                options: [.allowAirPlay, .allowBluetoothA2DP]
            )
            try session.setActive(true)
        } catch {
            CAPLog.print("[MonochromeNative] AVAudioSession config error: \(error.localizedDescription)")
        }
    }

    private func registerLifecycleObservers() {
        let nc = NotificationCenter.default
        nc.addObserver(
            self,
            selector: #selector(handleAudioInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
        nc.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    @objc private func handleAudioInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            wasPlayingBeforeInterruption = isPlayingNative ? ((player?.rate ?? 0) > 0) : currentReportedIsPlaying
            if isPlayingNative {
                player?.pause()
            }
            currentReportedIsPlaying = false
            notifyListeners("remoteCommand", data: ["command": "pause", "reason": "interruption"])
        case .ended:
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) && wasPlayingBeforeInterruption {
                    try? AVAudioSession.sharedInstance().setActive(true)
                    if isPlayingNative {
                        player?.play()
                    }
                    notifyListeners("remoteCommand", data: ["command": "play", "reason": "interruptionEnded"])
                }
            }
            wasPlayingBeforeInterruption = false
        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        if reason == .oldDeviceUnavailable {
            if isPlayingNative {
                player?.pause()
            }
            notifyListeners("remoteCommand", data: ["command": "pause", "reason": "routeDisconnected"])
        }
    }

    private func configureRemoteCommands() {
        DispatchQueue.main.async {
            UIApplication.shared.beginReceivingRemoteControlEvents()
            let commandCenter = MPRemoteCommandCenter.shared()

            commandCenter.playCommand.isEnabled = true
            commandCenter.playCommand.removeTarget(nil)
            commandCenter.playCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isPlayingNative {
                    self.player?.play()
                    self.refreshNowPlayingInfo(isPlaying: true)
                }
                self.notifyListeners("remoteCommand", data: ["command": "play"])
                return .success
            }

            commandCenter.pauseCommand.isEnabled = true
            commandCenter.pauseCommand.removeTarget(nil)
            commandCenter.pauseCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isPlayingNative {
                    self.player?.pause()
                    self.refreshNowPlayingInfo(isPlaying: false)
                }
                self.notifyListeners("remoteCommand", data: ["command": "pause"])
                return .success
            }

            commandCenter.togglePlayPauseCommand.isEnabled = true
            commandCenter.togglePlayPauseCommand.removeTarget(nil)
            commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                let currentlyPlaying = self.isPlayingNative
                    ? ((self.player?.rate ?? 0) > 0)
                    : self.currentReportedIsPlaying
                let nextPlaying = !currentlyPlaying
                self.currentReportedIsPlaying = nextPlaying
                if self.isPlayingNative {
                    if currentlyPlaying {
                        self.player?.pause()
                        self.refreshNowPlayingInfo(isPlaying: false)
                    } else {
                        self.player?.play()
                        self.refreshNowPlayingInfo(isPlaying: true)
                    }
                }
                self.notifyListeners("remoteCommand", data: ["command": currentlyPlaying ? "pause" : "play"])
                return .success
            }

            commandCenter.nextTrackCommand.isEnabled = true
            commandCenter.nextTrackCommand.removeTarget(nil)
            commandCenter.nextTrackCommand.addTarget { [weak self] _ in
                self?.notifyListeners("remoteCommand", data: ["command": "next"])
                return .success
            }

            commandCenter.previousTrackCommand.isEnabled = true
            commandCenter.previousTrackCommand.removeTarget(nil)
            commandCenter.previousTrackCommand.addTarget { [weak self] _ in
                self?.notifyListeners("remoteCommand", data: ["command": "previous"])
                return .success
            }

            commandCenter.changePlaybackPositionCommand.isEnabled = true
            commandCenter.changePlaybackPositionCommand.removeTarget(nil)
            commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
                guard let self = self,
                      let posEvent = event as? MPChangePlaybackPositionCommandEvent else {
                    return .commandFailed
                }
                let targetSeconds = posEvent.positionTime
                if self.isPlayingNative, let player = self.player {
                    let cmTime = CMTime(seconds: targetSeconds, preferredTimescale: 600)
                    player.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero)
                    self.refreshNowPlayingInfo(isPlaying: player.rate > 0, explicitTime: targetSeconds)
                }
                self.notifyListeners("remoteCommand", data: ["command": "seek", "position": targetSeconds])
                return .success
            }
        }
    }

    private func cleanupPlayerObservers() {
        if let token = timeObserverToken, let p = player {
            p.removeTimeObserver(token)
        }
        timeObserverToken = nil
        if let obs = itemEndObserver {
            NotificationCenter.default.removeObserver(obs)
            itemEndObserver = nil
        }
        if let obs = itemFailObserver {
            NotificationCenter.default.removeObserver(obs)
            itemFailObserver = nil
        }
        itemStatusObservation?.invalidate()
        itemStatusObservation = nil
        rateObservation?.invalidate()
        rateObservation = nil
    }

    @objc func playTrack(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid stream URL")
            return
        }

        configureAudioSession()

        currentTitle = call.getString("title") ?? "FlacLess"
        currentArtist = call.getString("artist") ?? ""
        currentAlbum = call.getString("album") ?? ""
        let nextArtworkUrl = call.getString("artworkUrl") ?? ""
        if nextArtworkUrl != currentArtworkUrl {
            currentArtworkUrl = nextArtworkUrl
            if nextArtworkUrl.isEmpty {
                artworkTask?.cancel()
                cachedArtworkUrl = ""
                cachedArtworkImage = nil
            }
        }
        let startTime = call.getDouble("startTime") ?? 0
        let headers = call.getObject("headers") as? [String: String] ?? [:]

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.cleanupPlayerObservers()

            let asset = headers.isEmpty
                ? AVURLAsset(url: url)
                : AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": headers])
            let item = AVPlayerItem(asset: asset)

            if self.player == nil {
                self.player = AVPlayer(playerItem: item)
                self.player?.automaticallyWaitsToMinimizeStalling = true
            } else {
                self.player?.replaceCurrentItem(with: item)
            }

            self.isPlayingNative = true
            self.currentReportedIsPlaying = true

            self.itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
                guard let self = self else { return }
                switch observedItem.status {
                case .readyToPlay:
                    let dur = observedItem.duration.seconds
                    self.notifyListeners("nativeAudioState", data: [
                        "event": "ready",
                        "duration": dur.isFinite ? dur : 0
                    ])
                    self.refreshNowPlayingInfo(isPlaying: true)
                case .failed:
                    self.isPlayingNative = false
                    self.notifyListeners("nativeAudioState", data: [
                        "event": "error",
                        "message": observedItem.error?.localizedDescription ?? "Playback failed"
                    ])
                default:
                    break
                }
            }

            self.itemEndObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                self?.notifyListeners("nativeAudioState", data: ["event": "ended"])
            }

            self.itemFailObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                self?.notifyListeners("nativeAudioState", data: ["event": "error", "message": "Stream interrupted"])
            }

            let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
            self.timeObserverToken = self.player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
                guard let self = self, let currentItem = self.player?.currentItem else { return }
                let currentSec = time.seconds
                let durSec = currentItem.duration.seconds
                self.notifyListeners("nativeAudioState", data: [
                    "event": "timeupdate",
                    "currentTime": currentSec.isFinite ? currentSec : 0,
                    "duration": durSec.isFinite ? durSec : 0
                ])
            }

            if startTime > 0 {
                let target = CMTime(seconds: startTime, preferredTimescale: 600)
                self.player?.seek(to: target)
            }
            self.player?.play()
            self.refreshNowPlayingInfo(isPlaying: true)
            self.loadArtworkIfNeeded(urlString: self.currentArtworkUrl)
            call.resolve(["started": true])
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.configureAudioSession()
            self.currentReportedIsPlaying = true
            self.player?.play()
            self.refreshNowPlayingInfo(isPlaying: true)
            call.resolve(["playing": true])
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.currentReportedIsPlaying = false
            self.player?.pause()
            self.refreshNowPlayingInfo(isPlaying: false)
            call.resolve(["playing": false])
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        let position = call.getDouble("position") ?? 0
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let cm = CMTime(seconds: max(0, position), preferredTimescale: 600)
            self.player?.seek(to: cm, toleranceBefore: .zero, toleranceAfter: .zero)
            self.refreshNowPlayingInfo(isPlaying: (self.player?.rate ?? 0) > 0, explicitTime: position)
            call.resolve(["position": position])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isPlayingNative = false
            self.currentReportedIsPlaying = false
            self.player?.pause()
            self.player?.replaceCurrentItem(with: nil)
            self.cleanupPlayerObservers()
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve(["stopped": true])
        }
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        let volume = Float(max(0.0, min(1.0, call.getDouble("volume") ?? 1.0)))
        DispatchQueue.main.async { [weak self] in
            self?.player?.volume = volume
            call.resolve(["volume": volume])
        }
    }

    @objc func setRate(_ call: CAPPluginCall) {
        let rate = Float(call.getDouble("rate") ?? 1.0)
        DispatchQueue.main.async { [weak self] in
            self?.player?.rate = rate
            call.resolve(["rate": rate])
        }
    }

    @objc func updateNowPlaying(_ call: CAPPluginCall) {
        configureAudioSession()
        currentTitle = call.getString("title") ?? currentTitle
        currentArtist = call.getString("artist") ?? currentArtist
        currentAlbum = call.getString("album") ?? currentAlbum
        let artworkUrl = call.getString("artworkUrl") ?? ""
        let duration = call.getDouble("duration") ?? 0
        let currentTime = call.getDouble("currentTime") ?? 0
        let isPlaying = call.getBool("isPlaying") ?? false
        currentReportedIsPlaying = isPlaying

        if artworkUrl.isEmpty {
            if !currentArtworkUrl.isEmpty {
                currentArtworkUrl = ""
                cachedArtworkUrl = ""
                cachedArtworkImage = nil
                artworkTask?.cancel()
            }
        } else if artworkUrl != currentArtworkUrl {
            currentArtworkUrl = artworkUrl
            loadArtworkIfNeeded(urlString: artworkUrl)
        }

        DispatchQueue.main.async { [weak self] in
            self?.refreshNowPlayingInfo(
                isPlaying: isPlaying,
                explicitTime: currentTime,
                explicitDuration: duration
            )
            call.resolve(["updated": true])
        }
    }

    private func refreshNowPlayingInfo(isPlaying: Bool, explicitTime: Double? = nil, explicitDuration: Double? = nil) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: currentTitle,
            MPMediaItemPropertyArtist: currentArtist,
            MPMediaItemPropertyAlbumTitle: currentAlbum,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]

        if let dur = explicitDuration, dur > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = dur
        } else if let itemDur = player?.currentItem?.duration.seconds, itemDur.isFinite, itemDur > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = itemDur
        }

        if let elapsed = explicitTime, elapsed >= 0 {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed
        } else if let playerTime = player?.currentTime().seconds, playerTime.isFinite, playerTime >= 0 {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = playerTime
        }

        if let img = cachedArtworkImage {
            let artwork = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
            info[MPMediaItemPropertyArtwork] = artwork
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArtworkIfNeeded(urlString: String) {
        guard !urlString.isEmpty, urlString != cachedArtworkUrl, let url = URL(string: urlString) else {
            return
        }
        artworkTask?.cancel()
        artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self = self, let data = data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                self.cachedArtworkUrl = urlString
                self.cachedArtworkImage = image
                if var existing = MPNowPlayingInfoCenter.default().nowPlayingInfo {
                    existing[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = existing
                }
            }
        }
        artworkTask?.resume()
    }

    @objc func saveDownloadedFile(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64Data"),
              let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            call.reject("Invalid base64 payload")
            return
        }

        let rawFilename = call.getString("filename") ?? "flacless-track-\(Int(Date().timeIntervalSince1970)).flac"
        let safeName = sanitizeFilename(rawFilename)

        guard let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            call.reject("Documents directory unavailable")
            return
        }

        let downloadsDir = docsUrl.appendingPathComponent("Downloads", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: downloadsDir, withIntermediateDirectories: true)
            let targetUrl = uniqueFileUrl(in: downloadsDir, filename: safeName)
            try data.write(to: targetUrl, options: .atomic)
            call.resolve([
                "saved": true,
                "filename": targetUrl.lastPathComponent,
                "path": targetUrl.path,
                "fileUrl": targetUrl.absoluteString
            ])
        } catch {
            call.reject("Failed to write downloaded file: \(error.localizedDescription)")
        }
    }

    @objc func shareFile(_ call: CAPPluginCall) {
        let path = call.getString("path") ?? ""
        let title = call.getString("title") ?? ""
        var items: [Any] = []
        if !path.isEmpty {
            let fileUrl = path.hasPrefix("file://") ? URL(string: path) : URL(fileURLWithPath: path)
            if let url = fileUrl, FileManager.default.fileExists(atPath: url.path) {
                items.append(url)
            }
        }
        if !title.isEmpty {
            items.append(title)
        }
        guard !items.isEmpty else {
            call.reject("Nothing to share")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let vc = self?.bridge?.viewController else {
                call.reject("ViewController unavailable")
                return
            }
            let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = vc.view
                popover.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            vc.present(activityVC, animated: true) {
                call.resolve(["shared": true])
            }
        }
    }

    @objc func listDownloads(_ call: CAPPluginCall) {
        guard let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            call.resolve(["files": []])
            return
        }
        let downloadsDir = docsUrl.appendingPathComponent("Downloads", isDirectory: true)
        let files = (try? FileManager.default.contentsOfDirectory(atPath: downloadsDir.path)) ?? []
        call.resolve(["files": files, "directory": downloadsDir.path])
    }

    @objc func triggerHaptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "selection":
                let gen = UISelectionFeedbackGenerator()
                gen.prepare()
                gen.selectionChanged()
            case "success":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.success)
            case "warning":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.warning)
            case "error":
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                gen.notificationOccurred(.error)
            case "medium":
                let gen = UIImpactFeedbackGenerator(style: .medium)
                gen.prepare()
                gen.impactOccurred()
            case "heavy":
                let gen = UIImpactFeedbackGenerator(style: .heavy)
                gen.prepare()
                gen.impactOccurred()
            default:
                let gen = UIImpactFeedbackGenerator(style: .light)
                gen.prepare()
                gen.impactOccurred()
            }
            call.resolve()
        }
    }

    @objc func getSystemCapabilities(_ call: CAPPluginCall) {
        let version = ProcessInfo.processInfo.operatingSystemVersion
        let systemVersion = UIDevice.current.systemVersion
        let model = UIDevice.current.model
        let isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        DispatchQueue.main.async {
            let isReduceTransparency = UIAccessibility.isReduceTransparencyEnabled
            let isReduceMotion = UIAccessibility.isReduceMotionEnabled
            call.resolve([
                "iosMajorVersion": version.majorVersion,
                "iosMinorVersion": version.minorVersion,
                "iosPatchVersion": version.patchVersion,
                "systemVersion": systemVersion,
                "model": model,
                "isReduceTransparencyEnabled": isReduceTransparency,
                "isReduceMotionEnabled": isReduceMotion,
                "isLowPowerModeEnabled": isLowPowerMode,
                "supportsLiquidGlass": version.majorVersion >= 26 && !isReduceTransparency
            ])
        }
    }

    private func sanitizeFilename(_ name: String) -> String {
        let illegal = CharacterSet(charactersIn: "/\\?%*|\"<>:")
        let cleaned = name.components(separatedBy: illegal).joined(separator: "_")
        return cleaned.isEmpty ? "track.flac" : cleaned
    }

    private func uniqueFileUrl(in directory: URL, filename: String) -> URL {
        var candidate = directory.appendingPathComponent(filename)
        if !FileManager.default.fileExists(atPath: candidate.path) {
            return candidate
        }
        let ext = candidate.pathExtension
        let stem = candidate.deletingPathExtension().lastPathComponent
        var idx = 1
        while FileManager.default.fileExists(atPath: candidate.path) {
            let nextName = ext.isEmpty ? "\(stem) (\(idx))" : "\(stem) (\(idx)).\(ext)"
            candidate = directory.appendingPathComponent(nextName)
            idx += 1
        }
        return candidate
    }
}
