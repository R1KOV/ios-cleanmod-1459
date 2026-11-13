// js/ios-instances.js
// Fast automatic health-check and failover for Monochrome API & streaming instances

export const FALLBACK_API_INSTANCES = [
    'https://tracks.monochrome.st',
    'https://eu-central.monochrome.tf',
    'https://us-west.monochrome.tf',
    'https://arran.monochrome.tf',
    'https://api.monochrome.tf',
    'https://wolf.qqdl.site',
    'https://maus.qqdl.site',
    'https://vogel.qqdl.site',
    'https://hund.qqdl.site',
    'https://tidal.kinoplus.online',
];

export const FALLBACK_STREAMING_INSTANCES = [
    'https://tracks.monochrome.st',
    'https://arran.monochrome.tf',
    'https://wolf.qqdl.site',
    'https://maus.qqdl.site',
    'https://vogel.qqdl.site',
    'https://katze.qqdl.site',
    'https://hund.qqdl.site',
    'https://hifi.p1nkhamster.xyz',
];

export function normalizeInstanceUrl(item) {
    const raw = typeof item === 'string' ? item : item?.url;
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim().replace(/\/+$/, '');
}

export function mergeUniqueInstances(listA = [], listB = []) {
    const seen = new Set();
    const out = [];
    for (const item of [...listA, ...listB]) {
        const url = normalizeInstanceUrl(item);
        if (!url || /\.squid\.wtf/i.test(url) || seen.has(url)) continue;
        seen.add(url);
        out.push(typeof item === 'object' && item !== null ? { ...item, url } : { url, version: '2.10' });
    }
    return out;
}

export function sortInstancesByHealth(probes = []) {
    return [...probes]
        .sort((a, b) => {
            if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
            const latA = Number.isFinite(a.latencyMs) ? a.latencyMs : Number.MAX_SAFE_INTEGER;
            const latB = Number.isFinite(b.latencyMs) ? b.latencyMs : Number.MAX_SAFE_INTEGER;
            if (latA !== latB) return latA - latB;
            return (a.index ?? 0) - (b.index ?? 0);
        })
        .map((p) => ({
            ...(typeof p.item === 'object' && p.item !== null ? p.item : { url: p.url, version: '2.10' }),
            url: p.url,
            healthy: p.healthy,
            latencyMs: p.latencyMs,
        }));
}

export async function probeInstance(url, fetchImpl = fetch, timeoutMs = 2400) {
    const cleanUrl = normalizeInstanceUrl(url);
    if (!cleanUrl) return { url: '', healthy: false, latencyMs: Infinity };

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const res = await fetchImpl(`${cleanUrl}/`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller?.signal,
        });
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
        // Any non-5xx response (200, 204, 404, 400) means the instance edge is reachable & alive
        const healthy = res.status > 0 && res.status < 500;
        return { url: cleanUrl, healthy, latencyMs: Math.round(elapsed) };
    } catch {
        return { url: cleanUrl, healthy: false, latencyMs: Infinity };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function runFastInstanceHealthCheck(apiSettings, options = {}) {
    const {
        timeoutMs = 2400,
        fetchImpl = typeof fetch === 'function' ? fetch.bind(window) : null,
        forceAll = false,
    } = options;
    if (!apiSettings || !fetchImpl) return null;

    // Ensure bundled instances.json is registered in INSTANCES_URLS
    if (Array.isArray(apiSettings.INSTANCES_URLS)) {
        if (!apiSettings.INSTANCES_URLS.includes('./instances.json')) {
            apiSettings.INSTANCES_URLS.unshift('./instances.json');
        }
    }

    let loaded = { api: [], streaming: [] };
    try {
        loaded = await apiSettings.loadInstancesFromGitHub();
    } catch {}

    const apiCandidates = mergeUniqueInstances(loaded?.api || [], FALLBACK_API_INSTANCES);
    const streamingCandidates = mergeUniqueInstances(loaded?.streaming || [], FALLBACK_STREAMING_INSTANCES);

    const isNativeCapacitor =
        typeof window !== 'undefined' &&
        !!(window.Capacitor && window.Capacitor.isNativePlatform?.());

    // In standard web browsers, avoid spamming dead/CORS-blocked community mirrors on boot;
    // on native iOS (CapacitorHttp enabled), probe all candidates natively without CORS issues.
    const probePool =
        isNativeCapacitor || forceAll
            ? mergeUniqueInstances(apiCandidates, streamingCandidates)
            : [{ url: 'https://tracks.monochrome.st', version: '2.10' }];

    const probeResults = await Promise.all(
        probePool.map(async (item, index) => {
            const result = await probeInstance(item.url, fetchImpl, timeoutMs);
            return { ...result, item, index };
        })
    );

    const byUrl = new Map(probeResults.map((r) => [r.url, r]));
    const rankedApi = sortInstancesByHealth(
        apiCandidates.map((item, index) => ({
            ...(byUrl.get(item.url) || { url: item.url, healthy: false, latencyMs: Infinity }),
            item,
            index,
        }))
    );
    const rankedStreaming = sortInstancesByHealth(
        streamingCandidates.map((item, index) => ({
            ...(byUrl.get(item.url) || { url: item.url, healthy: false, latencyMs: Infinity }),
            item,
            index,
        }))
    );

    apiSettings.defaultInstances = {
        api: rankedApi,
        streaming: rankedStreaming,
    };
    apiSettings.instancesLoaded = true;

    try {
        localStorage.setItem(
            apiSettings.STORAGE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                data: apiSettings.defaultInstances,
            })
        );
    } catch {}

    return {
        api: rankedApi,
        streaming: rankedStreaming,
        healthyCount: probeResults.filter((r) => r.healthy).length,
        totalCount: probeResults.length,
    };
}
