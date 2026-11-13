// js/dsp-routing.js
// Pure routing decisions for iOS AVPlayer vs Web Audio DSP and Liquid Glass surface selection.

/**
 * Determines whether playback should use the native iOS AVPlayer engine instead of
 * HTMLAudioElement + Web Audio API.
 *
 * Native AVPlayer bypasses WKWebView's AudioContext, so any active DSP
 * (Parametric EQ, AutoEQ, Graphic EQ, Binaural DSP, Mono downmix) MUST route
 * through <audio> + Web Audio API.
 */
export function shouldUseNativeAvPlayer({
    isNativeIos = false,
    isNativeAudioEnabled = false,
    hasActiveDsp = false,
    shouldUseShaka = false,
    isVideo = false,
    streamUrl = '',
} = {}) {
    if (!isNativeIos || !isNativeAudioEnabled) return false;
    if (hasActiveDsp) return false;
    if (shouldUseShaka || isVideo) return false;
    if (typeof streamUrl !== 'string' || streamUrl.length === 0) return false;
    if (streamUrl.startsWith('blob:') || streamUrl.startsWith('data:')) return false;
    return true;
}

/**
 * Resolves whether Liquid Glass (iOS 26/27) styling should be active.
 * Explicit user preference overrides hardware/OS defaults; otherwise enables on
 * iOS 26+ when Reduce Transparency is off, and falls back to Classic Solid on older iOS.
 */
export function resolveDefaultLiquidGlassState({
    iosMajorVersion = 0,
    isReduceTransparencyEnabled = false,
    storedPreference = null,
} = {}) {
    if (storedPreference === '1' || storedPreference === 'true') return true;
    if (storedPreference === '0' || storedPreference === 'false') return false;
    return Number(iosMajorVersion) >= 26 && !Boolean(isReduceTransparencyEnabled);
}
