// js/ios-bridge.js
// Native iOS Capacitor Bridge: AVFoundation audio sync, Lock Screen / Dynamic Island metadata,
// native downloads to Apple Files, SFSafariViewController external links, mobile bottom tab bar,
// Liquid Glass 26/27 + Classic Mode adaptation, 30 FPS visualizer cap, and automatic instance failover.

import {
    getWelcomeStrings,
    SUPPORTED_LANGUAGES,
    getPreferredLanguage,
    setPreferredLanguage,
    applyLanguagePack,
} from './ios-i18n.js';
import { runFastInstanceHealthCheck } from './ios-instances.js';
import { attachIosTouchGestures } from './ios-gestures.js';
import { showMonochromeWelcomeModal } from './ios-onboarding.js';
import { resolveDefaultLiquidGlassState } from './dsp-routing.js';
import { initGitHubBuilder, openGitHubBuildModal } from './github-builder.js';

const PREF_NATIVE_AUDIO = 'flacless-ios-native-audio-v1';
const LEGACY_PREF_NATIVE_AUDIO = 'monochrome-ios-native-audio-v1';
const PREF_LIQUID_GLASS = 'flacless-ios-liquid-glass-v1';
const PREF_FPS_CAP_30 = 'flacless-ios-fps-cap-30-v1';
const LEGACY_PREF_REDUCED_BLUR = 'monochrome-ios-reduced-blur-v1';

let _plugin = null;
let _capacitor = null;
let _browser = null;
let _initialized = false;
let _nativeEngineActive = false;
let _nativeEnginePlaying = false;
let _lastKnownTime = 0;
let _lastKnownDuration = 0;
let _systemCapabilities = null;

function formatClockTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateNativeUiPlaybackIcons(isPlaying) {
    if (typeof document === 'undefined') return;
    const playSvg20 =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
    const pauseSvg20 =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    const playSvg32 =
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
    const pauseSvg32 =
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

    const barBtn = document.querySelector('.now-playing-bar .play-pause-btn');
    if (barBtn) barBtn.innerHTML = isPlaying ? pauseSvg20 : playSvg20;
    const fsBtn = document.getElementById('fs-play-pause-btn');
    if (fsBtn) fsBtn.innerHTML = isPlaying ? pauseSvg32 : playSvg32;
}

function updateNativeUiProgress(currentTime, duration) {
    if (typeof document === 'undefined') return;
    const safeDur = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const safeTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
    const pct = safeDur > 0 ? Math.min(100, Math.max(0, (safeTime / safeDur) * 100)) : 0;
    document.querySelectorAll('#progress-fill, #fs-progress-fill').forEach((el) => {
        el.style.width = `${pct}%`;
    });
    document.querySelectorAll('#current-time, #fs-current-time').forEach((el) => {
        el.textContent = formatClockTime(safeTime);
    });
    if (safeDur > 0) {
        document.querySelectorAll('#total-duration, #fs-total-duration').forEach((el) => {
            el.textContent = formatClockTime(safeDur);
        });
    }
}

export function isNativeIosCapacitor() {
    if (typeof window === 'undefined') return false;
    try {
        if (_capacitor) return _capacitor.getPlatform() === 'ios';
        const cap = window.Capacitor;
        if (cap && typeof cap.getPlatform === 'function') {
            return cap.getPlatform() === 'ios';
        }
    } catch {}
    return false;
}

export function isNativeAudioEnabled() {
    try {
        const stored = localStorage.getItem(PREF_NATIVE_AUDIO) ?? localStorage.getItem(LEGACY_PREF_NATIVE_AUDIO);
        return stored === null ? true : stored === '1';
    } catch {
        return true;
    }
}

function parseIosMajorVersionFallback() {
    if (_systemCapabilities && typeof _systemCapabilities.iosMajorVersion === 'number') {
        return _systemCapabilities.iosMajorVersion;
    }
    if (typeof navigator !== 'undefined') {
        const match = (navigator.userAgent || '').match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[._]/i);
        if (match) return parseInt(match[1], 10) || 0;
    }
    return 0;
}

function detectReduceTransparencyFallback() {
    if (_systemCapabilities && typeof _systemCapabilities.isReduceTransparencyEnabled === 'boolean') {
        return _systemCapabilities.isReduceTransparencyEnabled;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try {
            return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
        } catch {}
    }
    return false;
}

export function isLiquidGlassEnabled() {
    try {
        const stored = localStorage.getItem(PREF_LIQUID_GLASS);
        return resolveDefaultLiquidGlassState({
            iosMajorVersion: parseIosMajorVersionFallback(),
            isReduceTransparencyEnabled: detectReduceTransparencyFallback(),
            storedPreference: stored,
        });
    } catch {
        return false;
    }
}

export function setLiquidGlassEnabled(enabled, persist = true) {
    const active = Boolean(enabled);
    if (persist) {
        try {
            localStorage.setItem(PREF_LIQUID_GLASS, active ? '1' : '0');
        } catch {}
    }
    if (typeof document !== 'undefined') {
        document.body.classList.toggle('ios-liquid-glass', active);
        document.body.classList.toggle('ios-classic-surface', !active);
        document.body.classList.toggle('ios-reduced-blur', !active);
        document.documentElement.dataset.iosLiquidGlass = active ? '1' : '0';

        const toggles = document.querySelectorAll('#ios-liquid-glass-toggle, #appearance-liquid-glass-toggle');
        toggles.forEach((el) => {
            if ('checked' in el) el.checked = active;
        });
    }
}

export function isFpsCap30Enabled() {
    try {
        const stored = localStorage.getItem(PREF_FPS_CAP_30) ?? localStorage.getItem(LEGACY_PREF_REDUCED_BLUR);
        if (stored !== null) return stored === '1';
    } catch {}
    if (typeof window !== 'undefined') {
        return isNativeIosCapacitor() || window.innerWidth <= 768;
    }
    return false;
}

export function setFpsCap30Enabled(enabled) {
    const active = Boolean(enabled);
    try {
        localStorage.setItem(PREF_FPS_CAP_30, active ? '1' : '0');
        localStorage.setItem(LEGACY_PREF_REDUCED_BLUR, active ? '1' : '0');
    } catch {}
    if (typeof document !== 'undefined') {
        document.body.classList.toggle('ios-fps-cap-30', active);
        document.documentElement.dataset.iosLowPower = active ? '1' : '0';
        const toggle = document.getElementById('ios-reduced-blur-toggle');
        if (toggle && 'checked' in toggle) toggle.checked = active;
    }
}

export const isReducedBlurEnabled = isFpsCap30Enabled;
export const setReducedBlurEnabled = setFpsCap30Enabled;

async function ensureCapacitorModules() {
    if (_plugin !== null && _capacitor !== null) {
        return { plugin: _plugin, Capacitor: _capacitor, Browser: _browser };
    }
    try {
        const capMod = await import('@capacitor/core');
        _capacitor = capMod.Capacitor;
        if (_capacitor.getPlatform() === 'ios') {
            _plugin = capMod.registerPlugin('MonochromeNative');
        }
    } catch {}
    try {
        const browserMod = await import('@capacitor/browser');
        _browser = browserMod.Browser;
    } catch {}
    return { plugin: _plugin, Capacitor: _capacitor, Browser: _browser };
}

export async function triggerNativeHaptic(style = 'light') {
    const { plugin } = await ensureCapacitorModules();
    if (plugin && typeof plugin.triggerHaptic === 'function') {
        try {
            await plugin.triggerHaptic({ style });
            return;
        } catch {}
    }
    try {
        const { hapticLight, hapticMedium, hapticSuccess } = await import('./haptics.js');
        if (style === 'medium' || style === 'heavy') await hapticMedium();
        else if (style === 'success') await hapticSuccess();
        else await hapticLight();
    } catch {}
}

export async function saveBlobToIosFiles(blob, filename) {
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.saveDownloadedFile !== 'function') {
        return false;
    }
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const raw = String(reader.result || '');
            const idx = raw.indexOf(',');
            resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
        };
        reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(blob);
    });

    const result = await plugin.saveDownloadedFile({
        base64Data,
        filename,
        mimeType: blob.type || 'application/octet-stream',
    });

    if (result?.saved) {
        try {
            const { showNotification } = await import('./downloads.js');
            showNotification(`Сохранено в «Файлы»: FlacLess/Downloads/${result.filename || filename}`);
        } catch {}
        return result;
    }
    return false;
}

export async function shareIosFile(path, title = '') {
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.shareFile !== 'function') return false;
    try {
        await plugin.shareFile({ path, title });
        return true;
    } catch {
        return false;
    }
}

export async function syncNativeNowPlaying({ track, isPlaying, currentTime, duration, artworkUrl }) {
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.updateNowPlaying !== 'function') return;
    try {
        await plugin.updateNowPlaying({
            title: track?.title || 'FlacLess',
            artist: track?.artist?.name || track?.artists?.map((a) => a.name).join(', ') || '',
            album: track?.album?.title || '',
            artworkUrl: artworkUrl || '',
            duration: Number.isFinite(duration) ? duration : 0,
            currentTime: Number.isFinite(currentTime) ? currentTime : 0,
            isPlaying: !!isPlaying,
        });
    } catch {}
}

export async function playStreamWithNativeAvPlayer({ url, track, artworkUrl, startTime = 0, headers = {} }) {
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || !isNativeIosCapacitor() || !isNativeAudioEnabled()) return false;
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;

    try {
        const res = await plugin.playTrack({
            url,
            title: track?.title || 'FlacLess',
            artist: track?.artist?.name || track?.artists?.map((a) => a.name).join(', ') || '',
            album: track?.album?.title || '',
            artworkUrl: artworkUrl || '',
            startTime: Number(startTime) || 0,
            headers,
        });
        _nativeEngineActive = !!res?.started;
        _nativeEnginePlaying = _nativeEngineActive;
        if (_nativeEngineActive) {
            updateNativeUiPlaybackIcons(true);
        }
        return _nativeEngineActive;
    } catch {
        _nativeEngineActive = false;
        _nativeEnginePlaying = false;
        return false;
    }
}

export function isNativeAudioActive() {
    return _nativeEngineActive;
}

export function isNativeAudioPlaying() {
    return _nativeEngineActive && _nativeEnginePlaying;
}

export async function pauseNativeAvPlayer() {
    if (!_nativeEngineActive) return false;
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.pause !== 'function') return false;
    try {
        await plugin.pause();
        _nativeEnginePlaying = false;
        updateNativeUiPlaybackIcons(false);
        return true;
    } catch {
        return false;
    }
}

export async function resumeNativeAvPlayer() {
    if (!_nativeEngineActive) return false;
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.play !== 'function') return false;
    try {
        await plugin.play();
        _nativeEnginePlaying = true;
        updateNativeUiPlaybackIcons(true);
        return true;
    } catch {
        return false;
    }
}

export async function seekNativeAvPlayer(position) {
    if (!_nativeEngineActive) return false;
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.seek !== 'function') return false;
    try {
        await plugin.seek({ position: Math.max(0, Number(position) || 0) });
        _lastKnownTime = Math.max(0, Number(position) || 0);
        updateNativeUiProgress(_lastKnownTime, _lastKnownDuration);
        return true;
    } catch {
        return false;
    }
}

export async function setNativeAvPlayerVolume(volume) {
    if (!_nativeEngineActive) return false;
    const { plugin } = await ensureCapacitorModules();
    if (!plugin || typeof plugin.setVolume !== 'function') return false;
    try {
        await plugin.setVolume({ volume: Math.max(0, Math.min(1, Number(volume) ?? 1)) });
        return true;
    } catch {
        return false;
    }
}

export async function stopNativeAvPlayer() {
    if (!_nativeEngineActive) return;
    _nativeEngineActive = false;
    _nativeEnginePlaying = false;
    _lastKnownTime = 0;
    _lastKnownDuration = 0;
    const { plugin } = await ensureCapacitorModules();
    if (plugin && typeof plugin.stop === 'function') {
        await plugin.stop().catch(() => {});
    }
}

function setupExternalLinkInterceptor() {
    if (typeof document === 'undefined' || document.documentElement.dataset.iosLinksBound) return;
    document.documentElement.dataset.iosLinksBound = '1';

    document.addEventListener(
        'click',
        async (e) => {
            const anchor = e.target?.closest?.('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href') || '';
            if (isNativeIosCapacitor() && (anchor.hasAttribute('download') || href.startsWith('blob:'))) {
                if (href.startsWith('blob:')) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        const res = await fetch(href);
                        const blob = await res.blob();
                        const filename = anchor.getAttribute('download') || `flacless-${Date.now()}.bin`;
                        await saveBlobToIosFiles(blob, filename);
                    } catch (err) {
                        console.warn('[iOS Download] Failed to save blob URL:', err);
                    }
                    return;
                }
            }

            const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
            if (isNativeIosCapacitor() && (anchor.target === '_blank' || isExternal)) {
                e.preventDefault();
                e.stopPropagation();
                const { Browser } = await ensureCapacitorModules();
                if (Browser && typeof Browser.open === 'function') {
                    await Browser.open({ url: href, presentationStyle: 'popover' }).catch(() => {});
                } else {
                    const tmp = document.createElement('a');
                    tmp.href = href;
                    tmp.target = '_blank';
                    tmp.rel = 'noopener noreferrer';
                    document.body.appendChild(tmp);
                    tmp.click();
                    tmp.remove();
                }
            }
        },
        true
    );
}

function setupMobileBottomTabBar(navigateFn) {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ios-bottom-tabbar')) return;

    const strings = getWelcomeStrings();
    const nav = document.createElement('nav');
    nav.id = 'ios-bottom-tabbar';
    nav.className = 'ios-bottom-tabbar';
    nav.setAttribute('aria-label', 'Мобильная навигация');

    const items = [
        {
            id: 'home',
            path: '/',
            label: strings.tabs.home,
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
        },
        {
            id: 'search',
            path: '/search',
            label: strings.tabs.search,
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
        },
        {
            id: 'library',
            path: '/library',
            label: strings.tabs.library,
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>`,
        },
        {
            id: 'settings',
            path: '/settings',
            label: strings.tabs.settings,
            icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
        },
    ];

    nav.innerHTML = items
        .map(
            (item) => `
            <button type="button" class="ios-tab-item" data-ios-tab="${item.id}" data-route="${item.path}" aria-label="${item.label}">
                <span class="ios-tab-icon">${item.icon}</span>
                <span class="ios-tab-label">${item.label}</span>
            </button>
        `
        )
        .join('');

    const shell = document.querySelector('.app-container') || document.body;
    shell.appendChild(nav);

    const updateActiveTab = () => {
        const path = window.location.pathname || '/';
        let activeId = 'home';
        if (path.startsWith('/search')) activeId = 'search';
        else if (path.startsWith('/library') || path.startsWith('/playlist') || path.startsWith('/userplaylist'))
            activeId = 'library';
        else if (path.startsWith('/settings')) activeId = 'settings';

        nav.querySelectorAll('.ios-tab-item').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.iosTab === activeId);
        });
    };

    nav.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('.ios-tab-item');
        if (!btn) return;
        const route = btn.dataset.route;
        if (!route) return;
        triggerNativeHaptic('selection');
        if (route === '/search') {
            if (typeof navigateFn === 'function') navigateFn('/search');
            setTimeout(() => {
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            }, 90);
        } else if (typeof navigateFn === 'function') {
            navigateFn(route);
        } else {
            window.history.pushState({}, '', route);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        setTimeout(updateActiveTab, 20);
    });

    window.addEventListener('popstate', updateActiveTab);
    const origPushState = window.history.pushState.bind(window.history);
    window.history.pushState = (...args) => {
        const res = origPushState(...args);
        updateActiveTab();
        return res;
    };
    updateActiveTab();
}

function setupKeyboardHandling() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const updateKeyboardState = () => {
        const vv = window.visualViewport;
        if (!vv) return;
        const heightDiff = window.innerHeight - vv.height;
        const keyboardOpen = heightDiff > 140;
        document.body.classList.toggle('ios-keyboard-open', keyboardOpen);
        document.documentElement.style.setProperty('--ios-vv-height', `${vv.height}px`);
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateKeyboardState);
        window.visualViewport.addEventListener('scroll', updateKeyboardState);
    }

    document.addEventListener('focusin', (e) => {
        if (e.target?.matches?.('input, textarea, [contenteditable="true"]')) {
            document.body.classList.add('ios-input-focused');
            setTimeout(() => {
                try {
                    e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
                } catch {}
            }, 180);
        }
    });

    document.addEventListener('focusout', () => {
        setTimeout(() => {
            const active = document.activeElement;
            if (!active || !active.matches?.('input, textarea, [contenteditable="true"]')) {
                document.body.classList.remove('ios-input-focused', 'ios-keyboard-open');
            }
        }, 120);
    });
}

function setupSettingsIntegration(apiSettings) {
    if (typeof document === 'undefined') return;
    const strings = getWelcomeStrings().settings;

    const appearanceList = document.querySelector('#settings-tab-appearance .settings-list');
    if (appearanceList && !document.getElementById('appearance-liquid-glass-item')) {
        const glassItem = document.createElement('div');
        glassItem.id = 'appearance-liquid-glass-item';
        glassItem.className = 'setting-item';
        glassItem.innerHTML = `
            <div class="info">
                <span class="label">${strings.liquidGlassLabel}</span>
                <span class="description">${strings.liquidGlassDesc}</span>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="appearance-liquid-glass-toggle" ${isLiquidGlassEnabled() ? 'checked' : ''} />
                <span class="slider"></span>
            </label>
        `;
        const themeItem = document.getElementById('theme-picker')?.closest('.setting-item');
        if (themeItem && themeItem.parentElement === appearanceList) {
            themeItem.insertAdjacentElement('afterend', glassItem);
        } else {
            appearanceList.prepend(glassItem);
        }
        glassItem.querySelector('#appearance-liquid-glass-toggle')?.addEventListener('change', (e) => {
            triggerNativeHaptic('selection');
            setLiquidGlassEnabled(!!e.target.checked, true);
        });
    }

    const systemList = document.querySelector('#settings-tab-system .settings-list');
    if (!systemList || document.getElementById('ios-adaptation-settings-group')) return;

    const langOptionsHtml = SUPPORTED_LANGUAGES.map(
        (l) => `<option value="${l.code}" ${getPreferredLanguage() === l.code ? 'selected' : ''}>${l.label}</option>`
    ).join('');

    const group = document.createElement('div');
    group.id = 'ios-adaptation-settings-group';
    group.className = 'settings-group';
    group.innerHTML = `
        <h3 class="settings-group-title">${strings.sectionTitle}</h3>
        <div class="setting-item">
            <div class="info">
                <span class="label">Язык интерфейса / Language</span>
                <span class="description">Язык меню, системного окна и вкладок</span>
            </div>
            <select id="ios-language-select">${langOptionsHtml}</select>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">Сборка .ipa через GitHub</span>
                <span class="description">Запуск облачной сборки FlacLess (.ipa) по ключу репозитория GitHub</span>
            </div>
            <button type="button" id="ios-open-gh-builder-btn" class="btn-primary">Собрать .ipa</button>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.liquidGlassLabel}</span>
                <span class="description">${strings.liquidGlassDesc}</span>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="ios-liquid-glass-toggle" ${isLiquidGlassEnabled() ? 'checked' : ''} />
                <span class="slider"></span>
            </label>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.perfLabel}</span>
                <span class="description">${strings.perfDesc}</span>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="ios-reduced-blur-toggle" ${isFpsCap30Enabled() ? 'checked' : ''} />
                <span class="slider"></span>
            </label>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.nativeAudioLabel}</span>
                <span class="description">${strings.nativeAudioDesc}</span>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="ios-native-audio-toggle" ${isNativeAudioEnabled() ? 'checked' : ''} />
                <span class="slider"></span>
            </label>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.healthLabel}</span>
                <span class="description" id="ios-health-status-desc">${strings.healthDesc}</span>
            </div>
            <button type="button" id="ios-run-health-btn" class="btn-secondary">${strings.healthBtn}</button>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.welcomeLabel}</span>
                <span class="description">${strings.welcomeDesc}</span>
            </div>
            <button type="button" id="ios-replay-welcome-btn" class="btn-secondary">${strings.welcomeBtn}</button>
        </div>
        <div class="setting-item">
            <div class="info">
                <span class="label">${strings.downloadsLabel}</span>
                <span class="description">${strings.downloadsDesc}</span>
            </div>
        </div>
    `;

    systemList.prepend(group);

    group.querySelector('#ios-language-select')?.addEventListener('change', (e) => {
        triggerNativeHaptic('selection');
        setPreferredLanguage(e.target.value);
    });

    group.querySelector('#ios-replay-welcome-btn')?.addEventListener('click', () => {
        triggerNativeHaptic('light');
        showMonochromeWelcomeModal(true);
    });

    group.querySelector('#ios-liquid-glass-toggle')?.addEventListener('change', (e) => {
        triggerNativeHaptic('selection');
        setLiquidGlassEnabled(!!e.target.checked, true);
    });

    group.querySelector('#ios-reduced-blur-toggle')?.addEventListener('change', (e) => {
        triggerNativeHaptic('selection');
        setFpsCap30Enabled(!!e.target.checked);
    });

    group.querySelector('#ios-native-audio-toggle')?.addEventListener('change', async (e) => {
        triggerNativeHaptic('selection');
        const enabled = !!e.target.checked;
        try {
            localStorage.setItem(PREF_NATIVE_AUDIO, enabled ? '1' : '0');
            localStorage.setItem(LEGACY_PREF_NATIVE_AUDIO, enabled ? '1' : '0');
        } catch {}
        if (!enabled && isNativeAudioActive()) {
            await stopNativeAvPlayer();
        }
    });

    group.querySelector('#ios-run-health-btn')?.addEventListener('click', async () => {
        const desc = document.getElementById('ios-health-status-desc');
        if (desc) desc.textContent = strings.healthChecking || 'Проверка серверов...';
        triggerNativeHaptic('light');
        const res = await runFastInstanceHealthCheck(apiSettings);
        if (desc && res) {
            const top = res.api?.[0];
            desc.textContent = `Доступно: ${res.healthyCount}/${res.totalCount}${top?.healthy ? ` · Быстрый: ${new URL(top.url).host} (${top.latencyMs} мс)` : ''}`;
        }
    });
}

function bindNativePlayerSync(player, apiSettings) {
    if (!player) return;

    document.getElementById('play-pause-btn')?.addEventListener('click', () => triggerNativeHaptic('medium'));
    document.getElementById('fs-play-pause-btn')?.addEventListener('click', () => triggerNativeHaptic('medium'));
    document.getElementById('now-playing-like-btn')?.addEventListener('click', () => triggerNativeHaptic('success'));
    document.getElementById('fs-like-btn')?.addEventListener('click', () => triggerNativeHaptic('success'));

    const audioEl = player.activeElement || document.getElementById('audio-player');
    if (audioEl && !audioEl.dataset.iosSyncBound) {
        audioEl.dataset.iosSyncBound = '1';

        const pushNowPlaying = () => {
            if (!isNativeIosCapacitor()) return;
            const track = player.currentTrack;
            if (!track) return;
            const coverEl = document.querySelector('.now-playing-bar .cover');
            const artworkUrl = coverEl?.src && !coverEl.src.startsWith('data:') ? coverEl.src : '';
            syncNativeNowPlaying({
                track,
                isPlaying: !audioEl.paused,
                currentTime: audioEl.currentTime || 0,
                duration: audioEl.duration || track.duration || 0,
                artworkUrl,
            });
        };

        audioEl.addEventListener('play', pushNowPlaying);
        audioEl.addEventListener('pause', pushNowPlaying);
        audioEl.addEventListener('loadedmetadata', pushNowPlaying);
        audioEl.addEventListener('seeked', pushNowPlaying);
        audioEl.addEventListener('error', () => {
            void runFastInstanceHealthCheck(apiSettings);
        });
    }

    void (async () => {
        const { plugin } = await ensureCapacitorModules();
        if (!plugin || typeof plugin.addListener !== 'function') return;

        await plugin.addListener('remoteCommand', async (ev) => {
            const cmd = ev?.command;
            if (cmd === 'play') {
                if (_nativeEngineActive) {
                    _nativeEnginePlaying = true;
                    updateNativeUiPlaybackIcons(true);
                    plugin.play().catch(() => {});
                } else {
                    try {
                        const { audioContextManager } = await import('./audio-context.js');
                        await audioContextManager.ensureInitializedAndResume(player.activeElement);
                    } catch {}
                    player.activeElement?.play?.().catch(() => {});
                }
            } else if (cmd === 'pause') {
                if (_nativeEngineActive) {
                    _nativeEnginePlaying = false;
                    updateNativeUiPlaybackIcons(false);
                    plugin.pause().catch(() => {});
                } else {
                    player.activeElement?.pause?.();
                }
            } else if (cmd === 'next') {
                player.playNext?.();
            } else if (cmd === 'previous') {
                player.playPrev?.();
            } else if (cmd === 'seek' && typeof ev.position === 'number') {
                if (_nativeEngineActive) {
                    _lastKnownTime = ev.position;
                    updateNativeUiProgress(_lastKnownTime, _lastKnownDuration);
                    plugin.seek({ position: ev.position }).catch(() => {});
                } else if (player.activeElement) {
                    player.activeElement.currentTime = ev.position;
                }
            }
        });

        await plugin.addListener('nativeAudioState', (ev) => {
            if (!_nativeEngineActive) return;
            if (typeof ev?.currentTime === 'number') _lastKnownTime = ev.currentTime;
            if (typeof ev?.duration === 'number') _lastKnownDuration = ev.duration;
            if (ev?.event === 'ready') {
                _nativeEnginePlaying = true;
                updateNativeUiPlaybackIcons(true);
                updateNativeUiProgress(_lastKnownTime, _lastKnownDuration);
            } else if (ev?.event === 'timeupdate') {
                updateNativeUiProgress(_lastKnownTime, _lastKnownDuration);
            } else if (ev?.event === 'ended') {
                _nativeEngineActive = false;
                _nativeEnginePlaying = false;
                player.playNext?.();
            } else if (ev?.event === 'error') {
                _nativeEngineActive = false;
                _nativeEnginePlaying = false;
                void runFastInstanceHealthCheck(apiSettings);
            }
        });
    })();
}

export async function initIosAdaptation({ player, apiSettings, navigate } = {}) {
    if (_initialized) return;
    _initialized = true;

    const { plugin } = await ensureCapacitorModules();
    if (plugin && typeof plugin.getSystemCapabilities === 'function') {
        try {
            _systemCapabilities = await plugin.getSystemCapabilities();
        } catch {}
    }

    if (typeof document !== 'undefined') {
        document.documentElement.classList.add('ios-adapted');
        if (isNativeIosCapacitor()) {
            document.documentElement.classList.add('ios-capacitor-native');
        }
        setLiquidGlassEnabled(isLiquidGlassEnabled(), false);
        setFpsCap30Enabled(isFpsCap30Enabled());
    }

    setupExternalLinkInterceptor();
    setupKeyboardHandling();
    setupMobileBottomTabBar(navigate);
    setupSettingsIntegration(apiSettings);
    initGitHubBuilder();
    applyLanguagePack();
    attachIosTouchGestures({
        player,
        hapticFeedback: (style) => void triggerNativeHaptic(style),
    });
    bindNativePlayerSync(player, apiSettings);

    setTimeout(() => {
        showMonochromeWelcomeModal(false);
    }, 220);

    if (apiSettings) {
        void runFastInstanceHealthCheck(apiSettings);
    }
}

export function getLastNativePlaybackPosition() {
    return { currentTime: _lastKnownTime, duration: _lastKnownDuration };
}
