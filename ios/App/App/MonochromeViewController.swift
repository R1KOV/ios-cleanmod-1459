import UIKit
import Capacitor

class MonochromeViewController: CAPBridgeViewController {
    override open func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        webView?.backgroundColor = .black
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = .black
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
        #else
        if #available(iOS 16.4, *) {
            webView?.isInspectable = false
        }
        #endif
    }

    override open var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(MonochromeNativePlugin())
    }
}
