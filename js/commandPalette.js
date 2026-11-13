import { debounce } from './utils.js';
import { db } from './db.js';
import Fuse from 'fuse.js';
import { navigate } from './router.js';
import {
    SVG_SEARCH,
    SVG_HOUSE,
    SVG_LIBRARY,
    SVG_CLOCK,
    SVG_CALENDAR,
    SVG_SETTINGS,
    SVG_INFO,
    SVG_DOWNLOAD,
    SVG_HAND_HEART,
    SVG_PLAY,
    SVG_SKIP_FORWARD,
    SVG_SKIP_BACK,
    SVG_SHUFFLE,
    SVG_REPEAT,
    SVG_MUTE,
    SVG_VOLUME_1,
    SVG_HEART,
    SVG_LIST,
    SVG_TRASH,
    SVG_ALIGN_LEFT,
    SVG_MAXIMIZE,
    SVG_SPARKLES,
    SVG_MONITOR,
    SVG_MOON,
    SVG_SUN,
    SVG_PALETTE,
    SVG_STORE,
    SVG_SLIDERS,
    SVG_PLUS,
    SVG_FOLDER_PLUS,
    SVG_KEYBOARD,
    SVG_UPLOAD,
    SVG_USER,
    SVG_PENCIL,
    SVG_LOG_OUT,
    SVG_LOG_IN,
    SVG_MUSIC,
    SVG_DISC,
    SVG_MIC,
    SVG_RADIO,
} from './icons.js';
import { Player } from './player.js';
import { UIRenderer } from './ui.js';

const ICON_SIZE = 16;

const ICONS = {
    search: SVG_SEARCH,
    house: SVG_HOUSE,
    library: SVG_LIBRARY,
    clock: SVG_CLOCK,
    calendar: SVG_CALENDAR,
    settings: SVG_SETTINGS,
    info: SVG_INFO,
    download: SVG_DOWNLOAD,
    handHeart: SVG_HAND_HEART,
    play: SVG_PLAY,
    skipForward: SVG_SKIP_FORWARD,
    skipBack: SVG_SKIP_BACK,
    shuffle: SVG_SHUFFLE,
    repeat: SVG_REPEAT,
    volumeX: SVG_MUTE,
    volume: SVG_VOLUME_1,
    heart: SVG_HEART,
    list: SVG_LIST,
    trash: SVG_TRASH,
    text: SVG_ALIGN_LEFT,
    maximize: SVG_MAXIMIZE,
    sparkles: SVG_SPARKLES,
    monitor: SVG_MONITOR,
    moon: SVG_MOON,
    sun: SVG_SUN,
    palette: SVG_PALETTE,
    store: SVG_STORE,
    sliders: SVG_SLIDERS,
    plus: SVG_PLUS,
    folderPlus: SVG_FOLDER_PLUS,
    keyboard: SVG_KEYBOARD,
    upload: SVG_UPLOAD,
    user: SVG_USER,
    pencil: SVG_PENCIL,
    logOut: SVG_LOG_OUT,
    logIn: SVG_LOG_IN,
    music: SVG_MUSIC,
    disc: SVG_DISC,
    mic: SVG_MIC,
    radio: SVG_RADIO,
};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

class CommandPalette {
    constructor() {
        this.overlay = document.getElementById('command-palette-overlay');
        this.input = document.getElementById('command-palette-input');
        this.resultsContainer = document.getElementById('command-palette-results');
        this.isOpen = false;
        this.selectedIndex = 0;
        this.flatItems = [];
        this.allSettings = [];
        this.musicSearchAbort = null;
        this.debouncedMusicSearch = debounce(this.searchMusic.bind(this), 300);
        this.commands = this.buildCommands();
        this.fuse = new Fuse(this.commands, {
            keys: [
                { name: 'label', weight: 0.6 },
                { name: 'keywords', weight: 0.3 },
                { name: 'group', weight: 0.1 },
            ],
            threshold: 0.4,
            ignoreLocation: true,
            includeScore: true,
        });

        this.init();
    }

    buildCommands() {
        return [
            {
                id: 'nav-home',
                group: 'Навигация',
                icon: 'house',
                label: 'Перейти на Главную',
                keywords: ['home', 'main', 'start', 'главная', 'домой'],
                action: () => {
                    navigate('/');
                },
            },
            {
                id: 'nav-library',
                group: 'Навигация',
                icon: 'library',
                label: 'Перейти в Медиатеку',
                keywords: ['library', 'collection', 'playlists', 'favorites', 'медиатека', 'избранное'],
                action: () => {
                    navigate('/library');
                },
            },
            {
                id: 'nav-recent',
                group: 'Навигация',
                icon: 'clock',
                label: 'Перейти в Недавнее',
                keywords: ['recent', 'history', 'last played', 'недавнее', 'история'],
                action: () => {
                    navigate('/recent');
                },
            },
            {
                id: 'nav-unreleased',
                group: 'Навигация',
                icon: 'calendar',
                label: 'Перейти в Неизданное',
                keywords: ['unreleased', 'upcoming', 'tracker', 'неизданное', 'трекер'],
                action: () => {
                    navigate('/unreleased');
                },
            },
            {
                id: 'nav-settings',
                group: 'Навигация',
                icon: 'settings',
                label: 'Перейти в Настройки',
                keywords: ['settings', 'preferences', 'config', 'options', 'настройки'],
                shortcut: null,
                action: () => {
                    navigate('/settings');
                },
            },
            {
                id: 'nav-about',
                group: 'Навигация',
                icon: 'info',
                label: 'О приложении FlacLess',
                keywords: ['about', 'version', 'credits', 'о приложении'],
                action: () => {
                    navigate('/about');
                },
            },
            {
                id: 'nav-download',
                group: 'Навигация',
                icon: 'download',
                label: 'Перейти к iOS / Мобильной версии',
                keywords: ['download', 'desktop', 'app', 'mobile', 'ios', 'скачать'],
                action: () => {
                    navigate('/download');
                },
            },

            {
                id: 'play-pause',
                group: 'Воспроизведение',
                icon: 'play',
                label: 'Воспроизведение / Пауза',
                keywords: ['play', 'pause', 'toggle', 'resume', 'stop', 'пауза', 'плей'],
                shortcut: 'Space',
                action: () => {
                    Player.instance.handlePlayPause();
                },
            },
            {
                id: 'play-next',
                group: 'Воспроизведение',
                icon: 'skipForward',
                label: 'Следующий трек',
                keywords: ['next', 'skip', 'forward', 'следующий'],
                shortcut: 'Shift+\u2192',
                action: () => {
                    Player.instance.playNext();
                },
            },
            {
                id: 'play-prev',
                group: 'Воспроизведение',
                icon: 'skipBack',
                label: 'Предыдущий трек',
                keywords: ['previous', 'back', 'rewind', 'предыдущий'],
                shortcut: 'Shift+\u2190',
                action: () => {
                    Player.instance.playPrev();
                },
            },
            {
                id: 'play-shuffle',
                group: 'Воспроизведение',
                icon: 'shuffle',
                label: 'Перемешать',
                keywords: ['shuffle', 'random', 'перемешать'],
                shortcut: 'S',
                action: () => {
                    document.getElementById('shuffle-btn')?.click();
                },
            },
            {
                id: 'play-repeat',
                group: 'Воспроизведение',
                icon: 'repeat',
                label: 'Переключить повтор',
                keywords: ['repeat', 'loop', 'cycle', 'повтор'],
                shortcut: 'R',
                action: () => {
                    document.getElementById('repeat-btn')?.click();
                },
            },
            {
                id: 'play-mute',
                group: 'Воспроизведение',
                icon: 'volumeX',
                label: 'Выключить / Включить звук',
                keywords: ['mute', 'unmute', 'sound', 'volume', 'звук'],
                shortcut: 'M',
                action: () => {
                    const el = Player.instance.activeElement;
                    if (el) el.muted = !el.muted;
                },
            },
            {
                id: 'play-vol-up',
                group: 'Воспроизведение',
                icon: 'volume',
                label: 'Громче',
                keywords: ['volume', 'louder', 'громче'],
                shortcut: '\u2191',
                action: () => {
                    const p = Player.instance;
                    if (p) p.setVolume(p.userVolume + 0.1);
                },
            },
            {
                id: 'play-vol-down',
                group: 'Воспроизведение',
                icon: 'volume',
                label: 'Тише',
                keywords: ['volume', 'quieter', 'тише'],
                shortcut: '\u2193',
                action: () => {
                    const p = Player.instance;
                    if (p) p.setVolume(p.userVolume - 0.1);
                },
            },

            {
                id: 'like-current',
                group: 'Сейчас играет',
                icon: 'heart',
                label: 'Лайкнуть текущий трек',
                keywords: ['like', 'favorite', 'love', 'heart', 'save', 'лайк', 'избранное'],
                action: () => {
                    document.querySelector('.now-playing-bar .like-btn')?.click();
                },
            },
            {
                id: 'download-current',
                group: 'Сейчас играет',
                icon: 'download',
                label: 'Скачать текущий трек',
                keywords: ['download', 'save', 'current', 'скачать'],
                action: () => {
                    document.querySelector('.now-playing-bar .download-btn')?.click();
                },
            },

            {
                id: 'queue-open',
                group: 'Очередь',
                icon: 'list',
                label: 'Открыть очередь',
                keywords: ['queue', 'list', 'up next', 'очередь'],
                shortcut: 'Q',
                action: () => {
                    document.getElementById('queue-btn')?.click();
                },
            },
            {
                id: 'queue-wipe',
                group: 'Очередь',
                icon: 'trash',
                label: 'Очистить очередь',
                keywords: ['wipe', 'clear', 'empty', 'queue', 'очистить'],
                action: async () => {
                    Player.instance.wipeQueue();
                    await this.notify('Очередь очищена');
                },
            },
            {
                id: 'queue-like-all',
                group: 'Очередь',
                icon: 'heart',
                label: 'Добавить всю очередь в избранное',
                keywords: ['like', 'all', 'queue', 'heart', 'favorite', 'избранное'],
                action: () => this.likeAllInQueue(),
            },
            {
                id: 'queue-download',
                group: 'Очередь',
                icon: 'download',
                label: 'Скачать всю очередь',
                keywords: ['download', 'queue', 'save', 'all', 'скачать'],
                action: () => this.downloadQueue(),
            },

            {
                id: 'lyrics-toggle',
                group: 'Вид',
                icon: 'text',
                label: 'Показать / Скрыть текст',
                keywords: ['lyrics', 'words', 'text', 'karaoke', 'текст'],
                shortcut: 'L',
                action: () => {
                    document.querySelector('.now-playing-bar .cover')?.click();
                },
            },
            {
                id: 'fullscreen-open',
                group: 'Вид',
                icon: 'maximize',
                label: 'Открыть полноэкранный плеер',
                keywords: ['fullscreen', 'expand', 'immersive', 'cover', 'полный экран'],
                action: () => {
                    const cover = document.querySelector('.now-playing-bar .cover-art');
                    if (cover) cover.click();
                },
            },
            {
                id: 'vis-toggle',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Включить / Выключить визуализатор',
                keywords: ['visualizer', 'visual', 'animation', 'effects', 'визуализатор'],
                action: () => this.toggleVisualizer(),
            },
            {
                id: 'vis-butterchurn',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Визуализатор: Butterchurn',
                keywords: ['butterchurn', 'milkdrop', 'preset', 'visualizer'],
                action: () => this.setVisualizerPreset('butterchurn'),
            },
            {
                id: 'vis-kawarp',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Визуализатор: Kawarp',
                keywords: ['kawarp', 'preset', 'visualizer'],
                action: () => this.setVisualizerPreset('kawarp'),
            },
            {
                id: 'vis-lcd',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Визуализатор: LCD',
                keywords: ['lcd', 'preset', 'visualizer'],
                action: () => this.setVisualizerPreset('lcd'),
            },
            {
                id: 'vis-particles',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Визуализатор: Частицы',
                keywords: ['particles', 'preset', 'visualizer', 'частицы'],
                action: () => this.setVisualizerPreset('particles'),
            },
            {
                id: 'vis-unknown',
                group: 'Вид',
                icon: 'sparkles',
                label: 'Визуализатор: Unknown Pleasures',
                keywords: ['unknown pleasures', 'preset', 'visualizer', 'joy division'],
                action: () => this.setVisualizerPreset('unknown-pleasures'),
            },

            {
                id: 'theme-system',
                group: 'Тема',
                icon: 'monitor',
                label: 'Тема: Системная',
                keywords: ['theme', 'system', 'auto', 'default', 'тема', 'системная'],
                action: () => this.setTheme('system'),
            },
            {
                id: 'theme-black',
                group: 'Тема',
                icon: 'moon',
                label: 'Тема: Чёрная (AMOLED)',
                keywords: ['theme', 'monochrome', 'black', 'dark', 'amoled', 'тема', 'черная'],
                action: () => this.setTheme('monochrome'),
            },
            {
                id: 'theme-dark',
                group: 'Тема',
                icon: 'moon',
                label: 'Тема: Тёмная',
                keywords: ['theme', 'dark', 'тема', 'темная'],
                action: () => this.setTheme('dark'),
            },
            {
                id: 'theme-white',
                group: 'Тема',
                icon: 'sun',
                label: 'Тема: Светлая',
                keywords: ['theme', 'white', 'light', 'тема', 'светлая'],
                action: () => this.setTheme('white'),
            },
            {
                id: 'theme-ocean',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Океан',
                keywords: ['theme', 'ocean', 'blue', 'sea', 'океан'],
                action: () => this.setTheme('ocean'),
            },
            {
                id: 'theme-purple',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Фиолетовая',
                keywords: ['theme', 'purple', 'violet', 'фиолетовая'],
                action: () => this.setTheme('purple'),
            },
            {
                id: 'theme-forest',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Лес',
                keywords: ['theme', 'forest', 'green', 'nature', 'лес'],
                action: () => this.setTheme('forest'),
            },
            {
                id: 'theme-mocha',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Mocha',
                keywords: ['theme', 'mocha', 'catppuccin', 'brown', 'warm'],
                action: () => this.setTheme('mocha'),
            },
            {
                id: 'theme-macchiato',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Macchiato',
                keywords: ['theme', 'macchiato', 'catppuccin'],
                action: () => this.setTheme('machiatto'),
            },
            {
                id: 'theme-frappe',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Frapp\u00e9',
                keywords: ['theme', 'frappe', 'catppuccin'],
                action: () => this.setTheme('frappe'),
            },
            {
                id: 'theme-latte',
                group: 'Тема',
                icon: 'palette',
                label: 'Тема: Latte',
                keywords: ['theme', 'latte', 'catppuccin', 'light'],
                action: () => this.setTheme('latte'),
            },
            {
                id: 'theme-store',
                group: 'Тема',
                icon: 'store',
                label: 'Открыть каталог тем',
                keywords: ['theme', 'store', 'browse', 'community', 'custom', 'темы'],
                action: () => {
                    document.getElementById('open-theme-store')?.click();
                },
            },

            {
                id: 'quality-auto',
                group: 'Аудио',
                icon: 'sliders',
                label: 'Качество: Авто (адаптивное)',
                keywords: ['quality', 'auto', 'adaptive', 'streaming', 'качество', 'авто'],
                action: () => this.setQuality('auto'),
            },
            {
                id: 'quality-low',
                group: 'Аудио',
                icon: 'sliders',
                label: 'Качество: Низкое (AAC)',
                keywords: ['quality', 'low', 'streaming', 'bitrate', 'качество'],
                action: () => this.setQuality('LOW'),
            },
            {
                id: 'quality-high',
                group: 'Аудио',
                icon: 'sliders',
                label: 'Качество: Высокое (AAC 320)',
                keywords: ['quality', 'high', 'streaming', 'bitrate', 'качество'],
                action: () => this.setQuality('HIGH'),
            },
            {
                id: 'quality-lossless',
                group: 'Аудио',
                icon: 'sliders',
                label: 'Качество: Lossless (FLAC)',
                keywords: ['quality', 'lossless', 'flac', 'cd', 'streaming', 'качество'],
                action: () => this.setQuality('LOSSLESS'),
            },
            {
                id: 'quality-hires',
                group: 'Аудио',
                icon: 'sliders',
                label: 'Качество: Hi-Res FLAC',
                keywords: ['quality', 'hi-res', 'hires', 'flac', 'streaming', 'качество'],
                action: () => this.setQuality('HI_RES_LOSSLESS'),
            },
            {
                id: 'sleep-15',
                group: 'Аудио',
                icon: 'clock',
                label: 'Таймер сна: 15 мин',
                keywords: ['sleep', 'timer', '15', 'таймер'],
                action: () => this.setSleepTimer(15),
            },
            {
                id: 'sleep-30',
                group: 'Аудио',
                icon: 'clock',
                label: 'Таймер сна: 30 мин',
                keywords: ['sleep', 'timer', '30', 'таймер'],
                action: () => this.setSleepTimer(30),
            },
            {
                id: 'sleep-60',
                group: 'Аудио',
                icon: 'clock',
                label: 'Таймер сна: 60 мин',
                keywords: ['sleep', 'timer', '60', 'таймер'],
                action: () => this.setSleepTimer(60),
            },
            {
                id: 'sleep-120',
                group: 'Аудио',
                icon: 'clock',
                label: 'Таймер сна: 120 мин',
                keywords: ['sleep', 'timer', '120', 'таймер'],
                action: () => this.setSleepTimer(120),
            },

            {
                id: 'lib-create-playlist',
                group: 'Медиатека',
                icon: 'plus',
                label: 'Создать плейлист',
                keywords: ['create', 'new', 'playlist', 'add', 'плейлист'],
                action: () => this.createPlaylist(),
            },
            {
                id: 'lib-create-folder',
                group: 'Медиатека',
                icon: 'folderPlus',
                label: 'Создать папку',
                keywords: ['create', 'new', 'folder', 'add', 'папка'],
                action: () => this.createFolder(),
            },

            {
                id: 'sys-cache',
                group: 'Система',
                icon: 'trash',
                label: 'Очистить кэш',
                keywords: ['cache', 'clear', 'reset', 'clean', 'кэш'],
                action: () => this.clearCache(),
            },
            {
                id: 'sys-shortcuts',
                group: 'Система',
                icon: 'keyboard',
                label: 'Горячие клавиши',
                keywords: ['keyboard', 'shortcuts', 'keys', 'hotkeys', 'клавиши'],
                action: () => {
                    document.getElementById('shortcuts-modal')?.style.setProperty('display', 'flex');
                },
            },
            {
                id: 'sys-export',
                group: 'Система',
                icon: 'upload',
                label: 'Экспорт данных',
                keywords: ['export', 'backup', 'data', 'save', 'экспорт'],
                action: () => this.navigateToSetting({ tab: 'system', id: 'export-data-btn' }),
            },
            {
                id: 'sys-search-setting',
                group: 'Система',
                icon: 'search',
                label: 'Поиск по настройкам...',
                keywords: ['setting', 'find', 'search', 'preference', 'настройки'],
                keepOpen: true,
                action: () => this.enterSettingsMode(),
            },

            {
                id: 'acc-profile',
                group: 'Аккаунт',
                icon: 'user',
                label: 'Открыть профиль',
                keywords: ['profile', 'account', 'user', 'профиль'],
                action: () => {
                    document.querySelector('.user-avatar-btn')?.click();
                },
            },
            {
                id: 'acc-edit-profile',
                group: 'Аккаунт',
                icon: 'pencil',
                label: 'Редактировать профиль',
                keywords: ['edit', 'profile', 'username', 'avatar', 'профиль'],
                action: async () => {
                    const { openEditProfile } = await import('./profile.js');
                    await openEditProfile();
                },
            },
            {
                id: 'acc-sign-out',
                group: 'Аккаунт',
                icon: 'logOut',
                label: 'Выйти из аккаунта',
                keywords: ['sign out', 'log out', 'logout', 'выход'],
                action: async () => {
                    const { authManager } = await import('./accounts/auth.js');
                    await authManager.signOut();
                },
            },
            {
                id: 'acc-sign-in',
                group: 'Аккаунт',
                icon: 'logIn',
                label: 'Войти в аккаунт',
                keywords: ['sign in', 'log in', 'login', 'account', 'вход'],
                action: () => {
                    navigate('/account');
                },
            },
        ];
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });

        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.cacheAllSettings();
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.isOpen = true;
        this.settingsMode = false;
        this.overlay.style.display = 'flex';
        this.input.value = '';
        this.input.placeholder = 'Поиск команд, музыки, настроек...';
        this.input.focus();
        this.showDefaultCommands();
    }

    close() {
        this.isOpen = false;
        this.settingsMode = false;
        this.overlay.style.display = 'none';
        this.cancelMusicSearch();
    }

    enterSettingsMode() {
        this.settingsMode = true;
        this.input.value = '';
        this.input.placeholder = 'Поиск по настройкам...';
        this.input.focus();
        this.cacheAllSettings();
        this.renderSettingsResults('');
    }

    handleInput() {
        const query = this.input.value.trim();
        this.selectedIndex = 0;

        if (this.settingsMode) {
            this.renderSettingsResults(query);
            return;
        }

        if (!query) {
            this.cancelMusicSearch();
            this.showDefaultCommands();
            return;
        }

        this.searchCommands(query);
        this.debouncedMusicSearch(query);
    }

    handleKeydown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.flatItems.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.executeSelected().catch(console.error);
        } else if (e.key === 'Escape') {
            if (this.settingsMode) {
                this.settingsMode = false;
                this.input.value = '';
                this.input.placeholder = 'Поиск команд, музыки, настроек...';
                this.showDefaultCommands();
            } else {
                this.close();
            }
        } else if (e.key === 'Backspace' && this.settingsMode && !this.input.value) {
            this.settingsMode = false;
            this.input.placeholder = 'Поиск команд, музыки, настроек...';
            this.showDefaultCommands();
        }
    }

    showDefaultCommands() {
        const groups = this.groupBy(
            this.commands.filter((c) => {
                const priority = [
                    'nav-home',
                    'nav-library',
                    'nav-settings',
                    'play-pause',
                    'play-next',
                    'play-prev',
                    'play-shuffle',
                    'queue-open',
                    'lyrics-toggle',
                    'fullscreen-open',
                    'sys-search-setting',
                ];
                return priority.includes(c.id);
            }),
            'group'
        );

        this.renderGroups(groups);
    }

    searchCommands(query) {
        const fuseResults = this.fuse.search(query).slice(0, 12);
        const matched = fuseResults.map((r) => r.item);

        if (matched.length === 0) {
            this.renderGroups({});
            return;
        }

        const groups = this.groupBy(matched, 'group');
        this.renderGroups(groups);
    }

    async searchMusic(query) {
        if (!query || query.length < 2) return;

        const api = UIRenderer.instance.api;
        if (!api) return;

        this.cancelMusicSearch();
        const controller = new AbortController();
        this.musicSearchAbort = controller;

        this.showMusicLoading();

        try {
            const results = await api.search(query, { limit: 4 });
            const tracks = results.tracks || { items: [] };
            const albums = results.albums || { items: [] };
            const artists = results.artists || { items: [] };

            if (controller.signal.aborted || !this.isOpen) return;

            const musicGroups = {};

            if (tracks?.items?.length) {
                musicGroups['Треки'] = tracks.items.map((track) => ({
                    id: `track-${track.id}`,
                    group: 'Треки',
                    icon: 'music',
                    image: api.getCoverUrl(track.album?.cover, 80),
                    label: track.title,
                    description: `${track.artist?.name || 'Неизвестный исполнитель'} \u2022 ${track.album?.title || ''}`,
                    action: async () => {
                        Player.instance.setQueue([track], 0);
                        await Player.instance.playTrackFromQueue();
                    },
                }));
            }

            if (albums?.items?.length) {
                musicGroups['Альбомы'] = albums.items.map((album) => ({
                    id: `album-${album.id}`,
                    group: 'Альбомы',
                    icon: 'disc',
                    image: api.getCoverUrl(album.cover, 80),
                    label: album.title,
                    description: album.artist?.name || 'Неизвестный исполнитель',
                    action: () => {
                        navigate(`/album/${album.id}`);
                    },
                }));
            }

            if (artists?.items?.length) {
                musicGroups['Исполнители'] = artists.items.map((artist) => ({
                    id: `artist-${artist.id}`,
                    group: 'Исполнители',
                    icon: 'mic',
                    image: api.getArtistPictureUrl(artist.picture, 80),
                    label: artist.name,
                    description: 'Исполнитель',
                    action: () => {
                        navigate(`/artist/${artist.id}`);
                    },
                }));
            }

            if (Object.keys(musicGroups).length > 0) {
                this.appendMusicGroups(musicGroups);
            }

            this.removeMusicLoading();
        } catch (e) {
            if (e.name !== 'AbortError') {
                this.removeMusicLoading();
            }
        }
    }

    cancelMusicSearch() {
        if (this.musicSearchAbort) {
            this.musicSearchAbort.abort();
            this.musicSearchAbort = null;
        }
    }

    showMusicLoading() {
        this.removeMusicLoading();
        const loading = document.createElement('div');
        loading.className = 'cmdk-loading';
        loading.setAttribute('data-music-loading', '');
        loading.innerHTML = '<div class="cmdk-loading-spinner"></div>Поиск музыки...';
        this.resultsContainer.appendChild(loading);
    }

    removeMusicLoading() {
        this.resultsContainer.querySelector('[data-music-loading]')?.remove();
    }

    appendMusicGroups(musicGroups) {
        this.removeMusicLoading();
        this.resultsContainer.querySelector('.cmdk-empty')?.remove();
        this.resultsContainer.querySelectorAll('[data-music-group]').forEach((el) => el.remove());

        let index = this.flatItems.length;

        for (const [heading, items] of Object.entries(musicGroups)) {
            const groupEl = document.createElement('div');
            groupEl.className = 'cmdk-group';
            groupEl.setAttribute('data-music-group', '');

            const headingEl = document.createElement('div');
            headingEl.className = 'cmdk-group-heading';
            headingEl.textContent = heading;
            groupEl.appendChild(headingEl);

            for (const item of items) {
                const itemEl = this.createItemElement(item, index);
                groupEl.appendChild(itemEl);
                this.flatItems.push(item);
                index++;
            }

            this.resultsContainer.appendChild(groupEl);
        }
    }

    groupBy(items, key) {
        const groups = {};
        for (const item of items) {
            const group = item[key] || 'Другое';
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
        }
        return groups;
    }

    renderGroups(groups) {
        this.resultsContainer.innerHTML = '';
        this.flatItems = [];
        let index = 0;

        const groupEntries = Object.entries(groups);
        if (groupEntries.length === 0) {
            const query = this.input.value.trim();
            if (query) {
                const empty = document.createElement('div');
                empty.className = 'cmdk-empty';
                empty.textContent = 'Ничего не найдено';
                this.resultsContainer.appendChild(empty);
            }
            return;
        }

        for (const [heading, items] of groupEntries) {
            const groupEl = document.createElement('div');
            groupEl.className = 'cmdk-group';

            const headingEl = document.createElement('div');
            headingEl.className = 'cmdk-group-heading';
            headingEl.textContent = heading;
            groupEl.appendChild(headingEl);

            for (const item of items) {
                const itemEl = this.createItemElement(item, index);
                groupEl.appendChild(itemEl);
                this.flatItems.push(item);
                index++;
            }

            this.resultsContainer.appendChild(groupEl);
        }

        this.updateSelection();
    }

    createItemElement(item, index) {
        const el = document.createElement('div');
        el.className = 'cmdk-item';
        el.id = `cmdk-item-${index}`;
        el.setAttribute('role', 'option');
        el.setAttribute('data-index', index);
        el.setAttribute('aria-selected', index === this.selectedIndex ? 'true' : 'false');
        if (index === this.selectedIndex) el.setAttribute('data-selected', 'true');

        let iconHtml = '';
        if (item.image) {
            iconHtml = `<div class="cmdk-item-icon"><img referrerpolicy="no-referrer" src="${escapeHtml(item.image)}" crossorigin="anonymous" alt="" loading="lazy" /></div>`;
        } else if (item.icon && ICONS[item.icon]) {
            iconHtml = `<div class="cmdk-item-icon">${ICONS[item.icon](ICON_SIZE)}</div>`;
        }

        let shortcutHtml = '';
        if (item.shortcut) {
            const keys = item.shortcut.split('+');
            shortcutHtml = `<div class="cmdk-item-shortcut">${keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join('')}</div>`;
        }

        const descHtml = item.description
            ? `<span class="cmdk-item-description">${escapeHtml(item.description)}</span>`
            : '';

        el.innerHTML = `${iconHtml}<div class="cmdk-item-content"><span class="cmdk-item-label">${escapeHtml(item.label)}</span>${descHtml}</div>${shortcutHtml}`;

        el.addEventListener('click', async () => {
            this.selectedIndex = index;
            await this.executeSelected();
        });

        el.addEventListener('mouseenter', () => {
            this.selectedIndex = index;
            this.updateSelection();
        });

        return el;
    }

    updateSelection() {
        const items = this.resultsContainer.querySelectorAll('.cmdk-item');
        items.forEach((item) => {
            const idx = parseInt(item.getAttribute('data-index'));
            if (idx === this.selectedIndex) {
                item.setAttribute('data-selected', 'true');
                item.setAttribute('aria-selected', 'true');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.removeAttribute('data-selected');
                item.setAttribute('aria-selected', 'false');
            }
        });
        this.input.setAttribute('aria-activedescendant', `cmdk-item-${this.selectedIndex}`);
    }

    async executeSelected() {
        const item = this.flatItems[this.selectedIndex];
        if (!item || !item.action) return;

        if (item.keepOpen) {
            try {
                await item.action();
            } catch (e) {
                console.error('Command palette action error:', e);
            }
            return;
        }

        try {
            await item.action();
        } catch (e) {
            console.error('Command palette action error:', e);
        }
        this.close();
    }

    renderSettingsResults(query) {
        if (this.allSettings.length === 0) this.cacheAllSettings();

        let results = this.allSettings;
        if (query) {
            results = this.settingsFuse.search(query).map((r) => r.item);
        }

        const items = results.map((setting) => ({
            id: `setting-${setting.id}`,
            group: `Настройки \u2022 ${setting.tab}`,
            icon: 'settings',
            label: setting.label,
            description: setting.description,
            action: () => this.navigateToSetting(setting),
        }));

        const groups = this.groupBy(items, 'group');
        this.renderGroups(groups);
    }

    cacheAllSettings() {
        const settingItems = document.querySelectorAll('#page-settings .setting-item');
        this.allSettings = Array.from(settingItems)
            .map((item) => {
                const labelEl = item.querySelector('.label');
                const descEl = item.querySelector('.description');
                const tabEl = item.closest('.settings-tab-content');

                const label = labelEl ? labelEl.textContent.trim() : '';
                const description = descEl ? descEl.textContent.trim() : '';
                const tab = tabEl ? tabEl.id.replace('settings-tab-', '') : '';

                if (!item.id) {
                    const inputEl = item.querySelector('input[id], select[id], button[id]');
                    item.id = inputEl
                        ? `setting-item-for-${inputEl.id}`
                        : `setting-item-${Math.random().toString(36).substr(2, 9)}`;
                }

                return { id: item.id, label, description, tab };
            })
            .filter((s) => s.label);

        this.settingsFuse = new Fuse(this.allSettings, {
            keys: ['label', 'description'],
            includeScore: true,
            threshold: 0.4,
            ignoreLocation: true,
        });
    }

    async navigateToSetting(setting) {
        navigate('/settings');

        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelector(`.settings-tab[data-tab="${setting.tab}"]`);
        if (tabButton && !tabButton.classList.contains('active')) {
            tabButton.click();
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        const settingElement = document.getElementById(setting.id);
        if (settingElement) {
            settingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            settingElement.style.transition = 'background-color 0.3s ease-out, box-shadow 0.3s ease-out';
            settingElement.style.backgroundColor = 'rgba(var(--highlight-rgb), 0.2)';
            settingElement.style.boxShadow = '0 0 0 2px rgba(var(--highlight-rgb), 0.5)';
            setTimeout(() => {
                settingElement.style.backgroundColor = '';
                settingElement.style.boxShadow = '';
            }, 2000);
        }
    }

    async setTheme(theme) {
        const { themeManager } = await import('./storage.js');
        themeManager.setTheme(theme);
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach((opt) => {
            if (opt.dataset.theme === theme) opt.classList.add('active');
            else opt.classList.remove('active');
        });
        await this.notify(`Тема изменена: ${theme}`);
    }

    async toggleVisualizer() {
        const { visualizerSettings } = await import('./storage.js');
        const current = visualizerSettings.isEnabled();
        visualizerSettings.setEnabled(!current);
        await this.notify(`Визуализатор ${!current ? 'включён' : 'выключен'}`);

        const overlay = document.getElementById('fullscreen-cover-overlay');
        if (overlay && getComputedStyle(overlay).display !== 'none') {
            UIRenderer.instance.closeFullscreenCover();
        }
    }

    async setVisualizerPreset(preset) {
        const { visualizerSettings } = await import('./storage.js');
        visualizerSettings.setPreset(preset);
        if (UIRenderer.instance.visualizer) {
            UIRenderer.instance.visualizer.setPreset(preset);
        }
        await this.notify(`Пресет визуализатора: ${preset}`);
    }

    async setQuality(quality) {
        const qualityNames = {
            auto: 'Авто',
            LOW: 'Низкое',
            HIGH: 'Высокое',
            LOSSLESS: 'Lossless',
            HI_RES_LOSSLESS: 'Hi-Res',
        };

        if (Player.instance) {
            // Set fallback API quality (Auto maps back to Hi-Res)
            const apiQuality = quality === 'auto' ? 'HI_RES_LOSSLESS' : quality;
            Player.instance.setQuality(apiQuality);
            localStorage.setItem('playback-quality', apiQuality);

            // Set adaptive streaming quality
            localStorage.setItem('adaptive-playback-quality', quality);
            if (Player.instance.forceQuality) Player.instance.forceQuality(quality);

            const streamingSelect = document.getElementById('streaming-quality-setting');
            if (streamingSelect) streamingSelect.value = quality;
        }

        const { downloadQualitySettings } = await import('./storage.js');
        // Do not pass auto to download quality, resolve it to original fallback
        const dlQuality = quality === 'auto' ? 'HI_RES_LOSSLESS' : quality;
        downloadQualitySettings.setQuality(dlQuality);
        const downloadSelect = document.getElementById('download-quality-setting');
        if (downloadSelect) downloadSelect.value = dlQuality;

        await this.notify(`Качество звука: ${qualityNames[quality] || quality}`);
    }

    async setSleepTimer(minutes) {
        if (Player.instance) {
            Player.instance.setSleepTimer(minutes);
            await this.notify(`Таймер сна: ${minutes} мин`);
        }
    }

    async likeAllInQueue() {
        const player = Player.instance;
        const ui = UIRenderer.instance;
        if (!player || !ui) return;

        const queue = player.getCurrentQueue();
        if (queue.length === 0) {
            await this.notify('Очередь пуста');
            return;
        }

        const { handleTrackAction } = await import('./events.js');
        const scrobbler = window.monochromeScrobbler;

        let likedCount = 0;
        await this.notify('Добавление очереди в избранное...');
        for (const track of queue) {
            const isLiked = await db.isFavorite('track', track.id);
            if (!isLiked) {
                await handleTrackAction('toggle-like', track, player, ui.api, ui.lyricsManager, 'track', ui, scrobbler);
                likedCount++;
            }
        }
        await this.notify(`Добавлено треков в избранное: ${likedCount}`);
    }

    async downloadQueue() {
        const player = Player.instance;
        const ui = UIRenderer.instance;
        if (!player || !ui) return;

        const queue = player.getCurrentQueue();
        if (queue.length === 0) {
            await this.notify('Очередь пуста');
            return;
        }

        const { downloadTracks } = await import('./downloads.js');
        const { downloadQualitySettings } = await import('./storage.js');
        await downloadTracks(queue, ui.api, downloadQualitySettings.getQuality(), ui.lyricsManager);
    }

    async createPlaylist() {
        const name = `Новый плейлист ${new Date().toLocaleDateString('ru-RU')}`;
        await db.createPlaylist(name);
        navigate('/library');
        await this.notify('Плейлист создан');
    }

    async createFolder() {
        const name = `Новая папка ${new Date().toLocaleDateString('ru-RU')}`;
        await db.createFolder(name);
        navigate('/library');
        await this.notify('Папка создана');
    }

    async clearCache() {
        const api = UIRenderer.instance.api;
        if (api) {
            await api.clearCache();
            await this.notify('Кэш очищен');
        }
    }

    async notify(message) {
        await import('./downloads.js').then((m) => m.showNotification(message)).catch(console.error);
    }
}

new CommandPalette();
