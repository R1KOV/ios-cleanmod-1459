// js/ios-onboarding.js
// Animated first-launch FlacLess welcome & rvkqq attribution overlay with automatic localization

import { WELCOME_STORAGE_KEY, getWelcomeStrings } from './ios-i18n.js';
import { hapticLight, hapticSuccess } from './haptics.js';

let activeOverlay = null;
let closeTimer = null;

const INITIAL_SEARCH = typeof window !== 'undefined' ? window.location.search : '';

function shouldAutoSkipWelcome() {
    if (typeof window === 'undefined') return true;
    try {
        const params = new URLSearchParams(window.location.search || INITIAL_SEARCH);
        const initialParams = new URLSearchParams(INITIAL_SEARCH);
        const getParam = (key) => params.get(key) || initialParams.get(key);
        if (getParam('autostart') === '1' || getParam('skipWelcome') === '1') {
            return true;
        }
        if (getParam('showWelcome') === '1') {
            return false;
        }
        return localStorage.getItem(WELCOME_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function closeMonochromeWelcomeModal(overlay = activeOverlay) {
    if (!overlay || overlay.dataset.closing === '1') return;
    overlay.dataset.closing = '1';

    try {
        localStorage.setItem(WELCOME_STORAGE_KEY, '1');
    } catch {}

    try {
        hapticSuccess();
    } catch {}

    overlay.classList.remove('is-visible');
    overlay.classList.add('is-closing');

    if (closeTimer) clearTimeout(closeTimer);
    const finalize = () => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        if (activeOverlay === overlay) {
            activeOverlay = null;
        }
    };

    overlay.addEventListener('transitionend', finalize, { once: true });
    closeTimer = setTimeout(finalize, 360);
}

export function showMonochromeWelcomeModal(force = false) {
    if (typeof document === 'undefined') return null;
    if (!force && shouldAutoSkipWelcome()) return null;

    if (activeOverlay && activeOverlay.parentNode) {
        return activeOverlay;
    }

    const strings = getWelcomeStrings();
    const overlay = document.createElement('div');
    overlay.id = 'ios-welcome-modal';
    overlay.className = 'ios-welcome-backdrop';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ios-welcome-title');

    const featuresHtml = (strings.features || [])
        .map(
            (feat) =>
                `<li class="ios-welcome-feature"><span class="ios-welcome-feature-mark" aria-hidden="true">◆</span><span>${feat}</span></li>`
        )
        .join('');

    overlay.innerHTML = `
        <div class="ios-welcome-card">
            <div class="ios-welcome-logo-stage">
                <div class="ios-welcome-logo-ring" aria-hidden="true"></div>
                <img
                    src="./assets/512.png"
                    alt="FlacLess"
                    class="ios-welcome-logo-img"
                />
            </div>
            <div class="ios-welcome-kicker">${strings.badge}</div>
            <h2 id="ios-welcome-title" class="ios-welcome-title">${strings.title}</h2>
            <p class="ios-welcome-credit">${strings.message}</p>
            <a
                href="${strings.telegramUrl || 'https://t.me/rvkqq'}"
                target="_blank"
                rel="noopener noreferrer"
                class="ios-welcome-tg-link"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.98 1.26-5.59 3.69-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.89.03-.24.36-.49.99-.75 3.88-1.69 6.47-2.8 7.77-3.35 3.7-1.54 4.47-1.81 4.97-1.82.11 0 .36.03.52.16.13.11.17.26.19.37.02.09.04.33.02.52z"/>
                </svg>
                <span>${strings.telegramLabel || 'Telegram:'} ${strings.telegramHandle || '@rvkqq'}</span>
            </a>
            <ul class="ios-welcome-features">
                ${featuresHtml}
            </ul>
            <button type="button" id="ios-welcome-ack-btn" class="ios-welcome-ack-btn">
                <span>${strings.ackButton}</span>
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Force style recalc before adding is-visible so GPU transition runs cleanly without stalling
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
    try {
        hapticLight();
    } catch {}

    const ackBtn = overlay.querySelector('#ios-welcome-ack-btn');
    if (ackBtn) {
        ackBtn.addEventListener('click', () => closeMonochromeWelcomeModal(overlay));
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeMonochromeWelcomeModal(overlay);
        }
    });

    const onKeyDown = (e) => {
        if (e.key === 'Escape' && activeOverlay === overlay) {
            document.removeEventListener('keydown', onKeyDown);
            closeMonochromeWelcomeModal(overlay);
        }
    };
    document.addEventListener('keydown', onKeyDown);

    return overlay;
}

if (typeof window !== 'undefined') {
    window.showMonochromeWelcomeModal = (force = true) => showMonochromeWelcomeModal(force);
}
