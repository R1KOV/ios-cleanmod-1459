// js/ios-i18n.js
// Automatic system language detection and localization for FlacLess iOS adaptation

export const WELCOME_STORAGE_KEY = 'monochrome-ios-welcome-seen-v1';

const LOCALE_STRINGS = {
    ru: {
        lang: 'ru',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess для iPhone и iPad',
        message: 'Адаптировал приложение на iOS - rvkqq. Цените пожалуйста и уважайте труд! Спасибо и обнял 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Фоновый Hi-Res звук (AVFoundation), экран блокировки и Dynamic Island',
            'Настоящий параметрический, графический EQ и AutoEQ без обхода DSP',
            'Liquid Glass для iOS 26/27 и классический режим для прошлых версий',
        ],
        ackButton: 'Понял',
        tabs: {
            home: 'Главная',
            search: 'Поиск',
            library: 'Медиатека',
            settings: 'Настройки',
        },
        settings: {
            sectionTitle: 'Система iOS',
            welcomeLabel: 'Экран приветствия',
            welcomeDesc: 'Повторно открыть стартовое окно с информацией о сборке',
            welcomeBtn: 'Открыть',
            liquidGlassLabel: 'Эффект Liquid Glass (iOS 26/27)',
            liquidGlassDesc: 'Полупрозрачные стеклянные панели. Автоматически отключается на старых версиях iOS и при снижении прозрачности',
            nativeAudioLabel: 'Нативный драйвер AVPlayer',
            nativeAudioDesc: 'Аппаратное воспроизведение FLAC/ALAC в фоне. При активном EQ или DSP звук автоматически идёт через Web Audio',
            perfLabel: 'Ограничение 30 FPS для визуализатора',
            perfDesc: 'Снижает нагрузку на GPU и нагрев батареи при включённом полноэкранном визуализаторе',
            healthLabel: 'Поиск быстрых серверов',
            healthDesc: 'Проверка доступных API-инстансов и сортировка по минимальной задержке',
            healthBtn: 'Проверить',
            healthChecking: 'Проверка серверов...',
            downloadsLabel: 'Папка загрузок на iPhone',
            downloadsDesc: 'Файлы сохраняются в «На моём iPhone -> FlacLess -> Downloads»',
        },
    },
    uk: {
        lang: 'uk',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess для iPhone та iPad',
        message: 'Адаптував додаток для iOS - rvkqq. Цінуйте, будь ласка, та поважайте працю! Дякую та обійняв 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Фоновий Hi-Res звук, екран блокування та Dynamic Island',
            'Повноцінний параметричний і графічний еквалайзер без обходу DSP',
            'Liquid Glass для iOS 26/27 та класичний режим для старіших версій',
        ],
        ackButton: 'Зрозумів',
        tabs: {
            home: 'Головна',
            search: 'Пошук',
            library: 'Медіатека',
            settings: 'Налаштування',
        },
        settings: {
            sectionTitle: 'Система iOS',
            welcomeLabel: 'Вітальне вікно',
            welcomeDesc: 'Показати стартовий екран ще раз',
            welcomeBtn: 'Відкрити',
            liquidGlassLabel: 'Ефект Liquid Glass (iOS 26/27)',
            liquidGlassDesc: 'Напівпрозорі скляні панелі. Автоматично вимикається на старіших iOS',
            nativeAudioLabel: 'Нативний драйвер AVPlayer',
            nativeAudioDesc: 'Відтворення FLAC/ALAC у фоні. При активному EQ звук автоматично йде через Web Audio',
            perfLabel: 'Обмеження 30 FPS для візуалізатора',
            perfDesc: 'Знижує навантаження на GPU та батарею',
            healthLabel: 'Авто-підбір серверів',
            healthDesc: 'Швидка перевірка живих API-інстансів',
            healthBtn: 'Перевірити',
            healthChecking: 'Перевірка серверів...',
            downloadsLabel: 'Завантаження у «Файли»',
            downloadsDesc: 'Треки зберігаються в На моєму iPhone -> FlacLess -> Downloads',
        },
    },
    en: {
        lang: 'en',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess for iPhone & iPad',
        message: 'Adapted for iOS by rvkqq. Please appreciate and respect the hard work! Thank you and hugs 🥰',
        telegramLabel: 'Author Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Background Hi-Res FLAC playback, Lock Screen & Dynamic Island controls',
            'Full Parametric EQ, Graphic EQ & AutoEQ with automatic Web Audio DSP routing',
            'Liquid Glass UI for iOS 26/27 with classic solid fallback on older iOS',
        ],
        ackButton: 'Got it',
        tabs: {
            home: 'Home',
            search: 'Search',
            library: 'Library',
            settings: 'Settings',
        },
        settings: {
            sectionTitle: 'iOS System',
            welcomeLabel: 'Welcome Screen',
            welcomeDesc: 'Replay the startup info modal',
            welcomeBtn: 'Show',
            liquidGlassLabel: 'Liquid Glass (iOS 26/27)',
            liquidGlassDesc: 'Translucent glass surfaces. Automatically disabled on older iOS or Reduce Transparency',
            nativeAudioLabel: 'Native AVPlayer Driver',
            nativeAudioDesc: 'Hardware background FLAC/ALAC playback; automatically switches to Web Audio when EQ/DSP is active',
            perfLabel: 'Cap Visualizer to 30 FPS',
            perfDesc: 'Reduces GPU power draw while fullscreen visualizers are active',
            healthLabel: 'Server Health Check',
            healthDesc: 'Probes live API instances and sorts by lowest latency',
            healthBtn: 'Check Now',
            healthChecking: 'Checking servers...',
            downloadsLabel: 'Files App Downloads',
            downloadsDesc: 'Saved tracks appear in On My iPhone -> FlacLess -> Downloads',
        },
    },
    es: {
        lang: 'es',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess para iPhone y iPad',
        message: 'Adaptado para iOS por rvkqq. ¡Por favor valora y respeta el trabajo! Gracias y un abrazo 🥰',
        telegramLabel: 'Telegram del autor:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Audio Hi-Res en segundo plano, pantalla de bloqueo y Dynamic Island',
            'Ecualizador paramétrico, gráfico y AutoEQ funcionales',
            'Liquid Glass para iOS 26/27 y modo clásico para versiones anteriores',
        ],
        ackButton: 'Entendido',
        tabs: { home: 'Inicio', search: 'Buscar', library: 'Biblioteca', settings: 'Ajustes' },
    },
    de: {
        lang: 'de',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess für iPhone & iPad',
        message: 'Für iOS angepasst von rvkqq. Bitte schätzt und respektiert die Arbeit! Danke und Umarmung 🥰',
        telegramLabel: 'Autor auf Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Hi-Res-Hintergrundaudio, Sperrbildschirm & Dynamic Island',
            'Parametrischer EQ, Grafik-EQ und AutoEQ ohne DSP-Bypass',
            'Liquid Glass für iOS 26/27 und klassischer Modus für ältere Versionen',
        ],
        ackButton: 'Verstanden',
        tabs: { home: 'Start', search: 'Suche', library: 'Mediathek', settings: 'Optionen' },
    },
    fr: {
        lang: 'fr',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess pour iPhone & iPad',
        message: 'Adapté sur iOS par rvkqq. Merci d’apprécier et de respecter ce travail ! Merci et câlins 🥰',
        telegramLabel: 'Telegram :',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Audio Hi-Res en arrière-plan, écran verrouillé et Dynamic Island',
            'Égaliseur paramétrique, graphique et AutoEQ actifs',
            'Liquid Glass pour iOS 26/27 et mode classique pour les anciennes versions',
        ],
        ackButton: 'Compris',
        tabs: { home: 'Accueil', search: 'Recherche', library: 'Bibliothèque', settings: 'Réglages' },
    },
    pt: {
        lang: 'pt',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess para iPhone e iPad',
        message: 'Adaptado para iOS por rvkqq. Por favor valorize e respeite o trabalho! Obrigado e um abraço 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Áudio Hi-Res em segundo plano, tela bloqueada e Dynamic Island',
            'Equalizador paramétrico, gráfico e AutoEQ integrados',
            'Liquid Glass no iOS 26/27 e modo clássico em versões anteriores',
        ],
        ackButton: 'Entendi',
        tabs: { home: 'Início', search: 'Buscar', library: 'Biblioteca', settings: 'Ajustes' },
    },
    tr: {
        lang: 'tr',
        badge: 'FlacLess · iOS Native Edition',
        title: 'iPhone ve iPad için FlacLess',
        message: 'iOS için rvkqq tarafından uyarlandı. Lütfen emeğe değer verin ve saygı gösterin! Teşekkürler 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'Arka planda Hi-Res ses, Kilit Ekranı ve Dynamic Island kontrolleri',
            'Tam çalışan parametrik, grafik EQ ve AutoEQ',
            'iOS 26/27 için Liquid Glass ve eski sürümler için klasik mod',
        ],
        ackButton: 'Anladım',
        tabs: { home: 'Ana Sayfa', search: 'Ara', library: 'Kitaplık', settings: 'Ayarlar' },
    },
    zh: {
        lang: 'zh',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess iPhone & iPad 版',
        message: '由 rvkqq 为 iOS 适配移植。请珍惜并尊重开发者的付出！感谢支持 🥰',
        telegramLabel: '作者 Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            '后台 Hi-Res 无损音频、锁屏与灵动岛控制',
            '完整可用的参数均衡器、图示均衡器与 AutoEQ',
            '支持 iOS 26/27 Liquid Glass 与旧版本经典界面',
        ],
        ackButton: '知道了',
        tabs: { home: '主页', search: '搜索', library: '音乐库', settings: '设置' },
    },
    ja: {
        lang: 'ja',
        badge: 'FlacLess · iOS Native Edition',
        title: 'FlacLess iOS版',
        message: 'rvkqq によって iOS 向けに最適化されました。制作へのご支援と感謝を込めて 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            'バックグラウンド Hi-Res 再生、ロック画面＆Dynamic Island 対応',
            'パラメトリックEQ・グラフィックEQ・AutoEQ 完全動作',
            'iOS 26/27 Liquid Glass と旧iOS向けクラシック表示対応',
        ],
        ackButton: '了解',
        tabs: { home: 'ホーム', search: '検索', library: 'ライブラリ', settings: '設定' },
    },
    ko: {
        lang: 'ko',
        badge: 'FlacLess · iOS Native Edition',
        title: 'iPhone 및 iPad용 FlacLess',
        message: 'rvkqq가 iOS용으로 최적화했습니다. 노고에 감사와 존중을 부탁드립니다! 감사합니다 🥰',
        telegramLabel: 'Telegram:',
        telegramHandle: '@rvkqq',
        telegramUrl: 'https://t.me/rvkqq',
        features: [
            '백그라운드 Hi-Res 재생, 잠금 화면 및 Dynamic Island 지원',
            '파라메트릭 EQ, 그래픽 EQ 및 AutoEQ 완벽 동작',
            'iOS 26/27 Liquid Glass 및 구형 iOS 클래식 모드 지원',
        ],
        ackButton: '확인',
        tabs: { home: '홈', search: '검색', library: '보관함', settings: '설정' },
    },
};

const RU_FAMILY = new Set(['ru', 'be', 'kk', 'ky', 'tg', 'uz', 'az', 'hy', 'ka']);

export const LANG_STORAGE_KEY = 'flacless-lang-v1';

export const SUPPORTED_LANGUAGES = [
    { code: 'ru', label: 'Русский (по умолчанию)' },
    { code: 'auto', label: 'Системный (по языку устройства)' },
    { code: 'uk', label: 'Українська' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'pt', label: 'Português' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
];

export function getPreferredLanguage() {
    if (typeof localStorage === 'undefined') return 'ru';
    try {
        return localStorage.getItem(LANG_STORAGE_KEY) || 'ru';
    } catch {
        return 'ru';
    }
}

export function setPreferredLanguage(lang) {
    const normalized = SUPPORTED_LANGUAGES.some((x) => x.code === lang) ? lang : 'auto';
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(LANG_STORAGE_KEY, normalized);
        } catch {}
    }
    const effective = detectUserLanguage();
    if (typeof document !== 'undefined') {
        document.documentElement.lang = effective;
        applyLanguagePack(effective);
    }
    return effective;
}

/**
 * @param {string | null} [explicitLocale]
 */
export function detectUserLanguage(explicitLocale = null) {
    const candidates = [];
    if (explicitLocale) {
        candidates.push(explicitLocale);
    } else {
        const saved = getPreferredLanguage();
        if (saved && saved !== 'auto' && LOCALE_STRINGS[saved]) {
            return saved;
        }
        if (typeof navigator !== 'undefined') {
            if (Array.isArray(navigator.languages)) {
                candidates.push(...navigator.languages);
            }
            if (navigator.language) {
                candidates.push(navigator.language);
            }
        }
    }

    for (const raw of candidates) {
        if (!raw || typeof raw !== 'string') continue;
        const base = raw.toLowerCase().split(/[-_]/)[0];
        if (RU_FAMILY.has(base)) return 'ru';
        if (LOCALE_STRINGS[base]) return base;
    }

    return 'ru';
}

const UI_TRANSLATIONS = {
    ru: {
        nav: {
            home: 'Главная',
            library: 'Медиатека',
            recent: 'Недавние',
            unreleased: 'Неизданное',
            settings: 'Настройки',
            about: 'О FlacLess',
            mobile: 'Сборка iOS',
            party: 'Комнаты',
            buildIpa: 'Собрать .ipa',
        },
        tabs: {
            appearance: 'Внешний вид',
            interface: 'Интерфейс',
            scrobbling: 'Скробблинг',
            audio: 'Звук',
            downloads: 'Загрузки',
            instances: 'Серверы',
            system: 'Система',
        },
        headers: {
            searchPlaceholder: 'Поиск треков, исполнителей, альбомов...',
            settingsTitle: 'Настройки',
            settingsSearch: 'Поиск по настройкам...',
            selectSong: 'Выберите трек',
        },
    },
    uk: {
        nav: {
            home: 'Головна',
            library: 'Медіатека',
            recent: 'Нещодавні',
            unreleased: 'Невидане',
            settings: 'Налаштування',
            about: 'Про FlacLess',
            mobile: 'Збірка iOS',
            party: 'Кімнати',
            buildIpa: 'Зібрати .ipa',
        },
        tabs: {
            appearance: 'Вигляд',
            interface: 'Інтерфейс',
            scrobbling: 'Скробблінг',
            audio: 'Звук',
            downloads: 'Завантаження',
            instances: 'Сервери',
            system: 'Система',
        },
        headers: {
            searchPlaceholder: 'Пошук треків, виконавців, альбомів...',
            settingsTitle: 'Налаштування',
            settingsSearch: 'Пошук у налаштуваннях...',
            selectSong: 'Оберіть трек',
        },
    },
    en: {
        nav: {
            home: 'Home',
            library: 'Library',
            recent: 'Recent',
            unreleased: 'Unreleased',
            settings: 'Settings',
            about: 'About FlacLess',
            mobile: 'iOS Build',
            party: 'Parties',
            buildIpa: 'Build .ipa',
        },
        tabs: {
            appearance: 'Appearance',
            interface: 'Interface',
            scrobbling: 'Scrobbling',
            audio: 'Audio',
            downloads: 'Downloads',
            instances: 'Servers',
            system: 'System',
        },
        headers: {
            searchPlaceholder: 'Search tracks, artists, albums...',
            settingsTitle: 'Settings',
            settingsSearch: 'Search settings...',
            selectSong: 'Select a song',
        },
    },
    es: {
        nav: { home: 'Inicio', library: 'Biblioteca', recent: 'Recientes', unreleased: 'Inédito', settings: 'Ajustes', about: 'Acerca de', mobile: 'App iOS', party: 'Salas', buildIpa: 'Compilar .ipa' },
        tabs: { appearance: 'Apariencia', interface: 'Interfaz', scrobbling: 'Scrobbling', audio: 'Audio', downloads: 'Descargas', instances: 'Servidores', system: 'Sistema' },
        headers: { searchPlaceholder: 'Buscar canciones, artistas, álbumes...', settingsTitle: 'Ajustes', settingsSearch: 'Buscar ajustes...', selectSong: 'Elige una canción' },
    },
    de: {
        nav: { home: 'Start', library: 'Mediathek', recent: 'Zuletzt', unreleased: 'Unveröffentlicht', settings: 'Einstellungen', about: 'Über', mobile: 'iOS-App', party: 'Räume', buildIpa: '.ipa bauen' },
        tabs: { appearance: 'Design', interface: 'Oberfläche', scrobbling: 'Scrobbling', audio: 'Audio', downloads: 'Downloads', instances: 'Server', system: 'System' },
        headers: { searchPlaceholder: 'Titel, Künstler, Alben suchen...', settingsTitle: 'Einstellungen', settingsSearch: 'Einstellungen suchen...', selectSong: 'Titel wählen' },
    },
    fr: {
        nav: { home: 'Accueil', library: 'Bibliothèque', recent: 'Récents', unreleased: 'Inédits', settings: 'Paramètres', about: 'À propos', mobile: 'App iOS', party: 'Salons', buildIpa: 'Compiler .ipa' },
        tabs: { appearance: 'Apparence', interface: 'Interface', scrobbling: 'Scrobbling', audio: 'Audio', downloads: 'Téléchargements', instances: 'Serveurs', system: 'Système' },
        headers: { searchPlaceholder: 'Rechercher titres, artistes, albums...', settingsTitle: 'Paramètres', settingsSearch: 'Rechercher...', selectSong: 'Choisir un titre' },
    },
    pt: {
        nav: { home: 'Início', library: 'Biblioteca', recent: 'Recentes', unreleased: 'Inéditas', settings: 'Ajustes', about: 'Sobre', mobile: 'App iOS', party: 'Salas', buildIpa: 'Compilar .ipa' },
        tabs: { appearance: 'Aparência', interface: 'Interface', scrobbling: 'Scrobbling', audio: 'Áudio', downloads: 'Downloads', instances: 'Servidores', system: 'Sistema' },
        headers: { searchPlaceholder: 'Buscar faixas, artistas, álbuns...', settingsTitle: 'Ajustes', settingsSearch: 'Buscar ajustes...', selectSong: 'Escolha uma faixa' },
    },
    tr: {
        nav: { home: 'Ana Sayfa', library: 'Kitaplık', recent: 'Son Çalınanlar', unreleased: 'Yayınlanmamış', settings: 'Ayarlar', about: 'Hakkında', mobile: 'iOS Uygulaması', party: 'Odalar', buildIpa: '.ipa Derle' },
        tabs: { appearance: 'Görünüm', interface: 'Arayüz', scrobbling: 'Scrobbling', audio: 'Ses', downloads: 'İndirmeler', instances: 'Sunucular', system: 'Sistem' },
        headers: { searchPlaceholder: 'Parça, sanatçı, albüm ara...', settingsTitle: 'Ayarlar', settingsSearch: 'Ayarlarda ara...', selectSong: 'Bir parça seç' },
    },
    zh: {
        nav: { home: '主页', library: '音乐库', recent: '最近播放', unreleased: '未发行', settings: '设置', about: '关于', mobile: 'iOS 构建', party: '一起听', buildIpa: '构建 .ipa' },
        tabs: { appearance: '外观', interface: '界面', scrobbling: '播放记录', audio: '音频', downloads: '下载', instances: '服务器', system: '系统' },
        headers: { searchPlaceholder: '搜索歌曲、艺人、专辑...', settingsTitle: '设置', settingsSearch: '搜索设置...', selectSong: '选择歌曲' },
    },
    ja: {
        nav: { home: 'ホーム', library: 'ライブラリ', recent: '最近の再生', unreleased: '未発表', settings: '設定', about: '情報', mobile: 'iOS ビルド', party: 'ルーム', buildIpa: '.ipa 作成' },
        tabs: { appearance: '外観', interface: 'インターフェース', scrobbling: 'Scrobble', audio: 'オーディオ', downloads: 'ダウンロード', instances: 'サーバー', system: 'システム' },
        headers: { searchPlaceholder: '曲・アーティスト・アルバムを検索...', settingsTitle: '設定', settingsSearch: '設定を検索...', selectSong: '曲を選択' },
    },
    ko: {
        nav: { home: '홈', library: '보관함', recent: '최근 재생', unreleased: '미발매', settings: '설정', about: '정보', mobile: 'iOS 빌드', party: '파티', buildIpa: '.ipa 빌드' },
        tabs: { appearance: '테마', interface: '인터페이스', scrobbling: '스크로블링', audio: '오디오', downloads: '다운로드', instances: '서버', system: '시스템' },
        headers: { searchPlaceholder: '트랙, 아티스트, 앨범 검색...', settingsTitle: '설정', settingsSearch: '설정 검색...', selectSong: '트랙 선택' },
    },
};

export function applyLanguagePack(lang = detectUserLanguage()) {
    if (typeof document === 'undefined') return;
    const pack = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.ru;
    const welcome = getWelcomeStrings(lang);

    const setSpan = (selector, text) => {
        const el = document.querySelector(selector);
        if (el && text) el.textContent = text;
    };

    setSpan('#sidebar-nav-home a span', pack.nav.home);
    setSpan('#sidebar-nav-library a span', pack.nav.library);
    setSpan('#sidebar-nav-recent a span', pack.nav.recent);
    setSpan('#sidebar-nav-unreleased a span', pack.nav.unreleased);
    setSpan('#sidebar-nav-settings a span', pack.nav.settings);
    setSpan('#sidebar-nav-about-bottom a span', pack.nav.about);
    setSpan('#sidebar-nav-mobile a span', pack.nav.mobile);
    setSpan('#sidebar-nav-party a span', pack.nav.party);
    setSpan('#sidebar-nav-github-build button span', pack.nav.buildIpa);

    const tabMap = {
        appearance: pack.tabs.appearance,
        interface: pack.tabs.interface,
        scrobbling: pack.tabs.scrobbling,
        audio: pack.tabs.audio,
        downloads: pack.tabs.downloads,
        instances: pack.tabs.instances,
        system: pack.tabs.system,
    };
    Object.entries(tabMap).forEach(([tab, label]) => {
        const btn = document.querySelector(`.settings-tab[data-tab="${tab}"]`);
        if (btn && label) btn.textContent = label;
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = pack.headers.searchPlaceholder;
    const settingsTitle = document.querySelector('#page-settings > .section-title');
    if (settingsTitle) settingsTitle.textContent = pack.headers.settingsTitle;
    const settingsSearch = document.getElementById('settings-search-input');
    if (settingsSearch) settingsSearch.placeholder = pack.headers.settingsSearch;

    document.querySelectorAll('#ios-bottom-tabbar .ios-tab-item').forEach((btn) => {
        const id = btn.dataset.iosTab;
        const lbl = btn.querySelector('.ios-tab-label');
        if (id && lbl && welcome.tabs?.[id]) {
            lbl.textContent = welcome.tabs[id];
            btn.setAttribute('aria-label', welcome.tabs[id]);
        }
    });
}

/**
 * @param {string | null} [explicitLocale]
 */
export function getWelcomeStrings(explicitLocale = null) {
    const lang = detectUserLanguage(explicitLocale);
    const localized = LOCALE_STRINGS[lang] || LOCALE_STRINGS.ru;
    return {
        ...LOCALE_STRINGS.ru,
        ...localized,
        tabs: {
            ...LOCALE_STRINGS.ru.tabs,
            ...(localized.tabs || {}),
        },
        settings: {
            ...LOCALE_STRINGS.ru.settings,
            ...(localized.settings || {}),
        },
    };
}
