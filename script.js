/* ============================================================
   360° VIRTUAL TOUR — MINIMAL DARK UI SCRIPT
   ============================================================ */
(function () {
    'use strict';

    /* ── DOM cache ── */
    const $ = (id) => document.getElementById(id);
    const dom = {
        loading: $('loadingScreen'),
        loaderFill: $('loaderFill'),
        topBar: $('topBar'),

        infoBox: $('infoBox'),
        infoBoxText: $('infoBoxText'),
        gridOverlay: $('gridOverlay'),
        gridBody: $('gridBody'),
        gridClose: $('gridClose'),
        btnGrid: $('btnGrid'),
        btnFullscreen: $('btnFullscreen'),
        btnHelp: $('btnHelp'),
        helpOverlay: $('helpOverlay'),
        helpClose: $('helpClose'),
        infoPopup: $('infoPopup'),
        popupClose: $('popupClose'),
        infoTitle: $('infoTitle'),
        infoDesc: $('infoDescription'),
        infoImage: $('infoImage'),
        popupImgWrap: $('popupImgWrap'),

        /* Indoor Navigation */
        navGuidePanel: $('navGuidePanel'),
        navGuideClose: $('navGuideClose'),
        btnNavGuide: $('btnNavGuide'),
        floorSelect: $('floorSelect'),
        labSelect: $('labSelect'),
        navGuideGo: $('navGuideGo'),
        navGuideClear: $('navGuideClear'),
        directionBanner: $('directionBanner'),
        dirStepNum: $('dirStepNum'),
        dirStepTotal: $('dirStepTotal'),
        dirInstruction: $('dirInstruction'),
        dirDestination: $('dirDestination'),
        dirPrev: $('dirPrev'),
        dirNext: $('dirNext'),
        navComingSoon: $('navComingSoon'),
    };

    let viewer = null;
    let configData = null;
    let sceneKeys = [];
    let totalScenes = 0;
    let currentSceneId = '';
    let activeLoadTimeout = null;
    let currentOnLoadHandler = null;
    const sceneEntryPositions = {};

    /* ─────────────────────────────────────────────
       LOADING SCREEN
       ───────────────────────────────────────────── */
    function runLoader(onReady) {
        let pct = 0;
        const tick = setInterval(() => {
            pct += Math.random() * 16 + 5;
            if (pct > 95) pct = 95;
            dom.loaderFill.style.width = pct + '%';
        }, 110);

        onReady(() => {
            clearInterval(tick);
            dom.loaderFill.style.width = '100%';
            setTimeout(() => {
                dom.loading.classList.add('done');
                dom.topBar.classList.add('show');
                dom.infoBox.classList.add('show');
            }, 50);
        });
    }

    /* ─────────────────────────────────────────────
       SCENE MANAGEMENT (Single Scene Loading & Smart Preloading)
       ───────────────────────────────────────────── */
    let preloadedImages = {};
    let addedScenes = new Set();

    function getMaxTextureSize() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                console.log("[getMaxTextureSize] Hardware MAX_TEXTURE_SIZE:", maxTextureSize);
                return maxTextureSize;
            }
        } catch (e) {
            console.warn("[getMaxTextureSize] Failed to get WebGL context, falling back to 8192:", e);
        }
        return 8192; // safe fallback
    }

    function checkPanoramaDimensions(url, onSuccess, onFailure) {
        console.log("[checkPanoramaDimensions] Pre-checking image dimensions for URL:", url);
        const img = new Image();

        let isSettled = false;
        let timeout = setTimeout(() => {
            if (isSettled) return;
            isSettled = true;
            img.onload = null;
            img.onerror = null;
            console.warn("[checkPanoramaDimensions] Image check timed out for:", url);
            onFailure("Image verification timed out. The file might be too slow to load or inaccessible.");
        }, 5000); // 5 seconds pre-flight timeout

        img.onload = () => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timeout);

            const width = img.width;
            const height = img.height;
            console.log(`[checkPanoramaDimensions] Image pre-loaded. Dimensions: ${width}x${height} for ${url}`);

            const maxTextureSize = getMaxTextureSize();

            // Warn when width exceeds 8192px
            if (width > 8192) {
                console.warn(`[checkPanoramaDimensions] Warning: Image width ${width}px exceeds the standard recommended limit of 8192px.`);
            } else if (width > 7680) {
                console.info(`[checkPanoramaDimensions] Optimization tip: Image width ${width}px is close to the limit. We recommend a maximum panorama width of 7680px–8192px for optimal compatibility across standard smart displays.`);
            }

            // GPU maximum texture limit enforcement
            if (width > maxTextureSize) {
                const errMsg = `This panorama is too big for your device! It's ${width}px wide, but your device only supports images up to ${maxTextureSize}px wide. We recommend a maximum panorama width of 7680px–8192px for compatibility.`;
                console.error("[checkPanoramaDimensions] GPU Limit Exceeded:", errMsg);
                onFailure(errMsg);
            } else {
                onSuccess();
            }
        };

        img.onerror = (e) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(timeout);
            console.error("[checkPanoramaDimensions] Failed to load image:", url, e);
            onFailure("Failed to load panorama image. Please check the network or file path.");
        };

        img.src = url;
    }

    function addSceneToViewer(sceneId) {
        console.log("Adding Scene:", sceneId);
        if (!configData || !configData.scenes[sceneId]) {
            console.error("[addSceneToViewer] Invalid scene config for: " + sceneId);
            return;
        }
        if (addedScenes.has(sceneId)) return;
        try {
            const sceneConfig = Object.assign({}, configData.scenes[sceneId]);
            viewer.addScene(sceneId, sceneConfig);
            addedScenes.add(sceneId);
            console.log("[addSceneToViewer] Scene added: " + sceneId);
        } catch (e) {
            console.error("[addSceneToViewer] Add scene failed for " + sceneId, e);
            throw e;
        }
    }

    function unloadScene(sceneId) {
        if (!sceneId) return;
        try {
            if (addedScenes.has(sceneId)) {
                viewer.removeScene(sceneId);
                addedScenes.delete(sceneId);
                console.log("[unloadScene] Scene removed: " + sceneId);
            }
            if (preloadedImages[sceneId]) {
                const link = preloadedImages[sceneId];
                if (link && link.parentNode) {
                    link.parentNode.removeChild(link);
                }
                delete preloadedImages[sceneId];
            }
        } catch (e) {
            console.error("[unloadScene] Unload scene failed for " + sceneId, e);
            throw e;
        }
    }

    function loadScene(sceneId, pitch, yaw, hfov) {
        console.log("Loading Scene:", sceneId);
        // 1. Verify that scene exists before loading
        if (!configData || !configData.scenes[sceneId]) {
            console.error("[loadScene] Scene config not found for: " + sceneId);
            return;
        }

        // 2. Validate panorama image URL before loading
        const panoramaUrl = configData.scenes[sceneId].panorama;
        if (!panoramaUrl || typeof panoramaUrl !== 'string' || panoramaUrl.trim() === '') {
            console.error("[loadScene] Invalid panorama URL for scene: " + sceneId);
            return;
        }

        console.log("[loadScene] Loading started for scene: " + sceneId);

        // 3. Display smooth loading indicator
        dom.loading.classList.remove('done');
        dom.loaderFill.style.transition = 'none';
        dom.loaderFill.style.width = '10%';

        // Fast UI feedback
        let loaderw = 10;
        let loaderInterval = setInterval(() => {
            if (loaderw < 90) loaderw += 15;
            dom.loaderFill.style.transition = 'width 0.1s linear';
            dom.loaderFill.style.width = loaderw + '%';
        }, 100);

        // 4. Prevent memory leaks by removing duplicate load listeners and timeouts
        if (currentOnLoadHandler) {
            try {
                viewer.off('load', currentOnLoadHandler);
            } catch (e) {
                console.warn("[loadScene] Error removing old load listener:", e);
            }
            currentOnLoadHandler = null;
        }
        if (activeLoadTimeout) {
            clearTimeout(activeLoadTimeout);
            activeLoadTimeout = null;
        }

        const prevSceneId = currentSceneId;

        // Perform dynamic hardware limit verification before loading
        checkPanoramaDimensions(panoramaUrl, () => {
            // 5. Wrap viewer.addScene in try-catch
            try {
                addSceneToViewer(sceneId);
            } catch (e) {
                console.error("[loadScene] Error in addSceneToViewer:", e);
                clearInterval(loaderInterval);
                dom.loading.classList.add('done');
                return;
            }

            // 6. Handle loading failure / timeout
            const onLoadFailed = (reason) => {
                console.error("[loadScene] Scene load failed for " + sceneId + ". Reason: " + reason);

                if (activeLoadTimeout) {
                    clearTimeout(activeLoadTimeout);
                    activeLoadTimeout = null;
                }
                if (currentOnLoadHandler) {
                    try {
                        viewer.off('load', currentOnLoadHandler);
                    } catch (e) { }
                    currentOnLoadHandler = null;
                }

                clearInterval(loaderInterval);
                dom.loading.classList.add('done'); // Hide loading screen

                // Keep the current/previous scene visible instead of locking the app
                if (prevSceneId && prevSceneId !== sceneId) {
                    try {
                        console.log("[loadScene] Reverting to previous scene: " + prevSceneId);
                        viewer.loadScene(prevSceneId);
                        currentSceneId = prevSceneId;
                    } catch (e) {
                        console.error("[loadScene] Error reverting to previous scene:", e);
                    }
                }
            };

            // 7. Add 4-second timeout fallback (prevent infinite loading screen)
            activeLoadTimeout = setTimeout(() => {
                console.warn("[loadScene] Scene timeout (4s) reached for scene: " + sceneId + ". Forcing loader screen hide.");

                clearInterval(loaderInterval);
                dom.loading.classList.add('done');

                // Assume loaded/loading is far enough along, or failed, but keep app active
                currentSceneId = sceneId;

                // Defer unloading the previous scene to prevent reentrancy issues
                if (prevSceneId && prevSceneId !== sceneId) {
                    setTimeout(() => {
                        try {
                            unloadScene(prevSceneId);
                            console.log("[loadScene] Scene removed from memory (timeout fallback): " + prevSceneId);
                        } catch (e) {
                            console.warn("[loadScene] Timeout unload failed:", e);
                        }
                    }, 500);
                }

                // Cleanup listeners
                if (currentOnLoadHandler) {
                    try {
                        viewer.off('load', currentOnLoadHandler);
                    } catch (e) { }
                    currentOnLoadHandler = null;
                }
                activeLoadTimeout = null;
            }, 4000);

            // 8. Load success handler
            const onLoad = () => {
                console.log("[loadScene] Scene loaded successfully: " + sceneId);

                if (activeLoadTimeout) {
                    clearTimeout(activeLoadTimeout);
                    activeLoadTimeout = null;
                }
                if (currentOnLoadHandler === onLoad) {
                    try {
                        viewer.off('load', onLoad);
                    } catch (e) { }
                    currentOnLoadHandler = null;
                }

                clearInterval(loaderInterval);
                dom.loaderFill.style.width = '100%';

                setTimeout(() => {
                    dom.loading.classList.add('done');
                }, 50);

                // In Single Scene Strategy, unload previous scene only after next scene is fully loaded
                // Wrap in setTimeout 500ms to allow Pannellum to complete its load/render loop and avoid WebGL crashes
                if (prevSceneId && prevSceneId !== sceneId) {
                    setTimeout(() => {
                        try {
                            unloadScene(prevSceneId);
                            console.log("[loadScene] Scene removed from memory: " + prevSceneId);
                        } catch (e) {
                            console.error("[loadScene] Error unloading previous scene " + prevSceneId + ":", e);
                        }
                    }, 500);
                }

                currentSceneId = sceneId;
            };

            currentOnLoadHandler = onLoad;
            viewer.on('load', onLoad);

            // 9. Wrap viewer.loadScene in try-catch
            try {
                viewer.loadScene(sceneId, pitch, yaw, hfov);
            } catch (e) {
                console.error("[loadScene] viewer.loadScene failed for " + sceneId + ":", e);
                onLoadFailed(e.message || "viewer.loadScene error");
            }
        }, (errorMsg) => {
            // Pre-flight check failed (dimensions too large, timeout, or load error)
            clearInterval(loaderInterval);
            dom.loading.classList.add('done');
            alert(errorMsg);

            // Roll back to previous scene state representation in UI
            if (prevSceneId) {
                console.log("[loadScene] Pre-flight check failed. Restoring active scene state to:", prevSceneId);
                currentSceneId = prevSceneId;
                updateUI(prevSceneId);
                onSceneChangeNav(prevSceneId);
            }
        });
    }

    /* ─────────────────────────────────────────────
       PANNELLUM HOTSPOT HANDLERS
       ───────────────────────────────────────────── */
    function smoothTransition(event, args) {
        if (event) event.stopPropagation();
        console.log("Hotspot clicked");
        console.log("Target Scene:", args.sceneId);

        const entryPitch = args.targetPitch ?? 0;
        const entryYaw = args.targetYaw ?? 0;
        const entryHfov = viewer.getHfov();

        // Record the entry direction so compass can reset to it
        sceneEntryPositions[args.sceneId] = {
            pitch: entryPitch,
            yaw: entryYaw,
            hfov: entryHfov
        };

        loadScene(args.sceneId, entryPitch, entryYaw, entryHfov);
    }

    function hotspotText(div) {
        const el = document.createElement('div');
        el.classList.add('hotspot-content');
        el.innerHTML = '<img src="assets/arrow.png" class="arrow-img">';
        div.innerHTML = '';
        div.appendChild(el);
    }

    /* ─────────────────────────────────────────────
       INFO POPUP (hotspot detail — stays centered)
       ───────────────────────────────────────────── */
    function showInfo(event, args) {
        dom.infoTitle.innerText = args.title || '';
        dom.infoDesc.innerHTML = args.description || '';
        if (args.image) {
            dom.infoImage.src = args.image;
            dom.popupImgWrap.style.display = 'block';
        } else {
            dom.infoImage.src = '';
            dom.popupImgWrap.style.display = 'none';
        }
        dom.infoPopup.classList.add('active');
    }

    function closeInfo() { dom.infoPopup.classList.remove('active'); }

    dom.popupClose.addEventListener('click', closeInfo);
    dom.infoPopup.addEventListener('click', (e) => {
        if (e.target === dom.infoPopup) closeInfo();
    });

    /* ─────────────────────────────────────────────
       HELP PANEL (right side — only one at a time)
       ───────────────────────────────────────────── */
    function openHelp() { closeGrid(); dom.helpOverlay.classList.add('active'); }
    function closeHelp() { dom.helpOverlay.classList.remove('active'); }
    function toggleHelp() {
        dom.helpOverlay.classList.contains('active') ? closeHelp() : openHelp();
    }

    dom.btnHelp.addEventListener('click', toggleHelp);
    dom.helpClose.addEventListener('click', closeHelp);
    dom.helpOverlay.addEventListener('click', (e) => {
        if (e.target === dom.helpOverlay) closeHelp();
    });

    /* ─────────────────────────────────────────────
       GRID PANEL (right side — only one at a time)
       ───────────────────────────────────────────── */
    function openGrid() {
        closeHelp();
        if (configData) {
            buildGrid(configData);
        }
        dom.gridOverlay.classList.add('active');
    }
    function closeGrid() {
        dom.gridOverlay.classList.remove('active');
        dom.gridBody.innerHTML = ''; // Clear items and unload images from DOM memory
    }
    function toggleGrid() {
        dom.gridOverlay.classList.contains('active') ? closeGrid() : openGrid();
    }

    dom.btnGrid.addEventListener('click', toggleGrid);
    dom.gridClose.addEventListener('click', closeGrid);
    dom.gridOverlay.addEventListener('click', (e) => {
        if (e.target === dom.gridOverlay) closeGrid();
    });

    function buildGrid(config) {
        dom.gridBody.innerHTML = '';

        // Initialize IntersectionObserver to lazy load thumbnails only when they enter viewport
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    obs.unobserve(img);
                }
            });
        }, {
            root: dom.gridBody,
            rootMargin: '100px' // Load a bit early before scrolling into view
        });

        sceneKeys.forEach((id, i) => {
            const scene = config.scenes[id];
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.dataset.scene = id;

            // Use an inline lightweight SVG placeholder so no initial network request is made
            const placeholder = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='45' viewBox='0 0 80 45'><rect width='80' height='45' fill='%23222'/></svg>";

            item.innerHTML =
                '<img class="grid-thumb" src="' + placeholder + '" data-src="' + scene.panorama + '" alt="' + scene.title + '">' +
                '<span class="grid-num">' + (i + 1) + '</span>' +
                '<span class="grid-label">' + scene.title + '</span>';

            item.addEventListener('click', () => {
                // Grid loads scene at config defaults — record as entry position
                const sc = config.scenes[id];
                sceneEntryPositions[id] = {
                    pitch: sc.pitch || 0,
                    yaw: sc.yaw || 0,
                    hfov: sc.hfov || 110
                };
                loadScene(id);
                closeGrid();
            });
            dom.gridBody.appendChild(item);

            // Start observing the image inside the created item
            const img = item.querySelector('.grid-thumb');
            if (img) {
                observer.observe(img);
            }
        });

        // Highlight the currently active scene card
        markGridActive(currentSceneId);
    }

    function markGridActive(sceneId) {
        dom.gridBody.querySelectorAll('.grid-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.scene === sceneId);
        });
    }

    /* ─────────────────────────────────────────────
       FULLSCREEN
       ───────────────────────────────────────────── */
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    }
    dom.btnFullscreen.addEventListener('click', toggleFullscreen);

    /* ─────────────────────────────────────────────
       UPDATE UI ON SCENE CHANGE
       ───────────────────────────────────────────── */
    function updateUI(sceneId) {
        console.log("updateUI:", sceneId);
        if (!configData) return;
        const scene = configData.scenes[sceneId];
        if (!scene) return;
        currentSceneId = sceneId;
        const idx = sceneKeys.indexOf(sceneId) + 1;


        dom.infoBoxText.textContent = scene.title;

        markGridActive(sceneId);
    }

    /* ─────────────────────────────────────────────
       KEYBOARD SHORTCUTS
       ───────────────────────────────────────────── */
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        const k = e.key.toLowerCase();
        if (k === 'escape') { closeInfo(); closeHelp(); closeGrid(); closeNavGuide(); return; }
        if (k === 'g') { e.preventDefault(); toggleGrid(); return; }
        if (k === 'h') { e.preventDefault(); toggleHelp(); return; }
        if (k === 'f') { e.preventDefault(); toggleFullscreen(); return; }
        if (k === 'n') { e.preventDefault(); toggleNavGuide(); return; }
    });

    /* ─────────────────────────────────────────────
       INDOOR NAVIGATION SYSTEM — 8-FLOOR
       ───────────────────────────────────────────── */

    /*
     * Which floors have 360° data available.
     * Set a floor to true once its panoramas are uploaded.
     */
    const FLOOR_AVAILABLE = {
        'Ground Floor': true,
        '1st Floor': false,
        '2nd Floor': false,
        '3rd Floor': false,
        '4th Floor': false,
        '5th Floor': false,
        '6th Floor': false,
        '7th Floor': false
    };

    /*
     * Maps each floor key to its corridor scene (entry point).
     * Only Ground Floor has real scenes right now.
     * Update these when new floor panoramas are added.
     */
    const FLOOR_CORRIDOR_MAP = {
        'Ground Floor': 'scene1',
        '1st Floor': null,
        '2nd Floor': null,
        '3rd Floor': null,
        '4th Floor': null,
        '5th Floor': null,
        '6th Floor': null,
        '7th Floor': null
    };

    /* Reverse lookup: scene → floor name */
    const SCENE_TO_FLOOR = {};
    (function buildSceneFloorMap() {
        const floorScenes = {
            'Ground Floor': ['scene1', 'scene2', 'scene3', 'scene4', 'scene5', 'scene6', 'scene7', 'scene8', 'scene9', 'scene10', 'scene11']
            /* Add scene arrays for other floors here when available */
        };
        for (const floor in floorScenes) {
            floorScenes[floor].forEach(s => { SCENE_TO_FLOOR[s] = floor; });
        }
    })();


    const FLOOR_DATA = {

        /* ══════ GROUND FLOOR (ACTIVE — has 360° images) ══════ */
        'Ground Floor': {
            labs: [
                {
                    id: 'xr-lab',
                    label: 'L-107 Extended Reality & Game Development Lab',
                    destinationScene: 'scene1',
                    destinationInfo: 'L-107 Extended Reality & Game Development Lab',
                    route: [
                        { scene: 'scene4', direction: 'Go straight ahead', arrowTarget: 'scene1' },
                        { scene: 'scene1', direction: '✅ You have arrived!', arrowTarget: null }
                    ]
                },
                {
                    id: 'iot-lab',
                    label: 'L-106 IOT Lab',
                    destinationScene: 'scene1',
                    destinationInfo: 'L-106 IOT Lab',
                    route: [
                        { scene: 'scene4', direction: 'Go straight ahead', arrowTarget: 'scene1' },
                        { scene: 'scene1', direction: '✅ IOT Lab is on your right', arrowTarget: null }
                    ]
                },
                {
                    id: 'network-lab',
                    label: 'L-108 Network Architecture Lab',
                    destinationScene: 'scene5',
                    destinationInfo: 'L-108 Network Architecture Lab',
                    route: [
                        { scene: 'scene4', direction: 'Go to the end of the corridor', arrowTarget: 'scene5' },
                        { scene: 'scene5', direction: '✅ Network Lab is on your left', arrowTarget: null }
                    ]
                },
                {
                    id: 'data-center',
                    label: 'Data Center',
                    destinationScene: 'scene4',
                    destinationInfo: 'Data Center',
                    route: [
                        { scene: 'scene4', direction: '✅ Data Center is right here', arrowTarget: null }
                    ]
                },
                {
                    id: 'seminar-hall',
                    label: 'Seminar Hall',
                    destinationScene: 'scene10',
                    destinationInfo: null,
                    route: [
                        { scene: 'scene4', direction: 'Continue straight ahead', arrowTarget: 'scene5' },
                        { scene: 'scene5', direction: 'Go straight to Seminar Hall', arrowTarget: 'scene10' },
                        { scene: 'scene10', direction: '✅ Welcome to the Seminar Hall', arrowTarget: null }
                    ]
                }
            ]
        },

        /* ══════ 1ST FLOOR (Coming Soon) ══════ */
        '1st Floor': {
            labs: [
                { id: '1f-comp', label: 'L-101 Computer Lab', destinationScene: null, destinationInfo: null, route: [] },
                { id: '1f-software', label: 'L-102 Software Engineering Lab', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 2ND FLOOR (Coming Soon) ══════ */
        '2nd Floor': {
            labs: [
                { id: '2f-comp', label: 'L-201 Computer Lab', destinationScene: null, destinationInfo: null, route: [] },
                { id: '2f-ai', label: 'L-202 AI & Machine Learning Lab', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 3RD FLOOR (Coming Soon) ══════ */
        '3rd Floor': {
            labs: [
                { id: '3f-db', label: 'L-301 Database Lab', destinationScene: null, destinationInfo: null, route: [] },
                { id: '3f-cyber', label: 'L-302 Cyber Security Lab', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 4TH FLOOR (Coming Soon) ══════ */
        '4th Floor': {
            labs: [
                { id: '4f-elec', label: 'L-401 Electronics Lab', destinationScene: null, destinationInfo: null, route: [] },
                { id: '4f-robo', label: 'L-402 Robotics Lab', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 5TH FLOOR (Coming Soon) ══════ */
        '5th Floor': {
            labs: [
                { id: '5f-research', label: 'L-501 Research Lab', destinationScene: null, destinationInfo: null, route: [] },
                { id: '5f-project', label: 'L-502 Project Lab', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 6TH FLOOR (Coming Soon) ══════ */
        '6th Floor': {
            labs: [
                { id: '6f-conf', label: 'Conference Hall', destinationScene: null, destinationInfo: null, route: [] },
                { id: '6f-lib', label: 'Digital Library', destinationScene: null, destinationInfo: null, route: [] }
            ]
        },

        /* ══════ 7TH FLOOR (Coming Soon) ══════ */
        '7th Floor': {
            labs: [
                { id: '7f-sem', label: 'Seminar Room', destinationScene: null, destinationInfo: null, route: [] },
                { id: '7f-innov', label: 'Innovation Hub', destinationScene: null, destinationInfo: null, route: [] }
            ]
        }
    };

    /* State */
    let navActive = false;
    let activeRoute = null;
    let activeLabData = null;
    let currentStepIndex = 0;
    let selectedFloorKey = '';

    /* ── Panel open/close ── */
    function openNavGuide() {
        closeHelp(); closeGrid();
        dom.navGuidePanel.classList.add('open');
        dom.btnNavGuide.classList.add('active');
    }
    function closeNavGuide() {
        dom.navGuidePanel.classList.remove('open');
        dom.btnNavGuide.classList.remove('active');
    }
    function toggleNavGuide() {
        dom.navGuidePanel.classList.contains('open') ? closeNavGuide() : openNavGuide();
    }

    dom.btnNavGuide.addEventListener('click', toggleNavGuide);
    dom.navGuideClose.addEventListener('click', closeNavGuide);

    /* ── Populate floor dropdown ── */
    Object.keys(FLOOR_DATA).forEach(floor => {
        const opt = document.createElement('option');
        opt.value = floor;
        opt.textContent = floor;
        dom.floorSelect.appendChild(opt);
    });

    /* ── Floor change → load floor environment OR show Coming Soon ── */
    dom.floorSelect.addEventListener('change', function () {
        const floor = this.value;
        selectedFloorKey = floor;

        /* Reset lab dropdown */
        dom.labSelect.innerHTML = '<option value="">Select Destination</option>';
        dom.labSelect.disabled = true;
        dom.navGuideGo.disabled = true;

        /* Clear any active navigation */
        if (navActive) clearNavigation();

        /* Hide Coming Soon by default */
        dom.navComingSoon.style.display = 'none';

        if (!floor) return;

        /* Check if this floor has 360° data */
        if (!FLOOR_AVAILABLE[floor]) {
            /* Floor not yet available — show Coming Soon, keep lab dropdown disabled */
            dom.navComingSoon.style.display = 'flex';
            dom.navGuideGo.style.display = 'none';
            return;
        }

        /* Floor IS available */
        dom.navGuideGo.style.display = 'inline-flex';

        /* Load the floor's corridor scene in the viewer */
        const corridorScene = FLOOR_CORRIDOR_MAP[floor];
        if (corridorScene && viewer && viewer.getScene() !== corridorScene) {
            loadScene(corridorScene);
        }

        /* Populate labs */
        if (FLOOR_DATA[floor]) {
            FLOOR_DATA[floor].labs.forEach(lab => {
                const opt = document.createElement('option');
                opt.value = lab.id;
                opt.textContent = lab.label;
                dom.labSelect.appendChild(opt);
            });
            dom.labSelect.disabled = false;
        }
    });

    /* ── Lab change → enable Go ── */
    dom.labSelect.addEventListener('change', function () {
        dom.navGuideGo.disabled = !this.value;
    });

    /* ── Show Path (Go) ── */
    dom.navGuideGo.addEventListener('click', function () {
        const floor = dom.floorSelect.value;
        const labId = dom.labSelect.value;
        if (!floor || !labId) return;

        /* Safety check — don't navigate to unavailable floors */
        if (!FLOOR_AVAILABLE[floor]) return;

        const floorData = FLOOR_DATA[floor];
        const lab = floorData.labs.find(l => l.id === labId);
        if (!lab || !lab.route || lab.route.length === 0) return;

        activeLabData = lab;
        activeRoute = lab.route;

        navActive = true;

        /* Find which step matches the current scene, or start at 0 */
        const curScene = viewer ? viewer.getScene() : currentSceneId;
        const matchIdx = activeRoute.findIndex(s => s.scene === curScene);
        currentStepIndex = matchIdx >= 0 ? matchIdx : 0;

        /* If the user is not on the route's first scene, navigate there */
        if (matchIdx < 0 && activeRoute.length > 0) {
            const firstStep = activeRoute[0];
            if (viewer && viewer.getScene() !== firstStep.scene) {
                loadScene(firstStep.scene);
            }
        }

        /* Add nav-active class to panorama for dimming non-highlighted */
        const pano = document.getElementById('panorama');
        if (pano) pano.classList.add('nav-active');

        /* Show clear button, hide go */
        dom.navGuideGo.style.display = 'none';
        dom.navGuideClear.style.display = 'inline-flex';

        applyHighlights();
        showDirectionBanner();
        closeNavGuide();
    });

    /* ── Clear navigation ── */
    dom.navGuideClear.addEventListener('click', clearNavigation);

    function clearNavigation() {
        navActive = false;
        activeRoute = null;
        activeLabData = null;
        currentStepIndex = 0;

        removeAllHighlights();
        hideDirectionBanner();

        const pano = document.getElementById('panorama');
        if (pano) pano.classList.remove('nav-active');

        dom.navGuideGo.style.display = 'inline-flex';
        dom.navGuideClear.style.display = 'none';
        dom.navGuideGo.disabled = !dom.labSelect.value;
        dom.navComingSoon.style.display = 'none';
    }

    /* ── Apply highlights to hotspots in the current scene ── */
    function applyHighlights() {
        removeAllHighlights();
        if (!navActive || !activeRoute || !viewer) return;

        const curScene = viewer.getScene();
        const step = activeRoute.find(s => s.scene === curScene);
        if (!step) return;

        /* Highlight the arrow hotspot that points toward arrowTarget */
        if (step.arrowTarget) {
            if (configData && configData.scenes[curScene]) {
                const sceneHotspots = configData.scenes[curScene].hotSpots || [];
                const allHs = document.querySelectorAll('#panorama .pnlm-hotspot');
                sceneHotspots.forEach((hsCfg, idx) => {
                    if (hsCfg.clickHandlerArgs && hsCfg.clickHandlerArgs.sceneId === step.arrowTarget) {
                        if (allHs[idx]) {
                            allHs[idx].classList.add('highlight-path');
                        }
                    }
                });
            }
        }

        /* Highlight destination info hotspot (blinking) */
        if (curScene === activeLabData.destinationScene && activeLabData.destinationInfo) {
            if (configData && configData.scenes[curScene]) {
                const sceneHotspots = configData.scenes[curScene].hotSpots || [];
                const allHs = document.querySelectorAll('#panorama .pnlm-hotspot');
                sceneHotspots.forEach((hsCfg, idx) => {
                    if (hsCfg.type === 'info' && hsCfg.clickHandlerArgs &&
                        hsCfg.clickHandlerArgs.title === activeLabData.destinationInfo) {
                        if (allHs[idx]) {
                            allHs[idx].classList.add('highlight-destination');
                        }
                    }
                });
            }
        }
    }

    function removeAllHighlights() {
        document.querySelectorAll('.highlight-path').forEach(el => el.classList.remove('highlight-path'));
        document.querySelectorAll('.highlight-destination').forEach(el => el.classList.remove('highlight-destination'));
    }

    /* ── Direction banner ── */
    function showDirectionBanner() {
        if (!activeRoute || !activeLabData) return;
        updateDirectionStep();
        dom.directionBanner.classList.add('show');
    }

    function hideDirectionBanner() {
        dom.directionBanner.classList.remove('show');
    }

    function updateDirectionStep() {
        if (!activeRoute) return;
        const step = activeRoute[currentStepIndex];
        if (!step) return;

        dom.dirStepNum.textContent = currentStepIndex + 1;
        dom.dirStepTotal.textContent = '/ ' + activeRoute.length;
        dom.dirInstruction.textContent = step.direction;
        dom.dirDestination.textContent = '→ ' + activeLabData.label;

        dom.dirPrev.disabled = currentStepIndex <= 0;
        dom.dirNext.disabled = currentStepIndex >= activeRoute.length - 1;
    }

    dom.dirPrev.addEventListener('click', function () {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateDirectionStep();
            /* Navigate viewer to the step's scene */
            const step = activeRoute[currentStepIndex];
            if (step && viewer && viewer.getScene() !== step.scene) {
                loadScene(step.scene);
            }
        }
    });

    dom.dirNext.addEventListener('click', function () {
        if (currentStepIndex < activeRoute.length - 1) {
            currentStepIndex++;
            updateDirectionStep();
            const step = activeRoute[currentStepIndex];
            if (step && viewer && viewer.getScene() !== step.scene) {
                loadScene(step.scene);
            }
        }
    });

    /* ── Re-apply highlights on scene change ── */
    function onSceneChangeNav(sceneId) {
        if (!navActive || !activeRoute) return;
        const matchIdx = activeRoute.findIndex(s => s.scene === sceneId);
        if (matchIdx >= 0) {
            currentStepIndex = matchIdx;
            updateDirectionStep();
        }
        /* Delay highlight application to allow Pannellum to render hotspots */
        setTimeout(applyHighlights, 200);
    }

    /* (Preloading is now handled dynamically by preloadScene) */

    /* ─────────────────────────────────────────────
       HFOV LOCK (original logic)
       ───────────────────────────────────────────── */
    function lockHfov(target) {
        let done = false, last = null, stable = 0;
        (function tick() {
            if (!viewer || done) return;
            const c = viewer.getHfov();
            if (last !== null && Math.abs(c - last) < 0.01) stable++; else stable = 0;
            last = c;
            if (stable >= 5) { viewer.setHfov(target, false); done = true; return; }
            requestAnimationFrame(tick);
        })();
    }

    /* ─────────────────────────────────────────────
       MAIN INIT
       ───────────────────────────────────────────── */
    runLoader(function (ready) {
        fetch('config.json')
            .then((r) => r.json())
            .then((config) => {
                configData = config;
                sceneKeys = Object.keys(config.scenes);
                totalScenes = sceneKeys.length;

                /* Wire up hotspots */
                for (const id in config.scenes) {
                    const hs = config.scenes[id].hotSpots;
                    if (!hs) continue;
                    hs.forEach((h) => {
                        if (h.cssClass && h.cssClass.includes('nav-btn') && h.clickHandlerArgs?.sceneId) {
                            h.clickHandlerFunc = smoothTransition;
                        } else if (h.cssClass && h.cssClass.includes('nav-btn')) {
                            h.cssClass = 'hidden-hotspot';
                        }
                        if (h.type === 'info') {
                            h.clickHandlerFunc = showInfo;
                        } else {
                            if (!h.createTooltipArgs) h.createTooltipArgs = h.text;
                            h.createTooltipFunc = hotspotText;
                        }
                    });
                }

                /* Mobile config tweaks */
                if (!config.default) config.default = {};
                if (window.innerWidth < 768) {
                    Object.assign(config.default, { minPitch: -100, maxPitch: 100, hfov: 100, minHfov: 50, maxHfov: 120 });
                }

                const TARGET_HFOV = window.innerWidth < 768 ? 100 : 110;

                const first = config.default.firstScene || sceneKeys[0];
                const firstSceneConfig = config.scenes[first];

                function initializeViewer() {
                    /* Create viewer with single scene for memory optimization */
                    const startupConfig = Object.assign({}, config);
                    startupConfig.scenes = {};

                    let activeFirstConfig = Object.assign({}, firstSceneConfig);
                    startupConfig.scenes[first] = activeFirstConfig;

                    viewer = pannellum.viewer('panorama', startupConfig);
                    window.viewer = viewer;
                    addedScenes.add(first);

                    /* Initial UI */
                    updateUI(first);

                    viewer.on('scenechange', function (sceneId) {
                        updateUI(sceneId);
                        onSceneChangeNav(sceneId);
                    });

                    /* ── Record entry position for the first scene (config defaults) ── */
                    sceneEntryPositions[first] = {
                        pitch: firstSceneConfig.pitch || 0,
                        yaw: firstSceneConfig.yaw || 0,
                        hfov: firstSceneConfig.hfov || TARGET_HFOV
                    };

                    /* ── Compass click → reset to ENTRY position ── */
                    viewer.on('load', function () {
                        const compass = document.querySelector('.pnlm-compass');
                        if (compass) {
                            compass.style.cursor = 'pointer';
                            compass.title = 'Reset to original view';

                            compass.addEventListener('click', function (e) {
                                e.stopPropagation();

                                // Stay in the SAME scene — reset to the direction user entered from
                                const id = viewer.getScene();
                                const pos = sceneEntryPositions[id];

                                if (pos) {
                                    viewer.setPitch(pos.pitch, true);  // true = animated
                                    viewer.setYaw(pos.yaw, true);      // entry yaw (targetYaw or config default)
                                    viewer.setHfov(pos.hfov, true);
                                }

                                // Visual click feedback — pulse animation
                                compass.classList.remove('compass-pulse');
                                void compass.offsetWidth;            // force reflow
                                compass.classList.add('compass-pulse');
                                compass.addEventListener('animationend', function () {
                                    compass.classList.remove('compass-pulse');
                                }, { once: true });
                            });
                        }
                    });

                    /* Move info popup inside panorama for fullscreen support */
                    if (window.innerWidth > 768) {
                        const pano = document.getElementById('panorama');
                        if (pano && dom.infoPopup) pano.appendChild(dom.infoPopup);
                    }

                    lockHfov(TARGET_HFOV);
                    currentSceneId = first;
                    ready();
                }

                if (firstSceneConfig && firstSceneConfig.panorama) {
                    checkPanoramaDimensions(firstSceneConfig.panorama, () => {
                        initializeViewer();
                    }, (err) => {
                        console.error("[init] First scene failed GPU compatibility check:", err);
                        alert("Initial scene loading failed: " + err);
                        dom.loading.classList.add('done');
                        ready();
                    });
                } else {
                    initializeViewer();
                }
            })
            .catch((err) => { console.error(err); ready(); });
    });
})();