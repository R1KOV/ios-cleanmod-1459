// js/ios-gestures.js
// Touch gesture math and iOS ergonomics bindings (swipe down to close Now Playing, horizontal swipe for track skip)

export function evaluateSwipeDismiss({ deltaY, deltaX, durationMs }) {
    const absY = Math.abs(deltaY);
    const absX = Math.abs(deltaX);
    if (deltaY <= 0) return false;
    if (absY <= absX * 1.15) return false;
    const velocity = durationMs > 0 ? deltaY / durationMs : 0;
    return deltaY >= 72 || (deltaY >= 38 && velocity >= 0.45);
}

export function evaluateHorizontalTrackSwipe({ deltaX, deltaY, durationMs }) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX < 52) return null;
    if (absX <= absY * 1.35) return null;
    const velocity = durationMs > 0 ? absX / durationMs : 0;
    if (absX >= 64 || velocity >= 0.35) {
        return deltaX < 0 ? 'next' : 'prev';
    }
    return null;
}

export function attachIosTouchGestures({ player, hapticFeedback }) {
    if (typeof document === 'undefined') return;

    const fullscreenOverlay = document.getElementById('fullscreen-cover-overlay');
    const coverWrapper = document.querySelector('#fullscreen-cover-overlay .fullscreen-cover-wrapper');
    const miniPlayerTrack = document.querySelector('.now-playing-bar .track-info');
    const closeBtn = document.getElementById('close-fullscreen-btn');

    // 1. Swipe down to close Fullscreen Now Playing overlay
    if (fullscreenOverlay && !fullscreenOverlay.dataset.iosSwipeBound) {
        fullscreenOverlay.dataset.iosSwipeBound = '1';
        let startY = 0;
        let startX = 0;
        let startTime = 0;
        let dragging = false;

        fullscreenOverlay.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length !== 1) return;
                // Do not steal touch from progress sliders, lyrics scroll, or buttons
                const target = e.target;
                if (
                    target?.closest?.('.progress-bar, input, button, .fullscreen-lyrics-container, .lyrics-panel')
                ) {
                    dragging = false;
                    return;
                }
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
                startTime = Date.now();
                dragging = true;
                fullscreenOverlay.style.transition = 'none';
            },
            { passive: true }
        );

        fullscreenOverlay.addEventListener(
            'touchmove',
            (e) => {
                if (!dragging || e.touches.length !== 1) return;
                const dy = e.touches[0].clientY - startY;
                const dx = e.touches[0].clientX - startX;
                if (dy > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) {
                    const clamped = Math.min(dy, 260);
                    fullscreenOverlay.style.transform = `translate3d(0, ${clamped}px, 0)`;
                    fullscreenOverlay.style.opacity = String(Math.max(0.55, 1 - clamped / 420));
                }
            },
            { passive: true }
        );

        const finishDismissGesture = (e) => {
            if (!dragging) return;
            dragging = false;
            const touch = e.changedTouches?.[0];
            fullscreenOverlay.style.transition = 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease';
            if (touch) {
                const dy = touch.clientY - startY;
                const dx = touch.clientX - startX;
                const dt = Date.now() - startTime;
                if (evaluateSwipeDismiss({ deltaY: dy, deltaX: dx, durationMs: dt })) {
                    fullscreenOverlay.style.transform = 'translate3d(0, 100%, 0)';
                    fullscreenOverlay.style.opacity = '0';
                    hapticFeedback?.('light');
                    setTimeout(() => {
                        fullscreenOverlay.style.transform = '';
                        fullscreenOverlay.style.opacity = '';
                        fullscreenOverlay.style.transition = '';
                        if (closeBtn) {
                            closeBtn.click();
                        } else {
                            fullscreenOverlay.style.display = 'none';
                        }
                    }, 180);
                    return;
                }
            }
            fullscreenOverlay.style.transform = '';
            fullscreenOverlay.style.opacity = '';
            setTimeout(() => {
                fullscreenOverlay.style.transition = '';
            }, 250);
        };

        fullscreenOverlay.addEventListener('touchend', finishDismissGesture, { passive: true });
        fullscreenOverlay.addEventListener('touchcancel', finishDismissGesture, { passive: true });
    }

    // 2. Horizontal swipe on cover art or mini-player to skip tracks
    const bindHorizontalSkip = (el) => {
        if (!el || el.dataset.iosTrackSwipeBound) return;
        el.dataset.iosTrackSwipeBound = '1';
        let sx = 0;
        let sy = 0;
        let st = 0;

        el.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length !== 1) return;
                sx = e.touches[0].clientX;
                sy = e.touches[0].clientY;
                st = Date.now();
            },
            { passive: true }
        );

        el.addEventListener(
            'touchend',
            (e) => {
                const touch = e.changedTouches?.[0];
                if (!touch) return;
                const direction = evaluateHorizontalTrackSwipe({
                    deltaX: touch.clientX - sx,
                    deltaY: touch.clientY - sy,
                    durationMs: Date.now() - st,
                });
                if (!direction) return;
                hapticFeedback?.('medium');
                if (direction === 'next') {
                    if (typeof player?.playNext === 'function') {
                        player.playNext();
                    } else {
                        document.getElementById('next-btn')?.click();
                    }
                } else {
                    if (typeof player?.playPrev === 'function') {
                        player.playPrev();
                    } else {
                        document.getElementById('prev-btn')?.click();
                    }
                }
            },
            { passive: true }
        );
    };

    bindHorizontalSkip(coverWrapper);
    bindHorizontalSkip(miniPlayerTrack);
}
