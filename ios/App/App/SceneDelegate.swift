import UIKit
import Capacitor
import UserNotifications
import AuthenticationServices

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = VesperViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Keep the web artwork visible beneath the system status bar.
class VesperViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(VesperNotificationPermission())
        bridge?.registerPluginInstance(VesperOAuth())
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let scrollView = webView?.scrollView else { return }
        scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 26.0, *) {
            scrollView.topEdgeEffect.isHidden = true
            scrollView.bottomEdgeEffect.isHidden = true
        }
    }
}

// Permission only: APNs registration and server delivery are configured separately.
@objc(VesperNotificationPermission)
public class VesperNotificationPermission: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VesperNotificationPermission"
    public let jsName = "VesperNotificationPermission"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "check", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func check(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let status: String
            switch settings.authorizationStatus {
            case .authorized: status = "granted"
            case .denied: status = "denied"
            case .provisional: status = "provisional"
            case .ephemeral: status = "ephemeral"
            case .notDetermined: status = "default"
            @unknown default: status = "unknown"
            }
            call.resolve(["status": status])
        }
    }

    @objc func request(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, error in
            if let error = error { call.reject(error.localizedDescription); return }
            self.check(call)
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("无法打开系统设置"); return
            }
            UIApplication.shared.open(url, options: [:]) { success in
                if success { call.resolve() } else { call.reject("无法打开系统设置") }
            }
        }
    }
}


// Keep authorization inside an authentication session so Safari's storage is
// never mistaken for the initiating WKWebView's storage.
@objc(VesperOAuth)
public class VesperOAuth: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "VesperOAuth"
    public let jsName = "VesperOAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?

    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.session == nil else {
                call.reject("Authorization is already open."); return
            }
            guard let raw = call.getString("url"), let url = URL(string: raw),
                  url.scheme == "https", url.host != nil,
                  url.user == nil, url.password == nil else {
                call.reject("Authorization requires a valid HTTPS URL."); return
            }
            guard self.bridge?.viewController?.view.window != nil else {
                call.reject("Reopen Vesper before authorizing."); return
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.rvera.vesper") { [weak self] callback, error in
                DispatchQueue.main.async {
                    self?.session = nil
                    if let error = error {
                        if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                            call.reject("Authorization cancelled.")
                        } else {
                            call.reject("Authorization could not complete. Please try again.")
                        }
                        return
                    }
                    guard let callback = callback else {
                        call.reject("The authorization service did not return a callback."); return
                    }
                    call.resolve(["url": callback.absoluteString])
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("Could not open the authorization window.")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
