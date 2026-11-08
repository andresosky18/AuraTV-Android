# AURA TV v2.1 — Versión Android TV

Esta carpeta (`android_tv/`) contiene la versión completa de **AURA TV v2.1 para Android TV / Google TV / Fire TV / TV Box**, manteniendo intacta la versión de Roku en la raíz del proyecto.

## ¿Qué comparte al 100% con la versión de Roku?
- **Mismo Backend y Portal Web (`https://auratv.site.je`):**
  - Sincronización, alta y baja de listas Xtream y M3U en `https://roku-backend-iptv.vercel.app/api/dispositivos`.
  - Sincronización de Add-ons, catálogos, metadatos y streams de películas en `https://roku-backend-iptv.vercel.app/api/addons`.
  - Modo directo (`mode = "direct"`) y diagnóstico HTTP (`DIRECT OK` / `DIRECT 403`, etc.) ejecutado desde el cliente nativo de Android TV sin bloqueos de CORS.
- **Mismo sistema de vinculación:** Genera su propia **MAC** única persistente (basada en el `ANDROID_ID` del televisor) y su **Device Key** de 6 dígitos para vincular la TV en `auratv.site.je`.
- **Mismo diseño visual e imágenes:** Usa las mismas 34 imágenes de `images/`, el mismo diseño 1280×720 autoescalable a 720p/1080p/4K, los 3 idiomas (Español, Inglés y Chino), el PIN parental y la misma navegación con las flechas del control remoto (`Arriba`, `Abajo`, `Izquierda`, `Derecha`, `OK`, `Back`).
- **Tecnología nativa de Android TV:**
  - Reproductor nativo **AndroidX Media3 (ExoPlayer)** con soporte para streams IPTV `.ts`, `.m3u8` (HLS) y `.mp4`, incluyendo vista previa en recuadro y pantalla completa al presionar `OK` por segunda vez.
  - Cliente HTTP nativo **OkHttp** con cabeceras `VLC/3.0.9 LibVLC/3.0.9` para servidores IPTV y soporte para certificados autofirmados (`insecure: true`).

---

## Cómo probar o generar el archivo `.apk`

### Opción 1: Vista previa rápida en tu PC
Puedes abrir directamente el archivo [`app/src/main/assets/index.html`](app/src/main/assets/index.html) en tu navegador y moverte con las flechas del teclado, `Enter` (`OK`) y `Backspace` / `Esc` (`Back`).

### Opción 2: Compilar el `.apk` con Android Studio
1. Abre **Android Studio**.
2. Selecciona **Open** y elige la carpeta `D:\yo\AURA_TV_v2.1\android_tv`.
3. Espera a que termine el *Gradle Sync* automático.
4. Ve al menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. El instalador quedará listo en `android_tv/app/build/outputs/apk/debug/app-debug.apk` para pasarlo por USB o *Send Files to TV* a tu televisor con Android TV.

### Opción 3: Compilar el `.apk` en la nube con GitHub Actions (sin instalar nada en tu PC)
Ya se incluyó el flujo [`.github/workflows/build-android-tv.yml`](../.github/workflows/build-android-tv.yml): al subir el proyecto a un repositorio de GitHub, la pestaña **Actions** compila automáticamente el `.apk` listo para descargar.
