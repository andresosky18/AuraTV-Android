<div align="center">

# AuraTV — Android TV & Google TV

**A free, open-source media app for the TV you already own.**  
Bring your own sources (M3U, Xtream Codes & Add-ons) and turn them into a unified 10-foot cinema interface designed for D-pad navigation, OLED screens, and ultra-fast channel switching.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/Platform-Android%20TV%20%7C%20Google%20TV%20%7C%20Fire%20TV-3DDC84?logo=android&logoColor=white)](https://github.com/andresosky18/AuraTV-Android)
[![Release](https://img.shields.io/badge/Version-v2.1-ffffff?style=flat-square)](https://github.com/andresosky18/AuraTV-Android/releases)
[![Portal](https://img.shields.io/badge/Web%20Portal-auratv.site.je-8B5CF6)](https://auratv.site.je)

</div>

---

## Overview

**AuraTV** (`AuraTV-Android`) is the official Android TV, Google TV, Fire TV, and TV Box client for the Aura TV ecosystem. Built with **Kotlin**, **AndroidX Media3 (ExoPlayer)**, **OkHttp**, and a hardware-accelerated **OLED Swiss Grid & Translucent Glass** 10-foot UI, it delivers instant navigation across playlists of **15,000+ live channels** alongside Movies & Series add-ons.

---

## Key Features

- **Bring Your Own Sources:** Connect any **M3U / M3U8 URL**, **Xtream Codes API** credentials, or external community **Add-ons** seamlessly.
- **Native AndroidX Media3 (ExoPlayer) Engine:**
  - Full support for `.m3u8` (HLS), `.ts` (MPEG-TS), and `.mp4` live and VOD streams.
  - Intelligent **Hardware + Software Decoder Fallback** (`EXTENSION_RENDERER_MODE_PREFER` + automatic codec recovery) that eliminates green/pink macroblocking artifacts on interlaced or non-standard `576i`/`576p` broadcast streams.
  - True **SurfaceView** rendering with dynamic aspect-ratio modes (`16:9`, `4:3`, `FILL`) and embedded mini-preview player.
- **O(1) High-Performance Channel Engine:** Pre-indexed `Map` lookups (`channelLookupMap` & `channelIndexMap`) and virtualized DOM rendering handle **15,000+ channels** with zero input lag on D-pad navigation.
- **10-Foot TV Interface (OLED Swiss Grid):**
  - Pure `#000000` OLED canvas scaled proportionally from `1280×720` to `1080p` and `4K`.
  - Translucent Glass OSD banner with real-time stream resolution badges (`FHD 1080p`, `HD 720p`, `SD 576p`), channel number jump (`0–9`), and live overlay Mini-Guide (`◄`).
- **Cloud Device Sync:** Pairs instantaneously with [auratv.site.je](https://auratv.site.je) using a persistent hardware MAC identifier and 6-digit Device Key to manage playlists remotely without typing long URLs on a TV remote.
- **Multi-Language & Parental Control:** Full UI support for **Spanish**, **English**, and **Chinese**, plus PIN-protected parental controls.

---

## Download & Installation

1. Download the latest **`AuraTV-Android-v2.1.apk`** from the [**Releases**](https://github.com/andresosky18/AuraTV-Android/releases) page or directly from [auratv.site.je](https://auratv.site.je/#downloads).
2. Install on your Android TV, Google TV, Chromecast, or Fire TV Stick via **Downloader**, **Send Files to TV**, or **ADB**:
   ```bash
   adb install -r AuraTV-Android-v2.1.apk
   ```

---

## Tech Stack

- **Language:** Kotlin & JavaScript (ES6+)
- **Media Engine:** AndroidX Media3 (`ExoPlayer`, `Media3 HLS`, `Media3 UI`)
- **Networking:** OkHttp 4 (`VLC/3.0.9 LibVLC/3.0.9` stream headers & self-signed SSL tolerance for private IPTV servers)
- **UI Architecture:** 10-Foot TV WebView Canvas + Native Android `SurfaceView` Hardware Overlay (`WebAppBridge`)

---

## Development Requirements

- **Android Studio** (Iguana / Koala or newer)
- **JDK 17**
- **Android SDK 34** (Min SDK 21 — Android 5.0 Lollipop+)

---

## Build from Source

Clone the repository and assemble the debug APK using the Gradle wrapper:

```bash
git clone https://github.com/andresosky18/AuraTV-Android.git
cd AuraTV-Android
./gradlew :app:assembleDebug
```

The compiled APK will be generated at:
```text
app/build/outputs/apk/debug/app-debug.apk
```

---

## Project Structure

```text
AuraTV-Android/
├── app/
│   ├── src/main/
│   │   ├── java/com/auratv/iptv/
│   │   │   ├── MainActivity.kt      # Native Media3 ExoPlayer, SurfaceView & D-pad bridge
│   │   │   └── WebAppBridge.kt      # JS <-> Native bridge (OkHttp, Device ID, Player controls)
│   │   ├── assets/
│   │   │   ├── index.html           # 10-foot TV Scene Graph layout (1280x720 auto-scaled)
│   │   │   ├── styles.css           # OLED Swiss Grid & Translucent Glass OSD design system
│   │   │   ├── app.js               # O(1) IPTV channel engine, Xtream/M3U parser & OSD logic
│   │   │   └── images/              # UI icons and branding assets
│   │   └── AndroidManifest.xml      # Leanback TV launcher & hardware acceleration config
│   └── build.gradle.kts
├── .github/workflows/
│   └── build-android-tv.yml         # Automated CI APK build workflow
├── build.gradle.kts
├── settings.gradle.kts
└── LICENSE                          # GNU GPL v3.0
```

---

## Contributors

- **Andres Aragon** ([@andresosky18](https://github.com/andresosky18)) — *Founder & Lead Developer*

---

## License

Every AuraTV app is public on GitHub under the **GNU General Public License v3.0 (GPLv3)**. Read it, build it yourself, or send a patch. See [LICENSE](LICENSE) for full details.

---

## Disclaimer

- **Client-Side Only:** AuraTV is strictly a client-side media player and interface. It **does not host, store, provide, or distribute** any media content, television channels, movies, or streams.
- **User-Provided Sources:** Users must configure their own authorized M3U playlists, Xtream Codes servers, or third-party add-ons.
- **No Affiliation:** AuraTV is an independent open-source project and is not affiliated with or endorsed by any third-party content providers.
