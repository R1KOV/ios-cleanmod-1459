import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'tf.monochrome.ios',
    appName: 'FlacLess',
    webDir: 'dist',
    backgroundColor: '#000000',
    server: {
        iosScheme: 'capacitor',
        hostname: 'localhost',
        allowNavigation: ['*'],
    },
    plugins: {
        CapacitorHttp: {
            enabled: true,
        },
        SplashScreen: {
            launchShowDuration: 0,
            backgroundColor: '#000000',
            showSpinner: false,
        },
    },
    ios: {
        contentInset: 'never',
        allowsLinkPreview: false,
        backgroundColor: '#000000',
        preferredContentMode: 'mobile',
        limitsNavigationsToAppBoundDomains: false,
        scrollEnabled: true,
    },
};

export default config;
