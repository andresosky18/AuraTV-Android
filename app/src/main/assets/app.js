/**
 * AURA TV v2.1 - Android TV Port
 * Replica al 100% la lógica de:
 * - MainScene.brs
 * - MoviesModule.brs
 * - AddonsModule.brs
 * - BackendTask.brs (conectado a AuraNative en Android TV)
 */

(function () {
    "use strict";

    // Conversión de colores de Roku "0xRRGGBBAA" a CSS "rgba(r,g,b,a)"
    function rokuColor(hexStr) {
        if (!hexStr) return "transparent";
        const clean = hexStr.replace(/^0x/i, "").replace(/^#/, "");
        if (clean.length === 8) {
            const r = parseInt(clean.substring(0, 2), 16);
            const g = parseInt(clean.substring(2, 4), 16);
            const b = parseInt(clean.substring(4, 6), 16);
            const a = (parseInt(clean.substring(6, 8), 16) / 255).toFixed(3);
            return `rgba(${r},${g},${b},${a})`;
        } else if (clean.length === 6) {
            return `#${clean}`;
        }
        return hexStr;
    }

    function pkgUri(uri) {
        if (!uri) return "";
        return uri.replace(/^pkg:\/+/i, "");
    }

    function el(id) {
        return document.getElementById(id);
    }

    // Escala exacta de esquina a esquina (0,0 -> 100%,100%) para cualquier TV (720p, 1080p, 4K)
    function resizeStage() {
        const scene = el("scene");
        if (!scene) return;
        const vw = document.documentElement.clientWidth || window.innerWidth || 1280;
        const vh = document.documentElement.clientHeight || window.innerHeight || 720;
        const scaleX = vw / 1280;
        const scaleY = vh / 720;
        scene.style.transform = `scale(${scaleX}, ${scaleY})`;
    }
    window.addEventListener("resize", resizeStage);

    // Estado global equivalente a "m" en BrightScript
    const m = {
        appState: "splash",
        lastState: "launcher",
        lastStateBeforePlayer: "regional",
        modalOpen: false,
        languageMenuOpen: false,
        languageMenuIndex: 0,

        regionalState: "categories",
        categories: [],
        currentCategoryChannels: [],
        lastCategoryIndex: 0,
        leftNavTop: 0,

        backendBaseUrl: "https://roku-backend-iptv.vercel.app/api/dispositivos",
        addonBaseUrl: "https://roku-backend-iptv.vercel.app/api/addons",
        portalBaseUrl: "https://auratv.site.je",
        deviceMac: "00:00:00:00:00:00",
        deviceKey: "123456",

        playlists: [],
        channels: [],
        filteredChannels: [],
        currentPreviewChannel: null,
        currentLoadedPlaylist: null,

        programRows: [
            { title: "Buscando programación...", time: "--:--" },
            { title: "Programación no disponible", time: "--:--" },
            { title: "Programación no disponible", time: "--:--" },
            { title: "Programación no disponible", time: "--:--" }
        ],
        days: [
            { num: "1", name: "Sáb" },
            { num: "2", name: "Dom" },
            { num: "3", name: "Lun" },
            { num: "4", name: "Mar" },
            { num: "5", name: "Mié" },
            { num: "6", name: "Jue" },
            { num: "7", name: "Vie" }
        ],

        playlistFocus: 0,
        addPlaylistFocus: 0,
        addPlaylistMode: "xtream",
        addHost: "",
        addUsername: "",
        addPassword: "",
        settingsFocus: 0,
        settingXtreamEpg: true,
        settingTmdb: true,
        entryOpen: false,
        entryField: "",
        entryText: "",
        language: "en",
        parentalPin: "",
        categoriesLocked: false,
        unlockGranted: false,
        pendingLockedCategory: null,

        launcherTiles: [
            { id: "live", label: "Live TV", x: 0, y: 0, w: 332, h: 196, layout: "main" },
            { id: "movies", label: "Movies", x: 356, y: 0, w: 332, h: 196, layout: "main" },
            { id: "series", label: "Series", x: 712, y: 0, w: 332, h: 196, layout: "main" },
            { id: "settings", label: "Settings", x: 36, y: 218, w: 260, h: 46, layout: "bar" },
            { id: "playlists", label: "Playlists", x: 392, y: 218, w: 260, h: 46, layout: "bar" },
            { id: "addons", label: "Add-ons", x: 748, y: 218, w: 260, h: 46, layout: "bar" }
        ],
        launcherTileIndex: 0,
        launcherTileNodes: [],

        leftNavItems: [],
        leftNavNodes: [],
        homeFocus: "left",
        leftIndex: 0,

        dayIndex: 0,
        dayNodes: [],
        programNodes: [],

        searchFocus: "keyboard",
        searchQuery: "",
        channelIndex: -1,
        channelTop: 0,
        visibleChannelRows: 14,
        searchChannelRowNodes: [],
        keyboardLayout: [
            ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "/", "\\", "DEL"],
            ["a", "s", "d", "f", "g", "h", "j", "k", "l", ".", ":", "DONE"],
            ["SHIFT", "z", "x", "c", "v", "b", "n", "m", ",", "?", "CLEAN", "SHIFT"],
            ["123", "SPACE", "123"]
        ],
        keyboardNodes: [],
        kbRow: 0,
        kbCol: 0,

        playlistRowNodes: [],
        addPlaylistFieldNodes: [],
        settingsItems: [],
        settingsRowNodes: [],
        entryLayout: [
            ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
            ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
            ["a", "s", "d", "f", "g", "h", "j", "k", "l", "."],
            ["z", "x", "c", "v", "b", "n", "m", ":", "/", "-"],
            ["DEL", "SPACE", "DONE"]
        ],
        entryNodes: [],
        entryRow: 0,
        entryCol: 0,

        // MoviesModule state
        movieCatalogs: [],
        movieItems: [],
        movieCatalogNodes: [],
        movieCardNodes: [],
        movieCatalogIndex: 0,
        movieItemIndex: 0,
        movieTop: 0,
        movieColumns: 4,
        movieVisibleCards: 8,
        movieFocusArea: "catalogs",
        movieMode: "idle",
        currentMovieCatalog: null,
        currentMovieMeta: null,
        movieDirectAddons: [],
        movieDirectAddonIndex: 0,
        movieCurrentDirectAddon: null,

        // AddonsModule state
        addonItems: [],
        addonRowNodes: [],
        addonIndex: 0,
        addonTop: 0,
        addonDirectQueue: [],
        addonDirectQueueIndex: 0,
        addonDirectResolvingIndex: -1,

        // Background sync state (every 3 seconds)
        syncInFlight: false,
        syncStartedAt: 0,
        channelLoadInFlight: false,
        channelLoadStartedAt: 0,
        pendingPlaylistToLoad: null,
        syncWheelStopTimer: null,

        // Estado del reproductor, salud de canales y temporizador del banner OSD (8s)
        channelStatusMap: {},
        currentPlayerStatus: "idle",
        currentPlayerDetail: "",
        osdBannerTimer: null,
        playerWatchdogStep1Timer: null,
        playerWatchdogStep2Timer: null,
        fallbackVideoBound: false,

        // 9 Funciones Pro IPTV + Índices O(1) para listas de 20,000+ canales sin lag
        favoriteUrls: [],
        favoriteSet: new Set(),
        recentUrls: [],
        channelByUrl: {},
        channelByNum: {},
        categoryNavItemsMap: {},
        categoryRawChannelsMap: {},
        currentCategoryRawChannels: [],
        lastWatchedUrl: "",
        lastWatchedName: "",
        previousChannel: null,
        videoResolutionLabel: "LIVE",
        aspectMode: "fill",
        miniGuideOpen: false,
        miniGuideIndex: 0,
        miniGuideTop: 0,
        miniGuideNodes: [],
        numericBuffer: "",
        numericTimer: null,
        toastTimer: null
    };

    function showToast(msg, durationMs) {
        const box = el("auraToastBox");
        if (!box) return;
        box.textContent = msg;
        box.classList.remove("hidden");
        if (m.toastTimer) clearTimeout(m.toastTimer);
        m.toastTimer = setTimeout(() => {
            box.classList.add("hidden");
        }, durationMs || 2600);
    }

    function isChannelFavorite(url) {
        return !!url && m.favoriteSet.has(url);
    }

    function toggleFavoriteChannel(ch) {
        if (!ch || !ch.url) return;
        const idx = m.favoriteUrls.indexOf(ch.url);
        if (idx >= 0) {
            m.favoriteUrls.splice(idx, 1);
            m.favoriteSet.delete(ch.url);
            showToast(`Quitado de Favoritos: ${ch.name}`);
        } else {
            m.favoriteUrls.unshift(ch.url);
            m.favoriteSet.add(ch.url);
            showToast(`★ Agregado a Favoritos: ${ch.name}`);
        }
        savePrefs();
        if (m.channels.length > 0) {
            updateCategoryCountsLabels();
        }
        if (m.appState === "regional") updateRegionalUi();
        if (m.appState === "player") {
            updatePlayerUi();
            showPlayerOsdBanner(8000);
            if (m.miniGuideOpen) updateMiniGuideUi();
        }
    }

    function recordRecentChannel(ch) {
        if (!ch || !ch.url) return;
        if (m.currentPreviewChannel && m.currentPreviewChannel.url && m.currentPreviewChannel.url !== ch.url) {
            m.previousChannel = m.currentPreviewChannel;
        }
        m.lastWatchedUrl = ch.url;
        m.lastWatchedName = ch.name || "";
        const existingIdx = m.recentUrls.indexOf(ch.url);
        if (existingIdx >= 0) m.recentUrls.splice(existingIdx, 1);
        m.recentUrls.unshift(ch.url);
        if (m.recentUrls.length > 20) m.recentUrls.length = 20;
        savePrefs();
        updateCategoryCountsLabels();
        updateChannelStatsUi();
    }

    function formatResolutionBadge(w, h) {
        const height = Number(h) || 0;
        const width = Number(w) || 0;
        if (height >= 2000 || width >= 3600) return "4K UHD";
        if (height >= 1000 || width >= 1800) return "1080p FHD";
        if (height >= 700 || width >= 1200) return "720p HD";
        if (height >= 460) return "SD " + height + "p";
        if (height > 0) return width + "x" + height;
        return "LIVE";
    }

    window.onNativeVideoResolution = function (width, height) {
        m.videoResolutionLabel = formatResolutionBadge(width, height);
        const badge = el("playerResBadge");
        if (badge) badge.textContent = m.videoResolutionLabel;
    };

    function cycleAspectRatio() {
        const order = ["fill", "fit", "zoom"];
        const labels = { fill: "16:9", fit: "ORIGINAL", zoom: "ZOOM" };
        const nextIdx = (order.indexOf(m.aspectMode) + 1) % order.length;
        m.aspectMode = order[nextIdx];

        if (hasNative() && typeof window.AuraNative.setAspectMode === "function") {
            window.AuraNative.setAspectMode(m.aspectMode);
        }
        const v = el("fallbackVideo");
        if (v) {
            if (m.aspectMode === "fill") v.style.objectFit = "fill";
            else if (m.aspectMode === "zoom") v.style.objectFit = "cover";
            else v.style.objectFit = "contain";
        }
        const aspectBadge = el("playerAspectBadge");
        if (aspectBadge) aspectBadge.textContent = labels[m.aspectMode] || "16:9";
        showToast(`Formato de pantalla: ${labels[m.aspectMode]}`);
        showPlayerOsdBanner(8000);
    }

    function getActivePlayerChannelList() {
        if (m.currentCategoryRawChannels && m.currentCategoryRawChannels.length > 0) {
            return m.currentCategoryRawChannels;
        }
        return m.channels;
    }

    function findChannelIndexFast(list, ch) {
        if (!list || list.length === 0 || !ch) return 0;
        if (list === m.channels && typeof ch._globalIdx === "number" && list[ch._globalIdx] === ch) {
            return ch._globalIdx;
        }
        if (typeof ch._catIdx === "number" && list[ch._catIdx] === ch) {
            return ch._catIdx;
        }
        const found = list.findIndex((c) => c && c.url === ch.url);
        return found >= 0 ? found : 0;
    }

    function buildMiniGuide() {
        const container = el("miniGuideRowsGroup");
        if (!container) return;
        container.innerHTML = "";
        m.miniGuideNodes = [];

        for (let i = 0; i < 11; i++) {
            const row = document.createElement("div");
            row.className = "abs hidden";
            row.style.left = "0px";
            row.style.top = (i * 50) + "px";
            row.style.width = "376px";
            row.style.height = "44px";
            row.style.cursor = "pointer";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "376px";
            bg.style.height = "44px";
            bg.style.background = "rgba(15, 22, 36, 0.85)";

            const num = document.createElement("div");
            num.className = "label font-small-bold center";
            num.style.left = "10px";
            num.style.top = "9px";
            num.style.width = "44px";
            num.style.height = "26px";
            num.style.borderRadius = "6px";
            num.style.background = "rgba(255,255,255,0.08)";
            num.style.color = "#38BDF8";

            const logo = document.createElement("img");
            logo.className = "abs hidden";
            logo.style.left = "62px";
            logo.style.top = "6px";
            logo.style.width = "32px";
            logo.style.height = "32px";
            logo.style.objectFit = "contain";
            logo.style.borderRadius = "6px";
            logo.style.background = "rgba(255,255,255,0.06)";
            logo.decoding = "async";
            logo.onerror = function () { this.classList.add("hidden"); };

            const name = document.createElement("div");
            name.className = "label font-small-bold";
            name.style.left = "102px";
            name.style.top = "10px";
            name.style.width = "260px";
            name.style.height = "24px";

            row.addEventListener("click", () => {
                const list = getActivePlayerChannelList();
                const idx = m.miniGuideTop + i;
                if (idx < list.length) {
                    m.miniGuideIndex = idx;
                    updateMiniGuideUi();
                    onRokuKey("OK");
                }
            });

            row.appendChild(bg);
            row.appendChild(num);
            row.appendChild(logo);
            row.appendChild(name);
            container.appendChild(row);
            m.miniGuideNodes.push({ row, bg, num, logo, name });
        }
    }

    function openMiniGuide() {
        const list = getActivePlayerChannelList();
        if (!list || list.length === 0) return;
        m.miniGuideOpen = true;
        m.miniGuideIndex = findChannelIndexFast(list, m.currentPreviewChannel);
        if (m.miniGuideIndex < m.miniGuideTop) m.miniGuideTop = m.miniGuideIndex;
        if (m.miniGuideIndex > m.miniGuideTop + 10) m.miniGuideTop = m.miniGuideIndex - 10;
        setVisible("playerMiniGuide", true);
        updateMiniGuideUi();
    }

    function closeMiniGuide() {
        m.miniGuideOpen = false;
        setVisible("playerMiniGuide", false);
    }

    function updateMiniGuideUi() {
        if (!m.miniGuideOpen) return;
        const list = getActivePlayerChannelList();
        if (m.miniGuideIndex < m.miniGuideTop) m.miniGuideTop = m.miniGuideIndex;
        if (m.miniGuideIndex > m.miniGuideTop + 10) m.miniGuideTop = m.miniGuideIndex - 10;
        if (m.miniGuideTop < 0) m.miniGuideTop = 0;

        const catSub = el("miniGuideCategoryLabel");
        if (catSub) {
            catSub.textContent = `${list.length} canales disponibles · OK para cambiar`;
        }

        m.miniGuideNodes.forEach((node, i) => {
            const idx = m.miniGuideTop + i;
            if (idx < list.length) {
                const ch = list[idx];
                node.row.classList.remove("hidden");
                node.num.textContent = String(ch.num || (idx + 1));

                if (ch.logo) {
                    if (node.logo.dataset.logo !== ch.logo) {
                        node.logo.dataset.logo = ch.logo;
                        node.logo.src = ch.logo;
                    }
                    node.logo.classList.remove("hidden");
                    node.name.style.left = "102px";
                    node.name.style.width = "260px";
                } else {
                    node.logo.classList.add("hidden");
                    node.name.style.left = "64px";
                    node.name.style.width = "298px";
                }

                const favPrefix = isChannelFavorite(ch.url) ? "★ " : "";
                const isPlayingNow = m.currentPreviewChannel && m.currentPreviewChannel.url === ch.url;
                node.name.textContent = favPrefix + (ch.name || "Canal") + (isPlayingNow ? "  • EN VIVO" : "");

                if (idx === m.miniGuideIndex) {
                    node.bg.style.background = "#FFFFFF";
                    node.bg.style.borderColor = "#38BDF8";
                    node.num.style.background = "#090D16";
                    node.num.style.color = "#38BDF8";
                    node.name.style.color = "#090D16";
                } else {
                    node.bg.style.background = isPlayingNow ? "rgba(29, 78, 216, 0.32)" : "rgba(15, 22, 36, 0.85)";
                    node.bg.style.borderColor = isPlayingNow ? "rgba(56, 189, 248, 0.45)" : "rgba(255,255,255,0.07)";
                    node.num.style.background = "rgba(255,255,255,0.08)";
                    node.num.style.color = "#38BDF8";
                    node.name.style.color = "#F8FAFC";
                }
            } else {
                node.row.classList.add("hidden");
            }
        });
    }

    function commitNumericZap() {
        if (m.numericTimer) {
            clearTimeout(m.numericTimer);
            m.numericTimer = null;
        }
        const numVal = parseInt(m.numericBuffer, 10);
        m.numericBuffer = "";
        setVisible("numericZapBox", false);
        if (!numVal || isNaN(numVal) || m.channels.length === 0) return;

        const targetCh = m.channelByNum[numVal] ||
            (numVal >= 1 && numVal <= m.channels.length ? m.channels[numVal - 1] : null);

        if (!targetCh) {
            showToast(`Canal #${numVal} no encontrado`);
            return;
        }

        if (m.appState === "player") {
            recordRecentChannel(targetCh);
            m.currentPreviewChannel = targetCh;
            m.currentPlayerStatus = "loading";
            m.currentPlayerDetail = "";
            updatePlayerUi();
            showPlayerOsdBanner(8000);
            startPlaybackWatchdog(targetCh.url);
            if (hasNative() && typeof window.AuraNative.playVideo === "function") {
                window.AuraNative.playVideo(targetCh.url, targetCh.name || "", 0, 0, 1280, 720, true);
            } else {
                const v = el("fallbackVideo");
                v.src = targetCh.url;
                v.load();
                v.play().catch(() => {});
            }
        } else {
            openPlayerPreview(targetCh);
            openPlayerFull();
        }
    }

    function handleNumberKey(digit) {
        if (m.entryOpen || m.appState === "search" || m.appState === "addPlaylist") return false;
        if (m.channels.length === 0) return false;
        if (m.numericBuffer.length >= 4) m.numericBuffer = "";
        m.numericBuffer += String(digit);

        const numVal = parseInt(m.numericBuffer, 10);
        const match = m.channels.find((c) => Number(c.num) === numVal) ||
            (numVal >= 1 && numVal <= m.channels.length ? m.channels[numVal - 1] : null);

        el("numericZapNumber").textContent = m.numericBuffer;
        el("numericZapName").textContent = match ? match.name : "Canal no encontrado";
        setVisible("numericZapBox", true);

        if (m.numericTimer) clearTimeout(m.numericTimer);
        m.numericTimer = setTimeout(commitNumericZap, 1350);
        return true;
    }

    function clearPlaybackWatchdog() {
        if (m.playerWatchdogStep1Timer) {
            clearTimeout(m.playerWatchdogStep1Timer);
            m.playerWatchdogStep1Timer = null;
        }
        if (m.playerWatchdogStep2Timer) {
            clearTimeout(m.playerWatchdogStep2Timer);
            m.playerWatchdogStep2Timer = null;
        }
    }

    function startPlaybackWatchdog(url) {
        clearPlaybackWatchdog();
        if (!url) return;

        const isNative = hasNative() && typeof window.AuraNative.playVideo === "function";
        const step1Delay = isNative ? 2800 : 1800;
        const step2Delay = isNative ? 5800 : 3800;

        m.playerWatchdogStep1Timer = setTimeout(() => {
            if (!m.currentPreviewChannel || m.currentPreviewChannel.url !== url) return;
            if (m.currentPlayerStatus === "playing" || m.currentPlayerStatus === "unavailable") return;

            if (!isNative) {
                const v = el("fallbackVideo");
                if (v && v.readyState >= 2 && v.videoWidth > 0 && !v.paused && !v.error) {
                    window.onNativePlayerStatus("playing", url, "");
                    return;
                }
                // Intento rápido de reconexión en navegador (ej. variante .m3u8 si era .ts)
                window.onNativePlayerStatus("reconnecting", url, "1/2");
                if (v) {
                    let retryUrl = url;
                    if (/\.ts(\?|$)/i.test(url) && url.indexOf("/live/") >= 0) {
                        retryUrl = url.replace(/\.ts(\?|$)/i, ".m3u8$1");
                    }
                    v.src = retryUrl;
                    v.load();
                    v.play().catch(() => {});
                }
            } else if (m.currentPlayerStatus === "loading" || m.currentPlayerStatus === "buffering") {
                window.onNativePlayerStatus("reconnecting", url, "1/2");
            }
        }, step1Delay);

        m.playerWatchdogStep2Timer = setTimeout(() => {
            if (!m.currentPreviewChannel || m.currentPreviewChannel.url !== url) return;
            if (m.currentPlayerStatus === "playing") {
                if (!isNative) {
                    const v = el("fallbackVideo");
                    if (v && v.videoWidth === 0) {
                        window.onNativePlayerStatus("unavailable", url, "Sin señal de video");
                    }
                }
                return;
            }
            window.onNativePlayerStatus("unavailable", url, "Sin señal de video");
        }, step2Delay);
    }

    function bindFallbackVideoEvents() {
        if (m.fallbackVideoBound) return;
        const v = el("fallbackVideo");
        if (!v) return;
        m.fallbackVideoBound = true;

        const checkVideoPlaying = () => {
            if (!m.currentPreviewChannel) return;
            const curUrl = m.currentPreviewChannel.url;
            if (v.videoWidth > 0 && !v.error) {
                clearPlaybackWatchdog();
                window.onNativeVideoResolution(v.videoWidth, v.videoHeight);
                window.onNativePlayerStatus("playing", curUrl, "");
            }
        };

        v.addEventListener("loadedmetadata", () => {
            if (v.videoWidth > 0) {
                window.onNativeVideoResolution(v.videoWidth, v.videoHeight);
            }
        });
        v.addEventListener("playing", checkVideoPlaying);
        v.addEventListener("loadeddata", checkVideoPlaying);
        v.addEventListener("timeupdate", () => {
            if (m.currentPlayerStatus !== "playing" && v.videoWidth > 0 && v.currentTime > 0) {
                checkVideoPlaying();
            }
        });
        v.addEventListener("waiting", () => {
            if (m.currentPreviewChannel && m.currentPlayerStatus === "playing") {
                startPlaybackWatchdog(m.currentPreviewChannel.url);
            }
        });
        v.addEventListener("stalled", () => {
            if (m.currentPreviewChannel) {
                startPlaybackWatchdog(m.currentPreviewChannel.url);
            }
        });
        v.addEventListener("error", () => {
            if (!m.currentPreviewChannel) return;
            const curUrl = m.currentPreviewChannel.url;
            if (m.currentPlayerStatus !== "reconnecting" && m.currentPlayerStatus !== "unavailable") {
                window.onNativePlayerStatus("reconnecting", curUrl, "1/2");
            }
        });
    }

    function showPlayerOsdBanner(durationMs) {
        const banner = el("playerBannerBox");
        if (!banner) return;
        banner.classList.remove("banner-hidden");
        if (m.osdBannerTimer) {
            clearTimeout(m.osdBannerTimer);
            m.osdBannerTimer = null;
        }
        const hideAfter = durationMs || 8000;
        m.osdBannerTimer = setTimeout(() => {
            if (m.appState === "player" && banner) {
                banner.classList.add("banner-hidden");
            }
        }, hideAfter);
    }

    function updateChannelStatsUi() {
        const total = m.channels.length;
        let offlineCount = 0;
        const statusKeys = Object.keys(m.channelStatusMap);
        for (let i = 0; i < statusKeys.length; i++) {
            if (m.channelStatusMap[statusKeys[i]] === "offline") offlineCount++;
        }
        const activeCount = Math.max(0, total - offlineCount);
        const catCount = Math.max(0, m.categories.length >= 3 ? m.categories.length - 3 : 0);

        const launcherStats = el("launcherChannelStatsLabel");
        const regionalStats = el("regionalChannelStatsLabel");

        if (total === 0) {
            const msg = m.playlists.length > 0
                ? "Cargando canales de tu lista..."
                : "Sin canales cargados · Vincula tu lista en auratv.site.je";
            if (launcherStats) launcherStats.textContent = msg;
            if (regionalStats) regionalStats.textContent = msg;
        } else {
            const lastTxt = m.lastWatchedName ? `   ·   Último: ${m.lastWatchedName}` : "";
            const summaryLauncher = `Canales activos: ${activeCount} / ${total} total   ·   Categorías: ${catCount}` +
                (m.favoriteUrls.length > 0 ? `   ·   ★ Favoritos: ${m.favoriteUrls.length}` : "") +
                (offlineCount > 0 ? `   ·   Caídos: ${offlineCount}` : "") +
                lastTxt;
            const summaryRegional = `Activos: ${activeCount} / Total: ${total}  ·  Categorías: ${catCount}` +
                (m.favoriteUrls.length > 0 ? `  ·  ★ Fav: ${m.favoriteUrls.length}` : "") +
                (offlineCount > 0 ? `  ·  Caídos: ${offlineCount}` : "");
            if (launcherStats) launcherStats.textContent = summaryLauncher;
            if (regionalStats) regionalStats.textContent = summaryRegional;
        }

        if (m.launcherTileNodes && m.launcherTileNodes[0] && m.launcherTileNodes[0].subLabel) {
            m.launcherTileNodes[0].subLabel.textContent = total > 0 ? `+${activeCount} Canales` : "0 Canales";
        }
        if (m.launcherTileNodes && m.launcherTileNodes[1] && m.launcherTileNodes[1].subLabel) {
            m.launcherTileNodes[1].subLabel.textContent = m.addonItems.length > 0 ? `${m.addonItems.length} Add-ons` : "Catálogos VOD";
        }
    }

    function updateStreamStatusOverlays() {
        const prevOverlay = el("previewStatusOverlay");
        const prevIcon = el("previewStatusIcon");
        const prevTitle = el("previewStatusTitle");
        const prevSub = el("previewStatusSubtitle");
        const fullBadge = el("playerStreamStatusBadge");
        const fullTitle = el("playerStreamStatusTitle");
        const fullSub = el("playerStreamStatusSub");

        const st = m.currentPlayerStatus;
        if (!m.currentPreviewChannel || st === "playing" || st === "idle") {
            if (prevOverlay) prevOverlay.classList.add("hidden");
            if (fullBadge) fullBadge.classList.add("hidden");
            return;
        }

        if (st === "reconnecting") {
            const attemptTxt = m.currentPlayerDetail ? ` (${m.currentPlayerDetail})` : "";
            if (prevIcon) prevIcon.textContent = "↻";
            if (prevOverlay && m.appState === "regional") {
                prevOverlay.classList.remove("hidden");
                prevTitle.textContent = "Reconectando señal" + attemptTxt + "...";
                prevSub.textContent = m.currentPreviewChannel.name || "";
            }
            if (fullBadge && m.appState === "player") {
                fullBadge.classList.remove("hidden");
                fullTitle.textContent = "Reconectando señal automáticamente" + attemptTxt + "...";
                fullSub.textContent = "Restableciendo transmisión sin salir del canal";
            }
        } else if (st === "unavailable") {
            if (prevIcon) prevIcon.textContent = "!";
            if (prevOverlay && m.appState === "regional") {
                prevOverlay.classList.remove("hidden");
                prevTitle.textContent = "Canal no disponible en el momento";
                prevSub.textContent = "Presiona OK para reintentar o selecciona otro canal";
            }
            if (fullBadge && m.appState === "player") {
                fullBadge.classList.remove("hidden");
                fullTitle.textContent = "Canal no disponible en el momento";
                fullSub.textContent = "Presiona OK para reintentar o ▲/▼ para cambiar de canal";
                showPlayerOsdBanner(8000);
            }
        } else {
            if (prevOverlay) prevOverlay.classList.add("hidden");
            if (fullBadge) fullBadge.classList.add("hidden");
        }
    }

    window.onNativePlayerStatus = function (status, url, detail) {
        if (!url || (m.currentPreviewChannel && m.currentPreviewChannel.url !== url)) return;
        m.currentPlayerStatus = status || "idle";
        m.currentPlayerDetail = detail || "";

        if (status === "playing") {
            clearPlaybackWatchdog();
            m.channelStatusMap[url] = "online";
            updateChannelStatsUi();
            if (m.appState === "regional") updateRegionalUi();
        } else if (status === "unavailable") {
            clearPlaybackWatchdog();
            m.channelStatusMap[url] = "offline";
            updateChannelStatsUi();
            if (m.appState === "regional") updateRegionalUi();
        }
        updateStreamStatusOverlays();
    };

    function startSyncWheelAnimation() {
        const launcherIcon = el("launcherSyncIcon");
        const playlistIcon = el("playlistRefreshIcon");
        if (launcherIcon) launcherIcon.classList.add("sync-spinning");
        if (playlistIcon) playlistIcon.classList.add("sync-spinning");
        if (m.syncWheelStopTimer) {
            clearTimeout(m.syncWheelStopTimer);
            m.syncWheelStopTimer = null;
        }
    }

    function stopSyncWheelAnimation() {
        const elapsed = Date.now() - (m.syncStartedAt || 0);
        const minSpinMs = 950;
        const remaining = Math.max(0, minSpinMs - elapsed);
        if (m.syncWheelStopTimer) clearTimeout(m.syncWheelStopTimer);
        m.syncWheelStopTimer = setTimeout(() => {
            if (!m.syncInFlight && !m.channelLoadInFlight) {
                const launcherIcon = el("launcherSyncIcon");
                const playlistIcon = el("playlistRefreshIcon");
                if (launcherIcon) launcherIcon.classList.remove("sync-spinning");
                if (playlistIcon) playlistIcon.classList.remove("sync-spinning");
            }
        }, remaining);
    }

    // --- CAPA NATIVA / PREFERENCIAS (SharedPreferences en Android TV o localStorage en navegador) ---
    function hasNative() {
        return typeof window.AuraNative !== "undefined" && window.AuraNative !== null;
    }

    function readRegistry(key, defVal) {
        if (hasNative() && typeof window.AuraNative.readPref === "function") {
            return window.AuraNative.readPref(key, defVal || "");
        }
        const v = localStorage.getItem("AuraTV_" + key);
        return v !== null ? v : (defVal || "");
    }

    function writeRegistry(key, val) {
        if (hasNative() && typeof window.AuraNative.writePref === "function") {
            window.AuraNative.writePref(key, String(val));
            return;
        }
        localStorage.setItem("AuraTV_" + key, String(val));
    }

    function getDeviceMac() {
        if (hasNative() && typeof window.AuraNative.getDeviceMac === "function") {
            return window.AuraNative.getDeviceMac();
        }
        let stored = localStorage.getItem("AuraTV_deviceMac");
        if (stored && stored.length === 17) return stored;
        const hex = "0123456789ABCDEF";
        const parts = ["94", "23"];
        for (let i = 0; i < 4; i++) {
            parts.push(
                hex.charAt(Math.floor(Math.random() * 16)) +
                hex.charAt(Math.floor(Math.random() * 16))
            );
        }
        stored = parts.join(":");
        localStorage.setItem("AuraTV_deviceMac", stored);
        return stored;
    }

    function getOrCreateDeviceKey() {
        if (hasNative() && typeof window.AuraNative.getOrCreateDeviceKey === "function") {
            return window.AuraNative.getOrCreateDeviceKey();
        }
        let stored = localStorage.getItem("AuraTV_deviceKey");
        if (stored && stored.length === 6) return stored;
        const seed = (Math.floor(Date.now() / 1000) % 900000) + 100000;
        stored = String(seed).slice(-6);
        localStorage.setItem("AuraTV_deviceKey", stored);
        return stored;
    }

    function refreshDeviceCredentialsUi() {
        if (el("macLabel")) el("macLabel").textContent = "MAC Address: " + m.deviceMac;
        if (el("webLabel")) el("webLabel").textContent = "Portal: " + m.portalBaseUrl;
        if (el("portalUrlLabel")) el("portalUrlLabel").textContent = m.portalBaseUrl;
        const verLbl = el("launcherVersionLabel");
        if (verLbl) verLbl.textContent = `Device Key: ${m.deviceKey}   ·   Version: 2.1`;
        if (el("settingsMacLabel")) el("settingsMacLabel").textContent = `${auraText("your_mac")}: ${m.deviceMac}`;
        if (el("deviceKeyLabel")) el("deviceKeyLabel").textContent = `${auraText("your_device_key")}: ${m.deviceKey}`;
        const credText = `MAC: ${m.deviceMac}   ·   Device Key: ${m.deviceKey}`;
        if (el("playlistsCredentialsLabel")) el("playlistsCredentialsLabel").textContent = credText;
        if (el("addPlaylistCredentialsLabel")) el("addPlaylistCredentialsLabel").textContent = credText;
    }

    function rotateDeviceIdentityOnMismatch() {
        if (m.identityRotatedOnce) return false;
        m.identityRotatedOnce = true;
        if (hasNative() && typeof window.AuraNative.rotateDeviceIdentity === "function") {
            const pair = String(window.AuraNative.rotateDeviceIdentity() || "").split("|");
            if (pair.length === 2 && pair[0] && pair[1]) {
                m.deviceMac = pair[0];
                m.deviceKey = pair[1];
            }
        } else {
            localStorage.removeItem("AuraTV_deviceMac");
            localStorage.removeItem("AuraTV_deviceKey");
            m.deviceMac = getDeviceMac();
            m.deviceKey = getOrCreateDeviceKey();
        }
        refreshDeviceCredentialsUi();
        showToast(`✓ Credenciales sincronizadas: MAC ${m.deviceMac} · Key ${m.deviceKey}`, 4500);
        setTimeout(() => syncPlaylistsFromWeb(false), 250);
        return true;
    }

    // --- BACKEND TASK (Peticiones HTTP/HTTPS vía OkHttp nativo en Android TV o fetch en navegador) ---
    function runBackendTask(req) {
        if (hasNative() && typeof window.AuraNative.executeRequest === "function") {
            window.AuraNative.executeRequest(JSON.stringify(req));
            return;
        }
        // Fallback para pruebas en navegador web
        const opts = {
            method: req.method || "GET",
            headers: {}
        };
        if (req.accept) opts.headers["Accept"] = req.accept;
        if (req.method === "POST") {
            opts.headers["Content-Type"] = "application/json";
            opts.body = JSON.stringify(req.payload || {});
        }
        fetch(req.url, opts)
            .then(async (resp) => {
                const code = resp.status;
                const text = await resp.text();
                if (req.diagnostic) {
                    if (code >= 200 && code < 300) {
                        if (req.raw) {
                            onApiResponse({ action: req.action, rawData: text, httpCode: code });
                        } else {
                            try {
                                onApiResponse({ action: req.action, data: JSON.parse(text), httpCode: code });
                            } catch (e) {
                                onApiResponse({ action: req.action, error: "Invalid JSON", httpCode: code, bodySnippet: text.substring(0, 220) });
                            }
                        }
                    } else {
                        onApiResponse({
                            action: req.action,
                            error: "HTTP/Network Error",
                            httpCode: code,
                            failureReason: resp.statusText || "",
                            bodySnippet: text.substring(0, 220)
                        });
                    }
                    return;
                }
                if (resp.ok && text) {
                    if (req.raw) {
                        onApiResponse({ action: req.action, rawData: text });
                    } else {
                        try {
                            onApiResponse({ action: req.action, data: JSON.parse(text) });
                        } catch (e) {
                            onApiResponse({ action: req.action, error: "Invalid JSON" });
                        }
                    }
                } else {
                    onApiResponse({ action: req.action, error: "Network Error", httpCode: code });
                }
            })
            .catch((err) => {
                onApiResponse({
                    action: req.action,
                    error: "HTTP/Network Error",
                    httpCode: 0,
                    failureReason: err && err.message ? err.message : "CORS / Network Error"
                });
            });
    }

    function parseRawPacket(pkt) {
        if (!pkt) return;
        const action = pkt.action || "";
        if (pkt.parsedChannels && Array.isArray(pkt.parsedChannels)) {
            onApiResponse({
                action,
                parsedChannels: pkt.parsedChannels,
                httpCode: pkt.httpCode || 200
            });
            return;
        }
        if (pkt.error) {
            onApiResponse({
                action,
                error: pkt.error,
                httpCode: pkt.httpCode || 0,
                failureReason: pkt.failureReason || ""
            });
            return;
        }
        const code = pkt.httpCode || 0;
        const bodyStr = pkt.bodyStr || "";
        const raw = !!pkt.raw;
        const diagnostic = !!pkt.diagnostic;

        if (diagnostic) {
            if (code >= 200 && code < 300) {
                if (raw) {
                    onApiResponse({ action, rawData: bodyStr, httpCode: code });
                } else {
                    try {
                        onApiResponse({ action, data: JSON.parse(bodyStr), httpCode: code });
                    } catch (e) {
                        onApiResponse({ action, error: "Invalid JSON", httpCode: code, bodySnippet: bodyStr.substring(0, 220) });
                    }
                }
            } else {
                onApiResponse({
                    action,
                    error: "HTTP/Network Error",
                    httpCode: code,
                    failureReason: pkt.failureReason || "",
                    bodySnippet: bodyStr.substring(0, 220)
                });
            }
            return;
        }

        if (code >= 200 && code < 300 && bodyStr.length > 0) {
            if (raw) {
                onApiResponse({ action, rawData: bodyStr });
            } else {
                try {
                    onApiResponse({ action, data: JSON.parse(bodyStr) });
                } catch (e) {
                    onApiResponse({ action, error: "Invalid JSON", failureReason: e.message });
                }
            }
        } else {
            onApiResponse({
                action,
                error: "Network Error",
                httpCode: code,
                failureReason: pkt.failureReason || bodyStr.substring(0, 120)
            });
        }
    }

    window.onNativeApiResponseId = function (reqId) {
        try {
            if (hasNative() && typeof window.AuraNative.takeResponse === "function") {
                const rawJson = window.AuraNative.takeResponse(reqId);
                const pkt = JSON.parse(rawJson);
                parseRawPacket(pkt);
            }
        } catch (e) {
            console.error("Error in onNativeApiResponseId", e);
        }
    };

    window.onNativeApiResponse = function (jsonStr) {
        try {
            const res = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
            if (res && res.bodyStr !== undefined) {
                parseRawPacket(res);
            } else {
                onApiResponse(res);
            }
        } catch (e) {
            console.error("Error parsing native API response", e);
        }
    };

    // --- INTERNACIONALIZACIÓN (Idéntica a auraText en MainScene.brs) ---
    function currentLanguageLabel() {
        if (m.language === "en") return "English";
        if (m.language === "zh") return "Chinese";
        return "Español";
    }

    function auraText(key) {
        const dict = {
            en: {
                live_tv: "Live TV",
                movies: "Movies",
                series: "Series",
                settings: "Settings",
                playlists: "Playlists",
                add_playlist: "Add playlist",
                xtream_account: "Xtream account",
                playlist: "Playlist",
                cancel: "Cancel",
                ok: "OK",
                website_visit: "Add playlists from the web:",
                or_scan: "Scan the QR code to open auratv.site.je",
                host: "Server URL",
                username: "Username",
                password: "Password",
                use_xtream: "Use XTREAM EPG",
                use_tmdb: "Use TMDB API",
                change_language: "Change language",
                set_parental_code: "Set parental PIN",
                lock_categories: "Lock categories",
                enter_pin: "Enter parental PIN",
                unlock_cat: "Unlock category",
                pin_saved_title: "Saved",
                pin_saved_desc: "Parental PIN saved.",
                pin_invalid_title: "Invalid PIN",
                pin_invalid_desc: "Enter at least 4 digits.",
                access_denied: "Incorrect PIN",
                access_denied_desc: "The parental PIN does not match.",
                channels: "CHANNELS",
                favorites: "Favorites",
                search_all: "Search all",
                results: "Results",
                program_searching: "Searching schedule...",
                program_unavailable: "Schedule unavailable",
                your_mac: "Your MAC",
                your_device_key: "Your device key",
                playlist_help_1: "To link this TV: open Settings and copy Your MAC + Your device key.",
                playlist_help_2: "Then open auratv.site.je and type both values manually.",
                syncing: "Updating...",
                sync_error: "Connection error.",
                synced: "Synced",
                no_playlists: "No playlists linked.",
                playlist_deleted: "Playlist removed locally.",
                add_required: "Complete Server, Username and Password.",
                add_success: "Playlist added successfully.",
                search_placeholder: "Type to search...",
                soon: "Coming soon",
                soon_default: "This section will be available soon.",
                close_hint: "Press OK or Back to close",
                movie_soon: "Movie library will be available soon.",
                movie_catalogs: "CATALOGS",
                movie_loading: "Loading movie library...",
                movie_no_addons: "No movie Add-ons are installed.",
                movie_install_hint: "Install compatible Add-ons at auratv.site.je",
                movie_no_items: "This catalog is empty.",
                movie_loading_detail: "Loading details...",
                movie_play: "PLAY",
                movie_detail_hint: "OK: play  ·  Back: library",
                movie_loading_stream: "Finding a compatible stream...",
                movie_no_stream: "No compatible direct stream was found.",
                series_soon: "Series library will be available soon.",
                addons: "Add-ons",
                addons_subtitle: "Installed Add-ons",
                addons_help_title: "Add Add-ons",
                addons_help_body: "Open auratv.site.je on your phone. Enter this TV's MAC and Device Key, then install a compatible manifest.json.",
                addons_loading: "Loading installed Add-ons...",
                addons_empty: "No Add-ons installed yet.",
                addons_back_hint: "Back: Home  ·  OK: Refresh",
                addon_direct_testing: "Testing direct access from this TV...",
                addon_direct_ready: "Direct access works on this TV.",
                addon_direct_failed: "This Add-on also rejected the connection.",
                movie_direct_loading: "Reading this Add-on directly from your TV...",
                unknown_channel: "Unknown channel",
                general_channels: "General channels"
            },
            zh: {
                live_tv: "Zhibo",
                movies: "Dianying",
                series: "Juji",
                settings: "Shezhi",
                playlists: "Bofang liebiao",
                add_playlist: "Tianjia bofang liebiao",
                xtream_account: "Xtream zhanghu",
                playlist: "Bofang liebiao",
                cancel: "Quxiao",
                ok: "Queding",
                website_visit: "Cong wangye tianjia bofang liebiao:",
                or_scan: "Saomiao QR ma dakai auratv.site.je",
                host: "Fuwuqi URL",
                username: "Yonghuming",
                password: "Mima",
                use_xtream: "Shiyong XTREAM EPG",
                use_tmdb: "Shiyong TMDB API",
                change_language: "Genggai yuyan",
                set_parental_code: "Shezhi jiazhang PIN",
                lock_categories: "Suoding fenlei",
                enter_pin: "Shuru jiazhang PIN",
                unlock_cat: "Jiesuo fenlei",
                pin_saved_title: "Yibaocun",
                pin_saved_desc: "Jiazhang PIN yibaocun.",
                pin_invalid_title: "PIN wuxiao",
                pin_invalid_desc: "Qing shuru zhishao 4 wei shuzi.",
                access_denied: "PIN cuowu",
                access_denied_desc: "Jiazhang PIN bu pipei.",
                channels: "PINDAO",
                favorites: "Shoucang",
                search_all: "Sousuo quanbu",
                results: "Sousuo jieguo",
                program_searching: "Zhengzai sousuo jiemu...",
                program_unavailable: "Zanwu jiemudan",
                your_mac: "Nide MAC",
                your_device_key: "Nide Device Key",
                playlist_help_1: "Bangding TV: dakai Shezhi, fuzhi MAC he Device Key.",
                playlist_help_2: "Ranhou dakai auratv.site.je, shoudong shuru liang ge zhi.",
                syncing: "Zhengzai gengxin...",
                sync_error: "Lianjie cuowu.",
                synced: "Yitongbu",
                no_playlists: "Meiyou yibangding de bofang liebiao.",
                playlist_deleted: "Bofang liebiao yishanchu.",
                add_required: "Qing tianxie fuwuqi, yonghuming he mima.",
                add_success: "Bofang liebiao tianjia chenggong.",
                search_placeholder: "Shuru neirong sousuo...",
                soon: "Jijiang tuichu",
                soon_default: "Ci gongneng jijiang tuichu.",
                close_hint: "An OK huo Back guanbi",
                movie_soon: "Dianying ku jijiang tuichu.",
                movie_catalogs: "MULU",
                movie_loading: "Zhengzai jiazai dianying...",
                movie_no_addons: "Meiyou dianying Add-on.",
                movie_install_hint: "Zai auratv.site.je anzhuang Add-on",
                movie_no_items: "Ci mulu meiyou neirong.",
                movie_loading_detail: "Zhengzai jiazai xiangqing...",
                movie_play: "BOFANG",
                movie_detail_hint: "OK bofang · Back fanhui",
                movie_loading_stream: "Zhengzai xunzhao shipin...",
                movie_no_stream: "Meiyou keyong de zhijie shipin.",
                series_soon: "Juji ku jijiang tuichu.",
                addons: "Add-ons",
                addons_subtitle: "Yianzhuang de Add-ons",
                addons_help_title: "Tianjia Add-ons",
                addons_help_body: "Yong shouji dakai auratv.site.je. Shuru TV de MAC he Device Key, ranhou anzhuang manifest.json.",
                addons_loading: "Zhengzai jiazai Add-ons...",
                addons_empty: "Hai meiyou Add-ons.",
                addons_back_hint: "Back: zhuye · OK: shuaxin",
                addon_direct_testing: "Zhengzai zhijie ceshi Add-on...",
                addon_direct_ready: "Zhijie lianjie chenggong.",
                addon_direct_failed: "Add-on ye jujue le lianjie.",
                movie_direct_loading: "Zhengzai zhijie duqu Add-on...",
                unknown_channel: "Weizhi pindao",
                general_channels: "Zonghe pindao"
            },
            es: {
                live_tv: "TV en vivo",
                movies: "Películas",
                series: "Series",
                settings: "Configuración",
                playlists: "Playlists",
                add_playlist: "Agregar playlist",
                xtream_account: "Cuenta Xtream",
                playlist: "Playlist",
                cancel: "Cancelar",
                ok: "OK",
                website_visit: "Agrega playlists desde la web:",
                or_scan: "Escanea el QR para abrir auratv.site.je",
                host: "Servidor URL",
                username: "Usuario",
                password: "Contraseña",
                use_xtream: "Usar XTREAM EPG",
                use_tmdb: "Usar API TMDB",
                change_language: "Cambiar idioma",
                set_parental_code: "Configurar PIN parental",
                lock_categories: "Bloquear categorías",
                enter_pin: "Ingresa el PIN parental",
                unlock_cat: "Desbloquear categoría",
                pin_saved_title: "Guardado",
                pin_saved_desc: "El PIN parental quedó guardado.",
                pin_invalid_title: "PIN inválido",
                pin_invalid_desc: "Ingresa al menos 4 dígitos.",
                access_denied: "PIN incorrecto",
                access_denied_desc: "El PIN parental no coincide.",
                channels: "CANALES",
                favorites: "Favoritos",
                search_all: "Buscar todos",
                results: "Resultados",
                program_searching: "Buscando programación...",
                program_unavailable: "Programación no disponible",
                your_mac: "Tu MAC",
                your_device_key: "Tu Device Key",
                playlist_help_1: "Para vincular esta TV: abre Configuración y copia Tu MAC + Tu Device Key.",
                playlist_help_2: "Luego entra a auratv.site.je y escribe ambos datos manualmente.",
                syncing: "Actualizando...",
                sync_error: "Error de conexión.",
                synced: "Sincronizado",
                no_playlists: "No hay playlists vinculadas.",
                playlist_deleted: "Playlist eliminada localmente.",
                add_required: "Completa Servidor, Usuario y Contraseña.",
                add_success: "Playlist agregada con éxito.",
                search_placeholder: "Escribe para buscar...",
                soon: "Próximamente",
                soon_default: "Esta sección estará disponible más adelante.",
                close_hint: "Presiona OK o Back para cerrar",
                movie_soon: "La biblioteca de películas estará disponible próximamente.",
                movie_catalogs: "CATÁLOGOS",
                movie_loading: "Cargando biblioteca de películas...",
                movie_no_addons: "No hay Add-ons de películas instalados.",
                movie_install_hint: "Instala Add-ons compatibles desde auratv.site.je",
                movie_no_items: "Este catálogo está vacío.",
                movie_loading_detail: "Cargando detalles...",
                movie_play: "REPRODUCIR",
                movie_detail_hint: "OK: reproducir  ·  Back: biblioteca",
                movie_loading_stream: "Buscando un stream compatible...",
                movie_no_stream: "No se encontró un stream directo compatible.",
                series_soon: "La biblioteca de series estará disponible próximamente.",
                addons: "Add-ons",
                addons_subtitle: "Add-ons instalados",
                addons_help_title: "Agregar Add-ons",
                addons_help_body: "Abre auratv.site.je en tu celular. Ingresa la MAC y Device Key de esta TV y luego instala un manifest.json compatible.",
                addons_loading: "Cargando Add-ons instalados...",
                addons_empty: "Todavía no tienes Add-ons instalados.",
                addons_back_hint: "Back: inicio  ·  OK: actualizar",
                addon_direct_testing: "Probando acceso directo desde esta TV...",
                addon_direct_ready: "El acceso directo funciona en esta TV.",
                addon_direct_failed: "Este Add-on también rechazó la conexión.",
                movie_direct_loading: "Leyendo este Add-on directamente desde tu TV...",
                unknown_channel: "Canal desconocido",
                general_channels: "Canales generales"
            }
        };
        const langMap = dict[m.language] || dict.es;
        return langMap[key] !== undefined ? langMap[key] : key;
    }

    function weekdayLong(dayIndex) {
        const en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const zh = ["Xingqi ri", "Xingqi yi", "Xingqi er", "Xingqi san", "Xingqi si", "Xingqi wu", "Xingqi liu"];
        const es = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        if (m.language === "en") return en[dayIndex];
        if (m.language === "zh") return zh[dayIndex];
        return es[dayIndex];
    }

    function weekdayShort(dayIndex) {
        const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const zh = ["Ri", "Yi", "Er", "San", "Si", "Wu", "Liu"];
        const es = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        if (m.language === "en") return en[dayIndex];
        if (m.language === "zh") return zh[dayIndex];
        return es[dayIndex];
    }

    function monthShort(monthIndex0) {
        const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        if (m.language === "en") return en[monthIndex0];
        if (m.language === "zh") return (monthIndex0 + 1) + " yue";
        return es[monthIndex0];
    }

    function savePrefs() {
        writeRegistry("language", m.language);
        writeRegistry("xtreamEpg", m.settingXtreamEpg ? "1" : "0");
        writeRegistry("tmdb", m.settingTmdb ? "1" : "0");
        writeRegistry("parentalPin", m.parentalPin);
        writeRegistry("categoriesLocked", m.categoriesLocked ? "1" : "0");
        writeRegistry("favoriteUrls", JSON.stringify(m.favoriteUrls || []));
        writeRegistry("recentUrls", JSON.stringify(m.recentUrls || []));
        writeRegistry("lastWatchedUrl", m.lastWatchedUrl || "");
        writeRegistry("lastWatchedName", m.lastWatchedName || "");
    }

    function loadPrefs() {
        const lang = (readRegistry("language", "en") || "en").toLowerCase();
        if (lang.startsWith("es")) m.language = "es";
        else if (lang.startsWith("zh")) m.language = "zh";
        else m.language = "en";

        m.settingXtreamEpg = readRegistry("xtreamEpg", "1") !== "0";
        m.settingTmdb = readRegistry("tmdb", "1") !== "0";
        m.parentalPin = readRegistry("parentalPin", "");
        m.categoriesLocked = readRegistry("categoriesLocked", "0") === "1";
        try {
            const favRaw = readRegistry("favoriteUrls", "[]");
            m.favoriteUrls = JSON.parse(favRaw || "[]");
            if (!Array.isArray(m.favoriteUrls)) m.favoriteUrls = [];
        } catch (e) {
            m.favoriteUrls = [];
        }
        m.favoriteSet = new Set(m.favoriteUrls);
        try {
            const recRaw = readRegistry("recentUrls", "[]");
            m.recentUrls = JSON.parse(recRaw || "[]");
            if (!Array.isArray(m.recentUrls)) m.recentUrls = [];
        } catch (e) {
            m.recentUrls = [];
        }
        m.lastWatchedUrl = readRegistry("lastWatchedUrl", "");
        m.lastWatchedName = readRegistry("lastWatchedName", "");
    }

    // --- CONSTRUCCIÓN DE NODOS DINÁMICOS (DISEÑO MODERNO PLAYBOX OLED BLACK) ---
    function getLauncherSvgIcon(tileId) {
        if (tileId === "live") {
            return `<svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 12L32 21L41 12" stroke="#FFFFFF" stroke-width="3.6"/>
                <rect x="10" y="21" width="44" height="33" rx="10" stroke="#FFFFFF" stroke-width="3.6"/>
                <polyline points="22 39 29 33 35 38 42 31" stroke="#FACC15" stroke-width="3.8"/>
            </svg>`;
        }
        if (tileId === "movies") {
            return `<svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="22" cy="22" r="9" stroke="#FFFFFF" stroke-width="3.5"/>
                <circle cx="40" cy="22" r="9" stroke="#FFFFFF" stroke-width="3.5"/>
                <rect x="12" y="31" width="34" height="22" rx="6" stroke="#FFFFFF" stroke-width="3.5"/>
                <rect x="19" y="37" width="12" height="10" rx="2.5" stroke="#FACC15" stroke-width="3.2"/>
                <line x1="37" y1="38" x2="40" y2="38" stroke="#FFFFFF" stroke-width="3.5"/>
                <line x1="37" y1="45" x2="40" y2="45" stroke="#FFFFFF" stroke-width="3.5"/>
                <path d="M46 37L56 32V52L46 47" stroke="#FFFFFF" stroke-width="3.5"/>
            </svg>`;
        }
        if (tileId === "series") {
            return `<svg viewBox="0 0 64 64" width="76" height="76" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="12" y="16" width="40" height="36" rx="8" stroke="#FFFFFF" stroke-width="3.5"/>
                <line x1="12" y1="27" x2="52" y2="27" stroke="#FFFFFF" stroke-width="3.5"/>
                <line x1="24" y1="16" x2="21" y2="27" stroke="#FFFFFF" stroke-width="3.2"/>
                <line x1="38" y1="16" x2="35" y2="27" stroke="#FFFFFF" stroke-width="3.2"/>
                <polygon points="28 34 39 40 28 46 28 34" stroke="#FACC15" stroke-width="3.4" fill="none"/>
            </svg>`;
        }
        if (tileId === "settings") {
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        }
        if (tileId === "playlists") {
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
        }
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`;
    }

    function buildLauncherTiles() {
        const container = el("launcherTilesGroup");
        container.innerHTML = "";
        m.launcherTileNodes = [];

        m.launcherTiles.forEach((tile, idx) => {
            const g = document.createElement("div");
            g.className = "abs launcher-card-wrap";
            g.style.left = tile.x + "px";
            g.style.top = tile.y + "px";
            g.style.width = tile.w + "px";
            g.style.height = tile.h + "px";
            g.style.cursor = "pointer";

            const topBar = document.createElement("div");
            topBar.className = "launcher-top-bar";

            const bg = document.createElement("div");
            bg.className = "abs launcher-card-bg" + (tile.layout === "bar" ? " pill-card" : "");
            bg.style.left = "0px";
            bg.style.top = "0px";
            bg.style.width = tile.w + "px";
            bg.style.height = tile.h + "px";

            const iconWrap = document.createElement("div");
            iconWrap.className = "abs";
            iconWrap.style.display = "flex";
            iconWrap.style.alignItems = "center";
            iconWrap.style.justifyContent = "center";
            iconWrap.innerHTML = getLauncherSvgIcon(tile.id);

            const label = document.createElement("div");
            label.className = "label font-medium-bold";
            label.textContent = tile.label;

            let subLabel = null;
            let metaRow = null;

            if (tile.layout === "main") {
                label.style.left = "28px";
                label.style.top = "30px";
                label.style.width = "195px";
                label.style.height = "36px";
                label.style.fontSize = "27px";
                label.style.fontWeight = "700";
                label.style.color = "#FFFFFF";

                iconWrap.style.left = (tile.w - 108) + "px";
                iconWrap.style.top = "56px";
                iconWrap.style.width = "84px";
                iconWrap.style.height = "84px";

                subLabel = document.createElement("div");
                subLabel.className = "label font-small-bold";
                subLabel.style.left = "28px";
                subLabel.style.top = "122px";
                subLabel.style.width = "185px";
                subLabel.style.height = "24px";
                subLabel.style.fontSize = "16px";
                subLabel.style.color = "#FFFFFF";
                subLabel.textContent = tile.id === "live"
                    ? "0 Canales"
                    : (tile.id === "movies" ? "Catálogos VOD" : "Próximamente");

                metaRow = document.createElement("div");
                metaRow.className = "label";
                metaRow.style.left = "28px";
                metaRow.style.top = "148px";
                metaRow.style.width = "185px";
                metaRow.style.height = "18px";
                metaRow.style.fontSize = "11.5px";
                metaRow.style.color = "rgba(255,255,255,0.62)";
                metaRow.textContent = tile.id === "live"
                    ? "↻ Sincronización activa"
                    : (tile.id === "movies" ? "↻ Add-ons vinculados" : "↻ En la nube");
            } else {
                topBar.style.display = "none";
                iconWrap.style.left = "26px";
                iconWrap.style.top = "14px";
                iconWrap.style.width = "18px";
                iconWrap.style.height = "18px";

                label.classList.add("center");
                label.style.left = "22px";
                label.style.top = "12px";
                label.style.width = (tile.w - 30) + "px";
                label.style.height = "22px";
                label.style.fontSize = "13.5px";
                label.style.fontWeight = "700";
                label.style.letterSpacing = "0.8px";
                label.style.textTransform = "uppercase";
                label.style.color = "#E2E8F0";
            }

            g.appendChild(bg);
            g.appendChild(topBar);
            g.appendChild(iconWrap);
            g.appendChild(label);
            if (subLabel) g.appendChild(subLabel);
            if (metaRow) g.appendChild(metaRow);

            g.addEventListener("mouseenter", () => {
                m.launcherTileIndex = idx;
                updateLauncherUi();
            });
            g.addEventListener("click", () => {
                m.launcherTileIndex = idx;
                updateLauncherUi();
                onRokuKey("OK");
            });

            container.appendChild(g);
            m.launcherTileNodes.push({ wrap: g, bg, icon: iconWrap, label, subLabel });
        });
    }

    function buildLeftNav() {
        if (m.leftNavNodes && m.leftNavNodes.length > 0) return;
        const container = el("leftNavGroup");
        container.innerHTML = "";
        m.leftNavNodes = [];

        for (let i = 0; i <= 12; i++) {
            const row = document.createElement("div");
            row.className = "abs";
            row.style.left = "0px";
            row.style.top = (i * 45) + "px";
            row.style.width = "382px";
            row.style.height = "40px";
            row.style.cursor = "pointer";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "382px";
            bg.style.height = "40px";
            bg.style.background = "#0D131F";

            const logoImg = document.createElement("img");
            logoImg.className = "abs hidden";
            logoImg.style.left = "10px";
            logoImg.style.top = "5px";
            logoImg.style.width = "30px";
            logoImg.style.height = "30px";
            logoImg.style.objectFit = "contain";
            logoImg.style.borderRadius = "6px";
            logoImg.style.background = "rgba(255,255,255,0.06)";
            logoImg.onerror = function () {
                this.classList.add("hidden");
            };

            const label = document.createElement("div");
            label.className = "label font-small-bold";
            label.style.left = "18px";
            label.style.top = "7px";
            label.style.width = "346px";
            label.style.height = "25px";

            row.addEventListener("click", () => {
                const dataIndex = m.leftNavTop + i;
                if (dataIndex < m.leftNavItems.length) {
                    m.homeFocus = "left";
                    m.leftIndex = dataIndex;
                    updateRegionalUi();
                    onRokuKey("OK");
                }
            });

            row.appendChild(bg);
            row.appendChild(logoImg);
            row.appendChild(label);
            container.appendChild(row);
            m.leftNavNodes.push({ row, bg, logoImg, label });
        }
    }

    function buildProgramRows() {
        const container = el("programListGroup");
        container.innerHTML = "";
        m.programNodes = [];

        m.programRows.forEach((item, idx) => {
            const row = document.createElement("div");
            row.className = "abs";
            row.style.left = "0px";
            row.style.top = (idx * 52) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "585px";
            bg.style.height = "44px";
            bg.style.background = "#0D131F";

            const icon = document.createElement("div");
            icon.className = "label font-small";
            icon.style.left = "16px";
            icon.style.top = "10px";
            icon.style.width = "18px";
            icon.style.height = "20px";
            icon.style.color = "#38BDF8";
            icon.textContent = "•";

            const title = document.createElement("div");
            title.className = "label font-small-bold";
            title.style.left = "42px";
            title.style.top = "10px";
            title.style.width = "390px";
            title.style.height = "24px";
            title.style.color = "#E2E8F0";
            title.textContent = item.title;

            const time = document.createElement("div");
            time.className = "label font-small right";
            time.style.left = "448px";
            time.style.top = "10px";
            time.style.width = "120px";
            time.style.height = "24px";
            time.style.color = "#64748B";
            time.textContent = item.time;

            row.appendChild(bg);
            row.appendChild(icon);
            row.appendChild(title);
            row.appendChild(time);
            container.appendChild(row);
            m.programNodes.push({ bg, title, time });
        });
    }

    function buildDays() {
        const container = el("daysGroup");
        container.innerHTML = "";
        m.dayNodes = [];

        m.days.forEach((day, idx) => {
            const row = document.createElement("div");
            row.className = "abs";
            row.style.left = "0px";
            row.style.top = (idx * 79) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "92px";
            bg.style.height = "70px";
            bg.style.background = "#0D131F";

            const numLabel = document.createElement("div");
            numLabel.className = "label font-medium-bold center";
            numLabel.style.left = "0px";
            numLabel.style.top = "8px";
            numLabel.style.width = "92px";
            numLabel.style.height = "28px";
            numLabel.textContent = day.num;

            const nameLabel = document.createElement("div");
            nameLabel.className = "label font-small center";
            nameLabel.style.left = "0px";
            nameLabel.style.top = "38px";
            nameLabel.style.width = "92px";
            nameLabel.style.height = "20px";
            nameLabel.style.color = "#94A3B8";
            nameLabel.textContent = day.name;

            row.appendChild(bg);
            row.appendChild(numLabel);
            row.appendChild(nameLabel);
            container.appendChild(row);
            m.dayNodes.push({ bg, numLabel, nameLabel });
        });
    }

    function buildSearchChannels() {
        const container = el("searchChannelsGroup");
        container.innerHTML = "";

        const bg = document.createElement("div");
        bg.className = "abs oled-card";
        bg.style.width = "395px";
        bg.style.height = "650px";

        const topBar = document.createElement("div");
        topBar.className = "abs";
        topBar.style.left = "14px";
        topBar.style.top = "16px";
        topBar.style.width = "367px";
        topBar.style.height = "46px";
        topBar.style.background = "#141D2E";
        topBar.style.borderRadius = "12px";

        const title = document.createElement("div");
        title.className = "label font-medium-bold";
        title.style.left = "34px";
        title.style.top = "22px";
        title.style.width = "260px";
        title.style.height = "34px";
        title.textContent = auraText("results");
        m.searchTitleLabel = title;

        container.appendChild(bg);
        container.appendChild(topBar);
        container.appendChild(title);

        m.searchChannelRowNodes = [];
        for (let i = 0; i < m.visibleChannelRows; i++) {
            const row = document.createElement("div");
            row.className = "abs hidden";
            row.style.left = "14px";
            row.style.top = (76 + i * 39) + "px";

            const rbg = document.createElement("div");
            rbg.className = "abs ui-row-bg";
            rbg.style.width = "367px";
            rbg.style.height = "34px";
            rbg.style.background = "#111827";

            const numLabel = document.createElement("div");
            numLabel.className = "label font-small-bold center";
            numLabel.style.left = "10px";
            numLabel.style.top = "6px";
            numLabel.style.width = "42px";
            numLabel.style.height = "20px";

            const logoLabel = document.createElement("div");
            logoLabel.className = "label font-small";
            logoLabel.style.left = "56px";
            logoLabel.style.top = "6px";
            logoLabel.style.width = "18px";
            logoLabel.style.height = "20px";
            logoLabel.textContent = "•";

            const nameLabel = document.createElement("div");
            nameLabel.className = "label font-small-bold";
            nameLabel.style.left = "80px";
            nameLabel.style.top = "6px";
            nameLabel.style.width = "272px";
            nameLabel.style.height = "20px";

            row.appendChild(rbg);
            row.appendChild(numLabel);
            row.appendChild(logoLabel);
            row.appendChild(nameLabel);
            container.appendChild(row);

            m.searchChannelRowNodes.push({ row, bg: rbg, numLabel, logoLabel, nameLabel });
        }
    }

    function getKeyWidth(value) {
        if (value === "DEL") return 56;
        if (value === "DONE") return 92;
        if (value === "CLEAN") return 92;
        if (value === "SHIFT") return 56;
        if (value === "123") return 56;
        if (value === "SPACE") return 480;
        if (value === "\\") return 42;
        return 46;
    }

    function buildKeyboard() {
        const container = el("searchKeyboardGroup");
        container.innerHTML = "";
        m.keyboardNodes = [];

        let y = 0;
        m.keyboardLayout.forEach((rowValues) => {
            let x = 0;
            const rowNodes = [];
            rowValues.forEach((value) => {
                const width = getKeyWidth(value);
                const g = document.createElement("div");
                g.className = "abs";
                g.style.left = x + "px";
                g.style.top = y + "px";

                const bg = document.createElement("div");
                bg.className = "abs ui-row-bg";
                bg.style.width = width + "px";
                bg.style.height = "44px";
                bg.style.background = "#111827";

                const label = document.createElement("div");
                label.className = "label font-small-bold center";
                label.style.left = "0px";
                label.style.top = "10px";
                label.style.width = width + "px";
                label.style.height = "22px";
                label.textContent = value;

                g.appendChild(bg);
                g.appendChild(label);
                container.appendChild(g);
                rowNodes.push({ bg, label, value });
                x += width + 7;
            });
            m.keyboardNodes.push(rowNodes);
            y += 52;
        });
    }

    function buildPlaylistRows() {
        const container = el("playlistRowsGroup");
        container.innerHTML = "";
        m.playlistRowNodes = [];

        for (let i = 0; i <= 5; i++) {
            const row = document.createElement("div");
            row.className = "abs hidden";
            row.style.top = (i * 62) + "px";
            row.style.cursor = "pointer";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "676px";
            bg.style.height = "54px";
            bg.style.background = "#0F1624";

            const num = document.createElement("div");
            num.className = "label font-small-bold center";
            num.style.left = "16px";
            num.style.top = "12px";
            num.style.width = "32px";
            num.style.height = "30px";
            num.style.borderRadius = "8px";
            num.style.background = "rgba(255,255,255,0.08)";
            num.textContent = String(i + 1);

            const name = document.createElement("div");
            name.className = "label font-medium-bold";
            name.style.left = "64px";
            name.style.top = "14px";
            name.style.width = "590px";
            name.style.height = "26px";

            row.addEventListener("click", () => {
                const idx = (m.playlistTop || 0) + i;
                if (idx < m.playlists.length) {
                    m.playlistFocus = idx;
                    updatePlaylistsUi();
                    onRokuKey("OK");
                }
            });

            row.appendChild(bg);
            row.appendChild(num);
            row.appendChild(name);
            container.appendChild(row);
            m.playlistRowNodes.push({ row, bg, num, name });
        }
    }

    function buildAddPlaylistFields() {
        m.addFieldKeys = ["host", "username", "password"];
        const container = el("addPlaylistFieldsGroup");
        container.innerHTML = "";
        m.addPlaylistFieldNodes = [];

        m.addFieldKeys.forEach((key, idx) => {
            const g = document.createElement("div");
            g.className = "abs";
            g.style.top = (idx * 64) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "640px";
            bg.style.height = "50px";
            bg.style.background = "#111827";

            const label = document.createElement("div");
            label.className = "label font-small-bold";
            label.style.left = "18px";
            label.style.top = "13px";
            label.style.width = "600px";
            label.style.height = "24px";
            label.textContent = auraText(key);

            g.appendChild(bg);
            g.appendChild(label);
            container.appendChild(g);
            m.addPlaylistFieldNodes.push({ bg, label, placeholderKey: key });
        });
    }

    function getSettingSvgIcon(key) {
        if (key === "use_xtream") {
            return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
        }
        if (key === "use_tmdb") {
            return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`;
        }
        if (key === "change_language") {
            return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
        }
        return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
    }

    function buildSettingsRows() {
        m.settingsItems = [
            { key: "use_xtream", toggle: true },
            { key: "use_tmdb", toggle: true },
            { key: "change_language", toggle: false },
            { key: "set_parental_code", toggle: false },
            { key: "lock_categories", toggle: true }
        ];
        const container = el("settingsRowsGroup");
        container.innerHTML = "";
        m.settingsRowNodes = [];

        m.settingsItems.forEach((item, i) => {
            const g = document.createElement("div");
            g.className = "abs";
            g.style.top = (i * 64) + "px";
            g.style.cursor = "pointer";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "620px";
            bg.style.height = "54px";
            bg.style.background = "#0F1624";

            const stripe = document.createElement("div");
            stripe.className = "abs";
            stripe.style.left = "0px";
            stripe.style.top = "10px";
            stripe.style.width = "5px";
            stripe.style.height = "34px";
            stripe.style.borderRadius = "4px";
            stripe.style.background = "#38BDF8";
            stripe.style.opacity = "0";

            const icon = document.createElement("div");
            icon.className = "abs setting-icon-badge";
            icon.style.left = "16px";
            icon.style.top = "9px";
            icon.innerHTML = getSettingSvgIcon(item.key);

            const label = document.createElement("div");
            label.className = "label font-medium-bold";
            label.style.left = "66px";
            label.style.top = "14px";
            label.style.width = "460px";
            label.style.height = "26px";
            label.textContent = auraText(item.key);

            const toggleBg = document.createElement("div");
            toggleBg.className = "abs";
            toggleBg.style.left = "550px";
            toggleBg.style.top = "14px";
            toggleBg.style.width = "50px";
            toggleBg.style.height = "26px";
            toggleBg.style.borderRadius = "999px";
            toggleBg.style.background = "#10B981";
            toggleBg.style.transition = "background-color 0.16s ease";

            const toggleDot = document.createElement("div");
            toggleDot.className = "abs";
            toggleDot.style.left = "577px";
            toggleDot.style.top = "17px";
            toggleDot.style.width = "20px";
            toggleDot.style.height = "20px";
            toggleDot.style.borderRadius = "50%";
            toggleDot.style.background = "#FFFFFF";
            toggleDot.style.transition = "left 0.16s ease";

            if (!item.toggle) {
                toggleBg.style.display = "none";
                toggleDot.style.display = "none";
            }

            g.addEventListener("click", () => {
                m.settingsFocus = i;
                updateSettingsUi();
                onRokuKey("OK");
            });

            g.appendChild(bg);
            g.appendChild(stripe);
            g.appendChild(icon);
            g.appendChild(label);
            g.appendChild(toggleBg);
            g.appendChild(toggleDot);
            container.appendChild(g);
            m.settingsRowNodes.push({ bg, stripe, icon, label, toggleBg, toggleDot });
        });
    }

    function buildEntryKeyboard() {
        const container = el("entryKeyboardGroup");
        container.innerHTML = "";
        m.entryNodes = [];
        m.entryRow = 0;
        m.entryCol = 0;

        let y = 0;
        m.entryLayout.forEach((vals) => {
            let x = 0;
            const rowNodes = [];
            vals.forEach((value) => {
                let w = 54;
                if (value === "DEL") w = 92;
                if (value === "SPACE") w = 380;
                if (value === "DONE") w = 100;

                const g = document.createElement("div");
                g.className = "abs";
                g.style.left = x + "px";
                g.style.top = y + "px";

                const bg = document.createElement("div");
                bg.className = "abs ui-row-bg";
                bg.style.width = w + "px";
                bg.style.height = "42px";
                bg.style.background = "#151E2E";

                const label = document.createElement("div");
                label.className = "label font-small-bold center";
                label.style.left = "0px";
                label.style.top = "10px";
                label.style.width = w + "px";
                label.style.height = "20px";
                label.textContent = value;

                g.appendChild(bg);
                g.appendChild(label);
                container.appendChild(g);
                rowNodes.push({ bg, label, value });
                x += w + 6;
            });
            m.entryNodes.push(rowNodes);
            y += 48;
        });
    }

    function buildMovieUi() {
        const catContainer = el("movieCatalogGroup");
        catContainer.innerHTML = "";
        m.movieCatalogNodes = [];

        for (let i = 0; i <= 6; i++) {
            const g = document.createElement("div");
            g.className = "abs hidden";
            g.style.top = (i * 58) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "245px";
            bg.style.height = "48px";
            bg.style.background = "#0F1624";

            const label = document.createElement("div");
            label.className = "label font-small-bold";
            label.style.left = "16px";
            label.style.top = "10px";
            label.style.width = "215px";
            label.style.height = "28px";

            g.appendChild(bg);
            g.appendChild(label);
            catContainer.appendChild(g);
            m.movieCatalogNodes.push({ group: g, bg, label });
        }

        const gridContainer = el("movieGridGroup");
        gridContainer.innerHTML = "";
        m.movieCardNodes = [];

        for (let i = 0; i <= 7; i++) {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const g = document.createElement("div");
            g.className = "abs hidden";
            g.style.left = (col * 205) + "px";
            g.style.top = (row * 238) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-card";
            bg.style.width = "184px";
            bg.style.height = "222px";
            bg.style.background = "#0F1624";

            const poster = document.createElement("img");
            poster.className = "abs";
            poster.style.left = "7px";
            poster.style.top = "7px";
            poster.style.width = "170px";
            poster.style.height = "170px";
            poster.style.objectFit = "fill";
            poster.style.borderRadius = "8px";
            poster.src = "images/movies_safe.png";
            poster.onerror = function () { this.src = "images/movies_safe.png"; };

            const label = document.createElement("div");
            label.className = "label font-small-bold center";
            label.style.left = "8px";
            label.style.top = "183px";
            label.style.width = "168px";
            label.style.height = "31px";

            g.appendChild(bg);
            g.appendChild(poster);
            g.appendChild(label);
            gridContainer.appendChild(g);
            m.movieCardNodes.push({ group: g, bg, poster, label });
        }
    }

    function buildAddonsUi() {
        const container = el("addonsRowsGroup");
        container.innerHTML = "";
        m.addonRowNodes = [];

        for (let i = 0; i <= 6; i++) {
            const g = document.createElement("div");
            g.className = "abs hidden";
            g.style.top = (i * 58) + "px";

            const bg = document.createElement("div");
            bg.className = "abs ui-row-bg";
            bg.style.width = "630px";
            bg.style.height = "50px";
            bg.style.background = "#0F1624";

            const nameLabel = document.createElement("div");
            nameLabel.className = "label font-small-bold";
            nameLabel.style.left = "18px";
            nameLabel.style.top = "13px";
            nameLabel.style.width = "380px";
            nameLabel.style.height = "24px";

            const metaLabel = document.createElement("div");
            metaLabel.className = "label font-small right";
            metaLabel.style.left = "405px";
            metaLabel.style.top = "14px";
            metaLabel.style.width = "205px";
            metaLabel.style.height = "22px";
            metaLabel.style.color = "#38BDF8";

            g.appendChild(bg);
            g.appendChild(nameLabel);
            g.appendChild(metaLabel);
            container.appendChild(g);
            m.addonRowNodes.push({ group: g, bg, nameLabel, metaLabel });
        }
    }

    // --- RELOJ EN TIEMPO REAL ---
    function updateRealTime() {
        const dt = new Date();
        let h = dt.getHours();
        const mins = dt.getMinutes();
        const period = h >= 12 ? "pm" : "am";
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        const minStr = mins < 10 ? "0" + mins : String(mins);
        const timeStr = `${h12}:${minStr} ${period}`;

        const wdText = weekdayLong(dt.getDay());
        const dayText = String(dt.getDate());
        const monthText = monthShort(dt.getMonth());
        const yearText = String(dt.getFullYear());

        el("launcherClockLabel").textContent = timeStr;
        el("clockLabel").textContent = timeStr;
        el("playerTimeLabel").textContent = timeStr;
        el("launcherDateLabel").textContent = wdText;
        el("launcherDate2Label").textContent = `${wdText}, ${dayText} ${monthText} ${yearText}`;
        el("playerDateLabel").textContent = `${yearText} / ${dt.getMonth() + 1} / ${dayText}`;

        for (let i = 0; i <= 6; i++) {
            const dayDt = new Date(dt.getTime() + i * 86400000);
            const shortName = weekdayShort(dayDt.getDay());
            const numStr = String(dayDt.getDate());
            if (i < m.days.length) {
                m.days[i].num = numStr;
                m.days[i].name = shortName;
            }
            if (m.dayNodes[i]) {
                m.dayNodes[i].numLabel.textContent = numStr;
                m.dayNodes[i].nameLabel.textContent = shortName;
            }
        }
    }

    // --- ACTUALIZACIÓN DE INTERFAZ ---
    function applyLanguageUi() {
        m.launcherTiles[0].label = auraText("live_tv");
        m.launcherTiles[1].label = auraText("movies");
        m.launcherTiles[2].label = auraText("series");
        m.launcherTiles[3].label = auraText("settings");
        m.launcherTiles[4].label = auraText("playlists");
        m.launcherTiles[5].label = auraText("addons");

        m.launcherTileNodes.forEach((node, i) => {
            if (node && node.label) node.label.textContent = m.launcherTiles[i].label;
        });

        el("regionalTitleLabel").textContent = auraText("channels");
        if (m.searchTitleLabel) m.searchTitleLabel.textContent = auraText("results");
        el("playlistsTitleLabel").textContent = auraText("playlists");
        el("addPlaylistTitleLabel").textContent = auraText("add_playlist");
        el("xtreamTabLabel").textContent = auraText("xtream_account");
        el("m3uTabLabel").textContent = auraText("playlist");
        el("cancelBtnLabel").textContent = auraText("cancel");
        el("okBtnLabel").textContent = auraText("ok");
        el("addInfoLabel1").textContent = auraText("website_visit");
        el("addInfoLabel2").textContent = auraText("or_scan");
        el("settingsTitleLabel").textContent = auraText("settings");

        // Movies & Addons labels
        el("moviesTitleLabel").textContent = auraText("movies");
        el("movieCatalogHeadingLabel").textContent = auraText("movie_catalogs");
        el("movieInstallHintLabel").textContent = auraText("movie_install_hint");
        el("moviePlayLabel").textContent = auraText("movie_play");
        el("movieDetailHintLabel").textContent = auraText("movie_detail_hint");

        el("addonsTitleLabel").textContent = auraText("addons");
        el("addonsSubtitleLabel").textContent = auraText("addons_subtitle");
        el("addonsHelpTitleLabel").textContent = auraText("addons_help_title");
        el("addonsHelpBodyLabel").textContent = auraText("addons_help_body");

        el("playlistHelpLabel1").textContent = auraText("playlist_help_1");
        el("playlistHelpLabel2").textContent = auraText("playlist_help_2");
        el("soonCloseLabel").textContent = auraText("close_hint");

        refreshDeviceCredentialsUi();

        m.settingsItems.forEach((item, i) => {
            let settingText = auraText(item.key);
            if (item.key === "change_language") settingText += ": " + currentLanguageLabel();
            if (m.settingsRowNodes[i]) m.settingsRowNodes[i].label.textContent = settingText;
        });

        m.leftNavItems.forEach((navItem) => {
            if (navItem.type === "favorite") navItem.label = `★ ${auraText("favorites")} (${m.favoriteUrls.length})`;
            if (navItem.type === "recent") navItem.label = `↺ Recientes (${m.recentUrls.length})`;
            if (navItem.type === "search") navItem.label = `🔍 ${auraText("search_all")}`;
        });
        refreshLeftNavRows();

        m.categories.forEach((catItem) => {
            if (catItem.type === "favorite") catItem.label = `★ ${auraText("favorites")} (${m.favoriteUrls.length})`;
            if (catItem.type === "recent") catItem.label = `↺ Recientes (${m.recentUrls.length})`;
            if (catItem.type === "search") catItem.label = `🔍 ${auraText("search_all")}`;
        });

        if (m.programRows.length >= 4) {
            m.programRows[0].title = auraText("program_searching");
            for (let i = 1; i <= 3; i++) m.programRows[i].title = auraText("program_unavailable");
        }
        m.programNodes.forEach((node, i) => {
            if (m.programRows[i]) node.title.textContent = m.programRows[i].title;
        });

        refreshAddPlaylistFieldText();
        updateRealTime();
        if (m.languageMenuOpen) updateLanguageMenuUi();
    }

    function setVisible(id, visible) {
        const node = el(id);
        if (!node) return;
        if (visible) node.classList.remove("hidden");
        else node.classList.add("hidden");
    }

    function updateAllUi() {
        applyLanguageUi();

        setVisible("splashGroup", m.appState === "splash");
        setVisible("launcherGroup", m.appState === "launcher");
        setVisible("regionalGroup", m.appState === "regional");
        setVisible("searchGroup", m.appState === "search");
        setVisible("moviesGroup", m.appState === "movies");
        setVisible("addonsGroup", m.appState === "addons");
        setVisible("playerGroup", m.appState === "player");
        setVisible("playlistsGroup", m.appState === "playlists");
        setVisible("addPlaylistGroup", m.appState === "addPlaylist");
        setVisible("settingsGroup", m.appState === "settings");
        setVisible("entryOverlayGroup", m.entryOpen);
        setVisible("soonGroup", m.modalOpen);

        // Si el reproductor está activo (en vista previa o pantalla completa), abrimos hueco transparente hacia ExoPlayer
        const hasPreviewVideo = m.appState === "regional" && m.currentPreviewChannel !== null;
        const isFullscreenVideo = m.appState === "player";
        el("sceneBg").style.display = (hasPreviewVideo || isFullscreenVideo) ? "none" : "block";

        const regBg = el("regionalBgLayer");
        const prevFrame = el("previewFrameBg");
        if (hasPreviewVideo) {
            regBg.classList.add("preview-hole");
            prevFrame.style.background = "transparent";
        } else {
            regBg.classList.remove("preview-hole");
            prevFrame.style.background = "#050608";
        }

        updateChannelStatsUi();
        updateLauncherUi();
        updateRegionalUi();
        updateSearchUi();
        updatePlayerUi();
        updatePlaylistsUi();
        updateAddPlaylistUi();
        updateSettingsUi();
        updateMoviesUi();
        updateAddonsUi();
        updateEntryUi();
    }

    function updateLauncherUi() {
        if (m.appState !== "launcher") return;
        m.launcherTileNodes.forEach((node, i) => {
            if (!node || !node.wrap) return;
            if (i === m.launcherTileIndex) {
                node.wrap.classList.add("focused");
            } else {
                node.wrap.classList.remove("focused");
            }
        });
    }

    function adjustLeftNavWindow() {
        if (m.leftIndex < 0) return;
        if (m.leftIndex < m.leftNavTop) m.leftNavTop = m.leftIndex;
        const lastVisible = m.leftNavTop + 12;
        if (m.leftIndex > lastVisible) m.leftNavTop = m.leftIndex - 12;
        if (m.leftNavTop < 0) m.leftNavTop = 0;
    }

    function refreshLeftNavRows() {
        m.leftNavNodes.forEach((node, i) => {
            const dataIndex = m.leftNavTop + i;
            if (dataIndex < m.leftNavItems.length) {
                node.row.classList.remove("hidden");
                const item = m.leftNavItems[dataIndex];
                let text = item.label;
                if (item.type === "channel" && item.channelData) {
                    const ch = item.channelData;
                    const favPrefix = isChannelFavorite(ch.url) ? "★ " : "";
                    const numPrefix = ch.num ? `${ch.num}. ` : "";
                    const st = m.channelStatusMap[ch.url];
                    if (st === "offline") {
                        text = `⚠ ${favPrefix}${numPrefix}${item.label} (No disp.)`;
                    } else if (st === "online") {
                        text = `● ${favPrefix}${numPrefix}${item.label}`;
                    } else {
                        text = `${favPrefix}${numPrefix}${item.label}`;
                    }
                    if (node.logoImg) {
                        if (ch.logo) {
                            if (node.logoImg.dataset.logo !== ch.logo) {
                                node.logoImg.dataset.logo = ch.logo;
                                node.logoImg.src = ch.logo;
                            }
                            node.logoImg.classList.remove("hidden");
                            node.label.style.left = "48px";
                            node.label.style.width = "320px";
                        } else {
                            node.logoImg.classList.add("hidden");
                            node.label.style.left = "18px";
                            node.label.style.width = "346px";
                        }
                    }
                } else if (node.logoImg) {
                    node.logoImg.classList.add("hidden");
                    node.label.style.left = "18px";
                    node.label.style.width = "346px";
                }
                node.label.textContent = text;
            } else {
                node.row.classList.add("hidden");
            }
        });
    }

    function updateRegionalUi() {
        if (m.appState !== "regional") return;
        refreshLeftNavRows();

        m.leftNavNodes.forEach((node, i) => {
            const dataIndex = m.leftNavTop + i;
            if (dataIndex < m.leftNavItems.length) {
                if (m.homeFocus === "left" && dataIndex === m.leftIndex) {
                    node.bg.style.background = "#FFFFFF";
                    node.bg.style.borderColor = "#38BDF8";
                    node.label.style.color = "#090D16";
                } else {
                    node.bg.style.background = "#0D131F";
                    node.bg.style.borderColor = "rgba(255,255,255,0.07)";
                    node.label.style.color = "#E2E8F0";
                }
            }
        });

        m.dayNodes.forEach((node, i) => {
            if (i === m.dayIndex) {
                node.bg.style.background = m.homeFocus === "days" ? "#FFFFFF" : "#1D4ED8";
                node.numLabel.style.color = m.homeFocus === "days" ? "#090D16" : "#FFFFFF";
                node.nameLabel.style.color = m.homeFocus === "days" ? "#334155" : "#CBD5E1";
            } else {
                node.bg.style.background = "#0D131F";
                node.numLabel.style.color = "#FFFFFF";
                node.nameLabel.style.color = "#64748B";
            }
        });
    }

    function adjustChannelWindow() {
        if (m.channelIndex < 0) return;
        if (m.channelIndex < m.channelTop) m.channelTop = m.channelIndex;
        const lastVisible = m.channelTop + m.visibleChannelRows - 1;
        if (m.channelIndex > lastVisible) m.channelTop = m.channelIndex - m.visibleChannelRows + 1;
        if (m.channelTop < 0) m.channelTop = 0;
    }

    function refreshSearchChannelRows() {
        m.searchChannelRowNodes.forEach((node, i) => {
            const dataIndex = m.channelTop + i;
            if (dataIndex < m.filteredChannels.length) {
                const item = m.filteredChannels[dataIndex];
                node.row.classList.remove("hidden");
                node.numLabel.textContent = String(item.num);
                node.nameLabel.textContent = item.name;
            } else {
                node.row.classList.add("hidden");
            }
        });
    }

    function refreshSearchResults() {
        const q = m.searchQuery.trim().toLowerCase();
        const MAX_RESULTS = 250;
        const out = [];
        const total = m.channels.length;
        if (!q) {
            const limit = Math.min(total, MAX_RESULTS);
            for (let i = 0; i < limit; i++) {
                out.push(m.channels[i]);
            }
        } else {
            for (let i = 0; i < total; i++) {
                const ch = m.channels[i];
                const nLower = ch._searchName !== undefined ? ch._searchName : (ch.name || "").toLowerCase();
                if (nLower.indexOf(q) >= 0 || String(ch.num || "").indexOf(q) >= 0 || (ch._searchCat || "").indexOf(q) >= 0) {
                    out.push(ch);
                    if (out.length >= MAX_RESULTS) break;
                }
            }
        }
        m.filteredChannels = out;
        if (m.filteredChannels.length === 0) {
            m.channelIndex = -1;
            m.channelTop = 0;
        } else {
            if (m.channelIndex < 0) m.channelIndex = 0;
            if (m.channelIndex >= m.filteredChannels.length) m.channelIndex = m.filteredChannels.length - 1;
            adjustChannelWindow();
        }
        refreshSearchChannelRows();
    }

    function updateSearchUi() {
        if (m.appState !== "search") return;
        el("searchQueryLabel").textContent = m.searchQuery;

        m.searchChannelRowNodes.forEach((node, i) => {
            const dataIndex = m.channelTop + i;
            if (dataIndex < m.filteredChannels.length) {
                if (m.searchFocus === "channels" && dataIndex === m.channelIndex) {
                    node.bg.style.background = "#FFFFFF";
                    node.numLabel.style.color = "#090D16";
                    node.logoLabel.style.color = "#090D16";
                    node.nameLabel.style.color = "#090D16";
                } else {
                    node.bg.style.background = "#111827";
                    node.numLabel.style.color = "#94A3B8";
                    node.logoLabel.style.color = "#38BDF8";
                    node.nameLabel.style.color = "#F1F5F9";
                }
            }
        });

        m.keyboardNodes.forEach((rowNodes, r) => {
            rowNodes.forEach((keyNode, c) => {
                if (m.searchFocus === "keyboard" && r === m.kbRow && c === m.kbCol) {
                    keyNode.bg.style.background = "#FFFFFF";
                    keyNode.label.style.color = "#090D16";
                } else {
                    keyNode.bg.style.background = "#111827";
                    keyNode.label.style.color = "#E2E8F0";
                }
            });
        });
    }

    function updatePlayerUi() {
        if (m.appState !== "player") return;
        if (m.currentPreviewChannel) {
            const ch = m.currentPreviewChannel;
            el("playerNumberLabel").textContent = String(ch.num || 1);
            el("playerNameLabel").textContent = ch.name || "";
            const catEl = el("playerCategoryLabel");
            if (catEl) {
                catEl.textContent = ch.category
                    ? String(ch.category).toUpperCase()
                    : "";
            }
            const logoEl = el("playerChannelLogo");
            if (logoEl) {
                if (ch.logo) {
                    logoEl.src = ch.logo;
                    logoEl.classList.remove("hidden");
                } else {
                    logoEl.classList.add("hidden");
                }
            }
            const favBadge = el("playerFavBadge");
            if (favBadge) {
                if (isChannelFavorite(ch.url)) {
                    favBadge.classList.remove("hidden");
                } else {
                    favBadge.classList.add("hidden");
                }
            }
            const resBadge = el("playerResBadge");
            if (resBadge) {
                resBadge.textContent = m.videoResolutionLabel || "LIVE";
            }
            const aspectBadge = el("playerAspectBadge");
            if (aspectBadge) {
                const labels = { fill: "16:9", fit: "ORIGINAL", zoom: "ZOOM" };
                aspectBadge.textContent = labels[m.aspectMode] || "16:9";
            }
        }
        updateStreamStatusOverlays();
    }

    function refreshPlaylistRows() {
        if (m.playlistTop === undefined) m.playlistTop = 0;
        if (m.playlistFocus >= 0 && m.playlistFocus < m.playlists.length) {
            if (m.playlistFocus < m.playlistTop) m.playlistTop = m.playlistFocus;
            if (m.playlistFocus > m.playlistTop + 5) m.playlistTop = m.playlistFocus - 5;
        }
        if (m.playlistTop < 0) m.playlistTop = 0;

        const activePl = m.pendingPlaylistToLoad || m.currentLoadedPlaylist;
        m.playlistRowNodes.forEach((node, i) => {
            const idx = m.playlistTop + i;
            if (idx < m.playlists.length) {
                const pl = m.playlists[idx];
                const isActive = activePl && (pl.id === activePl.id || samePlaylist(pl, activePl));
                const typeTag = pl.type === "m3u" ? "M3U" : "XTREAM";
                node.row.classList.remove("hidden");
                node.num.textContent = String(idx + 1);
                node.name.textContent = `${pl.name}   ·   ${typeTag}` + (isActive ? "   • ACTIVA" : "");
            } else {
                node.row.classList.add("hidden");
            }
        });
    }

    function updatePlaylistsUi() {
        if (m.appState !== "playlists") return;
        refreshPlaylistRows();
        const activePl = m.pendingPlaylistToLoad || m.currentLoadedPlaylist;
        m.playlistRowNodes.forEach((node, i) => {
            const idx = (m.playlistTop || 0) + i;
            if (idx < m.playlists.length) {
                const pl = m.playlists[idx];
                const isActive = activePl && (pl.id === activePl.id || samePlaylist(pl, activePl));
                if (m.playlistFocus === idx) {
                    node.bg.style.background = "#FFFFFF";
                    node.bg.style.borderColor = "#38BDF8";
                    node.num.style.background = "#090D16";
                    node.num.style.color = "#FFFFFF";
                    node.name.style.color = "#090D16";
                } else {
                    node.bg.style.background = isActive ? "rgba(16, 185, 129, 0.16)" : "#0F1624";
                    node.bg.style.borderColor = isActive ? "rgba(16, 185, 129, 0.45)" : "rgba(255,255,255,0.07)";
                    node.num.style.background = "rgba(255,255,255,0.08)";
                    node.num.style.color = isActive ? "#10B981" : "#94A3B8";
                    node.name.style.color = "#F8FAFC";
                }
            }
        });
        el("refreshBtnBg").style.background = m.playlistFocus === 100 ? "#38BDF8" : "#111827";
        el("addBtnBg").style.background = m.playlistFocus === 101 ? "#38BDF8" : "#111827";
        el("trashBtnBg").style.background = m.playlistFocus === 102 ? "#F43F5E" : "#111827";
    }

    function refreshAddPlaylistFieldText() {
        const vals = [m.addHost, m.addUsername, m.addPassword];
        m.addPlaylistFieldNodes.forEach((node, i) => {
            const val = vals[i];
            if (!val) {
                node.label.textContent = auraText(node.placeholderKey);
            } else if (i === 2) {
                node.label.textContent = "*".repeat(val.length);
            } else {
                node.label.textContent = val;
            }
        });
    }

    function updateAddPlaylistUi() {
        if (m.appState !== "addPlaylist") return;
        refreshAddPlaylistFieldText();
        if (m.addPlaylistMode === "xtream") {
            el("xtreamTabBg").style.background = "#FFFFFF";
            el("xtreamTabLabel").style.color = "#090D16";
            el("m3uTabBg").style.background = "#141C2B";
            el("m3uTabLabel").style.color = "#E2E8F0";
        } else {
            el("xtreamTabBg").style.background = "#141C2B";
            el("xtreamTabLabel").style.color = "#E2E8F0";
            el("m3uTabBg").style.background = "#FFFFFF";
            el("m3uTabLabel").style.color = "#090D16";
        }
        m.addPlaylistFieldNodes.forEach((node, i) => {
            if (m.addPlaylistFocus === i + 2) {
                node.bg.style.background = "#FFFFFF";
                node.label.style.color = "#090D16";
            } else {
                node.bg.style.background = "#111827";
                node.label.style.color = "#E2E8F0";
            }
        });
        if (m.addPlaylistFocus === 0) {
            el("xtreamTabBg").style.background = "#38BDF8";
            el("xtreamTabLabel").style.color = "#090D16";
        }
        if (m.addPlaylistFocus === 1) {
            el("m3uTabBg").style.background = "#38BDF8";
            el("m3uTabLabel").style.color = "#090D16";
        }
        el("cancelBtnBg").style.background = m.addPlaylistFocus === 5 ? "#FFFFFF" : "#141C2B";
        el("cancelBtnLabel").style.color = m.addPlaylistFocus === 5 ? "#090D16" : "#FFFFFF";
        el("okBtnBg").style.background = m.addPlaylistFocus === 6 ? "#10B981" : "#141C2B";
        el("okBtnLabel").style.color = "#FFFFFF";
    }

    function setToggleVisual(index, enabled) {
        const node = m.settingsRowNodes[index];
        if (!node) return;
        if (enabled) {
            node.toggleBg.style.background = "#10B981";
            node.toggleDot.style.left = "577px";
            node.toggleDot.style.background = "#FFFFFF";
        } else {
            node.toggleBg.style.background = "#334155";
            node.toggleDot.style.left = "553px";
            node.toggleDot.style.background = "#CBD5E1";
        }
    }

    function updateSettingsUi() {
        if (m.appState !== "settings") return;
        m.settingsRowNodes.forEach((node, i) => {
            if (i === m.settingsFocus) {
                node.bg.style.background = "#182236";
                node.bg.style.borderColor = "rgba(56,189,248,0.55)";
                node.stripe.style.opacity = "1";
                node.label.style.color = "#FFFFFF";
            } else {
                node.bg.style.background = "#0F1624";
                node.bg.style.borderColor = "rgba(255,255,255,0.07)";
                node.stripe.style.opacity = "0";
                node.label.style.color = "#CBD5E1";
            }
        });
        setToggleVisual(0, m.settingXtreamEpg);
        setToggleVisual(1, m.settingTmdb);
        setToggleVisual(4, m.categoriesLocked);
    }

    function updateEntryUi() {
        if (!m.entryOpen) return;
        el("entryValueLabel").textContent = m.entryText;
        m.entryNodes.forEach((row, r) => {
            row.forEach((node, c) => {
                if (r === m.entryRow && c === m.entryCol) {
                    node.bg.style.background = "#FFFFFF";
                    node.label.style.color = "#090D16";
                } else {
                    node.bg.style.background = "#151E2E";
                    node.label.style.color = "#E2E8F0";
                }
            });
        });
    }

    function updateLanguageMenuUi() {
        setVisible("languageGroup", m.languageMenuOpen);
        if (!m.languageMenuOpen) return;
        for (let i = 0; i <= 2; i++) {
            const bg = el("languageBg" + i);
            const lbl = el("languageLabel" + i);
            if (i === m.languageMenuIndex) {
                bg.style.background = "#FFFFFF";
                lbl.style.color = "#090D16";
            } else {
                bg.style.background = "#151E2E";
                lbl.style.color = "#FFFFFF";
            }
        }
    }

    // --- REPRODUCCIÓN DE VIDEO (ExoPlayer nativo en Android TV + fallback HTML5) ---
    function openPlayerPreview(item) {
        bindFallbackVideoEvents();
        recordRecentChannel(item);
        m.currentPreviewChannel = item;
        m.currentPlayerStatus = "loading";
        m.currentPlayerDetail = "";
        m.videoResolutionLabel = "LIVE";
        el("playerNameLabel").textContent = item.name || "";
        el("playerNumberLabel").textContent = String(item.num || 0);
        const catEl = el("playerCategoryLabel");
        if (catEl) catEl.textContent = item.category ? String(item.category).toUpperCase() : "";
        el("previewPoster").style.display = "none";
        updateStreamStatusOverlays();
        startPlaybackWatchdog(item.url);

        if (hasNative() && typeof window.AuraNative.playVideo === "function") {
            window.AuraNative.playVideo(item.url, item.name || "", 560, 102, 445, 320, false);
        } else {
            const v = el("fallbackVideo");
            v.style.display = "block";
            v.style.left = "560px";
            v.style.top = "102px";
            v.style.width = "445px";
            v.style.height = "320px";
            v.src = item.url;
            v.load();
            v.play().catch(() => {});
        }
        updateAllUi();
    }

    function openPlayerFull() {
        m.lastStateBeforePlayer = m.appState;
        m.appState = "player";
        closeMiniGuide();
        updateAllUi();
        showPlayerOsdBanner(8000);

        if (hasNative() && typeof window.AuraNative.moveVideo === "function") {
            window.AuraNative.moveVideo(0, 0, 1280, 720, true);
        } else {
            const v = el("fallbackVideo");
            v.style.display = "block";
            v.style.left = "0px";
            v.style.top = "0px";
            v.style.width = "1280px";
            v.style.height = "720px";
        }
    }

    function playChannelInFullscreenDirect(nextCh) {
        if (!nextCh) return;
        bindFallbackVideoEvents();
        recordRecentChannel(nextCh);
        m.currentPreviewChannel = nextCh;
        m.currentPlayerStatus = "loading";
        m.currentPlayerDetail = "";
        m.videoResolutionLabel = "LIVE";

        const list = getActivePlayerChannelList();
        const idx = findChannelIndexFast(list, nextCh);
        if (idx >= 0 && m.regionalState === "channels" && m.currentCategoryChannels.length > 0) {
            m.leftIndex = idx;
            adjustLeftNavWindow();
        }

        updatePlayerUi();
        if (m.miniGuideOpen) updateMiniGuideUi();
        showPlayerOsdBanner(8000);
        startPlaybackWatchdog(nextCh.url);

        if (hasNative() && typeof window.AuraNative.playVideo === "function") {
            window.AuraNative.playVideo(nextCh.url, nextCh.name || "", 0, 0, 1280, 720, true);
        } else {
            const v = el("fallbackVideo");
            v.src = nextCh.url;
            v.load();
            v.play().catch(() => {});
        }
    }

    function switchChannelInFullscreen(delta) {
        const list = getActivePlayerChannelList();
        if (!list || list.length === 0) return;

        let idx = findChannelIndexFast(list, m.currentPreviewChannel);
        if (idx < 0) idx = 0;
        idx = (idx + delta + list.length) % list.length;
        const nextCh = list[idx];
        playChannelInFullscreenDirect(nextCh);
    }

    function stopNativePlayer() {
        clearPlaybackWatchdog();
        m.currentPreviewChannel = null;
        m.currentPlayerStatus = "idle";
        m.currentPlayerDetail = "";
        if (m.osdBannerTimer) {
            clearTimeout(m.osdBannerTimer);
            m.osdBannerTimer = null;
        }
        el("previewPoster").style.display = "block";
        updateStreamStatusOverlays();
        if (hasNative() && typeof window.AuraNative.stopVideo === "function") {
            window.AuraNative.stopVideo();
        } else {
            const v = el("fallbackVideo");
            v.pause();
            v.removeAttribute("src");
            v.style.display = "none";
        }
    }

    // --- NAVEGACIÓN ENTRE PANTALLAS ---
    function backToLauncher() {
        m.appState = "launcher";
        m.unlockGranted = false;
        m.pendingLockedCategory = null;
        stopNativePlayer();
        updateAllUi();
    }

    function openSoon(title, desc) {
        m.modalOpen = true;
        el("soonTitleLabel").textContent = title;
        el("soonTextLabel").textContent = desc;
        updateAllUi();
    }

    function closeSoon() {
        m.modalOpen = false;
        updateAllUi();
    }

    function enterCategory(item) {
        if (!item) return;
        m.regionalState = "channels";
        m.lastCategoryIndex = m.leftIndex;
        m.currentCategoryChannels = [];
        m.currentCategoryRawChannels = [];

        if (item.type === "favorite") {
            (m.favoriteUrls || []).forEach((u) => {
                const ch = m.channelByUrl[u];
                if (ch) {
                    m.currentCategoryChannels.push({ label: ch.name, type: "channel", channelData: ch });
                    m.currentCategoryRawChannels.push(ch);
                }
            });
            if (m.currentCategoryChannels.length === 0) {
                showToast("Sin favoritos aún · Presiona ▶ o F sobre un canal para guardarlo ★");
                m.regionalState = "categories";
                return;
            }
        } else if (item.type === "recent") {
            (m.recentUrls || []).forEach((u) => {
                const ch = m.channelByUrl[u];
                if (ch) {
                    m.currentCategoryChannels.push({ label: ch.name, type: "channel", channelData: ch });
                    m.currentCategoryRawChannels.push(ch);
                }
            });
            if (m.currentCategoryChannels.length === 0) {
                showToast("Aún no hay canales recientes reproducidos");
                m.regionalState = "categories";
                return;
            }
        } else {
            m.currentCategoryChannels = m.categoryNavItemsMap[item.id] || [];
            m.currentCategoryRawChannels = m.categoryRawChannelsMap[item.id] || [];
        }

        m.leftNavItems = m.currentCategoryChannels;
        m.leftIndex = 0;
        m.leftNavTop = 0;
        adjustLeftNavWindow();
        updateRegionalUi();
    }

    function openRegional() {
        m.appState = "regional";
        m.homeFocus = "left";
        m.regionalState = "categories";
        if (m.categories.length > 0) m.leftNavItems = m.categories;
        m.leftIndex = m.lastCategoryIndex;
        adjustLeftNavWindow();

        if (m.channels.length === 0 && !m.channelLoadInFlight) {
            el("syncStatusLabel").textContent = auraText("syncing");
            const activePl = m.currentLoadedPlaylist || m.pendingPlaylistToLoad || m.playlists[0];
            if (activePl) {
                loadChannelsFromPlaylist(activePl);
            } else {
                syncPlaylistsFromWeb();
            }
        }
        updateAllUi();
    }

    function openSearch() {
        stopNativePlayer();
        m.appState = "search";
        m.searchFocus = "keyboard";
        m.kbRow = 0;
        m.kbCol = 0;
        refreshSearchResults();
        updateAllUi();
    }

    function openPlaylists() {
        m.appState = "playlists";
        m.playlistFocus = m.playlists.length > 0 ? 0 : 100;
        el("playlistSyncStatus").textContent = auraText("syncing");
        updateAllUi();
        syncPlaylistsFromWeb();
    }

    function openAddPlaylist() {
        m.appState = "addPlaylist";
        m.addPlaylistFocus = 0;
        m.addPlaylistMode = "xtream";
        el("addPlaylistStatus").textContent = "";
        updateAllUi();
    }

    function openSettings() {
        m.appState = "settings";
        m.settingsFocus = 0;
        updateAllUi();
    }

    function openEntry(field) {
        m.entryOpen = true;
        m.entryField = field;
        m.entryRow = 0;
        m.entryCol = 0;
        if (field === "host") {
            el("entryTitleLabel").textContent = auraText("host");
            m.entryText = m.addHost;
        } else if (field === "username") {
            el("entryTitleLabel").textContent = auraText("username");
            m.entryText = m.addUsername;
        } else if (field === "password") {
            el("entryTitleLabel").textContent = auraText("password");
            m.entryText = m.addPassword;
        } else if (field === "pinset") {
            el("entryTitleLabel").textContent = auraText("enter_pin");
            m.entryText = "";
        } else if (field === "unlock") {
            el("entryTitleLabel").textContent = auraText("unlock_cat");
            m.entryText = "";
        }
        setVisible("entryOverlayGroup", true);
        updateEntryUi();
    }

    function closeEntry(saveValue) {
        if (saveValue) {
            if (m.entryField === "host") m.addHost = m.entryText;
            if (m.entryField === "username") m.addUsername = m.entryText;
            if (m.entryField === "password") m.entryText && (m.addPassword = m.entryText);
            if (m.entryField === "password") m.addPassword = m.entryText;
            if (m.entryField === "pinset") {
                const pinv = m.entryText.replace(/\D/g, "");
                if (pinv.length >= 4) {
                    m.parentalPin = pinv.substring(0, 4);
                    savePrefs();
                    m.entryOpen = false;
                    if (m.pendingLockedCategory) {
                        const pending = m.pendingLockedCategory;
                        m.pendingLockedCategory = null;
                        m.unlockGranted = true;
                        updateAllUi();
                        enterCategory(pending);
                    } else {
                        updateAllUi();
                        openSoon(auraText("pin_saved_title"), auraText("pin_saved_desc"));
                    }
                    return;
                } else {
                    m.entryOpen = false;
                    updateAllUi();
                    openSoon(auraText("pin_invalid_title"), auraText("pin_invalid_desc"));
                    return;
                }
            }
            if (m.entryField === "unlock") {
                const pinv = m.entryText.replace(/\D/g, "");
                if (pinv === m.parentalPin && m.parentalPin !== "") {
                    m.unlockGranted = true;
                    m.entryOpen = false;
                    if (m.pendingLockedCategory) {
                        const pending = m.pendingLockedCategory;
                        m.pendingLockedCategory = null;
                        updateAllUi();
                        enterCategory(pending);
                    } else {
                        updateAllUi();
                    }
                    return;
                } else {
                    m.entryOpen = false;
                    updateAllUi();
                    openSoon(auraText("access_denied"), auraText("access_denied_desc"));
                    return;
                }
            }
        }
        m.entryOpen = false;
        updateAllUi();
    }

    function cycleLanguage() {
        if (m.language === "en") m.language = "es";
        else if (m.language === "es") m.language = "zh";
        else m.language = "en";
        savePrefs();
        updateAllUi();
    }

    // --- PLAYLISTS Y SINCRONIZACIÓN CONSTANTE CADA 3 SEGUNDOS CON EL MISMO BACKEND DE ROKU ---
    function normalizeHostUrl(rawHost) {
        const trimmed = String(rawHost || "").trim().replace(/\/+$/, "");
        if (!trimmed) return "";
        if (!/^https?:\/\//i.test(trimmed)) return "http://" + trimmed;
        return trimmed;
    }

    function samePlaylist(a, b) {
        if (!a || !b || a.type !== b.type) return false;
        if (a.type === "xtream") {
            return normalizeHostUrl(a.host) === normalizeHostUrl(b.host) &&
                String(a.username || "") === String(b.username || "") &&
                String(a.password || "") === String(b.password || "");
        }
        return String(a.url || a.host || "") === String(b.url || b.host || "");
    }

    function syncPlaylistsFromWeb(isBackground) {
        // Evitamos consumo de CPU/red en segundo plano cuando el usuario está navegando canales o viendo TV en vivo y ya tiene su playlist cargada
        if (isBackground && m.playlists.length > 0 && m.channels.length > 0 &&
            m.appState !== "playlists" && m.appState !== "addPlaylist" && m.appState !== "addons" && m.appState !== "launcher") {
            return;
        }
        if (m.appState === "player" && m.channels.length > 0) return;

        // Si el usuario está en la pantalla de Add-ons y no hay prueba directa corriendo, sincronizamos también Add-ons en segundo plano
        if (isBackground && m.appState === "addons" && m.addonDirectQueueIndex >= m.addonDirectQueue.length) {
            requestAddonsList(true);
        }

        const now = Date.now();
        if (m.syncInFlight && (now - m.syncStartedAt) < 8000) {
            return;
        }

        m.syncInFlight = true;
        m.syncStartedAt = now;
        if (!isBackground || m.playlists.length === 0 || m.appState === "playlists") {
            startSyncWheelAnimation();
            el("syncStatusLabel").textContent = auraText("syncing");
        }

        const macParam = encodeURIComponent(m.deviceMac);
        const keyParam = encodeURIComponent(m.deviceKey);
        const url = `${m.backendBaseUrl}?action=get&mac=${macParam}&key=${keyParam}&_t=${now}`;
        runBackendTask({ url, method: "GET", action: "sync", insecure: false });
    }

    function loadChannelsFromPlaylist(pl, forceReload) {
        if (!pl) return;
        const now = Date.now();
        if (!forceReload && m.channelLoadInFlight && (now - m.channelLoadStartedAt) < 20000 && samePlaylist(pl, m.pendingPlaylistToLoad)) {
            return;
        }
        if (forceReload) {
            stopNativePlayer();
            m.channels = [];
            m.categories = [];
            m.currentCategoryChannels = [];
            m.regionalState = "categories";
            m.lastCategoryIndex = 0;
            m.leftIndex = 0;
            m.leftNavTop = 0;
            m.leftNavItems = [
                { label: `★ ${auraText("favorites")} (${m.favoriteUrls.length})`, type: "favorite" },
                { label: `↺ Recientes (${m.recentUrls.length})`, type: "recent" },
                { label: `🔍 ${auraText("search_all")}`, type: "search" }
            ];
            updateChannelStatsUi();
        }
        m.channelLoadInFlight = true;
        m.channelLoadStartedAt = now;
        m.pendingPlaylistToLoad = pl;
        m.currentLoadedPlaylist = pl;
        writeRegistry("activePlaylistId", pl.id || "");
        startSyncWheelAnimation();
        el("syncStatusLabel").textContent = auraText("syncing");

        const rawUrl = String(pl.url || pl.host || "").trim();
        const isDirectM3u = pl.type === "m3u" || !pl.username || !pl.password || /\.m3u8?(\?|$)/i.test(rawUrl);

        if (!isDirectM3u && pl.type === "xtream") {
            const cleanHost = normalizeHostUrl(pl.host);
            const url = `${cleanHost}/player_api.php?username=${encodeURIComponent(pl.username)}&password=${encodeURIComponent(pl.password)}&action=get_live_streams`;
            runBackendTask({ url, method: "GET", action: "fetch_xtream", insecure: true });
        } else {
            const m3uUrl = normalizeHostUrl(rawUrl);
            runBackendTask({ url: m3uUrl, method: "GET", action: "fetch_m3u", raw: true, insecure: true });
        }
    }

    function saveNewPlaylist() {
        if (m.addPlaylistMode === "xtream" && (!m.addHost || !m.addUsername || !m.addPassword)) {
            el("addPlaylistStatus").textContent = auraText("add_required");
            return;
        }
        const name = m.addUsername || "Mi TV";
        const item = {
            id: "local-" + m.playlists.length,
            name,
            type: m.addPlaylistMode,
            host: m.addHost,
            username: m.addUsername,
            password: m.addPassword,
            url: m.addPlaylistMode === "m3u" ? m.addHost : ""
        };
        m.playlists.push(item);
        runBackendTask({
            url: m.backendBaseUrl,
            method: "POST",
            payload: { action: "upsert", mac: m.deviceMac, key: m.deviceKey, playlist: item },
            action: "upsert",
            insecure: false
        });
        el("addPlaylistStatus").textContent = auraText("add_success");
        m.addHost = "";
        m.addUsername = "";
        m.addPassword = "";
        openPlaylists();
    }

    function deleteSelectedPlaylist() {
        if (m.playlists.length === 0) return;
        let index = 0;
        if (m.playlistFocus >= 0 && m.playlistFocus < m.playlists.length) index = m.playlistFocus;
        const itemId = m.playlists[index].id;
        runBackendTask({
            url: m.backendBaseUrl,
            method: "POST",
            payload: { action: "delete", mac: m.deviceMac, key: m.deviceKey, id: itemId },
            action: "delete",
            insecure: false
        });
        m.playlists.splice(index, 1);
        if (m.playlists.length === 0) m.playlistFocus = 101;
        else if (index >= m.playlists.length) m.playlistFocus = m.playlists.length - 1;
        else m.playlistFocus = index;
        el("playlistSyncStatus").textContent = auraText("playlist_deleted");
        updatePlaylistsUi();
    }

    // --- MOVIES MODULE (Idéntico a MoviesModule.brs) ---
    function openMovies() {
        m.appState = "movies";
        m.movieMode = "loading";
        m.movieFocusArea = "catalogs";
        m.movieCatalogIndex = 0;
        m.movieItemIndex = 0;
        m.movieTop = 0;
        m.movieCatalogs = [];
        m.movieItems = [];
        m.currentMovieCatalog = null;
        m.currentMovieMeta = null;
        el("movieStatusLabel").textContent = auraText("movie_loading");
        el("movieDetailStatusLabel").textContent = "";
        updateAllUi();

        const url = `${m.addonBaseUrl}?action=list&mac=${m.deviceMac}&key=${m.deviceKey}`;
        runBackendTask({ url, method: "GET", action: "movie_addons", insecure: true });
    }

    function addonBaseFromManifestUrl(manifestUrl) {
        let base = manifestUrl || "";
        const q = base.indexOf("?");
        if (q >= 0) base = base.substring(0, q);
        const p = base.toLowerCase().indexOf("/manifest.json");
        if (p >= 0) base = base.substring(0, p);
        return base.replace(/\/+$/, "");
    }

    function finishMovieAddonDiscovery() {
        if (m.movieCatalogs.length === 0) {
            m.movieMode = "grid";
            el("movieStatusLabel").textContent = auraText("movie_no_addons");
            updateMoviesUi();
        } else {
            m.movieCatalogIndex = 0;
            m.movieFocusArea = "catalogs";
            requestMovieCatalog(0);
        }
    }

    function requestNextMovieDirectManifest() {
        if (m.movieDirectAddonIndex >= m.movieDirectAddons.length) {
            finishMovieAddonDiscovery();
            return;
        }
        const addon = m.movieDirectAddons[m.movieDirectAddonIndex];
        m.movieCurrentDirectAddon = addon;
        runBackendTask({
            url: addon.manifestUrl,
            method: "GET",
            action: "movie_direct_manifest",
            insecure: false,
            userAgent: "AuraTV/1.0 Roku",
            accept: "application/json, text/json;q=0.9, */*;q=0.2"
        });
    }

    function requestMovieCatalog(index) {
        if (index < 0 || index >= m.movieCatalogs.length) return;
        m.movieCatalogIndex = index;
        m.currentMovieCatalog = m.movieCatalogs[index];
        m.movieMode = "loading";
        el("movieStatusLabel").textContent = auraText("movie_loading");
        updateMoviesUi();
        const c = m.currentMovieCatalog;

        if (c.mode === "direct") {
            const url = `${c.baseUrl}/catalog/movie/${encodeURIComponent(c.catalogId)}.json`;
            runBackendTask({
                url,
                method: "GET",
                action: "movie_direct_catalog",
                insecure: false,
                userAgent: "AuraTV/1.0 Roku",
                accept: "application/json, text/json;q=0.9, */*;q=0.2"
            });
        } else {
            const url = `${m.addonBaseUrl}?action=catalog&mac=${m.deviceMac}&key=${m.deviceKey}&addonId=${c.addonId}&type=movie&catalogId=${c.catalogId}`;
            runBackendTask({ url, method: "GET", action: "movie_catalog", insecure: true });
        }
    }

    function requestMovieMeta() {
        if (m.movieItemIndex < 0 || m.movieItemIndex >= m.movieItems.length || !m.currentMovieCatalog) return;
        const item = m.movieItems[m.movieItemIndex];
        if (!item || !item.id) return;
        m.movieMode = "loading_detail";
        el("movieStatusLabel").textContent = auraText("movie_loading_detail");
        updateMoviesUi();
        const c = m.currentMovieCatalog;

        if (c.mode === "direct") {
            const url = `${c.baseUrl}/meta/movie/${encodeURIComponent(item.id)}.json`;
            runBackendTask({
                url,
                method: "GET",
                action: "movie_direct_meta",
                insecure: true,
                userAgent: "AuraTV/1.0 Roku",
                accept: "application/json, text/json;q=0.9, */*;q=0.2"
            });
        } else {
            const url = `${m.addonBaseUrl}?action=meta&mac=${m.deviceMac}&key=${m.deviceKey}&addonId=${c.addonId}&type=movie&id=${item.id}`;
            runBackendTask({ url, method: "GET", action: "movie_meta", insecure: true });
        }
    }

    function requestMovieStream() {
        if (!m.currentMovieMeta || !m.currentMovieCatalog || !m.currentMovieMeta.id) return;
        el("movieDetailStatusLabel").textContent = auraText("movie_loading_stream");
        const c = m.currentMovieCatalog;

        if (c.mode === "direct") {
            const url = `${c.baseUrl}/stream/movie/${encodeURIComponent(m.currentMovieMeta.id)}.json`;
            runBackendTask({
                url,
                method: "GET",
                action: "movie_direct_streams",
                insecure: true,
                userAgent: "AuraTV/1.0 Roku",
                accept: "application/json, text/json;q=0.9, */*;q=0.2"
            });
        } else {
            const url = `${m.addonBaseUrl}?action=streams&mac=${m.deviceMac}&key=${m.deviceKey}&addonId=${c.addonId}&type=movie&id=${m.currentMovieMeta.id}`;
            runBackendTask({ url, method: "GET", action: "movie_streams", insecure: true });
        }
    }

    function renderMovieDetail() {
        if (!m.currentMovieMeta) return;
        const meta = m.currentMovieMeta;
        const movieName = meta.name || "";
        el("movieDetailTitle").textContent = movieName;
        el("movieDetailPoster").src = meta.poster || "images/movies_safe.png";

        const backdrop = el("movieDetailBackdrop");
        if (meta.background) {
            backdrop.src = meta.background;
            backdrop.style.display = "block";
        } else {
            backdrop.style.display = "none";
        }

        el("movieDetailDescription").textContent = meta.description || movieName;
        const parts = [];
        if (meta.releaseInfo) parts.push(meta.releaseInfo);
        if (meta.runtime) parts.push(meta.runtime);
        if (meta.imdbRating) parts.push("IMDb " + meta.imdbRating);
        el("movieDetailMeta").textContent = parts.join("  ·  ");
        el("movieDetailStatusLabel").textContent = "";
    }

    function updateMoviesUi() {
        if (m.appState !== "movies") return;
        setVisible("movieDetailGroup", m.movieMode === "detail");

        let catalogTop = 0;
        if (m.movieCatalogIndex > 6) catalogTop = m.movieCatalogIndex - 6;
        m.movieCatalogNodes.forEach((node, i) => {
            const idx = catalogTop + i;
            if (idx < m.movieCatalogs.length) {
                node.group.classList.remove("hidden");
                node.label.textContent = m.movieCatalogs[idx].catalogName;
                if (m.movieFocusArea === "catalogs" && idx === m.movieCatalogIndex && m.movieMode !== "detail") {
                    node.bg.style.background = "#FFFFFF";
                    node.label.style.color = "#090D16";
                } else {
                    node.bg.style.background = "#0F1624";
                    node.label.style.color = "#E2E8F0";
                }
            } else {
                node.group.classList.add("hidden");
            }
        });

        if (m.movieItemIndex < m.movieTop) m.movieTop = m.movieItemIndex;
        if (m.movieItemIndex >= m.movieTop + m.movieVisibleCards) m.movieTop = m.movieItemIndex - m.movieVisibleCards + 1;
        if (m.movieTop < 0) m.movieTop = 0;

        m.movieCardNodes.forEach((node, i) => {
            const idx = m.movieTop + i;
            if (idx < m.movieItems.length) {
                node.group.classList.remove("hidden");
                const item = m.movieItems[idx];
                node.label.textContent = item.name || "Movie";
                node.poster.src = item.poster || "images/movies_safe.png";
                const isFocused = (m.movieFocusArea === "grid" && idx === m.movieItemIndex && m.movieMode !== "detail");
                node.bg.style.background = isFocused ? "#FFFFFF" : "#0F1624";
                node.label.style.color = isFocused ? "#090D16" : "#F8FAFC";
            } else {
                node.group.classList.add("hidden");
            }
        });

        el("moviePageLabel").textContent = m.movieItems.length > 0
            ? `${m.movieItemIndex + 1} / ${m.movieItems.length}`
            : "";
    }

    function handleMovieApiResponse(res) {
        if (res.action === "movie_direct_manifest") {
            const addon = m.movieCurrentDirectAddon;
            if (addon && !res.error && res.data) {
                const manifest = res.data;
                const addonName = manifest.name || "Direct Add-on";
                const baseUrl = addonBaseFromManifestUrl(addon.manifestUrl);
                if (Array.isArray(manifest.catalogs)) {
                    manifest.catalogs.forEach((cat) => {
                        if (cat && cat.type === "movie" && cat.id) {
                            m.movieCatalogs.push({
                                addonId: addon.id,
                                addonName,
                                catalogId: cat.id,
                                catalogName: cat.name || "Movies",
                                mode: "direct",
                                baseUrl
                            });
                        }
                    });
                }
            }
            m.movieDirectAddonIndex++;
            if (m.movieDirectAddonIndex < m.movieDirectAddons.length) {
                requestNextMovieDirectManifest();
            } else {
                finishMovieAddonDiscovery();
            }
            return;
        }

        if (res.action === "movie_direct_catalog") res.action = "movie_catalog";
        else if (res.action === "movie_direct_meta") res.action = "movie_meta";
        else if (res.action === "movie_direct_streams") res.action = "movie_streams";

        if (res.action === "movie_addons") {
            m.movieCatalogs = [];
            if (res.error) {
                m.movieMode = "grid";
                el("movieStatusLabel").textContent = auraText("sync_error");
                updateMoviesUi();
                return;
            }
            const addons = (res.data && Array.isArray(res.data.addons)) ? res.data.addons : [];
            addons.forEach((addon) => {
                const addonId = addon.id || "";
                const addonName = addon.name || "Add-on";
                if (Array.isArray(addon.catalogs)) {
                    addon.catalogs.forEach((cat) => {
                        if (cat && cat.type === "movie" && addonId && cat.id) {
                            m.movieCatalogs.push({
                                addonId,
                                addonName,
                                catalogId: cat.id,
                                catalogName: cat.name || "Movies"
                            });
                        }
                    });
                }
            });

            m.movieDirectAddons = addons.filter((a) => a && a.mode === "direct" && a.manifestUrl);
            m.movieDirectAddonIndex = 0;
            if (m.movieDirectAddons.length > 0) {
                el("movieStatusLabel").textContent = auraText("movie_direct_loading");
                requestNextMovieDirectManifest();
            } else {
                finishMovieAddonDiscovery();
            }
            return;
        }

        if (res.action === "movie_catalog") {
            m.movieItems = [];
            m.movieItemIndex = 0;
            m.movieTop = 0;
            m.movieMode = "grid";
            if (res.error) {
                el("movieStatusLabel").textContent = auraText("sync_error");
                updateMoviesUi();
                return;
            }
            if (res.data && Array.isArray(res.data.metas)) {
                m.movieItems = res.data.metas.filter(Boolean);
            }
            if (m.movieItems.length === 0) {
                el("movieStatusLabel").textContent = auraText("movie_no_items");
            } else {
                if (m.currentMovieCatalog) {
                    el("movieStatusLabel").textContent = `${m.currentMovieCatalog.addonName}  ·  ${m.currentMovieCatalog.catalogName}`;
                }
                m.movieFocusArea = "grid";
            }
            updateMoviesUi();
            return;
        }

        if (res.action === "movie_meta") {
            if (res.error || !res.data || !res.data.meta) {
                m.movieMode = "grid";
                if (res.error) el("movieStatusLabel").textContent = auraText("sync_error");
                updateMoviesUi();
                return;
            }
            m.currentMovieMeta = res.data.meta;
            m.movieMode = "detail";
            renderMovieDetail();
            updateMoviesUi();
            return;
        }

        if (res.action === "movie_streams") {
            let playableUrl = "";
            if (!res.error && res.data && Array.isArray(res.data.streams)) {
                for (const stream of res.data.streams) {
                    if (!stream) continue;
                    let canPlay = false;
                    if (typeof stream.playable === "boolean") {
                        canPlay = stream.playable;
                    } else if (stream.url && /^https?:\/\//i.test(stream.url)) {
                        canPlay = true;
                    }
                    if (canPlay && stream.url) {
                        playableUrl = stream.url;
                        break;
                    }
                }
            }
            if (!playableUrl) {
                el("movieDetailStatusLabel").textContent = auraText("movie_no_stream");
            } else {
                const movieName = (m.currentMovieMeta && m.currentMovieMeta.name) ? m.currentMovieMeta.name : "Movie";
                openPlayerPreview({ num: 0, name: movieName, url: playableUrl });
                openPlayerFull();
            }
        }
    }

    // --- ADDONS MODULE (Idéntico a AddonsModule.brs) ---
    function openAddons() {
        m.appState = "addons";
        m.addonIndex = 0;
        m.addonTop = 0;
        m.addonItems = [];
        el("addonsStatusLabel").textContent = auraText("addons_loading");
        updateAllUi();
        requestAddonsList();
    }

    function requestAddonsList(isBackground) {
        const macParam = encodeURIComponent(m.deviceMac);
        const keyParam = encodeURIComponent(m.deviceKey);
        const url = `${m.addonBaseUrl}?action=list&mac=${macParam}&key=${keyParam}&_t=${Date.now()}`;
        runBackendTask({ url, method: "GET", action: isBackground ? "addon_list_bg" : "addon_list", insecure: false });
    }

    function requestNextDirectAddonManifest() {
        if (m.addonDirectQueueIndex >= m.addonDirectQueue.length) {
            el("addonsStatusLabel").textContent = auraText("addons_back_hint");
            updateAddonsUi();
            return;
        }
        const idx = m.addonDirectQueue[m.addonDirectQueueIndex];
        const addon = m.addonItems[idx];
        m.addonDirectResolvingIndex = idx;
        runBackendTask({
            url: addon.manifestUrl,
            method: "GET",
            action: "addon_direct_manifest",
            insecure: false,
            userAgent: "AuraTV/1.0 Roku",
            accept: "application/json, text/json;q=0.9, */*;q=0.2",
            diagnostic: true
        });
    }

    function handleAddonsApiResponse(res) {
        if (res.action === "addon_direct_manifest") {
            const idx = m.addonDirectResolvingIndex;
            if (idx >= 0 && idx < m.addonItems.length) {
                const addon = m.addonItems[idx];
                if (res.error || !res.data) {
                    addon.directClientStatus = "failed";
                    addon.directClientCode = res.httpCode ? String(res.httpCode) : "ERROR";
                    addon.directClientDetail = res.failureReason || res.bodySnippet || "";
                } else {
                    const manifest = res.data;
                    addon.directClientStatus = "ready";
                    if (manifest.id) addon.resolvedId = manifest.id;
                    if (manifest.name) addon.name = manifest.name;
                    if (manifest.version) addon.version = manifest.version;
                    if (manifest.types) addon.types = manifest.types;
                }
            }
            m.addonDirectQueueIndex++;
            if (m.addonDirectQueueIndex < m.addonDirectQueue.length) {
                el("addonsStatusLabel").textContent = auraText("addon_direct_testing");
                updateAddonsUi();
                requestNextDirectAddonManifest();
            } else {
                const anyReady = m.addonItems.some((a) => a.directClientStatus === "ready");
                el("addonsStatusLabel").textContent = anyReady ? auraText("addon_direct_ready") : auraText("addons_back_hint");
                updateAddonsUi();
            }
            return;
        }

        if (res.action === "addon_list_bg") {
            if (!res.error && res.data && Array.isArray(res.data.addons)) {
                const incoming = res.data.addons.filter(Boolean);
                const oldIds = m.addonItems.map((a) => a.id || a.manifestUrl).join("|");
                const newIds = incoming.map((a) => a.id || a.manifestUrl).join("|");
                if (oldIds !== newIds) {
                    res.action = "addon_list";
                } else {
                    return;
                }
            } else {
                return;
            }
        }

        if (res.action !== "addon_list") return;
        m.addonItems = [];
        m.addonIndex = 0;
        m.addonTop = 0;

        if (res.error) {
            el("addonsStatusLabel").textContent = auraText("sync_error");
            updateAddonsUi();
            return;
        }

        if (res.data && Array.isArray(res.data.addons)) {
            m.addonItems = res.data.addons.filter(Boolean);
        }
        m.addonDirectQueue = [];
        m.addonDirectQueueIndex = 0;
        m.addonItems.forEach((addon, i) => {
            if (addon && addon.mode === "direct" && addon.manifestUrl) {
                m.addonDirectQueue.push(i);
            }
        });

        if (m.addonItems.length === 0) {
            el("addonsStatusLabel").textContent = auraText("addons_empty");
        } else if (m.addonDirectQueue.length > 0) {
            el("addonsStatusLabel").textContent = auraText("addon_direct_testing");
        } else {
            el("addonsStatusLabel").textContent = auraText("addons_back_hint");
        }
        updateAddonsUi();
        if (m.addonDirectQueue.length > 0) requestNextDirectAddonManifest();
    }

    function updateAddonsUi() {
        if (m.appState !== "addons") return;
        if (m.addonIndex < m.addonTop) m.addonTop = m.addonIndex;
        if (m.addonIndex >= m.addonTop + 7) m.addonTop = m.addonIndex - 6;
        if (m.addonTop < 0) m.addonTop = 0;

        m.addonRowNodes.forEach((node, i) => {
            const idx = m.addonTop + i;
            if (idx < m.addonItems.length) {
                node.group.classList.remove("hidden");
                const addon = m.addonItems[idx];
                node.nameLabel.textContent = addon.name || "Add-on";

                let meta = addon.version ? "v" + addon.version : "";
                if (Array.isArray(addon.types) && addon.types.length > 0) {
                    meta = (meta ? meta + "  " : "") + addon.types.join(" · ");
                }
                if (addon.mode === "direct") {
                    if (addon.directClientStatus === "ready") meta = "DIRECT  OK";
                    else if (addon.directClientStatus === "failed") meta = "DIRECT  " + (addon.directClientCode || "ERROR");
                    else meta = "DIRECT  ...";
                }
                node.metaLabel.textContent = meta;

                if (idx === m.addonIndex) {
                    node.bg.style.background = "#FFFFFF";
                    node.nameLabel.style.color = "#090D16";
                    node.metaLabel.style.color = "#0284C7";
                } else {
                    node.bg.style.background = "#0F1624";
                    node.nameLabel.style.color = "#F8FAFC";
                    node.metaLabel.style.color = "#38BDF8";
                }
            } else {
                node.group.classList.add("hidden");
            }
        });

        if (m.addonIndex >= 0 && m.addonIndex < m.addonItems.length) {
            const sel = m.addonItems[m.addonIndex];
            if (sel.mode === "direct" && sel.directClientStatus === "failed") {
                let statusText = "Direct test: " + (sel.directClientCode || "ERROR");
                if (sel.directClientDetail) {
                    const detail = sel.directClientDetail.length > 90
                        ? sel.directClientDetail.substring(0, 90) + "..."
                        : sel.directClientDetail;
                    statusText += "  ·  " + detail;
                }
                el("addonsStatusLabel").textContent = statusText;
            }
        }
    }

    // --- RESPUESTAS DE RED CENTRALIZADAS (onApiResponse) ---
    function onApiResponse(res) {
        if (!res || !res.action) return;
        if (res.action.startsWith("movie_")) {
            handleMovieApiResponse(res);
            return;
        }
        if (res.action.startsWith("addon_")) {
            handleAddonsApiResponse(res);
            return;
        }

        if (res.action === "sync") {
            m.syncInFlight = false;
            stopSyncWheelAnimation();

            if (res.error) {
                if (res.httpCode === 403 || res.httpCode === 409) {
                    if (rotateDeviceIdentityOnMismatch()) return;
                }
                const errDetail = res.failureReason ? ` (${res.failureReason})` : (res.httpCode ? ` (HTTP ${res.httpCode})` : "");
                el("playlistSyncStatus").textContent = auraText("sync_error") + errDetail;
                if (!m.channelLoadInFlight) el("syncStatusLabel").textContent = "";
            } else if (res.data && res.data.playlists !== undefined) {
                const rawPlaylists = Array.isArray(res.data.playlists)
                    ? res.data.playlists
                    : (res.data.playlists && typeof res.data.playlists === "object" ? Object.values(res.data.playlists) : []);

                const prevPlaylists = m.playlists.slice();
                const prevCount = prevPlaylists.length;
                m.playlists = rawPlaylists.filter(Boolean).map((item, idx) => ({
                    id: item.id || ("web-" + idx),
                    name: item.name || ("Playlist " + (idx + 1)),
                    type: item.type || "xtream",
                    host: item.host || "",
                    username: item.username || "",
                    password: item.password || "",
                    url: item.url || ""
                }));

                if (m.playlists.length > 0) {
                    let newlyAddedIndex = -1;
                    if (prevCount > 0 && m.playlists.length > prevCount) {
                        for (let i = m.playlists.length - 1; i >= 0; i--) {
                            const cand = m.playlists[i];
                            const existed = prevPlaylists.some((p) => (p.id && p.id === cand.id) || samePlaylist(p, cand));
                            if (!existed) {
                                newlyAddedIndex = i;
                                break;
                            }
                        }
                    }

                    if (newlyAddedIndex >= 0) {
                        const newPl = m.playlists[newlyAddedIndex];
                        m.playlistFocus = newlyAddedIndex;
                        el("playlistSyncStatus").textContent = `${auraText("synced")} (${m.playlists.length} playlists)`;
                        showToast(`✓ Nueva playlist sincronizada: ${newPl.name}`, 3600);
                        loadChannelsFromPlaylist(newPl, true);
                    } else {
                        if (prevCount === 0 || (m.playlistFocus < 100 && m.playlistFocus >= m.playlists.length)) {
                            m.playlistFocus = 0;
                        }
                        el("playlistSyncStatus").textContent = `${auraText("synced")} (${m.playlists.length})`;

                        const activeRef = m.pendingPlaylistToLoad || m.currentLoadedPlaylist;
                        const matchedActive = activeRef
                            ? m.playlists.find((p) => (p.id && p.id === activeRef.id) || samePlaylist(p, activeRef))
                            : null;
                        const savedId = readRegistry("activePlaylistId", "");
                        const savedMatch = savedId ? m.playlists.find((p) => p.id === savedId) : null;
                        const targetPlaylist = matchedActive || savedMatch || m.playlists[0];

                        if (m.channels.length === 0 && !m.channelLoadInFlight) {
                            loadChannelsFromPlaylist(targetPlaylist);
                        } else if (!matchedActive && !m.channelLoadInFlight) {
                            loadChannelsFromPlaylist(targetPlaylist, true);
                        } else if (!m.channelLoadInFlight) {
                            el("syncStatusLabel").textContent = "";
                        }
                    }
                } else {
                    if (m.playlistFocus < 100) m.playlistFocus = 101;
                    el("playlistSyncStatus").textContent = auraText("no_playlists");
                    if (!m.channelLoadInFlight) el("syncStatusLabel").textContent = "";
                }
                updatePlaylistsUi();
            }
        } else if (res.action === "fetch_xtream") {
            m.channelLoadInFlight = false;
            stopSyncWheelAnimation();
            const pl = m.pendingPlaylistToLoad || m.currentLoadedPlaylist || m.playlists[0];
            if (Array.isArray(res.data) && pl) {
                m.currentLoadedPlaylist = pl;
                const cleanHost = normalizeHostUrl(pl.host);
                m.channels = [];
                res.data.forEach((item, i) => {
                    if (item && item.stream_id !== undefined) {
                        const chName = item.name || "Canal";
                        const chCat = item.category_name || (item.category_id ? "Categoría " + item.category_id : auraText("general_channels"));
                        const chLogo = item.stream_icon || "";
                        m.channels.push({
                            num: i + 1,
                            name: chName,
                            category: chCat,
                            logo: chLogo,
                            url: `${cleanHost}/live/${pl.username}/${pl.password}/${item.stream_id}.ts`
                        });
                    }
                });
                rebuildCategoriesFromChannels();
            } else if (pl && pl.host && pl.username && pl.password) {
                // Fallback automático a lista M3U de Xtream si player_api.php no devolvió un arreglo JSON
                const cleanHost = normalizeHostUrl(pl.host);
                const fallbackM3uUrl = `${cleanHost}/get.php?username=${encodeURIComponent(pl.username)}&password=${encodeURIComponent(pl.password)}&type=m3u_plus&output=ts`;
                m.channelLoadInFlight = true;
                m.channelLoadStartedAt = Date.now();
                runBackendTask({ url: fallbackM3uUrl, method: "GET", action: "fetch_m3u", raw: true, insecure: true });
            } else {
                el("syncStatusLabel").textContent = "";
            }
        } else if (res.action === "fetch_m3u") {
            m.channelLoadInFlight = false;
            stopSyncWheelAnimation();
            const pl = m.pendingPlaylistToLoad || m.currentLoadedPlaylist || m.playlists[0];
            if (Array.isArray(res.parsedChannels) && res.parsedChannels.length > 0) {
                if (pl) m.currentLoadedPlaylist = pl;
                m.channels = res.parsedChannels;
                rebuildCategoriesFromChannels();
            } else if (res.rawData) {
                if (pl) m.currentLoadedPlaylist = pl;
                const lines = res.rawData.split(/\r?\n/);
                m.channels = [];
                let count = 1;
                let name = auraText("unknown_channel");
                let category = auraText("general_channels");
                let logo = "";
                lines.forEach((rawLine) => {
                    const line = rawLine.trim();
                    if (line.startsWith("#EXTINF")) {
                        const catMatch = line.match(/group-title="([^"]*)"/i);
                        if (catMatch && catMatch[1]) category = catMatch[1];
                        const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
                        if (logoMatch && logoMatch[1]) logo = logoMatch[1];
                        const comma = line.indexOf(",");
                        if (comma >= 0) name = line.substring(comma + 1).trim();
                    } else if (/^(https?|rtmp):\/\//i.test(line)) {
                        m.channels.push({ num: count++, name, url: line, category, logo });
                        name = auraText("unknown_channel");
                        category = auraText("general_channels");
                        logo = "";
                    }
                });
                rebuildCategoriesFromChannels();
            } else {
                el("syncStatusLabel").textContent = "";
            }
        }
    }

    function updateCategoryCountsLabels() {
        if (!m.categories || m.categories.length === 0) return;
        m.categories.forEach((cat) => {
            if (cat.type === "favorite") {
                cat.label = `★ ${auraText("favorites")} (${m.favoriteUrls.length})`;
            } else if (cat.type === "recent") {
                cat.label = `↺ Recientes (${m.recentUrls.length})`;
            } else if (cat.type === "search") {
                cat.label = `🔍 ${auraText("search_all")}`;
            }
        });
    }

    function rebuildCategoriesFromChannels() {
        m.categories = [
            { label: `★ ${auraText("favorites")} (${m.favoriteUrls.length})`, type: "favorite" },
            { label: `↺ Recientes (${m.recentUrls.length})`, type: "recent" },
            { label: `🔍 ${auraText("search_all")}`, type: "search" }
        ];
        m.channelByUrl = {};
        m.channelByNum = {};
        m.categoryNavItemsMap = {};
        m.categoryRawChannelsMap = {};

        const catOrder = [];
        const seen = {};
        const defaultCat = auraText("general_channels");

        for (let i = 0; i < m.channels.length; i++) {
            const ch = m.channels[i];
            if (!ch.category) ch.category = defaultCat;
            const c = ch.category;
            ch._globalIdx = i;
            ch._searchName = String(ch.name || "").toLowerCase();
            ch._searchCat = String(c).toLowerCase();
            if (ch.url) m.channelByUrl[ch.url] = ch;
            if (ch.num) m.channelByNum[ch.num] = ch;

            if (!seen[c]) {
                seen[c] = true;
                catOrder.push(c);
                m.categoryNavItemsMap[c] = [];
                m.categoryRawChannelsMap[c] = [];
            }
            ch._catIdx = m.categoryRawChannelsMap[c].length;
            m.categoryRawChannelsMap[c].push(ch);
            m.categoryNavItemsMap[c].push({ label: ch.name, type: "channel", channelData: ch });
        }

        for (let i = 0; i < catOrder.length; i++) {
            const c = catOrder[i];
            const cnt = m.categoryRawChannelsMap[c].length;
            m.categories.push({
                label: `${c.toUpperCase()} (${cnt})`,
                type: "category",
                id: c
            });
        }

        if (m.regionalState !== "channels") {
            m.regionalState = "categories";
            m.leftNavItems = m.categories;
            if (m.leftIndex >= m.leftNavItems.length) m.leftIndex = 0;
            adjustLeftNavWindow();
        }
        if (m.appState === "search") {
            refreshSearchResults();
        }
        updateChannelStatsUi();
        updateRegionalUi();
        el("syncStatusLabel").textContent = "";
        el("playlistSyncStatus").textContent = `${auraText("synced")} (${m.channels.length} canales)`;
    }

    // --- MANEJO DE CONTROL REMOTO (D-PAD) IDÉNTICO A onKeyEvent DE ROKU ---
    function launcherMove(target) {
        if (target >= 0 && target < m.launcherTiles.length) {
            m.launcherTileIndex = target;
            updateLauncherUi();
        }
    }

    function onRokuKey(key) {
        if (m.appState === "splash") return true;

        if (typeof key === "string" && key.startsWith("num_")) {
            const digit = key.substring(4);
            if (handleNumberKey(digit)) return true;
        }

        if (m.numericBuffer && key === "OK") {
            commitNumericZap();
            return true;
        }

        if (m.languageMenuOpen) {
            if (key === "back") {
                m.languageMenuOpen = false;
                updateLanguageMenuUi();
                updateAllUi();
            } else if (key === "up") {
                m.languageMenuIndex = (m.languageMenuIndex + 2) % 3;
                updateLanguageMenuUi();
            } else if (key === "down") {
                m.languageMenuIndex = (m.languageMenuIndex + 1) % 3;
                updateLanguageMenuUi();
            } else if (key === "OK") {
                m.language = m.languageMenuIndex === 1 ? "en" : (m.languageMenuIndex === 2 ? "zh" : "es");
                savePrefs();
                m.languageMenuOpen = false;
                updateLanguageMenuUi();
                updateAllUi();
            }
            return true;
        }

        if (m.modalOpen) {
            if (key === "OK" || key === "back") closeSoon();
            return true;
        }

        if (m.entryOpen) {
            const row = m.entryNodes[m.entryRow];
            if (key === "back") closeEntry(false);
            else if (key === "left") {
                m.entryCol = Math.max(0, m.entryCol - 1);
                updateEntryUi();
            } else if (key === "right") {
                m.entryCol = Math.min(row.length - 1, m.entryCol + 1);
                updateEntryUi();
            } else if (key === "up") {
                m.entryRow = Math.max(0, m.entryRow - 1);
                m.entryCol = Math.min(m.entryNodes[m.entryRow].length - 1, m.entryCol);
                updateEntryUi();
            } else if (key === "down") {
                m.entryRow = Math.min(m.entryNodes.length - 1, m.entryRow + 1);
                m.entryCol = Math.min(m.entryNodes[m.entryRow].length - 1, m.entryCol);
                updateEntryUi();
            } else if (key === "OK") {
                const value = m.entryNodes[m.entryRow][m.entryCol].value;
                if (value === "DEL") m.entryText = m.entryText.slice(0, -1);
                else if (value === "SPACE") m.entryText += " ";
                else if (value === "DONE") {
                    closeEntry(true);
                    return true;
                } else m.entryText += value;
                updateEntryUi();
            }
            return true;
        }

        if (m.appState === "launcher") {
            if (key === "left") {
                if (m.launcherTileIndex === 1) launcherMove(0);
                else if (m.launcherTileIndex === 2) launcherMove(1);
                else if (m.launcherTileIndex === 3) launcherMove(0);
                else if (m.launcherTileIndex === 4) launcherMove(3);
                else if (m.launcherTileIndex === 5) launcherMove(4);
            } else if (key === "right") {
                if (m.launcherTileIndex === 0) launcherMove(1);
                else if (m.launcherTileIndex === 1) launcherMove(2);
                else if (m.launcherTileIndex === 3) launcherMove(4);
                else if (m.launcherTileIndex === 4) launcherMove(5);
            } else if (key === "up") {
                if (m.launcherTileIndex === 3) launcherMove(0);
                else if (m.launcherTileIndex === 4) launcherMove(1);
                else if (m.launcherTileIndex === 5) launcherMove(2);
            } else if (key === "down") {
                if (m.launcherTileIndex === 0) launcherMove(3);
                else if (m.launcherTileIndex === 1) launcherMove(4);
                else if (m.launcherTileIndex === 2) launcherMove(5);
            } else if (key === "OK") {
                const tile = m.launcherTiles[m.launcherTileIndex];
                if (tile.id === "live") openRegional();
                else if (tile.id === "playlists") openPlaylists();
                else if (tile.id === "movies") openMovies();
                else if (tile.id === "series") openSoon(auraText("series"), auraText("series_soon"));
                else if (tile.id === "settings") openSettings();
                else if (tile.id === "addons") openAddons();
            }
            return true;
        }

        if (m.appState === "movies") {
            if (key === "back") {
                if (m.movieMode === "detail") {
                    m.movieMode = "grid";
                    el("movieDetailStatusLabel").textContent = "";
                    updateMoviesUi();
                } else {
                    backToLauncher();
                }
                return true;
            }
            if (m.movieMode === "detail") {
                if (key === "OK") requestMovieStream();
                return true;
            }
            if (m.movieMode === "loading" || m.movieMode === "loading_detail") return true;
            if (m.movieFocusArea === "catalogs") {
                if (key === "up" && m.movieCatalogIndex > 0) requestMovieCatalog(m.movieCatalogIndex - 1);
                else if (key === "down" && m.movieCatalogIndex < m.movieCatalogs.length - 1) requestMovieCatalog(m.movieCatalogIndex + 1);
                else if (key === "right" && m.movieItems.length > 0) {
                    m.movieFocusArea = "grid";
                    updateMoviesUi();
                } else if (key === "OK" && m.movieCatalogs.length > 0) requestMovieCatalog(m.movieCatalogIndex);
                return true;
            }
            if (m.movieFocusArea === "grid") {
                if (key === "left") {
                    if (m.movieItemIndex % m.movieColumns === 0) {
                        m.movieFocusArea = "catalogs";
                        updateMoviesUi();
                    } else {
                        m.movieItemIndex = Math.max(0, m.movieItemIndex - 1);
                        updateMoviesUi();
                    }
                } else if (key === "right") {
                    if (m.movieItemIndex % m.movieColumns < m.movieColumns - 1) {
                        m.movieItemIndex = Math.min(m.movieItems.length - 1, m.movieItemIndex + 1);
                        updateMoviesUi();
                    }
                } else if (key === "up") {
                    m.movieItemIndex = Math.max(0, m.movieItemIndex - m.movieColumns);
                    updateMoviesUi();
                } else if (key === "down") {
                    m.movieItemIndex = Math.min(m.movieItems.length - 1, m.movieItemIndex + m.movieColumns);
                    updateMoviesUi();
                } else if (key === "OK") {
                    requestMovieMeta();
                }
                return true;
            }
            return true;
        }

        if (m.appState === "addons") {
            if (key === "back") backToLauncher();
            else if (key === "up" && m.addonIndex > 0) {
                m.addonIndex--;
                updateAddonsUi();
            } else if (key === "down" && m.addonIndex < m.addonItems.length - 1) {
                m.addonIndex++;
                updateAddonsUi();
            } else if (key === "OK") {
                el("addonsStatusLabel").textContent = auraText("addons_loading");
                requestAddonsList();
            }
            return true;
        }

        if (m.appState === "playlists") {
            if (key === "back") {
                backToLauncher();
                return true;
            }
            if (m.playlistFocus >= 0 && m.playlistFocus < m.playlists.length) {
                if (key === "up") m.playlistFocus = m.playlistFocus === 0 ? 100 : m.playlistFocus - 1;
                else if (key === "down" && m.playlistFocus < m.playlists.length - 1) m.playlistFocus++;
                else if (key === "right") m.playlistFocus = 102;
                else if (key === "OK") {
                    const chosen = m.playlists[m.playlistFocus];
                    showToast(`Cargando playlist: ${chosen.name}`);
                    loadChannelsFromPlaylist(chosen, true);
                    openRegional();
                    return true;
                }
                updatePlaylistsUi();
                return true;
            }
            if (m.playlistFocus === 100) {
                if (key === "right") m.playlistFocus = 101;
                if (key === "down" && m.playlists.length > 0) m.playlistFocus = 0;
                if (key === "OK") syncPlaylistsFromWeb();
                updatePlaylistsUi();
            } else if (m.playlistFocus === 101) {
                if (key === "left") m.playlistFocus = 100;
                if (key === "down" && m.playlists.length > 0) m.playlistFocus = 0;
                if (key === "OK") {
                    openAddPlaylist();
                    return true;
                }
                updatePlaylistsUi();
            } else if (m.playlistFocus === 102) {
                if (key === "left") m.playlistFocus = m.playlists.length > 0 ? 0 : 101;
                else if (key === "OK") deleteSelectedPlaylist();
                updatePlaylistsUi();
            }
            return true;
        }

        if (m.appState === "addPlaylist") {
            if (key === "back") {
                openPlaylists();
                return true;
            }
            if (m.addPlaylistFocus === 0 || m.addPlaylistFocus === 1) {
                if (key === "left") m.addPlaylistFocus = 0;
                if (key === "right") m.addPlaylistFocus = 1;
                if (key === "down") m.addPlaylistFocus = 2;
                if (key === "OK") m.addPlaylistMode = m.addPlaylistFocus === 0 ? "xtream" : "m3u";
                updateAddPlaylistUi();
                return true;
            }
            if (m.addPlaylistFocus >= 2 && m.addPlaylistFocus <= 4) {
                if (key === "up") m.addPlaylistFocus = m.addPlaylistFocus === 2 ? 0 : m.addPlaylistFocus - 1;
                else if (key === "down") m.addPlaylistFocus = m.addPlaylistFocus === 4 ? 5 : m.addPlaylistFocus + 1;
                else if (key === "OK") {
                    if (m.addPlaylistFocus === 2) openEntry("host");
                    if (m.addPlaylistFocus === 3) openEntry("username");
                    if (m.addPlaylistFocus === 4) openEntry("password");
                    return true;
                }
                updateAddPlaylistUi();
                return true;
            }
            if (m.addPlaylistFocus === 5 || m.addPlaylistFocus === 6) {
                if (key === "left") m.addPlaylistFocus = 5;
                if (key === "right") m.addPlaylistFocus = 6;
                if (key === "up") m.addPlaylistFocus = 4;
                if (key === "OK") {
                    if (m.addPlaylistFocus === 5) openPlaylists();
                    else saveNewPlaylist();
                    return true;
                }
                updateAddPlaylistUi();
                return true;
            }
            return true;
        }

        if (m.appState === "settings") {
            if (key === "back") {
                backToLauncher();
                return true;
            } else if (key === "up") {
                m.settingsFocus = (m.settingsFocus - 1 + m.settingsItems.length) % m.settingsItems.length;
            } else if (key === "down") {
                m.settingsFocus = (m.settingsFocus + 1) % m.settingsItems.length;
            } else if (key === "OK") {
                if (m.settingsFocus === 0) {
                    m.settingXtreamEpg = !m.settingXtreamEpg;
                    savePrefs();
                } else if (m.settingsFocus === 1) {
                    m.settingTmdb = !m.settingTmdb;
                    savePrefs();
                } else if (m.settingsFocus === 2) {
                    cycleLanguage();
                    return true;
                } else if (m.settingsFocus === 3) {
                    openEntry("pinset");
                    return true;
                } else if (m.settingsFocus === 4) {
                    m.categoriesLocked = !m.categoriesLocked;
                    savePrefs();
                }
            }
            updateSettingsUi();
            return true;
        }

        if (m.appState === "player") {
            if (m.miniGuideOpen) {
                const list = getActivePlayerChannelList();
                if (key === "back" || key === "right" || key === "left") {
                    closeMiniGuide();
                    return true;
                }
                if (key === "up" && list.length > 0) {
                    m.miniGuideIndex = (m.miniGuideIndex - 1 + list.length) % list.length;
                    updateMiniGuideUi();
                    return true;
                }
                if (key === "down" && list.length > 0) {
                    m.miniGuideIndex = (m.miniGuideIndex + 1) % list.length;
                    updateMiniGuideUi();
                    return true;
                }
                if (key === "info" || key === "fav") {
                    if (list[m.miniGuideIndex]) toggleFavoriteChannel(list[m.miniGuideIndex]);
                    return true;
                }
                if (key === "OK" && list.length > 0) {
                    const chosen = list[m.miniGuideIndex];
                    if (chosen) {
                        playChannelInFullscreenDirect(chosen);
                        closeMiniGuide();
                    }
                    return true;
                }
                return true;
            }

            if (key === "back") {
                if (m.lastStateBeforePlayer === "search") {
                    stopNativePlayer();
                    m.appState = "search";
                    updateAllUi();
                } else if (m.lastStateBeforePlayer === "movies") {
                    stopNativePlayer();
                    m.appState = "movies";
                    m.movieMode = "detail";
                    updateAllUi();
                } else {
                    m.appState = m.lastStateBeforePlayer || "regional";
                    updateAllUi();
                    updateStreamStatusOverlays();
                    if (hasNative() && typeof window.AuraNative.moveVideo === "function") {
                        window.AuraNative.moveVideo(560, 102, 445, 320, false);
                    } else {
                        const v = el("fallbackVideo");
                        v.style.left = "560px";
                        v.style.top = "102px";
                        v.style.width = "445px";
                        v.style.height = "320px";
                    }
                }
                return true;
            }
            if (key === "up") {
                if (m.lastStateBeforePlayer !== "movies") {
                    switchChannelInFullscreen(-1);
                } else {
                    showPlayerOsdBanner(8000);
                }
                return true;
            }
            if (key === "down") {
                if (m.lastStateBeforePlayer !== "movies") {
                    switchChannelInFullscreen(1);
                } else {
                    showPlayerOsdBanner(8000);
                }
                return true;
            }
            if (key === "left") {
                if (m.lastStateBeforePlayer !== "movies") {
                    openMiniGuide();
                } else {
                    showPlayerOsdBanner(8000);
                }
                return true;
            }
            if (key === "right") {
                if (m.lastStateBeforePlayer !== "movies") {
                    if (m.previousChannel && (!m.currentPreviewChannel || m.previousChannel.url !== m.currentPreviewChannel.url)) {
                        const prev = m.previousChannel;
                        showToast(`↺ Canal anterior: ${prev.name}`);
                        playChannelInFullscreenDirect(prev);
                    } else {
                        showToast("Aún no hay canal anterior para alternar");
                        showPlayerOsdBanner(8000);
                    }
                } else {
                    showPlayerOsdBanner(8000);
                }
                return true;
            }
            if (key === "info" || key === "fav") {
                if (m.currentPreviewChannel) {
                    toggleFavoriteChannel(m.currentPreviewChannel);
                }
                return true;
            }
            if (key === "OK") {
                const banner = el("playerBannerBox");
                const wasBannerVisible = banner && !banner.classList.contains("banner-hidden");
                showPlayerOsdBanner(8000);
                if (m.currentPlayerStatus === "unavailable" && m.currentPreviewChannel) {
                    m.currentPlayerStatus = "loading";
                    updateStreamStatusOverlays();
                    startPlaybackWatchdog(m.currentPreviewChannel.url);
                    if (hasNative() && typeof window.AuraNative.playVideo === "function") {
                        window.AuraNative.playVideo(m.currentPreviewChannel.url, m.currentPreviewChannel.name || "", 0, 0, 1280, 720, true);
                    } else {
                        const v = el("fallbackVideo");
                        v.src = m.currentPreviewChannel.url;
                        v.load();
                        v.play().catch(() => {});
                    }
                } else if (wasBannerVisible) {
                    cycleAspectRatio();
                }
                return true;
            }
            return false;
        }

        if (m.appState === "search") {
            if (key === "back") {
                stopNativePlayer();
                openRegional();
                return true;
            }
            if (m.searchFocus === "keyboard") {
                const rowNodes = m.keyboardNodes[m.kbRow];
                if (key === "left") {
                    if (m.kbCol > 0) m.kbCol--;
                    else m.searchFocus = "channels";
                } else if (key === "right") {
                    m.kbCol = Math.min(rowNodes.length - 1, m.kbCol + 1);
                } else if (key === "up") {
                    m.kbRow = Math.max(0, m.kbRow - 1);
                    m.kbCol = Math.min(m.keyboardNodes[m.kbRow].length - 1, m.kbCol);
                } else if (key === "down") {
                    m.kbRow = Math.min(m.keyboardNodes.length - 1, m.kbRow + 1);
                    m.kbCol = Math.min(m.keyboardNodes[m.kbRow].length - 1, m.kbCol);
                } else if (key === "OK") {
                    const value = m.keyboardNodes[m.kbRow][m.kbCol].value;
                    if (value === "DEL") m.searchQuery = m.searchQuery.slice(0, -1);
                    else if (value === "SPACE") m.searchQuery += " ";
                    else if (value === "CLEAN") m.searchQuery = "";
                    else if (value === "DONE") m.searchFocus = "channels";
                    else if (value !== "SHIFT" && value !== "123") m.searchQuery += value;
                    if (m.filteredChannels.length > 0) {
                        m.channelIndex = 0;
                        m.channelTop = 0;
                    }
                    refreshSearchResults();
                }
                updateSearchUi();
                return true;
            } else if (m.searchFocus === "channels") {
                if (key === "right") {
                    m.searchFocus = "keyboard";
                    updateSearchUi();
                } else if (key === "up" && m.filteredChannels.length > 0) {
                    m.channelIndex = Math.max(0, m.channelIndex - 1);
                    adjustChannelWindow();
                    refreshSearchChannelRows();
                    updateSearchUi();
                } else if (key === "down" && m.filteredChannels.length > 0) {
                    m.channelIndex = Math.min(m.filteredChannels.length - 1, m.channelIndex + 1);
                    adjustChannelWindow();
                    refreshSearchChannelRows();
                    updateSearchUi();
                } else if (key === "OK") {
                    if (m.channelIndex >= 0 && m.channelIndex < m.filteredChannels.length) {
                        const selectedCh = m.filteredChannels[m.channelIndex];
                        openPlayerPreview(selectedCh);
                        openPlayerFull();
                    }
                }
                return true;
            }
        }

        if (m.appState === "regional") {
            if (key === "back") {
                if (m.regionalState === "channels") {
                    m.regionalState = "categories";
                    m.leftNavItems = m.categories;
                    m.leftIndex = m.lastCategoryIndex;
                    adjustLeftNavWindow();
                    updateRegionalUi();
                    return true;
                }
                stopNativePlayer();
                backToLauncher();
                return true;
            }
            if (m.homeFocus === "left") {
                if (key === "up" && m.leftNavItems.length > 0) {
                    m.leftIndex = (m.leftIndex - 1 + m.leftNavItems.length) % m.leftNavItems.length;
                    adjustLeftNavWindow();
                    updateRegionalUi();
                } else if (key === "down" && m.leftNavItems.length > 0) {
                    m.leftIndex = (m.leftIndex + 1) % m.leftNavItems.length;
                    adjustLeftNavWindow();
                    updateRegionalUi();
                } else if (key === "left" && m.regionalState === "channels") {
                    m.regionalState = "categories";
                    m.leftNavItems = m.categories;
                    m.leftIndex = m.lastCategoryIndex;
                    adjustLeftNavWindow();
                    updateRegionalUi();
                } else if (key === "info" || key === "fav") {
                    const item = m.leftNavItems[m.leftIndex];
                    if (item && item.type === "channel" && item.channelData) {
                        toggleFavoriteChannel(item.channelData);
                    }
                } else if (key === "right") {
                    const item = m.leftNavItems[m.leftIndex];
                    if (item && item.type === "channel" && item.channelData) {
                        toggleFavoriteChannel(item.channelData);
                    } else {
                        m.homeFocus = "days";
                        updateRegionalUi();
                    }
                } else if (key === "OK" && m.leftNavItems.length > 0) {
                    const item = m.leftNavItems[m.leftIndex];
                    if (item.type === "search") {
                        m.filteredChannels = m.channels.slice();
                        m.channelIndex = 0;
                        m.channelTop = 0;
                        refreshSearchChannelRows();
                        m.searchQuery = "";
                        el("searchQueryLabel").textContent = auraText("search_placeholder");
                        openSearch();
                    } else if (item.type === "favorite" || item.type === "recent") {
                        enterCategory(item);
                    } else if (item.type === "category") {
                        if (m.categoriesLocked && !m.unlockGranted) {
                            m.pendingLockedCategory = item;
                            openEntry(m.parentalPin === "" ? "pinset" : "unlock");
                        } else {
                            enterCategory(item);
                        }
                    } else if (item.type === "channel") {
                        const ch = item.channelData;
                        if (m.currentPreviewChannel && m.currentPreviewChannel.url === ch.url) {
                            openPlayerFull();
                        } else {
                            openPlayerPreview(ch);
                        }
                    }
                }
                return true;
            } else if (m.homeFocus === "days") {
                if (key === "left") {
                    m.homeFocus = "left";
                    updateRegionalUi();
                } else if (key === "up") {
                    m.dayIndex = (m.dayIndex - 1 + m.days.length) % m.days.length;
                    updateRegionalUi();
                } else if (key === "down") {
                    m.dayIndex = (m.dayIndex + 1) % m.days.length;
                    updateRegionalUi();
                }
                return true;
            }
        }
        return false;
    }

    window.onRokuKey = onRokuKey;

    // Soporte de teclado de PC si se abre en navegador para pruebas rápidas
    window.addEventListener("keydown", (ev) => {
        if (/^[0-9]$/.test(ev.key) && !m.entryOpen && m.appState !== "search" && m.appState !== "addPlaylist") {
            ev.preventDefault();
            onRokuKey("num_" + ev.key);
            return;
        }
        if ((ev.key === "f" || ev.key === "F" || ev.key === "i" || ev.key === "I") && !m.entryOpen && m.appState !== "search" && m.appState !== "addPlaylist") {
            ev.preventDefault();
            onRokuKey("fav");
            return;
        }
        const map = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right",
            Enter: "OK",
            Backspace: "back",
            Escape: "back"
        };
        if (map[ev.key]) {
            ev.preventDefault();
            onRokuKey(map[ev.key]);
        }
    });

    // --- INICIALIZACIÓN ---
    function init() {
        resizeStage();
        setTimeout(resizeStage, 100);
        setTimeout(resizeStage, 350);
        setTimeout(resizeStage, 1000);
        m.deviceMac = getDeviceMac();
        m.deviceKey = getOrCreateDeviceKey();
        loadPrefs();

        m.leftNavItems = [
            { label: `★ ${auraText("favorites")} (${m.favoriteUrls.length})`, type: "favorite" },
            { label: `↺ Recientes (${m.recentUrls.length})`, type: "recent" },
            { label: `🔍 ${auraText("search_all")}`, type: "search" }
        ];

        buildLauncherTiles();
        buildLeftNav();
        buildMiniGuide();
        buildProgramRows();
        buildDays();
        buildSearchChannels();
        buildKeyboard();
        buildPlaylistRows();
        buildAddPlaylistFields();
        buildSettingsRows();
        buildEntryKeyboard();
        buildMovieUi();
        buildAddonsUi();
        refreshSearchResults();

        refreshDeviceCredentialsUi();

        updateRealTime();
        updateChannelStatsUi();
        setInterval(updateRealTime, 60000);
        // Sincronización automática constante en segundo plano cada 3 segundos (3000 ms)
        setInterval(() => syncPlaylistsFromWeb(true), 3000);

        updateAllUi();
        syncPlaylistsFromWeb(false);

        setTimeout(() => {
            if (m.appState === "splash") {
                m.appState = "launcher";
                updateAllUi();
                syncPlaylistsFromWeb(false);
            }
        }, 1800);
    }

    window.addEventListener("DOMContentLoaded", init);
})();
