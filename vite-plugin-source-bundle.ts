import fs from 'fs/promises';
import path from 'path';
import { gzipSync, constants as zlibConstants } from 'zlib';
import type { Plugin, ResolvedConfig } from 'vite';

export const SOURCE_BUNDLE_FILENAME = 'flacless-source-bundle.bin';

const ROOT_FILES = [
    '.gitignore',
    'IOS_BUILD_AND_INSTALL.md',
    'README.md',
    'capacitor.config.ts',
    'index.html',
    'license',
    'metadata.json',
    'package.json',
    'styles-ios.css',
    'styles.css',
    'tsconfig.json',
    'vite-plugin-auth-gate.js',
    'vite-plugin-blob.ts',
    'vite-plugin-source-bundle.ts',
    'vite-plugin-svg-use.ts',
    'vite-plugin-upload.js',
    'vite.config.ts',
];

const INCLUDE_DIRS = ['js', 'public', 'images', 'assets', 'ios', 'scripts', '.github'];

const EXCLUDE_PREFIXES = [
    'node_modules/',
    'dist/',
    'dist-ios/',
    'dev-dist/',
    '.git/',
    '.playwright-cli/',
    '.aistudio/',
    'ios/App/App/public/',
    'ios/App/DerivedData/',
    'public/assets/aistudio/',
    'js/tests/',
];

const TEXT_EXTENSIONS = new Set([
    '.js',
    '.ts',
    '.mjs',
    '.cjs',
    '.json',
    '.html',
    '.css',
    '.svg',
    '.yml',
    '.yaml',
    '.md',
    '.swift',
    '.plist',
    '.xml',
    '.pbxproj',
    '.sh',
    '.xcconfig',
    '.entitlements',
    '.strings',
    '.storyboard',
    '.txt',
    '.resolved',
]);

const TEXT_BASENAMES = new Set(['license', '.gitignore', 'Podfile']);

function isExcludedRelPath(relPath: string): boolean {
    const norm = relPath.replace(/\\/g, '/');
    const base = path.posix.basename(norm);
    if (base === '.DS_Store' || base === SOURCE_BUNDLE_FILENAME) return true;
    return EXCLUDE_PREFIXES.some((prefix) => norm === prefix.slice(0, -1) || norm.startsWith(prefix));
}

function isTextFile(relPath: string): boolean {
    const base = path.posix.basename(relPath);
    if (TEXT_BASENAMES.has(base)) return true;
    const ext = path.posix.extname(relPath).toLowerCase();
    return TEXT_EXTENSIONS.has(ext);
}

async function walkDirectory(absDir: string, rootDir: string, outFiles: string[]): Promise<void> {
    let entries;
    try {
        entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const absPath = path.join(absDir, entry.name);
        const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');
        if (isExcludedRelPath(relPath)) continue;

        if (entry.isDirectory()) {
            await walkDirectory(absPath, rootDir, outFiles);
        } else if (entry.isFile()) {
            outFiles.push(relPath);
        }
    }
}

export async function buildCompressedSourceBundle(rootDir: string): Promise<Buffer> {
    const relPaths = new Set<string>();

    for (const file of ROOT_FILES) {
        try {
            const st = await fs.stat(path.join(rootDir, file));
            if (st.isFile()) relPaths.add(file);
        } catch {}
    }

    for (const dir of INCLUDE_DIRS) {
        const collected: string[] = [];
        await walkDirectory(path.join(rootDir, dir), rootDir, collected);
        for (const rel of collected) {
            relPaths.add(rel);
        }
    }

    const sortedPaths = Array.from(relPaths).sort();
    const files: Array<{ path: string; encoding: 'utf8' | 'base64'; content: string }> = [];

    for (const rel of sortedPaths) {
        const buf = await fs.readFile(path.join(rootDir, rel));
        if (isTextFile(rel)) {
            files.push({ path: rel, encoding: 'utf8', content: buf.toString('utf8') });
        } else {
            files.push({ path: rel, encoding: 'base64', content: buf.toString('base64') });
        }
    }

    let appVersion = '2.5.1';
    try {
        const pkg = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
        if (pkg?.version) appVersion = String(pkg.version);
    } catch {}

    const payload = JSON.stringify({
        version: appVersion,
        generatedAt: new Date().toISOString(),
        fileCount: files.length,
        files,
    });

    return gzipSync(Buffer.from(payload, 'utf8'), {
        level: zlibConstants.Z_BEST_COMPRESSION,
    });
}

export default function sourceBundlePlugin(): Plugin {
    let resolvedConfig: ResolvedConfig | null = null;
    let cachedBundle: Buffer | null = null;
    let buildingPromise: Promise<Buffer> | null = null;

    const getBundle = async (rootDir: string, forceRefresh = false): Promise<Buffer> => {
        if (cachedBundle && !forceRefresh) return cachedBundle;
        if (buildingPromise && !forceRefresh) return buildingPromise;
        buildingPromise = buildCompressedSourceBundle(rootDir)
            .then((buf) => {
                cachedBundle = buf;
                return buf;
            })
            .finally(() => {
                buildingPromise = null;
            });
        return buildingPromise;
    };

    return {
        name: 'vite-flacless-source-bundle',

        configResolved(config: ResolvedConfig) {
            resolvedConfig = config;
        },

        configureServer(server) {
            const rootDir = resolvedConfig?.root || process.cwd();
            server.middlewares.use((req, res, next) => {
                const reqPath = req.url?.split('?')[0];
                if (reqPath !== `/${SOURCE_BUNDLE_FILENAME}`) return next();

                getBundle(rootDir, true)
                    .then((buf) => {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/octet-stream');
                        res.setHeader('Cache-Control', 'no-store');
                        res.end(buf);
                    })
                    .catch((err) => {
                        res.statusCode = 500;
                        res.end(String(err?.message || 'Failed to build source bundle'));
                    });
            });
        },

        async generateBundle() {
            if (process.env.FLACLESS_SKIP_SOURCE_BUNDLE === '1') {
                return;
            }
            const rootDir = resolvedConfig?.root || process.cwd();
            const buf = await getBundle(rootDir, true);
            this.emitFile({
                type: 'asset',
                fileName: SOURCE_BUNDLE_FILENAME,
                source: buf,
            });
        },
    };
}
