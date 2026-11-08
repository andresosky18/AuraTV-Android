package com.auratv.iptv

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.media.MediaFormat
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.mediacodec.MediaCodecAdapter
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.video.MediaCodecVideoRenderer
import androidx.media3.exoplayer.video.VideoRendererEventListener
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity() {

    private lateinit var rootLayout: FrameLayout
    private lateinit var playerContainer: FrameLayout
    private lateinit var playerView: PlayerView
    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences

    private var exoPlayer: ExoPlayer? = null
    private var currentStreamUrl: String = ""
    private var currentStreamTitle: String = ""
    private var retryCount: Int = 0
    private var maxRetries: Int = 2
    private var hasRenderedVideoFrame: Boolean = false
    private var bufferingStartMs: Long = 0L
    private var lastPositionValue: Long = -1L
    private var lastPositionChangeMs: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())
    private val networkExecutor = Executors.newCachedThreadPool()
    private val responseQueue = ConcurrentHashMap<String, String>()

    private val streamWatchdog = object : Runnable {
        override fun run() {
            val player = exoPlayer
            if (player != null && currentStreamUrl.isNotEmpty() && playerContainer.visibility == View.VISIBLE) {
                val now = System.currentTimeMillis()
                when (player.playbackState) {
                    Player.STATE_BUFFERING -> {
                        if (bufferingStartMs == 0L) {
                            bufferingStartMs = now
                        } else if (now - bufferingStartMs > 3800L) {
                            // Si lleva más de 3.8s sin mostrar video en buffering, reconectamos rápido
                            bufferingStartMs = now
                            triggerAutoReconnect("Timeout en buffering")
                        }
                    }
                    Player.STATE_READY -> {
                        bufferingStartMs = 0L
                        if (!hasRenderedVideoFrame && player.videoSize.width == 0 && lastPositionChangeMs > 0L && now - lastPositionChangeMs > 3500L) {
                            // El canal abrió conexión pero no entrega pista de video
                            lastPositionChangeMs = now
                            triggerAutoReconnect("Canal sin señal de video")
                        } else if (player.playWhenReady) {
                            val pos = player.currentPosition
                            if (pos != lastPositionValue) {
                                lastPositionValue = pos
                                lastPositionChangeMs = now
                            } else if (lastPositionChangeMs > 0L && now - lastPositionChangeMs > 6000L) {
                                // Si la imagen/reloj del stream se congeló por más de 6s, reconectamos solos
                                lastPositionChangeMs = now
                                triggerAutoReconnect("Stream congelado")
                            }
                        }
                    }
                    Player.STATE_ENDED -> {
                        // En canales en vivo, si el servidor corta el stream (EOF), reconectamos de inmediato
                        triggerAutoReconnect("Señal reiniciada")
                    }
                    Player.STATE_IDLE -> {
                        if (retryCount <= maxRetries && bufferingStartMs > 0L && now - bufferingStartMs > 2500L) {
                            triggerAutoReconnect("Sin señal")
                        }
                    }
                }
            }
            mainHandler.postDelayed(this, 1200L)
        }
    }

    private val safeHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    private val insecureHttpClient: OkHttpClient by lazy {
        buildInsecureOkHttpClient()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        prefs = getSharedPreferences("AuraTV", Context.MODE_PRIVATE)

        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Capa 1: Reproductor nativo ExoPlayer (Media3) para IPTV (.ts, .m3u8, .mp4) y Películas
        playerContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.INVISIBLE
        }

        // Usamos TextureView (definido en R.layout.player_view) para evitar el bug del hardware overlay (SurfaceView)
        // en televisores TCL / MediaTek donde canales 576p/SD muestran una franja gris/rosada en el borde inferior.
        playerView = (LayoutInflater.from(this).inflate(R.layout.player_view, playerContainer, false) as PlayerView).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        playerContainer.addView(playerView)
        rootLayout.addView(
            playerContainer,
            FrameLayout.LayoutParams(1, 1)
        )

        // Capa 2: Interfaz AURA TV 1280x720 (con fondo transparente sobre el video cuando está activo)
        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            isFocusable = true
            isFocusableInTouchMode = true

            @Suppress("DEPRECATION")
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                cacheMode = WebSettings.LOAD_NO_CACHE
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                useWideViewPort = false
                loadWithOverviewMode = false
                textZoom = 100
            }

            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    requestFocus()
                }
            }

            addJavascriptInterface(AuraBridge(), "AuraNative")
        }

        rootLayout.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        setContentView(rootLayout)
        initExoPlayer()
        webView.clearCache(true)
        webView.loadUrl("file:///android_asset/index.html?v=${System.currentTimeMillis()}")
    }

    @androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
    private fun initExoPlayer() {
        val dataSourceFactory = OkHttpDataSource.Factory(insecureHttpClient)
            .setDefaultRequestProperties(
                mapOf(
                    "User-Agent" to "VLC/3.0.9 LibVLC/3.0.9",
                    "Connection" to "keep-alive"
                )
            )

        // Extractores universales para .ts, .m3u8, .mp4, .mkv, .flv, .mpd, RTSP
        // Sin FLAG_ALLOW_NON_IDR_KEYFRAMES para garantizar arranque sobre un IDR keyframe limpio con SPS/PPS válido
        val extractorsFactory = DefaultExtractorsFactory()
            .setConstantBitrateSeekingEnabled(true)
            .setTsExtractorFlags(
                DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS
                    or DefaultTsPayloadReaderFactory.FLAG_ENABLE_HDMV_DTS_AUDIO_STREAMS
            )

        // En televisores Android TV (especialmente TCL / MediaTek / Realtek), ExoPlayer por defecto fuerza
        // KEY_MAX_WIDTH=1920 y KEY_MAX_HEIGHT=1080 cuando Util.isTv(context) es true. En canales 576p/SD o 720p,
        // el decodificador por hardware reserva un buffer vertical mayor y deja el 20% inferior con basura YUV (franja gris/rosada).
        // Fijamos CodecMaxValues exactamente a la resolución real del stream para eliminar esa franja al 100%.
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildVideoRenderers(
                context: Context,
                extensionRendererMode: Int,
                mediaCodecSelector: MediaCodecSelector,
                enableDecoderFallback: Boolean,
                eventHandler: Handler,
                eventListener: VideoRendererEventListener,
                allowedVideoJoiningTimeMs: Long,
                out: ArrayList<Renderer>
            ) {
                val customVideoRenderer = object : MediaCodecVideoRenderer(
                    context,
                    codecAdapterFactory,
                    mediaCodecSelector,
                    allowedVideoJoiningTimeMs,
                    enableDecoderFallback,
                    eventHandler,
                    eventListener,
                    MAX_DROPPED_VIDEO_FRAME_COUNT_TO_NOTIFY
                ) {
                    override fun getCodecMaxValues(
                        codecInfo: MediaCodecInfo,
                        format: Format,
                        streamFormats: Array<out Format>
                    ): CodecMaxValues {
                        val base = super.getCodecMaxValues(codecInfo, format, streamFormats)
                        val exactW = if (format.width > 0) format.width else base.width
                        val exactH = if (format.height > 0) format.height else base.height
                        return CodecMaxValues(exactW, exactH, base.inputSize)
                    }

                    override fun getMediaFormat(
                        format: Format,
                        codecMimeType: String,
                        codecMaxValues: CodecMaxValues,
                        codecOperatingRate: Float,
                        deviceNeedsNoPostProcessWorkaround: Boolean,
                        tunnelingAudioSessionId: Int
                    ): MediaFormat {
                        val mediaFormat = super.getMediaFormat(
                            format,
                            codecMimeType,
                            codecMaxValues,
                            codecOperatingRate,
                            deviceNeedsNoPostProcessWorkaround,
                            tunnelingAudioSessionId
                        )
                        if (format.width > 0 && format.height > 0) {
                            mediaFormat.setInteger(MediaFormat.KEY_MAX_WIDTH, format.width)
                            mediaFormat.setInteger(MediaFormat.KEY_MAX_HEIGHT, format.height)
                        }
                        return mediaFormat
                    }
                }
                out.add(customVideoRenderer)
            }
        }
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
            .setEnableDecoderFallback(true)

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                8000,   // minBufferMs
                30000,  // maxBufferMs (30s para evitar cortes por micro-caídas de red)
                1200,   // bufferForPlaybackMs (arranque rápido en 1.2s)
                2200    // bufferForPlaybackAfterRebufferMs
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        exoPlayer = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory, extractorsFactory))
            .setLoadControl(loadControl)
            .build()
            .also { player ->
                player.videoScalingMode = C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
                playerView.player = player

                player.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_BUFFERING -> {
                                bufferingStartMs = System.currentTimeMillis()
                                if (retryCount == 0) {
                                    notifyPlayerStatus("buffering", currentStreamUrl, "")
                                }
                            }
                            Player.STATE_READY -> {
                                bufferingStartMs = 0L
                                lastPositionValue = player.currentPosition
                                lastPositionChangeMs = System.currentTimeMillis()
                                if (hasRenderedVideoFrame || player.videoSize.width > 0) {
                                    retryCount = 0
                                    notifyPlayerStatus("playing", currentStreamUrl, "")
                                }
                            }
                            Player.STATE_ENDED -> {
                                if (currentStreamUrl.isNotEmpty()) {
                                    triggerAutoReconnect("Fin de transmisión, reconectando...")
                                }
                            }
                            Player.STATE_IDLE -> {}
                        }
                    }

                    override fun onRenderedFirstFrame() {
                        hasRenderedVideoFrame = true
                        bufferingStartMs = 0L
                        retryCount = 0
                        lastPositionChangeMs = System.currentTimeMillis()
                        notifyPlayerStatus("playing", currentStreamUrl, "")
                        val vs = player.videoSize
                        if (vs.width > 0 && vs.height > 0) {
                            notifyVideoResolution(vs.width, vs.height)
                        }
                    }

                    override fun onVideoSizeChanged(videoSize: androidx.media3.common.VideoSize) {
                        if (videoSize.width > 0 && videoSize.height > 0) {
                            notifyVideoResolution(videoSize.width, videoSize.height)
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        if (currentStreamUrl.isEmpty()) return

                        if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                            player.seekToDefaultPosition()
                            player.prepare()
                            player.playWhenReady = true
                            return
                        }

                        triggerAutoReconnect(error.errorCodeName)
                    }
                })
            }

        mainHandler.removeCallbacks(streamWatchdog)
        mainHandler.postDelayed(streamWatchdog, 2000L)
    }

    private fun buildMediaItemForAttempt(rawUrl: String, attempt: Int): MediaItem {
        var targetUrl = rawUrl.trim()
        // En el intento 2, si es un stream Xtream .ts probamos variante .m3u8 o viceversa
        if (attempt == 2) {
            if (targetUrl.endsWith(".ts", ignoreCase = true) && targetUrl.contains("/live/")) {
                targetUrl = targetUrl.dropLast(3) + ".m3u8"
            } else if (targetUrl.endsWith(".m3u8", ignoreCase = true) && targetUrl.contains("/live/")) {
                targetUrl = targetUrl.dropLast(5) + ".ts"
            }
        }

        val lUrl = targetUrl.lowercase(Locale.US)
        val builder = MediaItem.Builder().setUri(Uri.parse(targetUrl))

        when {
            attempt == 1 -> {
                // Intento 1: dejar que ExoPlayer detecte el contenedor por bytes/cabeceras (excepto .m3u8/.mpd explícitos)
                when {
                    lUrl.contains(".m3u8") -> builder.setMimeType(MimeTypes.APPLICATION_M3U8)
                    lUrl.contains(".mpd") -> builder.setMimeType(MimeTypes.APPLICATION_MPD)
                    lUrl.contains(".ism") -> builder.setMimeType(MimeTypes.APPLICATION_SS)
                }
            }
            attempt == 3 -> {
                // Intento 3: forzar MPEG-TS explícito si el servidor no envía Content-Type
                if (!lUrl.contains(".mp4") && !lUrl.contains(".mkv")) {
                    builder.setMimeType(MimeTypes.VIDEO_MP2T)
                }
            }
            else -> {
                when {
                    lUrl.contains(".m3u8") -> builder.setMimeType(MimeTypes.APPLICATION_M3U8)
                    lUrl.contains(".mpd") -> builder.setMimeType(MimeTypes.APPLICATION_MPD)
                    lUrl.contains(".ism") -> builder.setMimeType(MimeTypes.APPLICATION_SS)
                    lUrl.contains(".ts") && attempt == 0 -> builder.setMimeType(MimeTypes.VIDEO_MP2T)
                    lUrl.contains(".mp4") -> builder.setMimeType(MimeTypes.VIDEO_MP4)
                    lUrl.contains(".mkv") || lUrl.contains(".webm") -> builder.setMimeType(MimeTypes.VIDEO_MATROSKA)
                }
            }
        }
        return builder.build()
    }

    private fun triggerAutoReconnect(reason: String) {
        val player = exoPlayer ?: return
        val url = currentStreamUrl
        if (url.isEmpty()) return

        if (retryCount < maxRetries) {
            retryCount++
            val attempt = retryCount
            notifyPlayerStatus("reconnecting", url, "$attempt/$maxRetries")
            mainHandler.postDelayed({
                if (currentStreamUrl == url && playerContainer.visibility == View.VISIBLE) {
                    try {
                        hasRenderedVideoFrame = false
                        bufferingStartMs = System.currentTimeMillis()
                        lastPositionChangeMs = System.currentTimeMillis()
                        player.stop()
                        player.clearMediaItems()
                        player.setMediaItem(buildMediaItemForAttempt(url, attempt))
                        player.prepare()
                        player.playWhenReady = true
                    } catch (_: Throwable) {}
                }
            }, 650L)
        } else {
            // Después de agotar los intentos rápidos, marcamos el canal como No disponible en este momento
            notifyPlayerStatus("unavailable", url, reason)
        }
    }

    private fun notifyPlayerStatus(status: String, url: String, detail: String) {
        val safeStatus = JSONObject.quote(status)
        val safeUrl = JSONObject.quote(url)
        val safeDetail = JSONObject.quote(detail)
        runOnUiThread {
            webView.evaluateJavascript(
                "window.onNativePlayerStatus && window.onNativePlayerStatus($safeStatus, $safeUrl, $safeDetail);",
                null
            )
        }
    }

    private fun notifyVideoResolution(width: Int, height: Int) {
        runOnUiThread {
            webView.evaluateJavascript(
                "window.onNativeVideoResolution && window.onNativeVideoResolution($width, $height);",
                null
            )
        }
    }

    /**
     * Convierte coordenadas del lienzo 1280x720 (SceneGraph de Roku) a píxeles reales del televisor Android TV.
     */
    private fun updatePlayerBounds(x1280: Int, y720: Int, w1280: Int, h720: Int, fullScreen: Boolean) {
        val rootW = rootLayout.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels
        val rootH = rootLayout.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels

        if (fullScreen) {
            playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            playerContainer.layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        } else {
            playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
            val scaleX = rootW / 1280f
            val scaleY = rootH / 720f

            val left = (x1280 * scaleX).roundToInt()
            val top = (y720 * scaleY).roundToInt()
            val width = (w1280 * scaleX).roundToInt().coerceAtLeast(1)
            val height = (h720 * scaleY).roundToInt().coerceAtLeast(1)

            playerContainer.layoutParams = FrameLayout.LayoutParams(width, height, Gravity.TOP or Gravity.LEFT).apply {
                leftMargin = left
                topMargin = top
            }
        }
        playerContainer.visibility = View.VISIBLE
        playerContainer.requestLayout()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val rokuKey = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP,
                KeyEvent.KEYCODE_CHANNEL_UP -> "up"
                KeyEvent.KEYCODE_DPAD_DOWN,
                KeyEvent.KEYCODE_CHANNEL_DOWN -> "down"
                KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER,
                KeyEvent.KEYCODE_NUMPAD_ENTER,
                KeyEvent.KEYCODE_BUTTON_A -> "OK"
                KeyEvent.KEYCODE_BACK,
                KeyEvent.KEYCODE_ESCAPE,
                KeyEvent.KEYCODE_BUTTON_B -> "back"
                KeyEvent.KEYCODE_MENU,
                KeyEvent.KEYCODE_INFO,
                KeyEvent.KEYCODE_BUTTON_Y -> "info"
                KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0 -> "num_0"
                KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1 -> "num_1"
                KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2 -> "num_2"
                KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3 -> "num_3"
                KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4 -> "num_4"
                KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5 -> "num_5"
                KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6 -> "num_6"
                KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7 -> "num_7"
                KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8 -> "num_8"
                KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> "num_9"
                else -> null
            }

            if (rokuKey != null) {
                webView.evaluateJavascript(
                    "window.onRokuKey && window.onRokuKey('$rokuKey');",
                    null
                )
                return true
            }
        } else if (event.action == KeyEvent.ACTION_UP) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP,
                KeyEvent.KEYCODE_CHANNEL_UP,
                KeyEvent.KEYCODE_DPAD_DOWN,
                KeyEvent.KEYCODE_CHANNEL_DOWN,
                KeyEvent.KEYCODE_DPAD_LEFT,
                KeyEvent.KEYCODE_DPAD_RIGHT,
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER,
                KeyEvent.KEYCODE_NUMPAD_ENTER,
                KeyEvent.KEYCODE_BUTTON_A,
                KeyEvent.KEYCODE_BACK,
                KeyEvent.KEYCODE_ESCAPE,
                KeyEvent.KEYCODE_BUTTON_B,
                KeyEvent.KEYCODE_MENU,
                KeyEvent.KEYCODE_INFO,
                KeyEvent.KEYCODE_BUTTON_Y,
                KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0,
                KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1,
                KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2,
                KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3,
                KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4,
                KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5,
                KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6,
                KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7,
                KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8,
                KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.onRokuKey && window.onRokuKey('back');", null)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        if (playerContainer.visibility == View.VISIBLE) {
            exoPlayer?.play()
        }
    }

    override fun onPause() {
        super.onPause()
        exoPlayer?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(streamWatchdog)
        exoPlayer?.release()
        exoPlayer = null
        networkExecutor.shutdownNow()
    }

    private fun hideSystemUI() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    private fun buildInsecureOkHttpClient(): OkHttpClient {
        return try {
            val trustAllCerts = arrayOf<TrustManager>(
                object : X509TrustManager {
                    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
                    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
                    override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
                }
            )
            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, trustAllCerts, SecureRandom())
            val sslSocketFactory = sslContext.socketFactory

            OkHttpClient.Builder()
                .sslSocketFactory(sslSocketFactory, trustAllCerts[0] as X509TrustManager)
                .hostnameVerifier { _, _ -> true }
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .build()
        } catch (e: Exception) {
            safeHttpClient
        }
    }

    inner class AuraBridge {

        @SuppressLint("HardwareIds")
        private fun getRawAndroidId(): String {
            return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "942387990315"
        }

        private fun buildMacForGen(gen: Int): String {
            val base = getRawAndroidId().uppercase(Locale.US).filter { it in '0'..'9' || it in 'A'..'F' }
            val padded = if (gen <= 0) {
                (base + "942387990315").take(12)
            } else {
                val hashHex = (base + "AURA" + gen).hashCode().toUInt().toString(16).uppercase(Locale.US).padStart(8, '0')
                ("9423" + hashHex + base + "942387990315").take(12)
            }
            return "${padded.substring(0, 2)}:${padded.substring(2, 4)}:${padded.substring(4, 6)}:" +
                "${padded.substring(6, 8)}:${padded.substring(8, 10)}:${padded.substring(10, 12)}"
        }

        private fun buildKeyForGen(gen: Int): String {
            val raw = getRawAndroidId() + ":KEY:" + gen
            var h = 1125899906842597L
            for (ch in raw) {
                h = 31L * h + ch.code.toLong()
            }
            val pos = if (h < 0) -h else h
            val sixDigit = (pos % 900000L) + 100000L
            return sixDigit.toString().takeLast(6)
        }

        /**
         * Equivalente exacto a getDeviceMac() en MainScene.brs:
         * Genera una MAC única persistente para este televisor Android a partir de ANDROID_ID.
         */
        @JavascriptInterface
        fun getDeviceMac(): String {
            val storedMac = prefs.getString("deviceMac", null)
            if (!storedMac.isNullOrEmpty() && storedMac.length == 17) {
                return storedMac
            }
            val gen = prefs.getInt("identityGen", 0)
            val mac = buildMacForGen(gen)
            prefs.edit().putString("deviceMac", mac).apply()
            return mac
        }

        /**
         * Equivalente exacto a getOrCreateDeviceKey() en MainScene.brs:
         * Genera y guarda un código numérico determinista de 6 dígitos en el registro AuraTV.
         */
        @JavascriptInterface
        fun getOrCreateDeviceKey(): String {
            val stored = prefs.getString("deviceKey", null)
            if (!stored.isNullOrEmpty() && stored.length == 6) {
                return stored
            }
            val gen = prefs.getInt("identityGen", 0)
            val keyStr = buildKeyForGen(gen)
            prefs.edit().putString("deviceKey", keyStr).apply()
            return keyStr
        }

        /**
         * Si la MAC anterior quedó bloqueada en Firebase con un Device Key aleatorio viejo
         * tras reinstalar la APK (HTTP 403/409 DEVICE_KEY_MISMATCH), genera un par determinista
         * limpio para este ANDROID_ID y lo persiste.
         */
        @JavascriptInterface
        fun rotateDeviceIdentity(): String {
            val nextGen = prefs.getInt("identityGen", 0) + 1
            val newMac = buildMacForGen(nextGen)
            val newKey = buildKeyForGen(nextGen)
            prefs.edit()
                .putInt("identityGen", nextGen)
                .putString("deviceMac", newMac)
                .putString("deviceKey", newKey)
                .apply()
            return "$newMac|$newKey"
        }

        @JavascriptInterface
        fun readPref(key: String, defaultValue: String): String {
            return prefs.getString(key, defaultValue) ?: defaultValue
        }

        @JavascriptInterface
        fun writePref(key: String, value: String) {
            prefs.edit().putString(key, value).apply()
        }

        @JavascriptInterface
        fun playVideo(url: String, title: String, x: Int, y: Int, w: Int, h: Int, fullScreen: Boolean) {
            runOnUiThread {
                updatePlayerBounds(x, y, w, h, fullScreen)
                val player = exoPlayer ?: return@runOnUiThread

                if (currentStreamUrl != url || !player.isPlaying) {
                    currentStreamUrl = url
                    currentStreamTitle = title
                    retryCount = 0
                    hasRenderedVideoFrame = false
                    bufferingStartMs = System.currentTimeMillis()
                    lastPositionValue = -1L
                    lastPositionChangeMs = System.currentTimeMillis()

                    notifyPlayerStatus("loading", url, "")
                    player.stop()
                    player.clearMediaItems()
                    player.setMediaItem(buildMediaItemForAttempt(url, 0))
                    player.prepare()
                    player.playWhenReady = true
                }
            }
        }

        @JavascriptInterface
        fun moveVideo(x: Int, y: Int, w: Int, h: Int, fullScreen: Boolean) {
            runOnUiThread {
                updatePlayerBounds(x, y, w, h, fullScreen)
            }
        }

        @JavascriptInterface
        fun setAspectMode(mode: String) {
            runOnUiThread {
                playerView.resizeMode = when (mode) {
                    "fill" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                    "zoom" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            }
        }

        @JavascriptInterface
        fun stopVideo() {
            runOnUiThread {
                currentStreamUrl = ""
                currentStreamTitle = ""
                retryCount = 0
                bufferingStartMs = 0L
                exoPlayer?.stop()
                exoPlayer?.clearMediaItems()
                playerContainer.visibility = View.INVISIBLE
            }
        }

        @JavascriptInterface
        fun takeResponse(reqId: String): String {
            return responseQueue.remove(reqId) ?: "{}"
        }

        /**
         * Equivalente exacto a BackendTask.brs:
         * Ejecuta peticiones HTTP/HTTPS desde código nativo (sin límites de CORS ni fallos SSL en Android TV),
         * soporta modo insecure (IPTV) y modo diagnostic (Add-ons directos).
         */
        @JavascriptInterface
        fun executeRequest(reqJsonStr: String) {
            networkExecutor.execute {
                val responseObj = JSONObject()
                var action = ""
                try {
                    val req = JSONObject(reqJsonStr)
                    action = req.optString("action", "")
                    val url = req.optString("url", "")
                    val method = req.optString("method", "GET").uppercase(Locale.US)
                    val raw = req.optBoolean("raw", false)
                    val diagnostic = req.optBoolean("diagnostic", false)
                    val insecure = req.optBoolean("insecure", false)
                    val userAgent = req.optString("userAgent", "").ifEmpty { "VLC/3.0.9 LibVLC/3.0.9" }
                    val accept = req.optString("accept", "")

                    responseObj.put("action", action)
                    responseObj.put("raw", raw)
                    responseObj.put("diagnostic", diagnostic)

                    val reqBuilder = Request.Builder()
                        .url(url)
                        .header("User-Agent", userAgent)
                        .header("Cache-Control", "no-cache, no-store, must-revalidate")
                        .header("Pragma", "no-cache")

                    if (accept.isNotEmpty()) {
                        reqBuilder.header("Accept", accept)
                    }

                    if (method == "POST") {
                        val payloadObj = req.opt("payload")
                        val payloadStr = payloadObj?.toString() ?: "{}"
                        val body = payloadStr.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                        reqBuilder.post(body)
                    } else {
                        reqBuilder.get()
                    }

                    val builtRequest = reqBuilder.build()
                    val primaryClient = if (insecure) insecureHttpClient else safeHttpClient
                    val fallbackClient = if (insecure) safeHttpClient else insecureHttpClient

                    val response = try {
                        primaryClient.newCall(builtRequest).execute()
                    } catch (_: Throwable) {
                        fallbackClient.newCall(builtRequest).execute()
                    }

                    response.use { res ->
                        val code = res.code
                        responseObj.put("httpCode", code)
                        responseObj.put("failureReason", res.message)

                        if (action == "fetch_m3u" && code in 200..299 && res.body != null) {
                            // Parseo en streaming línea por línea para soportar listas M3U gigantes (3MB - 30MB+) sin usar RAM extra
                            val channelsArr = JSONArray()
                            val reader = BufferedReader(res.body!!.charStream())
                            var count = 1
                            var currentName = "Canal"
                            var currentCategory = "General"
                            var currentLogo = ""
                            var line: String? = reader.readLine()
                            while (line != null) {
                                val trimmed = line.trim()
                                if (trimmed.startsWith("#EXTINF", ignoreCase = true)) {
                                    currentLogo = ""
                                    val groupIdx = trimmed.indexOf("group-title=\"", ignoreCase = true)
                                    if (groupIdx >= 0) {
                                        val start = groupIdx + 13
                                        val end = trimmed.indexOf('"', start)
                                        if (end > start) {
                                            currentCategory = trimmed.substring(start, end).ifEmpty { "General" }
                                        }
                                    }
                                    val logoIdx = trimmed.indexOf("tvg-logo=\"", ignoreCase = true)
                                    if (logoIdx >= 0) {
                                        val lStart = logoIdx + 10
                                        val lEnd = trimmed.indexOf('"', lStart)
                                        if (lEnd > lStart) {
                                            currentLogo = trimmed.substring(lStart, lEnd).trim()
                                        }
                                    }
                                    val commaIdx = trimmed.indexOf(',')
                                    if (commaIdx >= 0 && commaIdx + 1 < trimmed.length) {
                                        currentName = trimmed.substring(commaIdx + 1).trim().ifEmpty { "Canal $count" }
                                    }
                                } else if (trimmed.startsWith("http://", ignoreCase = true) ||
                                    trimmed.startsWith("https://", ignoreCase = true) ||
                                    trimmed.startsWith("rtmp://", ignoreCase = true)
                                ) {
                                    val chObj = JSONObject()
                                    chObj.put("num", count++)
                                    chObj.put("name", currentName)
                                    chObj.put("url", trimmed)
                                    chObj.put("category", currentCategory)
                                    if (currentLogo.isNotEmpty()) {
                                        chObj.put("logo", currentLogo)
                                    }
                                    channelsArr.put(chObj)
                                    currentName = "Canal $count"
                                    currentLogo = ""
                                }
                                line = reader.readLine()
                            }
                            responseObj.put("parsedChannels", channelsArr)
                            responseObj.put("bodyStr", "#EXTM3U")
                        } else {
                            val bodyStr = res.body?.string() ?: ""
                            responseObj.put("bodyStr", bodyStr)
                        }
                    }
                } catch (e: Throwable) {
                    responseObj.put("action", action)
                    responseObj.put("error", "HTTP/Network Error")
                    responseObj.put("httpCode", 0)
                    responseObj.put("failureReason", e.localizedMessage ?: e.javaClass.simpleName)
                }

                val reqId = UUID.randomUUID().toString()
                responseQueue[reqId] = responseObj.toString()
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onNativeApiResponseId && window.onNativeApiResponseId('$reqId');",
                        null
                    )
                }
            }
        }
    }
}
