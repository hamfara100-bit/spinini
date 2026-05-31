import Foundation
import React
import UIKit
import UserNotifications

#if canImport(FamilyControls)
import FamilyControls
#endif

#if canImport(ManagedSettings)
import ManagedSettings
import ManagedSettingsUI
#endif

#if canImport(DeviceActivity)
import DeviceActivity
#endif

#if canImport(NetworkExtension)
import NetworkExtension
#endif

@objc(DeviceGuardianModule)
class DeviceGuardianModule: NSObject, RCTBridgeModule {

    static func moduleName() -> String! {
        return "DeviceGuardianModule"
    }

    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - getGuardianStatus

    @objc func getGuardianStatus(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        var result: [String: Any] = [
            "usageStatsGranted": false,
            "accessibilityEnabled": false,
            "deviceAdminActive": false,
            "vpnActive": false,
            "screenTimeAuthorized": false,
            "contentFilterEnabled": false,
            "platform": "ios",
            "kioskMode": false,
        ]

        if #available(iOS 16.0, *) {
            #if canImport(FamilyControls)
            let status = AuthorizationCenter.shared.authorizationStatus
            let authorized = (status == .approved)
            result["screenTimeAuthorized"] = authorized
            result["usageStatsGranted"] = authorized
            #endif

            #if canImport(NetworkExtension)
            let filterManager = NEFilterManager.shared()
            result["contentFilterEnabled"] = filterManager.isEnabled
            result["vpnActive"] = filterManager.isEnabled
            #endif
        }

        resolve(result)
    }

    // MARK: - requestUsageStatsPermission (ScreenTime auth on iOS)

    @objc func requestUsageStatsPermission(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(FamilyControls)
            Task {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    let approved = AuthorizationCenter.shared.authorizationStatus == .approved
                    resolve(approved)
                } catch {
                    resolve(false)
                }
            }
            #else
            resolve(false)
            #endif
        } else {
            resolve(false)
        }
    }

    // MARK: - requestAccessibilityPermission (no direct iOS equivalent — open Settings)

    @objc func requestAccessibilityPermission(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            resolve(nil)
        }
    }

    // MARK: - requestDeviceAdminPermission (MDM concept on iOS — open Settings)

    @objc func requestDeviceAdminPermission(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            resolve(false)
        }
    }

    // MARK: - setScreenTimeApps

    @objc func setScreenTimeApps(
        _ bundleIds: [String],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(ManagedSettings)
            let store = ManagedSettingsStore()
            if bundleIds.isEmpty {
                store.application.blockedApplications = nil
            } else {
                let applications = Set(bundleIds.map { Application(bundleIdentifier: $0) })
                store.application.blockedApplications = applications
            }
            resolve(nil)
            #else
            reject("NOT_SUPPORTED", "ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - startVpn (NEFilterManager)

    @objc func startVpn(
        _ configJson: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(NetworkExtension)
            guard let data = configJson.data(using: .utf8),
                  let _ = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                reject("INVALID_CONFIG", "Invalid VPN config JSON", nil)
                return
            }

            let filterManager = NEFilterManager.shared()
            filterManager.loadFromPreferences { [weak filterManager] error in
                if let error = error {
                    reject("VPN_LOAD_ERROR", error.localizedDescription, error)
                    return
                }

                guard let manager = filterManager else {
                    reject("VPN_ERROR", "Filter manager unavailable", nil)
                    return
                }

                if manager.providerConfiguration == nil {
                    let providerConfig = NEFilterProviderConfiguration()
                    providerConfig.filterSockets = true
                    providerConfig.filterPackets = false
                    manager.providerConfiguration = providerConfig
                }

                manager.localizedDescription = "FamilyGuard Content Filter"
                manager.isEnabled = true

                // Persist config for the extension to read
                UserDefaults.standard.set(configJson, forKey: "guardian_vpn_config")

                manager.saveToPreferences { saveError in
                    if let saveError = saveError {
                        reject("VPN_SAVE_ERROR", saveError.localizedDescription, saveError)
                    } else {
                        resolve(true)
                    }
                }
            }
            #else
            reject("NOT_SUPPORTED", "NetworkExtension framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - stopVpn

    @objc func stopVpn(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(NetworkExtension)
            let filterManager = NEFilterManager.shared()
            filterManager.loadFromPreferences { [weak filterManager] error in
                if let error = error {
                    reject("VPN_LOAD_ERROR", error.localizedDescription, error)
                    return
                }
                guard let manager = filterManager else {
                    resolve(nil)
                    return
                }
                manager.isEnabled = false
                manager.saveToPreferences { saveError in
                    if let saveError = saveError {
                        reject("VPN_SAVE_ERROR", saveError.localizedDescription, saveError)
                    } else {
                        resolve(nil)
                    }
                }
            }
            #else
            resolve(nil)
            #endif
        } else {
            resolve(nil)
        }
    }

    // MARK: - getUsageStats
    // Full per-app usage requires a DeviceActivityReport extension and cannot be
    // queried directly from the main app process. Returning an empty array here;
    // implement a DeviceActivityReportExtension target to populate this data.

    @objc func getUsageStats(
        _ sinceMs: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve([])
    }

    // MARK: - getBlockedAttempts

    @objc func getBlockedAttempts(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        let stored = UserDefaults.standard.string(forKey: "blocked_attempts") ?? "[]"
        guard let data = stored.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            resolve([])
            return
        }
        resolve(arr)
    }

    // MARK: - openMdmEnrollment

    @objc func openMdmEnrollment(
        _ serverUrl: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let url = URL(string: serverUrl) else {
            reject("INVALID_URL", "Invalid MDM enrollment URL: \(serverUrl)", nil)
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    resolve(nil)
                } else {
                    reject("OPEN_URL_FAILED", "Failed to open MDM enrollment URL", nil)
                }
            }
        }
    }

    // MARK: - setDowntimeSchedule
    // Schedules a daily recurring DeviceActivity that restricts all apps during
    // the specified time window using DeviceActivityCenter.

    @objc func setDowntimeSchedule(
        _ startHour: Int,
        startMinute: Int,
        endHour: Int,
        endMinute: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(DeviceActivity) && canImport(ManagedSettings)
            Task {
                let center = DeviceActivityCenter()

                // Build DateComponents for start and end of the daily window
                var startComponents = DateComponents()
                startComponents.hour = startHour
                startComponents.minute = startMinute

                var endComponents = DateComponents()
                endComponents.hour = endHour
                endComponents.minute = endMinute

                let schedule = DeviceActivitySchedule(
                    intervalStart: startComponents,
                    intervalEnd: endComponents,
                    repeats: true
                )

                let activityName = DeviceActivityName("guardian.downtime")

                // DeviceActivityEvent with a zero-minute threshold triggers
                // the monitor extension immediately at schedule start.
                let event = DeviceActivityEvent(
                    applications: [],
                    categories: [],
                    webDomains: [],
                    threshold: DateComponents(minute: 0)
                )

                do {
                    try center.startMonitoring(
                        activityName,
                        during: schedule,
                        events: [DeviceActivityEvent.Name("guardian.downtime.start"): event]
                    )
                    resolve(nil)
                } catch {
                    reject("DOWNTIME_ERROR", "Failed to schedule downtime: \(error.localizedDescription)", error)
                }
            }
            #else
            reject("NOT_SUPPORTED", "DeviceActivity or ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - clearDowntimeSchedule
    // Removes all DeviceActivity monitoring schedules.

    @objc func clearDowntimeSchedule(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(DeviceActivity)
            Task {
                let center = DeviceActivityCenter()
                center.stopMonitoring()
                resolve(nil)
            }
            #else
            resolve(nil)
            #endif
        } else {
            resolve(nil)
        }
    }

    // MARK: - setAppCategoryBlocks
    // Shields the specified app categories using ManagedSettingsStore.
    // Accepted category strings: "games", "social", "entertainment",
    // "education", "utilities".

    @objc func setAppCategoryBlocks(
        _ categories: [String],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(ManagedSettings)
            Task {
                let store = ManagedSettingsStore()

                if categories.isEmpty {
                    store.shield.applicationCategories = nil
                    store.shield.webDomainCategories = nil
                    resolve(nil)
                    return
                }

                // Map string names to ActivityCategory
                var activityCategories: Set<ActivityCategory> = []
                for category in categories {
                    switch category.lowercased() {
                    case "games":
                        activityCategories.insert(.games)
                    case "social", "socialnetworking":
                        activityCategories.insert(.socialNetworking)
                    case "entertainment":
                        activityCategories.insert(.entertainment)
                    case "education":
                        activityCategories.insert(.education)
                    case "utilities":
                        activityCategories.insert(.utilities)
                    default:
                        break
                    }
                }

                if activityCategories.isEmpty {
                    store.shield.applicationCategories = nil
                    store.shield.webDomainCategories = nil
                } else {
                    store.shield.applicationCategories = .specific(activityCategories)
                    store.shield.webDomainCategories = .specific(activityCategories)
                }

                resolve(nil)
            }
            #else
            reject("NOT_SUPPORTED", "ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - setWebContentFilter
    // Configures ManagedSettingsStore web content filter.
    // When enabled with specific blocked domains, uses .specific(denied:).
    // When enabled with no specific domains, blocks all web content (.all).
    // When disabled, clears the filter policy.

    @objc func setWebContentFilter(
        _ enabled: Bool,
        allowedDomains: [String],
        blockedDomains: [String],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(ManagedSettings)
            Task {
                let store = ManagedSettingsStore()

                guard enabled else {
                    store.webContent.blockedByFilter = nil
                    resolve(nil)
                    return
                }

                if blockedDomains.isEmpty {
                    // Block all web content
                    store.webContent.blockedByFilter = .all
                } else {
                    // Block specific domains
                    let webDomains = Set(blockedDomains.compactMap { WebDomain(domain: $0) })
                    store.webContent.blockedByFilter = .specific(denied: webDomains)
                }

                resolve(nil)
            }
            #else
            reject("NOT_SUPPORTED", "ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - setDailyAppLimit
    // Persists the per-app daily limit to UserDefaults as JSON.
    //
    // NOTE: Enforcing the limit (shielding the app when the threshold is reached)
    // requires a DeviceActivityMonitorExtension app extension target. The extension
    // receives the `deviceActivityMonitor(_:eventDidReachThreshold:activity:)` callback
    // and must call ManagedSettingsStore().shield.applications to block the app.
    // This main-app method only records the intent; the extension target does the work.

    @objc func setDailyAppLimit(
        _ bundleId: String,
        limitMinutes: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(DeviceActivity)
            Task {
                // Load existing limits dictionary from UserDefaults
                var limits: [String: Int] = [:]
                if let stored = UserDefaults.standard.string(forKey: "guardian_daily_limits"),
                   let data = stored.data(using: .utf8),
                   let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Int] {
                    limits = decoded
                }

                // Update or remove the limit for this bundle ID
                if limitMinutes > 0 {
                    limits[bundleId] = limitMinutes
                } else {
                    limits.removeValue(forKey: bundleId)
                }

                // Persist back to UserDefaults
                if let encoded = try? JSONSerialization.data(withJSONObject: limits),
                   let json = String(data: encoded, encoding: .utf8) {
                    UserDefaults.standard.set(json, forKey: "guardian_daily_limits")
                }

                // Schedule a DeviceActivityEvent with the specified threshold.
                // The DeviceActivityMonitorExtension target will receive the callback
                // and apply the shield when the app reaches the time limit.
                let center = DeviceActivityCenter()
                let activityName = DeviceActivityName("guardian.applimit.\(bundleId)")

                var startComponents = DateComponents()
                startComponents.hour = 0
                startComponents.minute = 0

                var endComponents = DateComponents()
                endComponents.hour = 23
                endComponents.minute = 59

                let schedule = DeviceActivitySchedule(
                    intervalStart: startComponents,
                    intervalEnd: endComponents,
                    repeats: true
                )

                let application = Application(bundleIdentifier: bundleId)
                let event = DeviceActivityEvent(
                    applications: [application],
                    categories: [],
                    webDomains: [],
                    threshold: DateComponents(minute: limitMinutes)
                )

                do {
                    try center.startMonitoring(
                        activityName,
                        during: schedule,
                        events: [DeviceActivityEvent.Name("guardian.applimit.\(bundleId).threshold"): event]
                    )
                    resolve(nil)
                } catch {
                    // Monitoring may fail if Screen Time authorization hasn't been granted.
                    // The limit is still persisted in UserDefaults for future use.
                    reject("LIMIT_ERROR", "Failed to schedule app limit: \(error.localizedDescription)", error)
                }
            }
            #else
            reject("NOT_SUPPORTED", "DeviceActivity framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - getCurrentApp
    // iOS sandboxing prevents an app from observing which app is currently in the
    // foreground. The Android counterpart uses Accessibility Services for this.
    // Always resolves with an empty string on iOS.

    @objc func getCurrentApp(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve("")
    }

    // MARK: - lockDevice
    // Simulates device lock on iOS by blocking all known applications via
    // ManagedSettingsStore and displaying a local notification with the given message.
    // This prevents the user from switching to any other app included in the block set.
    //
    // NOTE: ManagedSettings can only block apps that are explicitly enumerated.
    // For a production implementation, populate the set from a stored FamilyActivitySelection
    // obtained via FamilyActivityPicker (SwiftUI) or ActivitySelectionView.

    @objc func lockDevice(
        _ message: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(ManagedSettings)
            Task {
                let store = ManagedSettingsStore()

                // Retrieve any previously selected applications from UserDefaults.
                // These are stored as a JSON-encoded array of bundle IDs by the
                // app's onboarding flow using FamilyActivityPicker.
                var appsToBlock: Set<Application> = []
                if let stored = UserDefaults.standard.string(forKey: "guardian_managed_apps"),
                   let data = stored.data(using: .utf8),
                   let bundleIds = try? JSONSerialization.jsonObject(with: data) as? [String] {
                    appsToBlock = Set(bundleIds.map { Application(bundleIdentifier: $0) })
                }

                // Shield all applications selected for management.
                // Setting to nil would remove the block; an empty set blocks nothing.
                store.application.blockedApplications = appsToBlock.isEmpty ? nil : appsToBlock
                store.application.denyAppInstallation = true
                store.application.denyAppRemoval = true

                // Show a local notification with the lock message
                let content = UNMutableNotificationContent()
                content.title = "Device Locked"
                content.body = message.isEmpty ? "This device has been locked by your guardian." : message
                content.sound = .default

                let request = UNNotificationRequest(
                    identifier: "guardian.lock.notification",
                    content: content,
                    trigger: nil // deliver immediately
                )

                UNUserNotificationCenter.current().add(request) { _ in
                    // Ignore notification scheduling errors; the lock is already applied.
                }

                resolve(nil)
            }
            #else
            reject("NOT_SUPPORTED", "ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }

    // MARK: - unlockDevice
    // Clears all ManagedSettings application blocks set by lockDevice().

    @objc func unlockDevice(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 16.0, *) {
            #if canImport(ManagedSettings)
            Task {
                let store = ManagedSettingsStore()
                store.application.blockedApplications = nil
                store.application.denyAppInstallation = false
                store.application.denyAppRemoval = false

                // Remove any pending lock notifications
                UNUserNotificationCenter.current().removePendingNotificationRequests(
                    withIdentifiers: ["guardian.lock.notification"]
                )

                resolve(nil)
            }
            #else
            reject("NOT_SUPPORTED", "ManagedSettings framework not available", nil)
            #endif
        } else {
            reject("NOT_SUPPORTED", "Requires iOS 16.0 or later", nil)
        }
    }
}
