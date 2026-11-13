// js/github-builder.js
// Powerful 1-click GitHub Actions .ipa Cloud Builder:
// - Initializes empty repos automatically
// - Syncs full FlacLess source tree via Git Blob SHA-1 diffing (only missing/changed files uploaded)
// - Guarantees up-to-date .github/workflows/build-ios-ipa.yml
// - Dispatches workflow with automatic retry, polls live macOS build steps, and downloads .ipa

import { showNotification } from './downloads.js';
import {
    WORKFLOW_PATH,
    SOURCE_BUNDLE_URL,
    BUILD_WORKFLOW_YAML,
    parseGitHubRepoInput,
    encodeEntryToBytes,
    bytesToBase64,
    computeGitBlobSha1,
    decodeSourceBundleBuffer,
    buildOneCommandPushScript,
} from './github-builder-core.js';

export { WORKFLOW_PATH, BUILD_WORKFLOW_YAML, parseGitHubRepoInput, buildOneCommandPushScript };

const REPO_STORAGE_KEY = 'flacless-gh-builder-repo-v1';
const BRANCH_STORAGE_KEY = 'flacless-gh-builder-branch-v1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghFetch(path, token, options = {}, retries = 3) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const res = await fetch(`https://api.github.com${path}`, {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {}),
            },
        });

        const text = await res.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {}

        if (res.ok) return json;

        const msg = json?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = json;
        lastErr = err;

        const isRetryable =
            res.status === 429 ||
            res.status >= 500 ||
            (res.status === 403 && /rate limit|secondary/i.test(msg));
        if (!isRetryable || attempt === retries) {
            throw err;
        }

        const retryAfterSec = Number(res.headers.get('retry-after') || 0);
        const delayMs = retryAfterSec > 0 ? retryAfterSec * 1000 : 1200 * (attempt + 1);
        await sleep(delayMs);
    }
    throw lastErr;
}

function statusBadgeText(status, conclusion) {
    if (status === 'completed') {
        if (conclusion === 'success') return 'Готово — .ipa собран';
        if (conclusion === 'failure') return 'Ошибка сборки (см. шаг и лог)';
        if (conclusion === 'cancelled') return 'Отменено';
        return `Завершено (${conclusion || '—'})`;
    }
    if (status === 'in_progress') return 'Собирается на macOS-раннере...';
    if (status === 'queued' || status === 'waiting') return 'В очереди GitHub Actions...';
    return status || 'Ожидание';
}

async function ensureBranchHead(slug, targetBranch, defaultBranch, token, setStatus) {
    const encodedBranch = encodeURIComponent(targetBranch);
    try {
        const ref = await ghFetch(`/repos/${slug}/git/ref/heads/${encodedBranch}`, token, {}, 1);
        if (ref?.object?.sha) {
            return { branch: targetBranch, headSha: ref.object.sha };
        }
    } catch (e) {
        // 409 = empty repository; 404 = branch or repo empty
        if (e.status !== 404 && e.status !== 409) throw e;
    }

    // Check if repo is completely empty or just missing targetBranch
    let isRepoEmpty = false;
    try {
        await ghFetch(`/repos/${slug}/commits?per_page=1`, token, {}, 1);
    } catch (e) {
        if (e.status === 409 || e.status === 404) {
            isRepoEmpty = true;
        } else {
            throw e;
        }
    }

    if (isRepoEmpty) {
        setStatus('Репозиторий пустой — инициализируем ветку...', 'info');
        const readmeB64 = bytesToBase64(new TextEncoder().encode('# FlacLess iOS\n\nAuto-initialized for FlacLess iOS .ipa cloud build.\n'));
        await ghFetch(`/repos/${slug}/contents/README.md`, token, {
            method: 'PUT',
            body: JSON.stringify({
                message: 'Initialize repository for FlacLess iOS build',
                content: readmeB64,
                branch: targetBranch,
            }),
        });
        await sleep(800);
        const ref = await ghFetch(`/repos/${slug}/git/ref/heads/${encodedBranch}`, token);
        return { branch: targetBranch, headSha: ref.object.sha };
    }

    // Repo has commits, create targetBranch from defaultBranch if missing
    const fallbackBranch = defaultBranch || 'main';
    const defRef = await ghFetch(`/repos/${slug}/git/ref/heads/${encodeURIComponent(fallbackBranch)}`, token);
    if (targetBranch !== fallbackBranch) {
        await ghFetch(`/repos/${slug}/git/refs`, token, {
            method: 'POST',
            body: JSON.stringify({
                ref: `refs/heads/${targetBranch}`,
                sha: defRef.object.sha,
            }),
        });
    }
    return { branch: targetBranch, headSha: defRef.object.sha };
}

async function syncProjectFilesToGitHub({
    slug,
    branch,
    headSha,
    token,
    syncFullSources,
    setStatus,
    setProgress,
}) {
    setStatus('Проверка структуры ветки на GitHub...', 'info');
    setProgress(8);

    const headCommit = await ghFetch(`/repos/${slug}/git/commits/${headSha}`, token);
    const baseTreeSha = headCommit?.tree?.sha;
    const remoteBlobMap = new Map();

    if (baseTreeSha) {
        const treeRes = await ghFetch(`/repos/${slug}/git/trees/${baseTreeSha}?recursive=1`, token);
        if (Array.isArray(treeRes?.tree)) {
            for (const node of treeRes.tree) {
                if (node.type === 'blob' && node.path && node.sha) {
                    remoteBlobMap.set(node.path, node.sha);
                }
            }
        }
    }

    const needsFullSync = syncFullSources || !remoteBlobMap.has('package.json') || !remoteBlobMap.has('ios/App/App.xcodeproj/project.pbxproj');
    const desiredEntries = [];

    if (needsFullSync) {
        setStatus('Загрузка архива исходников FlacLess...', 'info');
        setProgress(16);
        const bundleRes = await fetch(`${SOURCE_BUNDLE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!bundleRes.ok) {
            throw new Error(`Не удалось загрузить пакет исходников (${bundleRes.status}).`);
        }
        const rawBuf = await bundleRes.arrayBuffer();
        const bundle = await decodeSourceBundleBuffer(rawBuf);
        for (const f of bundle.files) {
            if (!f?.path || f.path === WORKFLOW_PATH) continue;
            desiredEntries.push({
                path: f.path,
                bytes: encodeEntryToBytes(f),
            });
        }
    }

    // Always enforce the exact up-to-date workflow file
    desiredEntries.push({
        path: WORKFLOW_PATH,
        bytes: new TextEncoder().encode(BUILD_WORKFLOW_YAML),
    });

    setStatus(`Сравнение ${desiredEntries.length} файлов с репозиторием...`, 'info');
    setProgress(24);

    const toUpload = [];
    const treeItems = [];

    for (const entry of desiredEntries) {
        const localSha = await computeGitBlobSha1(entry.bytes);
        const remoteSha = remoteBlobMap.get(entry.path);
        const mode = entry.path.endsWith('.sh') ? '100755' : '100644';
        if (remoteSha === localSha) {
            treeItems.push({ path: entry.path, mode, type: 'blob', sha: remoteSha });
        } else {
            toUpload.push({ ...entry, mode });
        }
    }

    if (toUpload.length === 0) {
        setProgress(88);
        setStatus('Репозиторий уже актуален — пропускаем загрузку файлов.', 'info');
        return { committed: false, uploadedCount: 0 };
    }

    // Upload changed/missing blobs in throttled parallel batches
    const CONCURRENCY = 8;
    let completed = 0;

    for (let i = 0; i < toUpload.length; i += CONCURRENCY) {
        const batch = toUpload.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map(async (item) => {
                const res = await ghFetch(`/repos/${slug}/git/blobs`, token, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: bytesToBase64(item.bytes),
                        encoding: 'base64',
                    }),
                });
                completed += 1;
                const pct = 25 + Math.round((completed / toUpload.length) * 60);
                setProgress(pct);
                setStatus(`Загрузка исходников в ${slug}: ${completed} / ${toUpload.length}...`, 'info');
                return { path: item.path, mode: item.mode, type: 'blob', sha: res.sha };
            })
        );
        treeItems.push(...results);
    }

    setStatus('Создание атомарного коммита в GitHub...', 'info');
    setProgress(90);

    const newTree = await ghFetch(`/repos/${slug}/git/trees`, token, {
        method: 'POST',
        body: JSON.stringify({
            ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
            tree: treeItems,
        }),
    });

    const newCommit = await ghFetch(`/repos/${slug}/git/commits`, token, {
        method: 'POST',
        body: JSON.stringify({
            message: `FlacLess iOS build sync (${toUpload.length} files)`,
            tree: newTree.sha,
            parents: [headSha],
        }),
    });

    await ghFetch(`/repos/${slug}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
            sha: newCommit.sha,
            force: false,
        }),
    });

    setProgress(96);
    return { committed: true, uploadedCount: toUpload.length };
}

async function dispatchWorkflowWithRetry(slug, branch, appVersion, createRelease, token) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            await ghFetch(
                `/repos/${slug}/actions/workflows/build-ios-ipa.yml/dispatches`,
                token,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        ref: branch,
                        inputs: {
                            app_version: appVersion,
                            create_release: createRelease,
                        },
                    }),
                },
                0
            );
            return;
        } catch (err) {
            const transientNotIndexed = err.status === 404 || err.status === 422;
            if (!transientNotIndexed || attempt === 4) {
                throw err;
            }
            await sleep(1500 + attempt * 1000);
        }
    }
}

export function initGitHubBuilder() {
    const modal = document.getElementById('github-build-modal');
    if (!modal || modal.dataset.initialized === '1') return;
    modal.dataset.initialized = '1';

    const repoInput = document.getElementById('gh-repo-input');
    const tokenInput = document.getElementById('gh-token-input');
    const branchInput = document.getElementById('gh-branch-input');
    const versionInput = document.getElementById('gh-version-input');
    const syncSourcesToggle = document.getElementById('gh-sync-sources-toggle');
    const releaseToggle = document.getElementById('gh-create-release-toggle');
    const startBtn = document.getElementById('gh-start-build-btn');
    const checkBtn = document.getElementById('gh-check-runs-btn');
    const statusBox = document.getElementById('gh-build-status-box');
    const statusText = document.getElementById('gh-build-status-text');
    const progressWrap = document.getElementById('gh-build-progress-wrap');
    const progressBar = document.getElementById('gh-build-progress-bar');
    const runLink = document.getElementById('gh-run-url-link');
    const downloadArtifactBtn = document.getElementById('gh-download-artifact-btn');
    const releaseLink = document.getElementById('gh-release-url-link');
    const oneLinerEl = document.getElementById('gh-oneliner-code');
    const copyOneLinerBtn = document.getElementById('gh-copy-oneliner-btn');
    const downloadYmlBtn = document.getElementById('gh-download-yml-btn');

    let pollTimer = null;
    let activeArtifact = null;
    let activeSessionToken = '';

    try {
        const savedRepo = localStorage.getItem(REPO_STORAGE_KEY);
        const savedBranch = localStorage.getItem(BRANCH_STORAGE_KEY);
        if (savedRepo && repoInput && !repoInput.value) repoInput.value = savedRepo;
        if (savedBranch && branchInput) branchInput.value = savedBranch;
    } catch {}

    const refreshOneLiner = () => {
        if (!oneLinerEl) return;
        oneLinerEl.textContent = buildOneCommandPushScript(
            repoInput?.value || '',
            branchInput?.value || 'main',
            tokenInput?.value || ''
        );
    };

    repoInput?.addEventListener('input', refreshOneLiner);
    branchInput?.addEventListener('input', refreshOneLiner);
    tokenInput?.addEventListener('input', refreshOneLiner);
    refreshOneLiner();

    const setStatus = (msg, type = 'info') => {
        if (!statusBox || !statusText) return;
        statusBox.style.display = 'block';
        statusBox.dataset.state = type;
        statusText.textContent = msg;
    };

    const setProgress = (percent) => {
        if (!progressWrap || !progressBar) return;
        if (percent === null || percent === undefined) {
            progressWrap.style.display = 'none';
            progressBar.style.width = '0%';
            return;
        }
        const clamped = Math.max(0, Math.min(100, Math.round(percent)));
        progressWrap.style.display = 'block';
        progressBar.style.width = `${clamped}%`;
    };

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    const closeModal = () => {
        modal.classList.remove('active');
    };

    modal.querySelectorAll('.close-modal-btn, #gh-close-modal-btn').forEach((btn) => {
        btn.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const inspectLatestRun = async (slug, token) => {
        const runsData = await ghFetch(
            `/repos/${slug}/actions/workflows/build-ios-ipa.yml/runs?per_page=5`,
            token
        );
        const latest = runsData?.workflow_runs?.[0];
        if (!latest) {
            setStatus('Workflow найден, ожидание запуска...', 'info');
            return null;
        }

        if (runLink && latest.html_url) {
            runLink.href = latest.html_url;
            runLink.style.display = 'inline-flex';
        }

        let stepHint = '';
        let stepPct = null;
        try {
            const jobsData = await ghFetch(`/repos/${slug}/actions/runs/${latest.id}/jobs`, token);
            const job = jobsData?.jobs?.[0];
            if (job && Array.isArray(job.steps) && job.steps.length > 0) {
                const total = job.steps.length;
                const activeStep = job.steps.find((s) => s.status === 'in_progress');
                const failedStep = job.steps.find((s) => s.conclusion === 'failure');
                const doneCount = job.steps.filter((s) => s.status === 'completed').length;
                stepPct = latest.status === 'completed' ? 100 : Math.max(8, Math.round((doneCount / total) * 100));
                if (failedStep) {
                    stepHint = ` · Сбой на шаге «${failedStep.name}»`;
                } else if (activeStep) {
                    stepHint = ` · Шаг ${activeStep.number}/${total}: ${activeStep.name}`;
                }
            }
        } catch {}

        const badge = statusBadgeText(latest.status, latest.conclusion);
        setProgress(stepPct);
        setStatus(
            `Запуск #${latest.run_number}: ${badge}${stepHint}`,
            latest.conclusion === 'failure' ? 'error' : latest.conclusion === 'success' ? 'success' : 'info'
        );

        if (latest.status === 'completed') {
            stopPolling();
            if (latest.conclusion === 'success') {
                setProgress(100);
                const arts = await ghFetch(`/repos/${slug}/actions/runs/${latest.id}/artifacts`, token);
                const ipaArtifact =
                    arts?.artifacts?.find((a) => a.name.includes('FlacLess')) || arts?.artifacts?.[0];
                if (ipaArtifact && downloadArtifactBtn) {
                    activeArtifact = ipaArtifact;
                    activeSessionToken = token;
                    downloadArtifactBtn.style.display = 'inline-flex';
                }
                try {
                    const releases = await ghFetch(`/repos/${slug}/releases?per_page=3`, token);
                    const rel = releases?.[0];
                    if (rel?.html_url && releaseLink) {
                        releaseLink.href = rel.html_url;
                        releaseLink.style.display = 'inline-flex';
                    }
                } catch {}
            }
        }
        return latest;
    };

    startBtn?.addEventListener('click', async () => {
        const parsed = parseGitHubRepoInput(repoInput?.value || '');
        const token = (tokenInput?.value || '').trim();
        const branchInputVal = (branchInput?.value || '').trim();
        const appVersion = (versionInput?.value || '2.5.1').trim() || '2.5.1';
        const syncFullSources = syncSourcesToggle ? !!syncSourcesToggle.checked : true;
        const createRelease = releaseToggle?.checked ? 'true' : 'false';

        if (!parsed) {
            setProgress(null);
            setStatus('Укажите репозиторий в формате owner/repo или ссылку GitHub.', 'error');
            return;
        }
        if (!token) {
            setProgress(null);
            setStatus('Вставьте GitHub Token (PAT с правами repo и workflow).', 'error');
            return;
        }

        try {
            localStorage.setItem(REPO_STORAGE_KEY, parsed.slug);
            if (branchInputVal) localStorage.setItem(BRANCH_STORAGE_KEY, branchInputVal);
        } catch {}

        startBtn.disabled = true;
        if (downloadArtifactBtn) downloadArtifactBtn.style.display = 'none';
        if (runLink) runLink.style.display = 'none';
        if (releaseLink) releaseLink.style.display = 'none';
        stopPolling();

        try {
            setProgress(4);
            setStatus('Проверка репозитория и прав токена...', 'info');
            const repoInfo = await ghFetch(`/repos/${parsed.slug}`, token);
            if (repoInfo?.permissions && repoInfo.permissions.push === false) {
                throw new Error('У токена нет прав на запись в этот репозиторий (нужен scope: repo).');
            }

            const desiredBranch = branchInputVal || repoInfo.default_branch || 'main';
            const { branch: targetBranch, headSha } = await ensureBranchHead(
                parsed.slug,
                desiredBranch,
                repoInfo.default_branch,
                token,
                setStatus
            );
            if (branchInput) branchInput.value = targetBranch;

            await syncProjectFilesToGitHub({
                slug: parsed.slug,
                branch: targetBranch,
                headSha,
                token,
                syncFullSources,
                setStatus,
                setProgress,
            });

            setStatus('Запуск облачной сборки .ipa на macOS...', 'info');
            setProgress(100);
            await dispatchWorkflowWithRetry(parsed.slug, targetBranch, appVersion, createRelease, token);

            setStatus('Сборка запущена! Подключаемся к логу GitHub Actions...', 'info');
            setProgress(5);
            await sleep(2200);
            await inspectLatestRun(parsed.slug, token);

            pollTimer = setInterval(() => {
                inspectLatestRun(parsed.slug, token).catch(() => {});
            }, 4500);
        } catch (err) {
            setProgress(null);
            const detail =
                err.status === 401
                    ? 'Неверный GitHub токен (401).'
                    : err.status === 403
                      ? `Недостаточно прав токена (нужны scopes: repo и workflow): ${err.message}`
                      : err.message;
            setStatus(`Ошибка: ${detail}`, 'error');
        } finally {
            startBtn.disabled = false;
        }
    });

    checkBtn?.addEventListener('click', async () => {
        const parsed = parseGitHubRepoInput(repoInput?.value || '');
        const token = (tokenInput?.value || '').trim();
        if (!parsed || !token) {
            setStatus('Введите репозиторий и GitHub токен для проверки статуса.', 'error');
            return;
        }
        try {
            await inspectLatestRun(parsed.slug, token);
        } catch (err) {
            setStatus(`Ошибка проверки: ${err.message}`, 'error');
        }
    });

    downloadArtifactBtn?.addEventListener('click', async () => {
        if (!activeArtifact?.archive_download_url || !activeSessionToken) return;
        downloadArtifactBtn.disabled = true;
        try {
            const res = await fetch(activeArtifact.archive_download_url, {
                headers: { Authorization: `Bearer ${activeSessionToken}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${activeArtifact.name || 'FlacLess-iOS-unsigned'}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            showNotification('Архив с FlacLess-iOS-unsigned.ipa скачан');
        } catch (err) {
            setStatus(`Не удалось скачать артефакт: ${err.message}`, 'error');
        } finally {
            downloadArtifactBtn.disabled = false;
        }
    });

    copyOneLinerBtn?.addEventListener('click', async () => {
        const text = oneLinerEl?.textContent || '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showNotification('Команда скопирована в буфер обмена');
        } catch {
            showNotification('Скопируйте команду вручную');
        }
    });

    downloadYmlBtn?.addEventListener('click', () => {
        const blob = new Blob([BUILD_WORKFLOW_YAML], { type: 'text/yaml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'build-ios-ipa.yml';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
}

export function openGitHubBuildModal() {
    initGitHubBuilder();
    const modal = document.getElementById('github-build-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

if (typeof document !== 'undefined' && !window.__flaclessGhBuilderBound) {
    window.__flaclessGhBuilderBound = true;
    document.addEventListener('click', (e) => {
        const trigger = e.target?.closest?.(
            '#sidebar-github-build-btn, #mobile-open-github-builder-btn, #about-open-gh-builder-btn, #ios-open-gh-builder-btn'
        );
        if (trigger) {
            openGitHubBuildModal();
        }
    });
}
