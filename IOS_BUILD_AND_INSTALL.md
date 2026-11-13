# Сборка и установка FlacLess для iPhone / iPad (`.ipa`)

> Адаптировал приложение на iOS — **rvkqq** (`t.me/rvkqq`).
> Работает на всех моделях iPhone и iPad с iOS 15.0+ (от iPhone 8 / SE / X до iPhone 16 Pro / Dynamic Island / 120Hz ProMotion, включая Liquid Glass для iOS 26/27 и классический режим для более ранних версий).

---

## Способ 1: Сборка `.ipa` прямо на GitHub одной кнопкой (БЕЗ Mac)

Вам **не нужен Mac**, Xcode или платный аккаунт Apple Developer. Всё собирается в облаке GitHub.

### Шаг 1. Загрузите проект в свой репозиторий на GitHub
1. Создайте новый репозиторий на [GitHub](https://github.com/new) (приватный или публичный).
2. Загрузите файлы этого проекта в ветку `main`.

### Шаг 2. Запустите сборку
1. Откройте вкладку **Actions** в репозитории.
2. Если Actions выключены — нажмите **I understand my workflows, go ahead and enable them**.
3. Выберите workflow **Build FlacLess iOS (.ipa)**.
4. Нажмите **Run workflow** -> **Run workflow** (или просто сделайте `git push` в `main`).
5. Дождитесь завершения сборки (~3–5 минут).

### Шаг 3. Скачайте готовый `.ipa`
1. Откройте завершённый запуск workflow.
2. Внизу в разделе **Artifacts** скачайте **`FlacLess-iOS-unsigned`** и распакуйте ZIP-архив — внутри лежит **`FlacLess-iOS-unsigned.ipa`**.

*(При желании в **Run workflow** выберите `create_release: true`, чтобы `.ipa` сразу опубликовался в **Releases**.)*

---

## Способ 2: Установка `.ipa` на iPhone / iPad

### Sideloadly / AltStore / SideStore (с ПК, бесплатный Apple ID)
1. Подключите iPhone к ПК.
2. Перетащите `FlacLess-iOS-unsigned.ipa` в Sideloadly (или откройте через AltStore / SideStore) и подпишите своим Apple ID.
3. На iPhone откройте **Настройки -> Основные -> VPN и управление устройством** и доверьте сертификат.

### ESign / Feather / Scarlet (прямо с iPhone)
1. Скачайте `FlacLess-iOS-unsigned.ipa` в **«Файлы»**.
2. Импортируйте файл в **Feather**, **ESign** или **Scarlet**, подпишите своим `.p12` сертификатом и установите.

### TrollStore (без подписи на поддерживаемых версиях iOS)
1. Откройте `FlacLess-iOS-unsigned.ipa` в **TrollStore** и нажмите **Install**.

---

## Способ 3: Локальная сборка одной командой (macOS + Xcode 15+)

```bash
npm run ios:build
# или
./scripts/build-ios.sh
```

Готовый файл: `dist-ios/FlacLess-iOS-unsigned.ipa`.

С подписью своим сертификатом:
```bash
DEVELOPMENT_TEAM="ВАШ_TEAM_ID" \
PROVISIONING_PROFILE_SPECIFIER="Название профиля" \
./scripts/build-ios.sh
```

---

## Что реализовано для iOS и звука

- **Нативный аудио-драйвер (`MonochromeNativePlugin`) + Web Audio DSP**:
  - `AVAudioSession` (`.playback`, AirPlay, Bluetooth A2DP), авто-пауза при отключении наушников, корректная обработка звонков и Siri.
  - `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter`: обложка, название, артист, перемотка (scrubbing) и кнопки управления на экране блокировки, в Пункте управления и Dynamic Island.
  - Автоматическая маршрутизация: `AVPlayer` для экономичного фонового Hi-Res FLAC/ALAC/AAC при выключенном DSP и мгновенный переход на `<audio>` + Web Audio API без потери позиции трека при включении параметрического/графического эквалайзера, AutoEQ, Binaural DSP или моно-режима.
  - Загрузки сохраняются в **На моём iPhone -> FlacLess -> Downloads** (доступно в приложении **«Файлы»**) + системный **Share Sheet**.
- **Liquid Glass (iOS 26/27) + классический режим**:
  - Автоопределение версии iOS и системной настройки «Понижение прозрачности» через `getSystemCapabilities()`, с ручным переключателем в **Настройки -> Внешний вид** и **Система iOS**.
