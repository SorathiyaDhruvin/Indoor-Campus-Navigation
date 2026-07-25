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
        btnAudioToggle: $('btnAudioToggle'),
        iconAudioOn: $('iconAudioOn'),
        iconAudioOff: $('iconAudioOff'),
        btnMenuToggle: $('btnMenuToggle'),
        mainDropdown: $('mainDropdown'),
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
        btnToggleArrows: $('btnToggleArrows'),
        txtToggleArrows: $('txtToggleArrows'),
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

        /* Welcome Splash Elements */
        loaderContent: $('loaderContent'),
        welcomeCard: $('welcomeCard'),
        btnEnterTour: $('btnEnterTour'),

        /* Floor Map */
        mapOverlay: $('mapOverlay'),
        btnMapOpen: $('btnMapOpen'),
        btnDropdownMap: $('btnDropdownMap'),
        mapClose: $('mapClose'),
        mapWrapper: $('mapWrapper'),
    };

    let viewer = null;
    let configData = null;
    let sceneKeys = [];
    let totalScenes = 0;
    let currentSceneId = '';
    let sceneHistory = [];
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

            // Transition from progress loader to welcome card
            setTimeout(() => {
                if (dom.loaderContent) dom.loaderContent.classList.add('hidden');

                setTimeout(() => {
                    if (dom.loaderContent) dom.loaderContent.style.display = 'none';
                    if (dom.welcomeCard) {
                        dom.welcomeCard.classList.remove('hidden');
                    }
                }, 500);
            }, 300);

            // Listen for Start Tour click
            if (dom.btnEnterTour) {
                dom.btnEnterTour.addEventListener('click', () => {
                    // Play modern UI click tick sound
                    if (window.playTick) playTick();

                    // Hide loading overlay entirely
                    dom.loading.classList.add('done');
                    dom.topBar.classList.add('show');
                    if (dom.infoBox) {
                        dom.infoBox.classList.add('show');
                    }

                    // Resume AudioContext if suspended
                    if (window.audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }

                    // Unlock audio manager & play background audio narration
                    if (window.audioManager) {
                        audioManager.hasInteracted = true;
                        audioManager.playCurrentScene();
                    }

                    // Focus the panorama container so WASD keys work instantly
                    const pano = document.getElementById('panorama');
                    if (pano) {
                        pano.setAttribute('tabindex', '0');
                        pano.focus();
                    }
                });
            }
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
            onFailure("Image verification timed out (30s). The file might be too slow to load or inaccessible.");
        }, 30000); // 30 seconds pre-flight timeout

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
        } catch (e) {
            console.error("[unloadScene] Unload scene failed for " + sceneId, e);
            throw e;
        }
    }

    function loadScene(sceneId, pitch, yaw, hfov, isBack = false) {
        console.log("Loading Scene:", sceneId);
        
        // Hide the controls guide when the user takes a step
        const controlsGuide = document.querySelector('.controls-guide-card');
        if (controlsGuide && controlsGuide.style.display !== 'none') {
            controlsGuide.style.display = 'none';
        }

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

        const sc = configData.scenes[sceneId];
        const entryPos = sceneEntryPositions[sceneId] || {};
        pitch = pitch !== undefined ? pitch : (entryPos.pitch !== undefined ? entryPos.pitch : (sc.pitch || 0));
        yaw = yaw !== undefined ? yaw : (entryPos.yaw !== undefined ? entryPos.yaw : (sc.yaw || 0));
        hfov = hfov !== undefined ? hfov : (entryPos.hfov !== undefined ? entryPos.hfov : (sc.hfov || 110));

        const isPreloaded = !!preloadedImages[sceneId];
        let loaderInterval = null;

        if (!isPreloaded) {
            // 3. Display smooth loading indicator
            dom.loading.classList.remove('done');
            dom.loaderFill.style.transition = 'none';
            dom.loaderFill.style.width = '10%';

            // Fast UI feedback
            let loaderw = 10;
            loaderInterval = setInterval(() => {
                if (loaderw < 90) loaderw += 15;
                dom.loaderFill.style.transition = 'width 0.1s linear';
                dom.loaderFill.style.width = loaderw + '%';
            }, 100);
        }

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

        if (prevSceneId && prevSceneId !== sceneId && !isBack) {
            sceneHistory.push(prevSceneId);
        }

        // Perform dynamic hardware limit verification before loading
        checkPanoramaDimensions(panoramaUrl, () => {
            // 5. Wrap viewer.addScene in try-catch
            try {
                addSceneToViewer(sceneId);
            } catch (e) {
                console.error("[loadScene] Error in addSceneToViewer:", e);
                if (loaderInterval) clearInterval(loaderInterval);
                if (!isPreloaded) dom.loading.classList.add('done');
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

                if (loaderInterval) clearInterval(loaderInterval);
                if (!isPreloaded) dom.loading.classList.add('done'); // Hide loading screen

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

                if (loaderInterval) clearInterval(loaderInterval);
                if (!isPreloaded) dom.loading.classList.add('done');

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
                    }, 1500);
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

                // Enforce target pitch/yaw in case Pannellum restores a cached camera state
                if (yaw !== undefined && yaw !== null) viewer.setYaw(yaw, false);
                if (pitch !== undefined && pitch !== null) viewer.setPitch(pitch, false);

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

                if (loaderInterval) {
                    clearInterval(loaderInterval);
                    dom.loaderFill.style.width = '100%';
                    setTimeout(() => {
                        dom.loading.classList.add('done');
                    }, 50);
                }

                // In Single Scene Strategy, unload previous scene only after next scene is fully loaded
                // Wrap in setTimeout 1500ms to allow Pannellum to complete its load/render loop and avoid WebGL crashes
                if (prevSceneId && prevSceneId !== sceneId) {
                    setTimeout(() => {
                        try {
                            unloadScene(prevSceneId);
                            console.log("[loadScene] Scene removed from memory: " + prevSceneId);
                        } catch (e) {
                            console.error("[loadScene] Error unloading previous scene " + prevSceneId + ":", e);
                        }
                    }, 1500);
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
            if (loaderInterval) clearInterval(loaderInterval);
            if (!isPreloaded) dom.loading.classList.add('done');
            
            if (dom.infoBoxText && dom.infoBox) {
                dom.infoBoxText.textContent = "Error: " + errorMsg;
                dom.infoBox.classList.add('show');
                setTimeout(() => dom.infoBox.classList.remove('show'), 5000);
            }

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
        if (typeof playWhoosh === 'function') playWhoosh();

        console.log("Hotspot clicked, switching to Target Scene:", args.sceneId);

        const entryPitch = args.targetPitch ?? 0;
        const entryYaw = args.targetYaw ?? 0;
        const currentHfov = viewer.getHfov();

        sceneEntryPositions[args.sceneId] = {
            pitch: entryPitch,
            yaw: entryYaw,
            hfov: currentHfov
        };

        // Load the scene immediately without camera zoom animation
        loadScene(args.sceneId, entryPitch, entryYaw, currentHfov);
    }

    function hotspotText(div, args) {
        const el = document.createElement('div');
        el.classList.add('hotspot-content');
        
        let tooltipHtml = '';
        if (args && args.sceneId && configData && configData.scenes[args.sceneId]) {
            let targetTitle = configData.scenes[args.sceneId].title || args.sceneId;
            // Clean HTML tags if any
            const tmp = document.createElement('div');
            tmp.innerHTML = targetTitle;
            targetTitle = tmp.innerText || tmp.textContent;
            tooltipHtml = `<div class="arrow-tooltip">${targetTitle}</div>`;
        }
        
        el.innerHTML = `
            ${tooltipHtml}
            <svg class="arrow-img" viewBox="0 0 204 100" xmlns="http://www.w3.org/2000/svg">
                <path class="chev-3" d="M 164 5 L 194 50 L 164 95 L 146 95 L 176 50 L 146 5 Z" fill="var(--arrow-color, #ffffff)" stroke="var(--arrow-stroke, rgba(0,0,0,0.3))" stroke-width="1.5" />
                <path class="chev-2" d="M 96 5 L 126 50 L 96 95 L 78 95 L 108 50 L 78 5 Z" fill="var(--arrow-color, #ffffff)" stroke="var(--arrow-stroke, rgba(0,0,0,0.3))" stroke-width="1.5" />
                <path class="chev-1" d="M 28 5 L 58 50 L 28 95 L 10 95 L 40 50 L 10 5 Z" fill="var(--arrow-color, #ffffff)" stroke="var(--arrow-stroke, rgba(0,0,0,0.3))" stroke-width="1.5" />
            </svg>
        `;
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

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // 'Q' key to toggle the options menu
        if (e.key === 'q' || e.key === 'Q') {
            if (dom.mainDropdown) {
                dom.mainDropdown.classList.toggle('show');
            }
        }
        else if (e.key === '1') { if (dom.btnNavGuide) dom.btnNavGuide.click(); }
        else if (e.key === '2') { if (dom.btnGrid) dom.btnGrid.click(); }
        else if (e.key === '3') { if (dom.btnFullscreen) dom.btnFullscreen.click(); }
        else if (e.key === '4') { if (dom.btnHelp) dom.btnHelp.click(); }
        else if (e.key === '5') { if (dom.btnToggleArrows) dom.btnToggleArrows.click(); }
        // Spacebar to toggle info popup for info hotspots in current scene
        else if (e.code === 'Space' || e.keyCode === 32) {
            e.preventDefault(); // Prevent page scroll
            if (dom.infoPopup && dom.infoPopup.classList.contains('active')) {
                closeInfo();
            } else {
                if (viewer && configData && currentSceneId && configData.scenes[currentSceneId]) {
                    const pitch = viewer.getPitch();
                    let yaw = viewer.getYaw();
                    const hotspots = configData.scenes[currentSceneId].hotSpots || [];

                    let found = null;
                    let minDist = Infinity;
                    for (const hs of hotspots) {
                        if (hs.type === 'info') {
                            if (hs.pitch !== undefined && hs.yaw !== undefined) {
                                const dPitch = Math.abs(hs.pitch - pitch);
                                let dYaw = Math.abs(hs.yaw - yaw);
                                if (dYaw > 180) dYaw = 360 - dYaw;
                                const dist = Math.sqrt(dPitch * dPitch + dYaw * dYaw);
                                if (dist < minDist) {
                                    minDist = dist;
                                    found = hs;
                                }
                            } else if (!found) {
                                found = hs;
                            }
                        }
                    }
                    if (found && found.clickHandlerArgs) {
                        showInfo(null, found.clickHandlerArgs);
                    }
                }
            }
        }
    }, true);

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

    /* ─────────────────────────────────────────────
       FLOOR MAP SYSTEM & COORDINATE EDITOR
       ───────────────────────────────────────────── */
    let coordinatesConfig = {};
    let isEditMode = false;
    let dragPin = null;

       // Hardcoded fallback coordinates config for all 55 scenes
    const DEFAULT_COORDINATES = {
        "scene1": { "x": 59, "y": 68 },
        "scene2": { "x": 59, "y": 64 },
        "scene3": { "x": 60, "y": 61 },
        "scene4": { "x": 44, "y": 51 },
        "scene5": { "x": 47, "y": 59 },
        "scene6": { "x": 65, "y": 61 },
        "scene7": { "x": 71, "y": 52 },
        "scene8": { "x": 68, "y": 53 },
        "scene9": { "x": 74, "y": 61 },
        "scene10": { "x": 65, "y": 64 },
        "scene11": { "x": 67, "y": 65 },
        "scene12": { "x": 69, "y": 66 },
        "scene13": { "x": 74, "y": 56 },
        "scene14": { "x": 76, "y": 51 },
        "scene15": { "x": 74, "y": 49 },
        "scene16": { "x": 74, "y": 46 },
        "scene17": { "x": 74, "y": 43 },
        "scene18": { "x": 74, "y": 40 },
        "scene19": { "x": 78, "y": 61 },
        "scene20": { "x": 77, "y": 65 },
        "scene21": { "x": 75, "y": 65 },
        "scene22": { "x": 73, "y": 65 },
        "scene23": { "x": 79, "y": 65 },
        "scene24": { "x": 80, "y": 66 },
        "scene25": { "x": 82, "y": 66 },
        "scene26": { "x": 68, "y": 49 },
        "scene27": { "x": 68, "y": 45 },
        "scene28": { "x": 87, "y": 19 },
        "scene29": { "x": 71, "y": 37 },
        "scene30": { "x": 75, "y": 36 },
        "scene31": { "x": 77, "y": 35 },
        "scene32": { "x": 75, "y": 30 },
        "scene33": { "x": 74, "y": 30 },
        "scene34": { "x": 72, "y": 30 },
        "scene35": { "x": 77, "y": 29 },
        "scene36": { "x": 79, "y": 28 },
        "scene37": { "x": 81, "y": 27 },
        "scene38": { "x": 68, "y": 38 },
        "scene39": { "x": 68, "y": 32 },
        "scene40": { "x": 69, "y": 32 },
        "scene41": { "x": 70, "y": 31 },
        "scene42": { "x": 64, "y": 33 },
        "scene43": { "x": 62, "y": 33 },
        "scene44": { "x": 62, "y": 38 },
        "scene45": { "x": 56, "y": 39 },
        "scene46": { "x": 53, "y": 52 },
        "scene47": { "x": 45, "y": 52 },
        "scene48": { "x": 43, "y": 52 },
        "scene49": { "x": 41, "y": 52 },
        "scene50": { "x": 39, "y": 52 },
        "scene51": { "x": 43, "y": 48 },
        "scene52": { "x": 41, "y": 48 },
        "scene53": { "x": 39, "y": 48 },
        "scene54": { "x": 56, "y": 57 },
        "scene55": { "x": 71, "y": 59 }
    };

    // Load coordinates config
    function loadCoordinatesConfig() {
        fetch('map_coordinates.json')
            .then(res => res.json())
            .then(data => {
                coordinatesConfig = data;
                console.log("[loadCoordinatesConfig] Coordinates loaded successfully.");
                populateEditDropdown();
                updateJsonText();
                renderMapPins();
                updateActiveMapPin();
            })
            .catch(err => {
                console.warn("[loadCoordinatesConfig] Failed to load JSON config, using hardcoded default coordinates config:", err);
                coordinatesConfig = Object.assign({}, DEFAULT_COORDINATES);
                populateEditDropdown();
                updateJsonText();
                renderMapPins();
                updateActiveMapPin();
            });
    }

    function updateJsonText() {
        const text = document.getElementById('mapEditJsonText');
        if (text) {
            text.value = JSON.stringify(coordinatesConfig, null, 2);
        }
    }

    function populateEditDropdown() {
        const select = document.getElementById('mapEditSceneSelect');
        if (!select) return;
        select.innerHTML = '';
        
        const keys = Object.keys(coordinatesConfig).filter(k => k !== '_labels').sort((a, b) => {
            const numA = parseInt(a.replace('scene', ''), 10);
            const numB = parseInt(b.replace('scene', ''), 10);
            return numA - numB;
        });

        keys.forEach(sceneId => {
            const opt = document.createElement('option');
            opt.value = sceneId;
            const sceneNum = parseInt(sceneId.replace('scene', ''), 10);
            if (sceneNum <= 46 || sceneNum === 54 || sceneNum === 55) {
                opt.textContent = `🔒 ${sceneId.toUpperCase()} (${coordinatesConfig[sceneId].x}%, ${coordinatesConfig[sceneId].y}%) [Locked]`;
                opt.disabled = true;
            } else {
                opt.textContent = `${sceneId.toUpperCase()} (${coordinatesConfig[sceneId].x}%, ${coordinatesConfig[sceneId].y}%)`;
            }
            select.appendChild(opt);
        });

        if (currentSceneId && coordinatesConfig[currentSceneId]) {
            const currentNum = parseInt(currentSceneId.replace('scene', ''), 10);
            if (currentNum <= 46 || currentNum === 54 || currentNum === 55) {
                // Default to the first non-locked scene in the dropdown list
                const firstNonLocked = keys.find(k => {
                    const num = parseInt(k.replace('scene', ''), 10);
                    return num > 46 && num !== 54 && num !== 55;
                });
                if (firstNonLocked) {
                    select.value = firstNonLocked;
                }
            } else {
                select.value = currentSceneId;
            }
        }
    }

    function renderMapPins() {
        if (!dom.mapWrapper) return;
        
        // Remove existing pins
        const existingPins = dom.mapWrapper.querySelectorAll('.map-pin');
        existingPins.forEach(pin => pin.remove());

        Object.keys(coordinatesConfig).filter(k => k !== '_labels').forEach(sceneId => {
            const coord = coordinatesConfig[sceneId];
            const pin = document.createElement('div');
            pin.className = 'map-pin';
            pin.style.left = coord.x + '%';
            pin.style.top = coord.y + '%';
            pin.dataset.sceneId = sceneId;

            // Fetch scene title for tooltip
            let name = sceneId.toUpperCase();
            if (configData && configData.scenes[sceneId]) {
                name = configData.scenes[sceneId].title || name;
            }
            
            const sceneNum = parseInt(sceneId.replace('scene', ''), 10);
            if (sceneNum <= 46 || sceneNum === 54 || sceneNum === 55) {
                pin.classList.add('locked');
                pin.setAttribute('data-tooltip', `🔒 ${sceneId.toUpperCase()} - ${name} (Locked)`);
            } else {
                pin.setAttribute('data-tooltip', `${sceneId.toUpperCase()} - ${name}`);
            }

            if (currentSceneId === sceneId) {
                pin.classList.add('active');
            }

            // Click listener - navigate to scene (only when NOT in edit mode)
            pin.addEventListener('click', (e) => {
                if (isEditMode) {
                    e.stopPropagation();
                    return;
                }
                e.stopPropagation();
                if (window.playTick) playTick();
                if (currentSceneId === sceneId) return;
                
                closeMap();
                loadScene(sceneId);
            });

            // Drag setup (only for Edit Mode)
            setupPinDrag(pin);

            dom.mapWrapper.appendChild(pin);
        });
        renderMapLabels();
    }

    function renderMapLabels() {
        if (!dom.mapWrapper) return;
        const existingLabels = dom.mapWrapper.querySelectorAll('.map-label');
        existingLabels.forEach(lbl => lbl.remove());

        if (coordinatesConfig._labels && Array.isArray(coordinatesConfig._labels)) {
            coordinatesConfig._labels.forEach(labelData => {
                const lbl = document.createElement('div');
                lbl.className = 'map-label';
                lbl.style.left = labelData.x + '%';
                lbl.style.top = labelData.y + '%';
                lbl.dataset.id = labelData.id;
                lbl.textContent = labelData.text;
                lbl.style.fontSize = (labelData.size || 13) + 'px';
                lbl.style.transform = `translate(-50%, -50%) rotate(${labelData.rotation || 0}deg)`;

                const editBtn = document.createElement('button');
                editBtn.className = 'map-label-edit';
                editBtn.innerHTML = '&#9998;';
                editBtn.title = 'Edit Properties';
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!isEditMode) return;
                    openLabelProperties(labelData);
                });
                lbl.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'map-label-delete';
                delBtn.innerHTML = '&times;';
                delBtn.title = 'Delete Label';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!isEditMode) return;
                    coordinatesConfig._labels = coordinatesConfig._labels.filter(l => l.id !== labelData.id);
                    updateJsonText();
                    renderMapLabels();
                });
                lbl.appendChild(delBtn);
                setupLabelDrag(lbl, labelData);
                dom.mapWrapper.appendChild(lbl);
            });
        }
    }

    let currentEditingLabel = null;
    function openLabelProperties(labelData) {
        currentEditingLabel = labelData;
        const popup = document.getElementById('labelPropsPopup');
        if (!popup) return;
        document.getElementById('lpText').value = labelData.text || '';
        document.getElementById('lpSize').value = labelData.size || 13;
        document.getElementById('lpRotation').value = labelData.rotation || 0;
        popup.style.display = 'block';
    }

    function setupLabelDrag(lbl, labelData) {
        let isDragging = false;
        
        function onDragStart(e) {
            if (!isEditMode) return;
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            lbl.classList.add('dragging');
            window.addEventListener('mousemove', onDragMove);
            window.addEventListener('mouseup', onDragEnd);
            window.addEventListener('touchmove', onDragMove, { passive: false });
            window.addEventListener('touchend', onDragEnd);
        }

        function onDragMove(e) {
            if (!isDragging || !isEditMode) return;
            e.preventDefault();
            const rect = dom.mapWrapper.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;
            x = Math.max(0, Math.min(100, Math.round(x)));
            y = Math.max(0, Math.min(100, Math.round(y)));
            lbl.style.left = x + '%';
            lbl.style.top = y + '%';
            labelData.x = x;
            labelData.y = y;
            updateJsonText();
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            lbl.classList.remove('dragging');
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
            window.removeEventListener('touchmove', onDragMove);
            window.removeEventListener('touchend', onDragEnd);
        }

        lbl.addEventListener('mousedown', onDragStart);
        lbl.addEventListener('touchstart', onDragStart, { passive: false });
    }

    function setupPinDrag(pin) {
        let isDragging = false;
        
        function onDragStart(e) {
            if (!isEditMode) return;
            
            const sceneId = pin.dataset.sceneId;
            const sceneNum = parseInt(sceneId.replace('scene', ''), 10);
            if (sceneNum <= 46 || sceneNum === 54 || sceneNum === 55) return;
            
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            dragPin = pin;
            pin.classList.add('dragging');
            
            // Set edit dropdown to this scene ID
            const select = document.getElementById('mapEditSceneSelect');
            if (select) select.value = pin.dataset.sceneId;

            window.addEventListener('mousemove', onDragMove);
            window.addEventListener('mouseup', onDragEnd);
            window.addEventListener('touchmove', onDragMove, { passive: false });
            window.addEventListener('touchend', onDragEnd);
        }

        function onDragMove(e) {
            if (!isDragging || !isEditMode) return;
            e.preventDefault();
            
            const rect = dom.mapWrapper.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;

            x = Math.max(0, Math.min(100, Math.round(x)));
            y = Math.max(0, Math.min(100, Math.round(y)));

            pin.style.left = x + '%';
            pin.style.top = y + '%';

            // Update config object
            const sceneId = pin.dataset.sceneId;
            if (coordinatesConfig[sceneId]) {
                coordinatesConfig[sceneId].x = x;
                coordinatesConfig[sceneId].y = y;
            }

            updateJsonText();
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            dragPin = null;
            pin.classList.remove('dragging');
            
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
            window.removeEventListener('touchmove', onDragMove);
            window.removeEventListener('touchend', onDragEnd);

            populateEditDropdown();
        }

        pin.addEventListener('mousedown', onDragStart);
        pin.addEventListener('touchstart', onDragStart, { passive: false });
    }

    function handleMapWrapperClick(e) {
        if (!isEditMode) {
            const card = e.target.closest('.map-container-card');
            if (card) card.classList.toggle('enlarged');
            return;
        }
        
        const select = document.getElementById('mapEditSceneSelect');
        if (!select) return;
        
        const sceneId = select.value;
        if (!sceneId || !coordinatesConfig[sceneId]) return;

        // Check if the selected scene is fixed (scene 1 to 46, scene 54, or scene 55)
        const sceneNum = parseInt(sceneId.replace('scene', ''), 10);
        if (sceneNum <= 46 || sceneNum === 54 || sceneNum === 55) return;

        const rect = dom.mapWrapper.getBoundingClientRect();
        let x = ((e.clientX - rect.left) / rect.width) * 100;
        let y = ((e.clientY - rect.top) / rect.height) * 100;

        x = Math.max(0, Math.min(100, Math.round(x)));
        y = Math.max(0, Math.min(100, Math.round(y)));

        // Reposition pin
        coordinatesConfig[sceneId].x = x;
        coordinatesConfig[sceneId].y = y;

        // Update pin style
        const pin = dom.mapWrapper.querySelector(`.map-pin[data-scene-id="${sceneId}"]`);
        if (pin) {
            pin.style.left = x + '%';
            pin.style.top = y + '%';
        } else {
            renderMapPins();
        }

        populateEditDropdown();
        updateJsonText();
    }

    function updateActiveMapPin() {
        if (!dom.mapWrapper) return;
        const pins = dom.mapWrapper.querySelectorAll('.map-pin');
        pins.forEach(pin => {
            if (pin.dataset.sceneId === currentSceneId) {
                pin.classList.add('active');
            } else {
                pin.classList.remove('active');
            }
        });
        
        const select = document.getElementById('mapEditSceneSelect');
        if (select && currentSceneId && coordinatesConfig[currentSceneId]) {
            select.value = currentSceneId;
        }

        updateMapRadar();
    }

    function updateMapRadar() {
        if (!viewer || !dom.mapWrapper) return;
        const activePin = dom.mapWrapper.querySelector('.map-pin.active');
        if (!activePin) return;

        let radar = activePin.querySelector('.radar-cone');
        if (!radar) {
            // Remove radar from any other pins first just in case
            const allRadars = dom.mapWrapper.querySelectorAll('.radar-cone');
            allRadars.forEach(r => r.remove());

            radar = document.createElement('div');
            radar.className = 'radar-cone';
            activePin.appendChild(radar);
        }

        const yaw = viewer.getYaw() || 0;
        const offset = getSceneMapOffset(currentSceneId);
        const adjustedYaw = yaw + offset;
        radar.style.setProperty('--radar-yaw', `${adjustedYaw}deg`);
    }

    function getSceneMapOffset(sceneId) {
        if (!configData || !configData.scenes[sceneId] || !coordinatesConfig[sceneId]) return 0;
        
        const scene = configData.scenes[sceneId];
        const coordA = coordinatesConfig[sceneId];
        
        const hotspots = scene.hotSpots || [];
        for (const hp of hotspots) {
            if (hp.clickHandlerArgs && hp.clickHandlerArgs.sceneId) {
                const targetId = hp.clickHandlerArgs.sceneId;
                const coordB = coordinatesConfig[targetId];
                if (coordB) {
                    const dx = coordB.x - coordA.x;
                    const dy = coordB.y - coordA.y;
                    
                    // Ignore extremely small differences to avoid division by zero / noise
                    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                        const mapAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
                        const hpYaw = hp.yaw || 0;
                        let offset = mapAngle - hpYaw;
                        
                        // Normalize offset to -180 to 180 degrees
                        while (offset > 180) offset -= 360;
                        while (offset < -180) offset += 360;
                        
                        return offset;
                    }
                }
            }
        }
        return 0;
    }

    function openMap() {
        closeHelp();
        closeGrid();
        renderMapPins();
        dom.mapOverlay.classList.add('active');
        const statusLabel = document.getElementById('mapEditStatus');
        if (statusLabel) statusLabel.textContent = "";
        window.addEventListener('keydown', handleMapEsc);
    }

    function closeMap() {
        dom.mapOverlay.classList.remove('active');
        window.removeEventListener('keydown', handleMapEsc);
    }

    function toggleMap() {
        dom.mapOverlay.classList.contains('active') ? closeMap() : openMap();
    }

    function handleMapEsc(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closeMap();
        }
    }

    // Initialize Map Coordinates and open map by default
    loadCoordinatesConfig();
    openMap();

    if (dom.btnMapOpen) {
        dom.btnMapOpen.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.playTick) playTick();
            toggleMap();
        });
    }
    if (dom.btnDropdownMap) {
        dom.btnDropdownMap.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.playTick) playTick();
            toggleMap();
        });
    }
    if (dom.mapClose) {
        dom.mapClose.addEventListener('click', closeMap);
    }
    if (dom.mapOverlay) {
        dom.mapOverlay.addEventListener('click', (e) => {
            if (e.target === dom.mapOverlay) closeMap();
        });
    }

    // Attach Edit Mode listeners
    const editToggle = document.getElementById('btnMapEditToggle');
    const mapCard = document.querySelector('.map-container-card');
    if (editToggle && mapCard) {
        editToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.playTick) playTick();
            isEditMode = !isEditMode;
            mapCard.classList.toggle('edit-mode', isEditMode);
            renderMapPins();
        });
    }

    if (dom.mapWrapper) {
        dom.mapWrapper.addEventListener('click', handleMapWrapperClick);
    }

    const editCopy = document.getElementById('btnMapEditCopy');
    if (editCopy) {
        editCopy.addEventListener('click', (e) => {
            e.stopPropagation();
            const textarea = document.getElementById('mapEditJsonText');
            if (textarea) {
                textarea.select();
                navigator.clipboard.writeText(textarea.value)
                    .then(() => {
                        const originalText = editCopy.innerHTML;
                        editCopy.innerHTML = "✅ Copied Coordinates!";
                        setTimeout(() => {
                            editCopy.innerHTML = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error("[Edit Panel] Clipboard copy failed:", err);
                    });
            }
        });
    }

    const btnMapEditEnlarge = document.getElementById('btnMapEditEnlarge');
    if (btnMapEditEnlarge) {
        btnMapEditEnlarge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isEditMode) return;
            dom.mapContainer.classList.toggle('enlarged');
        });
    }

    const btnMapAddLabel = document.getElementById('btnMapAddLabel');
    if (btnMapAddLabel) {
        btnMapAddLabel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isEditMode) return;
            const text = prompt("Enter text for the new label:");
            if (!text || text.trim() === "") return;

            if (!coordinatesConfig._labels) {
                coordinatesConfig._labels = [];
            }
            
            // Add at center of the map (50%, 50%)
            coordinatesConfig._labels.push({
                id: 'label_' + Date.now(),
                text: text.trim(),
                x: 50,
                y: 50
            });
            
            updateJsonText();
            renderMapLabels();
        });
    }

    const btnLpCancel = document.getElementById('btnLpCancel');
    if (btnLpCancel) {
        btnLpCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('labelPropsPopup').style.display = 'none';
            currentEditingLabel = null;
        });
    }

    const btnLpSave = document.getElementById('btnLpSave');
    if (btnLpSave) {
        btnLpSave.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!currentEditingLabel) return;
            const text = document.getElementById('lpText').value;
            const size = parseInt(document.getElementById('lpSize').value, 10);
            const rotation = parseInt(document.getElementById('lpRotation').value, 10);
            currentEditingLabel.text = text;
            currentEditingLabel.size = isNaN(size) ? 13 : size;
            currentEditingLabel.rotation = isNaN(rotation) ? 0 : rotation;
            document.getElementById('labelPropsPopup').style.display = 'none';
            currentEditingLabel = null;
            updateJsonText();
            renderMapLabels();
        });
    }

    // Input listener to parse typed coordinates JSON manually
    const jsonTextarea = document.getElementById('mapEditJsonText');
    const statusLabel = document.getElementById('mapEditStatus');
    if (jsonTextarea) {
        jsonTextarea.addEventListener('input', () => {
            try {
                const parsed = JSON.parse(jsonTextarea.value);
                
                // Validate parsed structure
                let isValid = true;
                for (const sceneId in parsed) {
                    if (typeof parsed[sceneId] !== 'object' || parsed[sceneId] === null || 
                        typeof parsed[sceneId].x !== 'number' || typeof parsed[sceneId].y !== 'number') {
                        isValid = false;
                        break;
                    }
                }
                
                if (isValid) {
                    // Force lock scenes 1-46, 54, and 55 to DEFAULT_COORDINATES values
                    for (let i = 1; i <= 46; i++) {
                        const sceneId = `scene${i}`;
                        if (DEFAULT_COORDINATES[sceneId]) {
                            parsed[sceneId] = Object.assign({}, DEFAULT_COORDINATES[sceneId]);
                        }
                    }
                    if (DEFAULT_COORDINATES["scene54"]) {
                        parsed["scene54"] = Object.assign({}, DEFAULT_COORDINATES["scene54"]);
                    }
                    if (DEFAULT_COORDINATES["scene55"]) {
                        parsed["scene55"] = Object.assign({}, DEFAULT_COORDINATES["scene55"]);
                    }
                    coordinatesConfig = parsed;
                    updateJsonText(); // Refresh textbox with locked values restored
                    if (statusLabel) {
                        statusLabel.textContent = "✅ Valid JSON - Map Updated (Locked scenes preserved)";
                        statusLabel.style.color = "#00E676";
                    }
                    renderMapPins();
                } else {
                    if (statusLabel) {
                        statusLabel.textContent = "❌ Invalid values (need {x,y})";
                        statusLabel.style.color = "#FF5252";
                    }
                }
            } catch (err) {
                if (statusLabel) {
                    statusLabel.textContent = "❌ Invalid JSON structure";
                    statusLabel.style.color = "#FF5252";
                }
            }
        });
    }

    // Dropdown change listener to highlight selected pin
    const editSelect = document.getElementById('mapEditSceneSelect');
    if (editSelect) {
        editSelect.addEventListener('change', () => {
            const sceneId = editSelect.value;
            const pins = dom.mapWrapper.querySelectorAll('.map-pin');
            pins.forEach(pin => {
                if (pin.dataset.sceneId === sceneId) {
                    pin.style.transform = 'translate(-50%, -50%) scale(1.6)';
                    pin.style.boxShadow = '0 0 16px rgba(255, 82, 82, 0.9)';
                    pin.style.zIndex = '15';
                } else {
                    pin.style.transform = '';
                    pin.style.boxShadow = '';
                    pin.style.zIndex = '';
                }
            });
        });
    }

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
       TOGGLE ARROWS
       ───────────────────────────────────────────── */
    function toggleArrows() {
        document.body.classList.toggle('hide-arrows');
        if (dom.txtToggleArrows) {
            if (document.body.classList.contains('hide-arrows')) {
                dom.txtToggleArrows.innerText = 'Show Arrows';
            } else {
                dom.txtToggleArrows.innerText = 'Hide Arrows';
            }
        }
    }
    if (dom.btnToggleArrows) dom.btnToggleArrows.addEventListener('click', toggleArrows);

    /* ─────────────────────────────────────────────
       UPDATE UI ON SCENE CHANGE
       ───────────────────────────────────────────── */
    function updatePreloads(sceneId) {
        if (!configData || !configData.scenes[sceneId]) return;
        const scene = configData.scenes[sceneId];

        const adjacent = [sceneId];
        if (scene.hotSpots) {
            scene.hotSpots.forEach(h => {
                if (h.clickHandlerArgs && h.clickHandlerArgs.sceneId) {
                    adjacent.push(h.clickHandlerArgs.sceneId);
                }
            });
        }

        // Also keep the previous scene in history preloaded
        if (sceneHistory.length > 0) {
            const lastSceneId = sceneHistory[sceneHistory.length - 1];
            if (!adjacent.includes(lastSceneId)) {
                adjacent.push(lastSceneId);
            }
        }

        // If in guided navigation, preload the next and previous steps in the route
        if (navActive && activeRoute) {
            const currentRouteIdx = activeRoute.findIndex(s => s.scene === sceneId);
            if (currentRouteIdx >= 0) {
                if (currentRouteIdx > 0) {
                    const prevStepScene = activeRoute[currentRouteIdx - 1].scene;
                    if (!adjacent.includes(prevStepScene)) adjacent.push(prevStepScene);
                }
                if (currentRouteIdx < activeRoute.length - 1) {
                    const nextStepScene = activeRoute[currentRouteIdx + 1].scene;
                    if (!adjacent.includes(nextStepScene)) adjacent.push(nextStepScene);
                }
            }
        }

        for (const id in preloadedImages) {
            if (!adjacent.includes(id)) {
                if (preloadedImages[id] instanceof Image) {
                    preloadedImages[id].src = "";
                }
                delete preloadedImages[id];
            }
        }

        adjacent.forEach(id => {
            if (!preloadedImages[id] && configData.scenes[id] && configData.scenes[id].panorama) {
                const img = new Image();
                img.src = configData.scenes[id].panorama;
                preloadedImages[id] = img;
            }
        });
    }

    function updateUI(sceneId) {
        console.log("updateUI:", sceneId);
        if (!configData) return;
        const scene = configData.scenes[sceneId];
        if (!scene) return;
        currentSceneId = sceneId;
        const idx = sceneKeys.indexOf(sceneId) + 1;


        // Info Box was removed in favor of HUD, so safely check if it exists
        if (dom.infoBoxText) {
            dom.infoBoxText.textContent = scene.title;
        }

        markGridActive(sceneId);
        updatePreloads(sceneId);

        if (window.audioManager) {
            window.audioManager.playScene(sceneId);
        }
        updateActiveMapPin();
    }

    /* ─────────────────────────────────────────────
       KEYBOARD SHORTCUTS & NAVIGATION
       ───────────────────────────────────────────── */
    function navigateDirection(direction) {
        if (!configData || !currentSceneId || !viewer) return;
        const scene = configData.scenes[currentSceneId];
        if (!scene || !scene.hotSpots) return;

        const currentYaw = viewer.getYaw();

        let bestTarget = null;
        let minDiff = Infinity;
        let bestTargetYaw = null;

        scene.hotSpots.forEach(h => {
            if (h.clickHandlerArgs && h.clickHandlerArgs.sceneId) {
                let delta = (h.yaw - currentYaw) % 360;
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;

                let targetAngle = 0; // Forward
                if (direction === 'right') targetAngle = 90;
                else if (direction === 'left') targetAngle = -90;
                else if (direction === 'backward') targetAngle = 180;

                let angleDiff = Math.abs(delta - targetAngle);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;

                // Match if the hotspot is within a 60-degree cone of the target direction
                if (angleDiff <= 60 && angleDiff < minDiff) {
                    minDiff = angleDiff;
                    bestTarget = h.clickHandlerArgs.sceneId;
                    bestTargetYaw = h.clickHandlerArgs.targetYaw;
                }
            }
        });

        if (bestTarget && configData.scenes[bestTarget]) {
            const sc = configData.scenes[bestTarget];
            sceneEntryPositions[bestTarget] = {
                pitch: sc.pitch || 0,
                yaw: (bestTargetYaw !== undefined && bestTargetYaw !== null) ? bestTargetYaw : (sc.yaw || 0),
                hfov: sc.hfov || 110
            };
            loadScene(bestTarget, sceneEntryPositions[bestTarget].pitch, sceneEntryPositions[bestTarget].yaw, sceneEntryPositions[bestTarget].hfov);
        }
    }

    function goBack() {
        if (sceneHistory.length > 0) {
            const lastSceneId = sceneHistory.pop();
            const sc = configData && configData.scenes[lastSceneId] ? configData.scenes[lastSceneId] : {};
            const entryPos = sceneEntryPositions[lastSceneId] || {};
            loadScene(lastSceneId, sc.pitch || 0, sc.yaw || 0, entryPos.hfov || sc.hfov || 110, true);
        } else {
            console.log("No previous scene in history.");
        }
    }

    const activeKeys = new Set();
    let isAnimatingCamera = false;
    let cameraVelPitch = 0;
    let cameraVelYaw = 0;

    function smoothCameraLoop() {
        if (!viewer) return;

        const maxSpeed = 1.5; // Increased for faster rotation
        const acceleration = 0.30; // Increased for faster ramp-up and snappier controls
        const friction = 0.88; // Friction for smooth gliding stop

        let inputPitch = 0;
        let inputYaw = 0;

        if (activeKeys.has('w')) inputPitch += 1;
        if (activeKeys.has('s')) inputPitch -= 1;
        if (activeKeys.has('a') || activeKeys.has('arrowleft')) inputYaw -= 1;
        if (activeKeys.has('d') || activeKeys.has('arrowright')) inputYaw += 1;

        // Apply acceleration
        cameraVelPitch += inputPitch * acceleration;
        cameraVelYaw += inputYaw * acceleration;

        // Apply friction
        cameraVelPitch *= friction;
        cameraVelYaw *= friction;

        // Clamp to maxSpeed
        cameraVelPitch = Math.max(-maxSpeed, Math.min(maxSpeed, cameraVelPitch));
        cameraVelYaw = Math.max(-maxSpeed, Math.min(maxSpeed, cameraVelYaw));

        // Stop animating if velocity is extremely low and no keys are pressed
        if (inputPitch === 0 && inputYaw === 0 && Math.abs(cameraVelPitch) < 0.01 && Math.abs(cameraVelYaw) < 0.01) {
            cameraVelPitch = 0;
            cameraVelYaw = 0;
            isAnimatingCamera = false;
            return;
        }

        let pitch = viewer.getPitch();
        let yaw = viewer.getYaw();

        viewer.setPitch(pitch + cameraVelPitch, false);
        viewer.setYaw(yaw + cameraVelYaw, false);

        requestAnimationFrame(smoothCameraLoop);
    }

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        const k = e.key.toLowerCase();

        if (['arrowup', 'arrowdown'].includes(k)) {
            e.preventDefault(); // Prevent page scroll
            e.stopPropagation(); // Prevent Pannellum from rotating camera
            if (k === 'arrowup') navigateDirection('forward');
            else if (k === 'arrowdown') goBack();
            return;
        }

        // Smooth fast rotation with WASD and Left/Right arrows
        if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright'].includes(k)) {
            e.preventDefault();
            e.stopPropagation();
            activeKeys.add(k);
            if (!isAnimatingCamera) {
                isAnimatingCamera = true;
                requestAnimationFrame(smoothCameraLoop);
            }
            return;
        }

        if (k === 'escape') { closeInfo(); closeHelp(); closeGrid(); closeNavGuide(); return; }
        if (k === 'm') { 
            e.preventDefault(); 
            e.stopPropagation(); 
            toggleMap(); 
            return; 
        }
        if (k === 'g') { e.preventDefault(); toggleGrid(); return; }
        if (k === 'h') { e.preventDefault(); toggleHelp(); return; }
        if (k === 'f') { e.preventDefault(); toggleFullscreen(); return; }
        if (k === 'n') { e.preventDefault(); toggleNavGuide(); return; }
    }, { capture: true });

    document.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright'].includes(k)) {
            activeKeys.delete(k);
        }
    }, { capture: true });

    // Safely attach to buttons if they exist
    const btnForward = document.getElementById('forwardBtn');
    if (btnForward) btnForward.addEventListener('click', () => navigateDirection('forward'));

    const btnBackward = document.getElementById('backwardBtn');
    if (btnBackward) btnBackward.addEventListener('click', () => goBack());

    const btnLeft = document.getElementById('leftBtn');
    if (btnLeft) btnLeft.addEventListener('click', () => navigateDirection('left'));

    const btnRight = document.getElementById('rightBtn');
    if (btnRight) btnRight.addEventListener('click', () => navigateDirection('right'));
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

    dom.btnNavGuide.addEventListener('click', () => { toggleNavGuide(); closeDropdown(); });

    dom.btnMenuToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        dom.mainDropdown.classList.toggle('show');
    });

    document.addEventListener('click', function (e) {
        if (dom.mainDropdown && !dom.mainDropdown.contains(e.target) && e.target !== dom.btnMenuToggle) {
            closeDropdown();
        }
    });

    // Close dropdown when any item inside it is clicked
    dom.mainDropdown.addEventListener('click', function (e) {
        if (e.target.closest('.dropdown-item')) {
            closeDropdown();
        }
    });

    function closeDropdown() {
        if (dom.mainDropdown) dom.mainDropdown.classList.remove('show');
    }
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
        fetch('config.json?v=' + new Date().getTime())
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
                            if (!h.createTooltipArgs) h.createTooltipArgs = (h.cssClass && h.cssClass.includes('nav-btn')) ? h.clickHandlerArgs : h.text;
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

                    // Disable default title box completely
                    startupConfig.showTitle = false;

                    viewer = pannellum.viewer('panorama', startupConfig);
                    window.viewer = viewer;
                    addedScenes.add(first);

                    /* Initial UI */
                    updateUI(first);

                    viewer.on('scenechange', function (sceneId) {
                        updateUI(sceneId);
                        onSceneChangeNav(sceneId);
                    });

                    let lastRadarYaw = null;
                    let isTrackingRadar = false;
                    function trackRadarView() {
                        if (viewer) {
                            const yaw = viewer.getYaw();
                            if (yaw !== lastRadarYaw) {
                                lastRadarYaw = yaw;
                                
                                // 1. Map Radar Update
                                if (dom.mapOverlay && dom.mapOverlay.classList.contains('active')) {
                                    updateMapRadar();
                                }
                                
                                // 2. Advanced Navigation HUD
                                const sceneConfig = viewer.getConfig();
                                const hudPathsList = document.getElementById('hudPathsList');
                                
                                if (sceneConfig && sceneConfig.hotSpots && hudPathsList) {
                                    let pathsHtml = "";
                                    const navSpots = sceneConfig.hotSpots.filter(hs => hs.clickHandlerArgs && hs.clickHandlerArgs.sceneId);
                                    
                                    if (navSpots.length === 0) {
                                        pathsHtml = '<div class="hud-path-item empty">No paths detected</div>';
                                    } else {
                                        let paths = navSpots.map(hs => {
                                            let diff = ((hs.yaw - yaw + 540) % 360) - 180;
                                            const targetTitle = (configData && configData.scenes[hs.clickHandlerArgs.sceneId]) ? (configData.scenes[hs.clickHandlerArgs.sceneId].title || "Next Area") : "Unknown Area";
                                            return { diff, title: targetTitle };
                                        });
                                        
                                        // Sort by how close they are to the center of view
                                        paths.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
                                        
                                        // Deduplicate so we don't show the same name multiple times
                                        const seenTitles = new Set();
                                        const uniquePaths = [];
                                        paths.forEach(p => {
                                            if (!seenTitles.has(p.title)) {
                                                seenTitles.add(p.title);
                                                uniquePaths.push(p);
                                            }
                                        });
                                        
                                        uniquePaths.forEach(p => {
                                            let dirLabel = "↑ Ahead";
                                            let dirColor = "#00E676"; 
                                            
                                            if (p.diff > 20 && p.diff <= 145) { dirLabel = "→ Right"; dirColor = "#74b9ff"; }
                                            else if (p.diff < -20 && p.diff >= -145) { dirLabel = "← Left"; dirColor = "#74b9ff"; }
                                            else if (Math.abs(p.diff) > 145) { dirLabel = "↓ Behind"; dirColor = "#ff7675"; }
                                            
                                            pathsHtml += `
                                                <div class="hud-path-item">
                                                    <div class="hud-path-dir" style="color: ${dirColor}; border-color: ${dirColor}40;">${dirLabel}</div>
                                                    <div class="hud-path-name" title="${p.title}">${p.title}</div>
                                                </div>
                                            `;
                                        });
                                    }
                                    
                                    if (hudPathsList.innerHTML !== pathsHtml) {
                                        hudPathsList.innerHTML = pathsHtml;
                                    }
                                }
                            }
                        }
                        requestAnimationFrame(trackRadarView);
                    }
                    viewer.on('load', () => {
                        if (!isTrackingRadar) {
                            isTrackingRadar = true;
                            trackRadarView();
                        }
                    });

                    /* ── Record entry position for the first scene (config defaults) ── */
                    sceneEntryPositions[first] = {
                        pitch: firstSceneConfig.pitch || 0,
                        yaw: firstSceneConfig.yaw || 0,
                        hfov: firstSceneConfig.hfov || TARGET_HFOV
                    };

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
                        try {
                            initializeViewer();
                        } catch (e) {
                            console.error("[init] initializeViewer failed:", e);
                            ready();
                        }
                    }, (err) => {
                        console.error("[init] First scene failed GPU compatibility check:", err);
                        const errP = document.createElement('p');
                        errP.style.color = '#ff6b6b';
                        errP.style.marginTop = '20px';
                        errP.textContent = "Error: " + err;
                        if (dom.loaderContent) dom.loaderContent.appendChild(errP);
                        
                        setTimeout(ready, 3000);
                    });
                } else {
                    try {
                        initializeViewer();
                    } catch (e) {
                        console.error("[init] initializeViewer failed:", e);
                        ready();
                    }
                }
            })
            .catch((err) => { console.error(err); ready(); });
    });

    /* ==========================================================
       VR CURSOR & AUDIO SYNTHESIZER
       ========================================================== */
    const vrCursor = document.getElementById('vrCursor');
    if (vrCursor) {
        let lastMouseX = -1;
        let lastMouseY = -1;

        const updateCursorPos = (x, y) => {
            if (lastMouseX !== -1 && (Math.abs(x - lastMouseX) > 1 || Math.abs(y - lastMouseY) > 1)) {
                if (vrCursor.style.display === 'none') vrCursor.style.display = 'block';
            }
            lastMouseX = x;
            lastMouseY = y;

            // Clamp coordinates to prevent clipping at the screen edges
            const bounds = 12; // Radius + padding
            const clampedX = Math.max(bounds, Math.min(window.innerWidth - bounds, x));
            const clampedY = Math.max(bounds, Math.min(window.innerHeight - bounds, y));

            vrCursor.style.left = clampedX + 'px';
            vrCursor.style.top = clampedY + 'px';
        };

        window.addEventListener('mousemove', (e) => {
            updateCursorPos(e.clientX, e.clientY);
        }, { passive: true, capture: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                updateCursorPos(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true, capture: true });

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                updateCursorPos(e.touches[0].clientX, e.touches[0].clientY);
            }
            vrCursor.classList.add('dragging');
        }, { passive: true, capture: true });

        window.addEventListener('touchend', () => vrCursor.classList.remove('dragging'), { passive: true, capture: true });


        // Use capture phase (true) so Pannellum doesn't block the event with stopPropagation
        window.addEventListener('keydown', () => {
            vrCursor.style.display = 'none';
        }, true);

        window.addEventListener('mousedown', () => vrCursor.classList.add('dragging'), true);
        window.addEventListener('mouseup', () => vrCursor.classList.remove('dragging'), true);

        // Magnetic hover
        const addMagnetic = () => { vrCursor.classList.add('magnetic'); playTick(); };
        const removeMagnetic = () => vrCursor.classList.remove('magnetic');

        const attachMagneticToElements = () => {
            document.querySelectorAll('button, a, select, .grid-item, .nav-btn, .hotspot-content').forEach(el => {
                if (!el.dataset.vrBound) {
                    el.addEventListener('mouseenter', addMagnetic);
                    el.addEventListener('mouseleave', removeMagnetic);
                    el.dataset.vrBound = 'true';
                }
            });
        };
        attachMagneticToElements();

        // Pannellum dynamically creates hotspots, so observe the DOM for changes
        const observer = new MutationObserver(() => attachMagneticToElements());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Audio Synthesizer (Web Audio API)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Initialize audio on first user interaction (browser policy)
    document.addEventListener('click', initAudio, { once: true });

    window.audioManager = {
        audio: new Audio(),
        isMuted: false,
        hasInteracted: false,
        currentFile: null,

        init() {
            this.audio.muted = false;
            this.audio.autoplay = true; // Try to force browser autoplay

            const enableAudio = () => {
                if (!this.hasInteracted) {
                    this.hasInteracted = true;
                    // If audio is paused and we have a file, try to play it
                    if (this.currentFile && this.audio.paused && !this.isMuted) {
                        this.playCurrentScene();
                    }
                }
                document.removeEventListener('click', enableAudio, true);
                document.removeEventListener('keydown', enableAudio, true);
                document.removeEventListener('touchstart', enableAudio, true);
                document.removeEventListener('mousedown', enableAudio, true);
                document.removeEventListener('wheel', enableAudio, true);
                document.removeEventListener('mousemove', enableAudio, true);
                document.removeEventListener('pointermove', enableAudio, true);
            };

            // Listen to absolutely every possible event to trick the browser into unlocking audio
            document.addEventListener('click', enableAudio, true);
            document.addEventListener('keydown', enableAudio, true);
            document.addEventListener('touchstart', enableAudio, true);
            document.addEventListener('mousedown', enableAudio, true);
            document.addEventListener('wheel', enableAudio, true);
            document.addEventListener('mousemove', enableAudio, true);
            document.addEventListener('pointermove', enableAudio, true);

            if (dom.btnAudioToggle) {
                dom.btnAudioToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMute();
                });
            }

            // Keyboard shortcut to toggle mute
            document.addEventListener('keydown', (e) => {
                if (e.key === 'k' || e.key === 'K') {
                    this.toggleMute();
                }
            });
        },

        playScene(sceneId) {
            if (!configData || !configData.scenes[sceneId]) return;
            const scene = configData.scenes[sceneId];
            const file = scene.audio?.file;

            if (!file) {
                this.stop();
                this.currentFile = null;
                return;
            }

            if (this.currentFile !== file) {
                this.currentFile = file;
                this.audio.src = file;
                this.audio.load();
            }

            this.audio.currentTime = 0;

            if (!this.isMuted) {
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        this.hasInteracted = true; // Browser allowed autoplay
                    }).catch(e => {
                        console.warn('Autoplay blocked by browser. Waiting for user interaction.', e);
                        this.hasInteracted = false;
                    });
                }
            }
        },

        playCurrentScene() {
            if (this.currentFile && !this.isMuted) {
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn('Audio play failed', e));
                }
            }
        },

        stop() {
            this.audio.pause();
            this.audio.currentTime = 0;
        },

        toggleMute() {
            this.isMuted = !this.isMuted;
            this.audio.muted = this.isMuted;
            if (dom.iconAudioOn && dom.iconAudioOff) {
                dom.iconAudioOn.style.display = this.isMuted ? 'none' : 'block';
                dom.iconAudioOff.style.display = this.isMuted ? 'block' : 'none';
            }
            if (this.isMuted) {
                this.audio.pause();
            } else {
                this.playCurrentScene();
            }
        }
    };
    window.audioManager.init();

    window.playTick = function () {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.06);
    };

    window.playWhoosh = function () {
        if (!audioCtx) return;
        const bufferSize = audioCtx.sampleRate * 0.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.2);
        filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    };

    // Hide controls guide on panorama interaction (camera click/drag/move)
    const panoramaEl = document.getElementById('panorama');
    if (panoramaEl) {
        const hideGuide = () => {
            const controlsGuide = document.querySelector('.controls-guide-card');
            if (controlsGuide && controlsGuide.style.display !== 'none') {
                controlsGuide.style.display = 'none';
            }
        };
        // Use capture phase to ensure we catch it before Pannellum stops propagation
        panoramaEl.addEventListener('mousedown', hideGuide, true);
        panoramaEl.addEventListener('touchstart', hideGuide, true);
        panoramaEl.addEventListener('pointerdown', hideGuide, true);
        panoramaEl.addEventListener('wheel', hideGuide, true);
        
        document.addEventListener('keydown', (e) => {
            if (!e.key) return;
            const k = e.key.toLowerCase();
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
                hideGuide();
            } else if (k === 'i') {
                const controlsGuide = document.querySelector('.controls-guide-card');
                if (controlsGuide) {
                    controlsGuide.style.display = controlsGuide.style.display === 'none' ? 'block' : 'none';
                }
            }
        }, true);
    }

})();
