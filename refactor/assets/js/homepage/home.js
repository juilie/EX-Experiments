import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

let container, stats;
let camera, scene, renderer;
let composer, renderPass, saoPass, ditheringPass;
let group;

// 3D title variables
let titleRenderer, titleScene, titleCamera, titleMesh, titleMount, exMesh, researchMesh;
let exMaterial, researchMaterial;

// Color scheme controls
let colorSchemes, colorSchemeNames, colorControls;

// Newsletter cloud background variables
let newsletterCloudRenderer, newsletterCloudScene, newsletterCloudCamera, newsletterCloudMesh;
let lastNewsletterCloudRenderTime = 0;
const newsletterCloudFrameIntervalMs = 50; // ~20 FPS for clouds
const NewsletterCloudShader = {
    uniforms: {
        'time': { value: 0.0 },
        'resolution': { value: new THREE.Vector2() }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        const float cloudscale = 0.8;
        const float speed = 0.02;
        const float clouddark = 0.4;
        const float cloudlight = 0.4;
        const float cloudcover = 0.3;
        const float cloudalpha = 6.0;
        const float skytint = 0.6;
        const vec3 skycolour1 = vec3(0.15, 0.3, 0.5);
        const vec3 skycolour2 = vec3(0.3, 0.6, 0.9);

        const mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );

        vec2 hash( vec2 p ) {
            p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
            return -1.0 + 2.0*fract(sin(p)*43758.5453123);
        }

        float noise( in vec2 p ) {
            const float K1 = 0.366025404; // (sqrt(3)-1)/2;
            const float K2 = 0.211324865; // (3-sqrt(3))/6;
            vec2 i = floor(p + (p.x+p.y)*K1);
            vec2 a = p - i + (i.x+i.y)*K2;
            vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
            vec2 b = a - o + K2;
            vec2 c = a - 1.0 + 2.0*K2;
            vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
            vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
            return dot(n, vec3(70.0));
        }

        float fbm(vec2 n) {
            float total = 0.0, amplitude = 0.1;
            for (int i = 0; i < 7; i++) {
                total += noise(n) * amplitude;
                n = m * n;
                amplitude *= 0.4;
            }
            return total;
        }

        void main() {
            vec2 p = vUv;
            vec2 uv = p*vec2(resolution.x/resolution.y,1.0);
            float t = time * speed;
            float q = fbm(uv * cloudscale * 0.5);

            float r = 0.0;
            uv *= cloudscale;
            uv -= q - t;
            float weight = 0.8;
            for (int i=0; i<8; i++){
                r += abs(weight*noise( uv ));
                uv = m*uv + t;
                weight *= 0.7;
            }

            float f = 0.0;
            uv = p*vec2(resolution.x/resolution.y,1.0);
            uv *= cloudscale;
            uv -= q - t;
            weight = 0.7;
            for (int i=0; i<8; i++){
                f += weight*noise( uv );
                uv = m*uv + t;
                weight *= 0.6;
            }

            f *= r + f;

            float c = 0.0;
            float t2 = time * speed * 2.0;
            uv = p*vec2(resolution.x/resolution.y,1.0);
            uv *= cloudscale*2.0;
            uv -= q - t2;
            weight = 0.4;
            for (int i=0; i<7; i++){
                c += weight*noise( uv );
                uv = m*uv + t2;
                weight *= 0.6;
            }

            float c1 = 0.0;
            float t3 = time * speed * 3.0;
            uv = p*vec2(resolution.x/resolution.y,1.0);
            uv *= cloudscale*3.0;
            uv -= q - t3;
            weight = 0.4;
            for (int i=0; i<7; i++){
                c1 += abs(weight*noise( uv ));
                uv = m*uv + t3;
                weight *= 0.6;
            }

            c += c1;

            vec3 skycolour = mix(skycolour2, skycolour1, p.y);
            vec3 cloudcolour = vec3(1.1, 1.1, 0.9) * clamp((clouddark + cloudlight*c), 0.0, 1.0);
            f = cloudcover + cloudalpha*f*r;
            vec3 result = mix(skycolour, clamp(skytint * skycolour + cloudcolour, 0.0, 1.0), clamp(f + c, 0.0, 1.0));
            gl_FragColor = vec4( result, 1.0 );
        }
    `
};
    
    // 2D Chatbox overlay variables
    let overlayCanvas, overlayCtx;
    let chatboxes2D = [];
    let customFontLoaded = false;
    let lastSpawnTime = 0;
    let spawnInterval = 1200; // Spawn new chatbox every 1.2 seconds
    let pixelScale = 2; // How much to scale down for pixelation
    let chatboxColorTransition = 0; // 0 = white, 1 = dark blue theme
    let transitionStartTime = 0;
    
    // Cloud image system
    let cloudImages = [];
    let lastCloudSpawnTime = 0;
    let cloudSpawnInterval = 3000; // Spawn every 3 seconds
    
    // Wandering HUD scanner system
    let wanderingScanners = [];
    let maxScanners = 3;
    let detectionDistance = 80;

    // Sample articles data
    const articles = [
        {
            id: 1,
            title: "Black magic",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Oct 7, 2025",
            previewImage: "assets/images/ex1.jpg",
            link: "../article/index.html"
        },
        {
            id: 2,
            title: "Actual anomalies",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Aug 31, 2025",
            previewImage: "assets/images/ex2.jpg",
            link: "../article/index.html"
        },
        {
            id: 3,
            title: "Safety last",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Aug 17, 2025",
            previewImage: "assets/images/ex3.jpg",
            link: "../article/index.html"
        },
        {
            id: 4,
            title: "Supper man wavers",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Aug 3, 2025",
            previewImage: "assets/images/ex4.jpg",
            link: "../article/index.html"
        },
        {
            id: 5,
            title: "Playing goo-goo babies with your life on the line",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Jul 21, 2025",
            previewImage: "assets/images/ex5.png",
            link: "../article/index.html"
        },
        {
            id: 6,
            title: "Coconut dogs",
            category: "Newsletter",
            excerpt: "Weekly download of future-culture picks and deep-internet insights.",
            date: "Jun 30, 2025",
            previewImage: "assets/images/ex6.png",
            link: "../article/index.html"
        }
    ];

    // Dithering shader
    const DitheringShader = {
        uniforms: {
            'tDiffuse': { value: null },
            'resolution': { value: new THREE.Vector2() },
            'colorNum': { value: 4.0 },
            'pixelSize': { value: 2.0 }
        },

        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,

        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            uniform float colorNum;
            uniform float pixelSize;
            varying vec2 vUv;

            const float bayerMatrix8x8[64] = float[64](
                0.0/ 64.0, 48.0/ 64.0, 12.0/ 64.0, 60.0/ 64.0,  3.0/ 64.0, 51.0/ 64.0, 15.0/ 64.0, 63.0/ 64.0,
                32.0/ 64.0, 16.0/ 64.0, 44.0/ 64.0, 28.0/ 64.0, 35.0/ 64.0, 19.0/ 64.0, 47.0/ 64.0, 31.0/ 64.0,
                8.0/ 64.0, 56.0/ 64.0,  4.0/ 64.0, 52.0/ 64.0, 11.0/ 64.0, 59.0/ 64.0,  7.0/ 64.0, 55.0/ 64.0,
                40.0/ 64.0, 24.0/ 64.0, 36.0/ 64.0, 20.0/ 64.0, 43.0/ 64.0, 27.0/ 64.0, 39.0/ 64.0, 23.0/ 64.0,
                2.0/ 64.0, 50.0/ 64.0, 14.0/ 64.0, 62.0/ 64.0,  1.0/ 64.0, 49.0/ 64.0, 13.0/ 64.0, 61.0/ 64.0,
                34.0/ 64.0, 18.0/ 64.0, 46.0/ 64.0, 30.0/ 64.0, 33.0/ 64.0, 17.0/ 64.0, 45.0/ 64.0, 29.0/ 64.0,
                10.0/ 64.0, 58.0/ 64.0,  6.0/ 64.0, 54.0/ 64.0,  9.0/ 64.0, 57.0/ 64.0,  5.0/ 64.0, 53.0/ 64.0,
                42.0/ 64.0, 26.0/ 64.0, 38.0/ 64.0, 22.0/ 64.0, 41.0/ 64.0, 25.0/ 64.0, 37.0/ 64.0, 21.0 / 64.0
            );

            vec3 dither(vec2 uv, vec3 color) {
                int x = int(uv.x * resolution.x) % 8;
                int y = int(uv.y * resolution.y) % 8;
                float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;

                color.rgb += threshold;
                color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
                color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
                color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

                return color;
            }

            void main() {
                vec2 normalizedPixelSize = pixelSize / resolution;  
                vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);

                vec4 color = texture2D(tDiffuse, uvPixel);
                color.rgb = dither(uvPixel, color.rgb);

                gl_FragColor = color;
            }
        `
    };

    function createOverlayCanvas() {
        overlayCanvas = document.createElement('canvas');
        overlayCanvas.style.position = 'fixed';
        overlayCanvas.style.top = '0';
        overlayCanvas.style.left = '0';
        overlayCanvas.style.pointerEvents = 'none';
        overlayCanvas.style.zIndex = '75';
        overlayCanvas.style.imageRendering = 'pixelated';
        overlayCanvas.style.imageRendering = 'crisp-edges';
        overlayCanvas.style.overflow = 'hidden';
        document.body.appendChild(overlayCanvas);
        
        overlayCtx = overlayCanvas.getContext('2d');
        overlayCtx.imageSmoothingEnabled = false;
        overlayCtx.webkitImageSmoothingEnabled = false;
        overlayCtx.mozImageSmoothingEnabled = false;
        overlayCtx.msImageSmoothingEnabled = false;
        
        resizeOverlayCanvas();
        
        loadCustomFont();
        create2DChatboxes();
    }

    function loadCustomFont() {
        const font = new FontFace('Epmarugo', 'url(assets/epmarugo.ttf)');
        font.load().then(function(loadedFont) {
            document.fonts.add(loadedFont);
            customFontLoaded = true;
        }).catch(function(error) {
            console.warn('Custom font failed to load:', error);
            customFontLoaded = false;
        });
    }

    function resizeOverlayCanvas() {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        
        overlayCanvas.width = Math.floor(viewportWidth / pixelScale);
        overlayCanvas.height = Math.floor(viewportHeight / pixelScale);
        
        overlayCanvas.style.width = viewportWidth + 'px';
        overlayCanvas.style.height = viewportHeight + 'px';
    }

    function create2DChatboxes() {
        chatboxes2D = [];
        
        const initialCount = 6 + Math.floor(Math.random() * 4);
        
        for (let i = 0; i < initialCount; i++) {
            const chatbox = createNewChatbox();
            const gridCols = Math.ceil(Math.sqrt(initialCount));
            const gridRows = Math.ceil(initialCount / gridCols);
            const col = i % gridCols;
            const row = Math.floor(i / gridCols);
            
            const cellWidth = (overlayCanvas.width / pixelScale) / gridCols;
            const cellHeight = (overlayCanvas.height / pixelScale) / gridRows;
            
            chatbox.x = (col * cellWidth) + (Math.random() * cellWidth * 0.8);
            chatbox.y = (row * cellHeight) + (Math.random() * cellHeight * 0.8);
            
            chatbox.x = Math.max(0, Math.min(chatbox.x, overlayCanvas.width / pixelScale - chatbox.width));
            chatbox.y = Math.max(0, Math.min(chatbox.y, overlayCanvas.height / pixelScale - chatbox.height));
            
            chatboxes2D.push(chatbox);
        }
    }

    function createNewChatbox(startX = null, speedTier = 'normal') {
        const baseWidth = 240;
        const baseHeight = 72;
        
        const scaledWidth = baseWidth / pixelScale;
        const scaledHeight = baseHeight / pixelScale;
        const scaledMargin = 80 / pixelScale;
        
        const x = startX !== null ? startX : overlayCanvas.width + scaledMargin/4;
        const caretMargin = 20 / pixelScale;
        const y = Math.random() * (overlayCanvas.height - scaledHeight - caretMargin);
        
        let baseVelocity, verticalDrift;
        switch (speedTier) {
            case 'superfast':
                baseVelocity = (-5 - Math.random() * 6) / pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 1.5) / pixelScale;
                break;
            case 'fast':
                baseVelocity = (-3 - Math.random() * 3) / pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 1.0) / pixelScale;
                break;
            case 'medium':
                baseVelocity = (-1.5 - Math.random() * 2) / pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.6) / pixelScale;
                break;
            case 'slow':
                baseVelocity = (-0.8 - Math.random() * 1.2) / pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.4) / pixelScale;
                break;
            default:
                baseVelocity = (-0.5 - Math.random() * 0.8) / pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.2) / pixelScale;
                break;
        }
        
        return {
            x: x,
            y: y,
            vx: baseVelocity,
            vy: verticalDrift,
            width: scaledWidth,
            height: scaledHeight,
            text: 'EX Research',
            textStyles: generateRandomTextStyles(),
            styleUpdateTime: 0,
            speedTier: speedTier
        };
    }

    function generateRandomTextStyles() {
        const fragments = [
            {
                text: 'EX',
                bold: Math.random() > 0.5,
                sizeMultiplier: 0.8 + Math.random() * 0.6
            },
            {
                text: ' ',
                bold: false,
                sizeMultiplier: 1
            },
            {
                text: 'Research',
                bold: Math.random() > 0.5,
                sizeMultiplier: 0.8 + Math.random() * 0.6
            }
        ];
        return fragments;
    }

    function createCloudImage() {
        const exNumber = Math.floor(Math.random() * 9) + 1;
        const img = document.createElement('img');
        img.src = `assets/images/ex${exNumber}.png`;
        img.className = 'cloud-image';
        
        const x = Math.random() * (window.innerWidth - 200) + 100;
        const y = Math.random() * (window.innerHeight - 200) + 100;
        
        const finalWidth = 150 + Math.random() * 300;
        const finalHeight = 100 + Math.random() * 200;
        
        img.style.left = x + 'px';
        img.style.top = y + 'px';
        img.style.width = '0px';
        img.style.height = '0px';
        img.style.transform = 'translate(-50%, -50%)';
        
        document.body.appendChild(img);
        
        const cloudData = {
            element: img,
            x: x,
            y: y,
            currentWidth: 0,
            currentHeight: 0,
            finalWidth: finalWidth,
            finalHeight: finalHeight,
            phase: 'scaling',
            startTime: performance.now(),
            scaleDuration: 200 + Math.random() * 300,
            scanner: null
        };
        
        return cloudData;
    }

    function createWanderingScanner() {
        const scanner = document.createElement('div');
        scanner.className = 'hud-scanner';
        
        const frame = document.createElement('div');
        frame.className = 'hud-scanner-frame';
        scanner.appendChild(frame);
        
        const corners = document.createElement('div');
        corners.className = 'hud-scanner-corners';
        scanner.appendChild(corners);
        
        const line = document.createElement('div');
        line.className = 'hud-scanner-line';
        scanner.appendChild(line);
        
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;
        
        scanner.style.left = startX + 'px';
        scanner.style.top = startY + 'px';
        scanner.style.transform = 'translate(-50%, -50%)';
        scanner.style.width = '20px';
        scanner.style.height = '20px';
        scanner.setAttribute('data-status', 'Scanning');
        
        document.body.appendChild(scanner);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 1.5;
        
        const scannerData = {
            element: scanner,
            currentX: startX,
            currentY: startY,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            phase: 'wandering',
            lastDirectionChange: performance.now(),
            targetCloud: null,
            initialWidth: 20,
            initialHeight: 20
        };
        
        return scannerData;
    }

    function initializeWanderingScanners() {
        for (let i = 0; i < maxScanners; i++) {
            wanderingScanners.push(createWanderingScanner());
        }
    }

    function updateCloudImages(currentTime) {
        if (window.cloudControls && window.cloudControls.enabled && 
            currentTime - lastCloudSpawnTime > cloudSpawnInterval) {
            cloudImages.push(createCloudImage());
            lastCloudSpawnTime = currentTime;
        }
        
        cloudImages = cloudImages.filter(cloud => {
            const elapsed = currentTime - cloud.startTime;
            
            if (cloud.phase === 'scaling') {
                const progress = Math.min(elapsed / cloud.scaleDuration, 1);
                cloud.currentWidth = cloud.finalWidth * progress;
                cloud.currentHeight = cloud.finalHeight * progress;
                
                cloud.element.style.width = cloud.currentWidth + 'px';
                cloud.element.style.height = cloud.currentHeight + 'px';
                
                if (progress >= 1) {
                    cloud.phase = 'ready';
                    assignScannerToCloud(cloud);
                }
            } else if (cloud.phase === 'ready') {
                // Ready to be detected
            } else if (cloud.phase === 'being_scanned') {
                // Being scanned
            }
            
            return cloud.phase !== 'complete';
        });
    }

    function updateWanderingScanners(currentTime) {
        while (wanderingScanners.length < maxScanners) {
            wanderingScanners.push(createWanderingScanner());
        }
        
        wanderingScanners.forEach(scanner => {
            if (!scanner.element || !scanner.element.parentNode) return;
            
            if (scanner.phase === 'wandering') {
                scanner.currentX += scanner.velocityX;
                scanner.currentY += scanner.velocityY;
                
                if (scanner.currentX < 0 || scanner.currentX > window.innerWidth) {
                    scanner.velocityX *= -1;
                    scanner.currentX = Math.max(0, Math.min(window.innerWidth, scanner.currentX));
                }
                if (scanner.currentY < 0 || scanner.currentY > window.innerHeight) {
                    scanner.velocityY *= -1;
                    scanner.currentY = Math.max(0, Math.min(window.innerHeight, scanner.currentY));
                }
                
                if (currentTime - scanner.lastDirectionChange > 2000 + Math.random() * 3000) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 1.5;
                    scanner.velocityX = Math.cos(angle) * speed;
                    scanner.velocityY = Math.sin(angle) * speed;
                    scanner.lastDirectionChange = currentTime;
                }
            } else if (scanner.phase === 'targeting') {
                const cloud = scanner.targetCloud;
                if (!cloud || cloud.phase === 'complete') {
                    scanner.phase = 'wandering';
                    scanner.targetCloud = null;
                    return;
                }
                
                const dx = cloud.x - scanner.currentX;
                const dy = cloud.y - scanner.currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 5) {
                    const moveSpeed = 10;
                    scanner.currentX += (dx / distance) * moveSpeed;
                    scanner.currentY += (dy / distance) * moveSpeed;
                } else {
                    scanner.phase = 'scanning';
                    scanner.scanStartTime = currentTime;
                    scanner.growthStartTime = currentTime;
                    scanner.targetWidth = cloud.finalWidth;
                    scanner.targetHeight = cloud.finalHeight;
                    scanner.element.classList.add('scanning');
                    scanner.element.setAttribute('data-status', 'Identified');
                }
                
            } else if (scanner.phase === 'scanning') {
                const elapsed = currentTime - scanner.scanStartTime;
                const growthElapsed = currentTime - scanner.growthStartTime;
                
                if (growthElapsed < 300) {
                    const growthProgress = growthElapsed / 300;
                    const easeProgress = 1 - Math.pow(1 - growthProgress, 3);
                    
                    const currentWidth = scanner.initialWidth + (scanner.targetWidth - scanner.initialWidth) * easeProgress;
                    const currentHeight = scanner.initialHeight + (scanner.targetHeight - scanner.initialHeight) * easeProgress;
                    
                    scanner.element.style.width = currentWidth + 'px';
                    scanner.element.style.height = currentHeight + 'px';
                }
                
                if (elapsed > 800) {
                    scanner.targetCloud.element.remove();
                    scanner.targetCloud.phase = 'complete';
                    
                    scanner.phase = 'returning';
                    scanner.returnStartTime = currentTime;
                    scanner.element.classList.remove('scanning');
                }
                
            } else if (scanner.phase === 'returning') {
                const elapsed = currentTime - scanner.returnStartTime;
                if (elapsed < 200) {
                    const shrinkProgress = elapsed / 200;
                    const currentWidth = scanner.targetWidth - (scanner.targetWidth - scanner.initialWidth) * shrinkProgress;
                    const currentHeight = scanner.targetHeight - (scanner.targetHeight - scanner.initialHeight) * shrinkProgress;
                    
                    scanner.element.style.width = currentWidth + 'px';
                    scanner.element.style.height = currentHeight + 'px';
                } else {
                    scanner.element.style.width = scanner.initialWidth + 'px';
                    scanner.element.style.height = scanner.initialHeight + 'px';
                    scanner.element.setAttribute('data-status', 'Scanning');
                    scanner.phase = 'wandering';
                    scanner.targetCloud = null;
                    
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 1.5;
                    scanner.velocityX = Math.cos(angle) * speed;
                    scanner.velocityY = Math.sin(angle) * speed;
                }
            }
            
            scanner.element.style.left = scanner.currentX + 'px';
            scanner.element.style.top = scanner.currentY + 'px';
        });
    }

    function assignScannerToCloud(cloud) {
        let nearestScanner = null;
        let nearestDistance = Infinity;
        
        wanderingScanners.forEach(scanner => {
            if (scanner.phase === 'wandering') {
                const dx = cloud.x - scanner.currentX;
                const dy = cloud.y - scanner.currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestScanner = scanner;
                }
            }
        });
        
        if (nearestScanner) {
            nearestScanner.phase = 'targeting';
            nearestScanner.targetCloud = cloud;
            cloud.phase = 'being_scanned';
        }
    }

    function drawChatboxes() {
        if (!overlayCtx) return;
        
        const currentTime = performance.now();
        
        // Color transition disabled for now
        // if (transitionStartTime > 0) {
        // 	const elapsed = currentTime - transitionStartTime;
        // 	chatboxColorTransition = Math.min(elapsed / 1000, 1);
        // }
        // const bgLightness = Math.floor(255 * (1 - chatboxColorTransition));
        // overlayCanvas.style.backgroundColor = `rgb(${bgLightness}, ${bgLightness}, ${bgLightness})`;
        
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        updateCloudImages(currentTime);
        updateWanderingScanners(currentTime);
        
        // Slow down speed after enter is clicked
        let speed = window.chatboxControls ? window.chatboxControls.speed : 1.0;
        let currentSpawnInterval = spawnInterval;
        if (transitionStartTime > 0) {
            speed *= 0.3; // Reduce speed to 30% for easier reading
            currentSpawnInterval = spawnInterval * 5; // Spawn 5x less frequently when slowed down
        }
        const connectionDistance = window.chatboxControls ? window.chatboxControls.connectionDistance * 12 : 40;
        
        if (currentTime - lastSpawnTime > currentSpawnInterval) {
            chatboxes2D.push(createNewChatbox(null, 'normal'));
            lastSpawnTime = currentTime;
        }
        
        chatboxes2D = chatboxes2D.filter(chatbox => {
            chatbox.x += chatbox.vx * speed;
            chatbox.y += chatbox.vy * speed;
            
            if (currentTime - chatbox.styleUpdateTime > 2000 + Math.random() * 2000) {
                chatbox.textStyles = generateRandomTextStyles();
                chatbox.styleUpdateTime = currentTime;
            }
            
            const caretMargin = 20 / pixelScale;
            if (chatbox.y < 0) {
                chatbox.y = 0;
                chatbox.vy = Math.abs(chatbox.vy) * 0.5;
            }
            if (chatbox.y > overlayCanvas.height - chatbox.height - caretMargin) {
                chatbox.y = overlayCanvas.height - chatbox.height - caretMargin;
                chatbox.vy = -Math.abs(chatbox.vy) * 0.5;
            }
            
            return chatbox.x > -chatbox.width - 20;
        });
        
        overlayCtx.strokeStyle = 'black';
        overlayCtx.lineWidth = Math.max(1, Math.round(2 / pixelScale));
        
        for (let i = 0; i < chatboxes2D.length; i++) {
            for (let j = i + 1; j < chatboxes2D.length; j++) {
                const dx = (chatboxes2D[i].x + chatboxes2D[i].width/2) - (chatboxes2D[j].x + chatboxes2D[j].width/2);
                const dy = (chatboxes2D[i].y + chatboxes2D[i].height/2) - (chatboxes2D[j].y + chatboxes2D[j].height/2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < connectionDistance) {
                    overlayCtx.beginPath();
                    overlayCtx.moveTo(chatboxes2D[i].x + chatboxes2D[i].width/2, chatboxes2D[i].y + chatboxes2D[i].height/2);
                    overlayCtx.lineTo(chatboxes2D[j].x + chatboxes2D[j].width/2, chatboxes2D[j].y + chatboxes2D[j].height/2);
                    overlayCtx.stroke();
                }
            }
        }
        
        chatboxes2D.forEach(chatbox => {
            drawSpeechBubble(chatbox);
        });
    }

    function drawSpeechBubble(chatbox) {
        const baseCaretSize = 20;
        const baseCaretOffset = 32;
        
        const caretSize = baseCaretSize / pixelScale;
        const caretX = chatbox.x + (baseCaretOffset / pixelScale);
        const caretY = chatbox.y + chatbox.height;

        // Color transition disabled - using white chatboxes
        overlayCtx.fillStyle = 'white';
        overlayCtx.strokeStyle = 'black';
        overlayCtx.lineWidth = Math.max(1, Math.round(4 / pixelScale));

        overlayCtx.beginPath();
        overlayCtx.rect(chatbox.x, chatbox.y, chatbox.width, chatbox.height);
        overlayCtx.moveTo(caretX - caretSize, caretY);
        overlayCtx.lineTo(caretX + caretSize, caretY);
        overlayCtx.lineTo(caretX, caretY + caretSize);
        overlayCtx.closePath();
        overlayCtx.fill();

        overlayCtx.beginPath();
        overlayCtx.moveTo(chatbox.x, chatbox.y);
        overlayCtx.lineTo(chatbox.x + chatbox.width, chatbox.y);
        overlayCtx.lineTo(chatbox.x + chatbox.width, chatbox.y + chatbox.height);
        overlayCtx.lineTo(caretX + caretSize, caretY);
        overlayCtx.moveTo(caretX - caretSize, caretY);
        overlayCtx.lineTo(chatbox.x, caretY);
        overlayCtx.lineTo(chatbox.x, chatbox.y);
        overlayCtx.stroke();

        overlayCtx.beginPath();
        overlayCtx.moveTo(caretX - caretSize, caretY);
        overlayCtx.lineTo(caretX, caretY + caretSize);
        overlayCtx.lineTo(caretX + caretSize, caretY);
        overlayCtx.stroke();
        
        // Text color - black
        overlayCtx.fillStyle = 'black';
        overlayCtx.textBaseline = 'middle';
        
        const textBaseFontSize = chatbox.height * 0.4;
        const fontFamily = customFontLoaded ? 'Epmarugo' : 'monospace';
        
        let totalWidth = 0;
        chatbox.textStyles.forEach(fragment => {
            const fontSize = textBaseFontSize * fragment.sizeMultiplier;
            const weight = fragment.bold ? 'bold' : 'normal';
            overlayCtx.font = `${weight} ${fontSize}px ${fontFamily}`;
            totalWidth += overlayCtx.measureText(fragment.text).width;
        });
        
        const maxWidth = chatbox.width * 0.9;
        const textScale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
        
        let currentX = chatbox.x + (chatbox.width - (totalWidth * textScale)) / 2;
        const textY = chatbox.y + chatbox.height / 2;
        
        chatbox.textStyles.forEach(fragment => {
            const fontSize = (textBaseFontSize * fragment.sizeMultiplier) * textScale;
            const weight = fragment.bold ? 'bold' : 'normal';
            overlayCtx.font = `${weight} ${fontSize}px ${fontFamily}`;
            
            overlayCtx.fillText(fragment.text, currentX, textY);
            currentX += overlayCtx.measureText(fragment.text).width;
        });
    }
    
    function setupNewsletterForm() {
        const form = document.querySelector('.newsletter-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const email = form.querySelector('.newsletter-input').value;
                if (email) {
                    alert('Thanks for subscribing! We\'ll be in touch soon.');
                    form.querySelector('.newsletter-input').value = '';
                }
            });
        }
    }

function setupNavigation() {
    // Navigation is now handled by direct links
}

function setupEnterButton() {
const enterButton = document.getElementById('enter-button');
const header = document.querySelector('.header');
const contentSection = document.getElementById('content-section');

if (enterButton) {
    enterButton.addEventListener('click', function() {
        // Scroll to content section
        contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Show header after a short delay
        setTimeout(() => {
            header.classList.add('visible');
        }, 200);

        // Enable background fade on scroll after clicking enter
        setupBackgroundFade();
        
        // Start chatbox color transition
        transitionStartTime = performance.now();
    });
}
}

function setupBackgroundFade() {
const canvas = document.querySelector('body > canvas');
if (!canvas) return;

function handleScroll() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    
    // Start fading at 50vh scroll, fully transparent by 100vh
    const fadeStart = windowHeight * 0.5;
    const fadeEnd = windowHeight * 1.0;
    
    if (scrollY <= fadeStart) {
        canvas.style.opacity = '1';
    } else if (scrollY >= fadeEnd) {
        canvas.style.opacity = '0';
    } else {
        const fadeProgress = (scrollY - fadeStart) / (fadeEnd - fadeStart);
        canvas.style.opacity = String(1 - fadeProgress);
    }
}

window.addEventListener('scroll', handleScroll);
handleScroll(); // Check initial state
}

function setupScrollAnimations() {
const serviceCards = document.querySelectorAll('.service-card');
const newsletterWindow = document.querySelector('.newsletter-window');
const clientsWindow = document.querySelector('.clients-window');

const observerOptions = {
root: null,
rootMargin: '0px',
threshold: 0.2
};

const observer = new IntersectionObserver((entries) => {
entries.forEach(entry => {
    if (entry.isIntersecting) {
        entry.target.classList.add('animate');
        // Optional: stop observing after animation triggers
        observer.unobserve(entry.target);
    }
});
}, observerOptions);

// Observe service cards
serviceCards.forEach(card => {
observer.observe(card);
});

// Observe newsletter window
if (newsletterWindow) {
observer.observe(newsletterWindow);
}

// Observe newsletter sticker for scroll-triggered animation
const newsletterSticker = document.querySelector('.newsletter-sticker');
if (newsletterSticker && newsletterWindow) {
// Use the same observer to trigger sticker animation when window animates
const stickerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Add a slight delay after the window starts animating
            setTimeout(() => {
                newsletterSticker.classList.add('animate');
            }, 600);
            stickerObserver.unobserve(entry.target);
        }
    });
}, observerOptions);
stickerObserver.observe(newsletterWindow);
}

// Observe clients window
if (clientsWindow) {
observer.observe(clientsWindow);
}

// Setup message-style animation for "How We Help" header
setupMessageAnimation();

// Setup message-style animation for "Recent Posts" header
setupRecentPostsAnimation();
}

function setupMessageAnimation() {
const typingIndicator = document.getElementById('typing-indicator');
const headerElement = document.getElementById('how-we-help-header');
const titleElement = document.getElementById('section-title');

if (!typingIndicator || !headerElement || !titleElement) return;

// Pre-calculate the final width by temporarily making text visible but off-screen
const tempTitle = titleElement.cloneNode(true);
tempTitle.style.position = 'absolute';
tempTitle.style.visibility = 'hidden';
tempTitle.style.opacity = '1';
tempTitle.style.transform = 'scale(1)';
tempTitle.style.whiteSpace = 'nowrap';
headerElement.appendChild(tempTitle);
const finalWidth = tempTitle.offsetWidth + 32; // Add padding
headerElement.removeChild(tempTitle);

const observerOptions = {
root: null,
rootMargin: '0px',
threshold: 0.3
};

let hasTriggered = false;

const messageObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
    if (entry.isIntersecting && !hasTriggered) {
        hasTriggered = true;
        
        // Step 1: Show the bubble with typing indicator
        headerElement.classList.add('show');
        setTimeout(() => {
            typingIndicator.classList.add('show');
        }, 100);
        
        // Step 2: After 1.2 seconds of "typing", hide dots and expand bubble
        setTimeout(() => {
            typingIndicator.classList.remove('show');
            typingIndicator.classList.add('hide');
            
            // Show text first
            titleElement.classList.add('show');
            
            // Then expand the bubble - text and box move together
            setTimeout(() => {
                headerElement.style.width = finalWidth + 'px';
            }, 50);
        }, 1000);
        
        // Stop observing after triggered
        messageObserver.unobserve(entry.target);
    }
});
}, observerOptions);

// Observe the header element
messageObserver.observe(headerElement);
}

function setupRecentPostsAnimation() {
const typingIndicator = document.getElementById('recent-posts-typing-indicator');
const headerElement = document.getElementById('recent-posts-header');
const titleElement = document.getElementById('recent-posts-title');

if (!typingIndicator || !headerElement || !titleElement) return;

// Pre-calculate the final width by temporarily making text visible but off-screen
const tempTitle = titleElement.cloneNode(true);
tempTitle.style.position = 'absolute';
tempTitle.style.visibility = 'hidden';
tempTitle.style.opacity = '1';
tempTitle.style.transform = 'scale(1)';
tempTitle.style.whiteSpace = 'nowrap';
headerElement.appendChild(tempTitle);
const finalWidth = tempTitle.offsetWidth + 32; // Add padding
headerElement.removeChild(tempTitle);

const observerOptions = {
root: null,
rootMargin: '0px',
threshold: 0.3
};

let hasTriggered = false;

const messageObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
    if (entry.isIntersecting && !hasTriggered) {
        hasTriggered = true;
        
        // Step 1: Show the bubble with typing indicator
        headerElement.classList.add('show');
        setTimeout(() => {
            typingIndicator.classList.add('show');
        }, 100);
        
        // Step 2: After 1.2 seconds of "typing", hide dots and expand bubble
        setTimeout(() => {
            typingIndicator.classList.remove('show');
            typingIndicator.classList.add('hide');
            
            // Show text first
            titleElement.classList.add('show');
            
            // Then expand the bubble - text and box move together
            setTimeout(() => {
                headerElement.style.width = finalWidth + 'px';
            }, 50);
        }, 1000);
        
        // Stop observing after triggered
        messageObserver.unobserve(entry.target);
    }
});
}, observerOptions);

// Observe the header element
messageObserver.observe(headerElement);
}

function initializeNewsletterCloud() {
    const cloudContainer = document.getElementById('newsletter-cloud-bg');
    if (!cloudContainer) return;

    newsletterCloudRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    newsletterCloudRenderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 1.5) * 0.5));
    newsletterCloudRenderer.setSize(cloudContainer.clientWidth, cloudContainer.clientHeight);
    newsletterCloudRenderer.domElement.style.position = 'absolute';
    newsletterCloudRenderer.domElement.style.top = '0';
    newsletterCloudRenderer.domElement.style.left = '0';
    newsletterCloudRenderer.domElement.style.width = '100%';
    newsletterCloudRenderer.domElement.style.height = '100%';
    cloudContainer.appendChild(newsletterCloudRenderer.domElement);

    newsletterCloudScene = new THREE.Scene();
    newsletterCloudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const plane = new THREE.PlaneGeometry(2, 2);
    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: NewsletterCloudShader.uniforms,
        vertexShader: NewsletterCloudShader.vertexShader,
        fragmentShader: NewsletterCloudShader.fragmentShader
    });
    newsletterCloudMesh = new THREE.Mesh(plane, cloudMaterial);
    newsletterCloudScene.add(newsletterCloudMesh);
    NewsletterCloudShader.uniforms.resolution.value.set(cloudContainer.clientWidth, cloudContainer.clientHeight);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        if (cloudContainer && newsletterCloudRenderer) {
            newsletterCloudRenderer.setSize(cloudContainer.clientWidth, cloudContainer.clientHeight);
            newsletterCloudRenderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 1.5) * 0.5));
            NewsletterCloudShader.uniforms.resolution.value.set(cloudContainer.clientWidth, cloudContainer.clientHeight);
        }
    });
    resizeObserver.observe(cloudContainer);
}

init();

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild( container );

        const width = document.documentElement.clientWidth;
        const height = document.documentElement.clientHeight;

        renderer = new THREE.WebGLRenderer();
        renderer.setClearColor( 0xffffff, 1 );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( width, height );
        renderer.setAnimationLoop( animate );
        document.body.appendChild( renderer.domElement );
        // Ensure the WebGL canvas never captures scroll or clicks
        renderer.domElement.style.pointerEvents = 'none';

        camera = new THREE.PerspectiveCamera( 65, width / height, 3, 10 );
        camera.position.z = 7;

        scene = new THREE.Scene();

        group = new THREE.Object3D();
        scene.add( group );

        const light = new THREE.PointLight( 0xefffef, 500 );
        light.position.z = 10;
        light.position.y = - 10;
        light.position.x = - 10;
        scene.add( light );

        const light2 = new THREE.PointLight( 0xffefef, 500 );
        light2.position.z = 10;
        light2.position.x = - 10;
        light2.position.y = 10;
        scene.add( light2 );

        const light3 = new THREE.PointLight( 0xefefff, 500 );
        light3.position.z = 10;
        light3.position.x = 10;
        light3.position.y = - 10;
        scene.add( light3 );

    const light4 = new THREE.AmbientLight( 0xffffff, 0.2 );
    scene.add( light4 );

    // Color scheme system
    initializeColorSchemes();

    const geometry = new THREE.SphereGeometry( 3, 48, 24 );

    for ( let i = 0; i < 120; i ++ ) {

        const material = new THREE.MeshStandardMaterial();
        material.roughness = 0.5 * Math.random() + 0.25;
        material.metalness = 0;
        const c = generateColor();
        material.color.setHSL( c.h, c.s, c.l );

        const mesh = new THREE.Mesh( geometry, material );
            mesh.position.x = Math.random() * 4 - 2;
            mesh.position.y = Math.random() * 4 - 2;
            mesh.position.z = Math.random() * 4 - 2;
            mesh.rotation.x = Math.random();
            mesh.rotation.y = Math.random();
            mesh.rotation.z = Math.random();

            mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 0.2 + 0.05;
            group.add( mesh );

        }

// Keyboard controls for quick scheme tweaking
setupColorControlsUI();

createOverlayCanvas();
initializeWanderingScanners();
setupNewsletterForm();
setupNavigation();
setupEnterButton();
setupScrollAnimations();
initializeThreeTitle();
initializeNewsletterCloud();
        
        setTimeout(() => {
            if (cloudImages.length === 0) {
                cloudImages.push(createCloudImage());
            }
        }, 100);

        composer = new EffectComposer( renderer );
        renderPass = new RenderPass( scene, camera );
        composer.addPass( renderPass );
        saoPass = new SAOPass( scene, camera );
        
        saoPass.params.output = SAOPass.OUTPUT.Default;
        saoPass.params.saoBias = 0.5;
        saoPass.params.saoIntensity = 0.42;
        saoPass.params.saoScale = 6;
        saoPass.params.saoKernelRadius = 100;
        saoPass.params.saoMinResolution = 0;
        saoPass.params.saoBlur = false;
        saoPass.params.saoBlurRadius = 8;
        saoPass.params.saoBlurStdDev = 4;
        saoPass.params.saoBlurDepthCutoff = 0.01;
        
        composer.addPass( saoPass );
        
        ditheringPass = new ShaderPass( DitheringShader );
        ditheringPass.uniforms.resolution.value.set( window.innerWidth, window.innerHeight );
        ditheringPass.enabled = false;
        composer.addPass( ditheringPass );
        
        const outputPass = new OutputPass();
        composer.addPass( outputPass );

        window.chatboxControls = {
            visible: true,
            speed: 2.0,
            connectionDistance: 12.0,
            spawnRate: 2.0,
            pixelation: 2,
            style: 'classic'
        };

        window.cloudControls = {
            enabled: true,
            spawnRate: 0.5,
            scannerCount: 4
        };
        
        window.cloudDebug = {
            status: 'Waiting...'
        };

        window.addEventListener( 'resize', onWindowResize );

    // Add responsive typography styles
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .article-title {
                font-size: 20px !important;
                line-height: 1.3 !important;
            }
            .article-content {
                padding: 24px !important;
            }
            .articles-grid {
                grid-template-columns: 1fr !important;
                gap: 24px !important;
                padding: 0 16px !important;
            }
        }
        
        @media (max-width: 480px) {
            .article-title {
                font-size: 18px !important;
            }
            .article-excerpt {
                font-size: 14px !important;
            }
            .article-content {
                padding: 20px !important;
            }
        }
    `;
    document.head.appendChild(style);

    }

    function onWindowResize() {

        const width = document.documentElement.clientWidth || 1;
        const height = document.documentElement.clientHeight || 1;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize( width, height );

        composer.setSize( width, height );
        
        ditheringPass.uniforms.resolution.value.set( width, height );
        
        if ( overlayCanvas ) {
            resizeOverlayCanvas();
        }
    }

    function animate() {
        render();
    }

function render() {

    const timer = performance.now();
    group.rotation.x = timer * 0.0002;
    group.rotation.y = timer * 0.0001;

    if ( window.chatboxControls && window.chatboxControls.visible ) {
        drawChatboxes();
    }

    composer.render();

    // Render 3D title scene if available
    if (titleRenderer && titleScene && titleCamera && titleMesh) {
        const time = performance.now() * 0.001;
        
        // Animate EX and Research separately
        if (exMesh) {
            exMesh.rotation.y = Math.sin(time) * 0.2;
            exMesh.position.y = Math.sin(time * 0.7) * 0.1;
        }
        if (researchMesh) {
            researchMesh.rotation.y = Math.sin(time + 1.5) * 0.15;
            researchMesh.position.y = Math.sin(time * 0.5 + 2) * 0.08;
        }
        
        titleRenderer.render(titleScene, titleCamera);
    }

    // Render newsletter cloud background at reduced frame rate
    const now = performance.now();
    if (newsletterCloudRenderer && newsletterCloudScene && newsletterCloudCamera && 
        now - lastNewsletterCloudRenderTime >= newsletterCloudFrameIntervalMs) {
        NewsletterCloudShader.uniforms.time.value = (now * 0.001);
        newsletterCloudRenderer.render(newsletterCloudScene, newsletterCloudCamera);
        lastNewsletterCloudRenderTime = now;
    }
}

// Color schemes and controls
function initializeColorSchemes() {
    colorSchemes = {
        dorficOrangeWhite: () => {
            // 50/50 mix of vibrant orange spheres and near-white spheres
            if (Math.random() < 0.5) {
                // Orange around 30-45 degrees (0.08-0.12 in H on [0,1])
                const hue = 0.08 + (Math.random() - 0.5) * 0.02; // tight hue jitter
                const s = clamp01((colorControls.s || 0.55) + (Math.random() - 0.5) * 0.08);
                const l = clamp01((colorControls.l || 0.50) + (Math.random() - 0.5) * 0.06);
                return { h: hue, s, l };
            } else {
                // Nearly white: zero saturation, high lightness
                const l = clamp01(0.90 + (Math.random() - 0.5) * 0.06);
                return { h: 0, s: 0.0, l };
            }
        },
        dualTealPurple: () => {
            const base = Math.random() < 0.5 ? 0.58 : 0.78;
            return { h: clamp01(base + (Math.random() - 0.5) * getJitterH()), s: getS(), l: getL(0.03) };
        },
        dualBlueOrange: () => {
            const base = Math.random() < 0.5 ? 0.60 : 0.08;
            return { h: clamp01(base + (Math.random() - 0.5) * getJitterH()), s: getS(), l: getL(0.02) };
        },
        dualForestRose: () => {
            const base = Math.random() < 0.5 ? 0.33 : 0.95;
            return { h: clamp01(base + (Math.random() - 0.5) * getJitterH()), s: getS(0.4, 0.15), l: getL(0.04) };
        },
        multicolorMuted: () => {
            return { h: Math.random(), s: getS(0.45, 0.15), l: getL(0.05, 0.33) };
        },
        warmMuted: () => {
            const warm = 0.02 + Math.random() * 0.18;
            return { h: warm, s: getS(0.45, 0.12), l: getL(0.05, 0.36) };
        },
        coolMuted: () => {
            const cool = 0.55 + Math.random() * 0.25;
            return { h: cool, s: getS(0.45, 0.12), l: getL(0.05, 0.36) };
        },
        grayscale: () => {
            const l = clamp01((getBaseL() - 0.02) + (Math.random() - 0.5) * 0.08);
            return { h: 0, s: 0, l };
        }
    };
    colorSchemeNames = Object.keys(colorSchemes);
    const params = new URLSearchParams(window.location.search);
    const initialScheme = params.get('scheme') && colorSchemes[params.get('scheme')] ? params.get('scheme') : 'dualTealPurple';
    colorControls = {
        schemeIndex: colorSchemeNames.indexOf(initialScheme),
        s: clamp01(parseFloat(params.get('s')) || 0.5),
        l: clamp01(parseFloat(params.get('l')) || 0.4),
        jitterH: clamp01(parseFloat(params.get('j')) || 0.06)
    };
}

function getSchemeName() {
    return colorSchemeNames[(colorControls.schemeIndex + colorSchemeNames.length) % colorSchemeNames.length];
}

function getS(base = 0.5, range = 0.1) {
    const sBase = colorControls.s || base;
    return clamp01(sBase + (Math.random() - 0.5) * range);
}

function getBaseL(defaultL = 0.4) {
    return colorControls.l || defaultL;
}

function getL(range = 0.06, defaultL = 0.4) {
    const lBase = getBaseL(defaultL);
    return clamp01(lBase + (Math.random() - 0.5) * range);
}

function getJitterH() { return colorControls.jitterH; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function generateColor() {
    const scheme = colorSchemes[getSchemeName()];
    return scheme();
}

function applyColorsToGroup() {
    if (!group) return;
    group.children.forEach(obj => {
        if (obj.material && obj.material.color) {
            const c = generateColor();
            obj.material.color.setHSL(c.h, c.s, c.l);
        }
    });
    updateURLParams();
    console.log('Applied scheme:', getSchemeName(), 's=', colorControls.s.toFixed(2), 'l=', colorControls.l.toFixed(2));
}

function updateURLParams() {
    const params = new URLSearchParams(window.location.search);
    params.set('scheme', getSchemeName());
    params.set('s', String(colorControls.s.toFixed(2)));
    params.set('l', String(colorControls.l.toFixed(2)));
    params.set('j', String(colorControls.jitterH.toFixed(2)));
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

function setupColorControlsUI() {
    window.addEventListener('keydown', (e) => {
        if (e.key === ']') { colorControls.schemeIndex = (colorControls.schemeIndex + 1) % colorSchemeNames.length; applyColorsToGroup(); }
        if (e.key === '[') { colorControls.schemeIndex = (colorControls.schemeIndex - 1 + colorSchemeNames.length) % colorSchemeNames.length; applyColorsToGroup(); }
        if (e.key === 'S') { colorControls.s = clamp01(colorControls.s + 0.05); applyColorsToGroup(); }
        if (e.key === 's') { colorControls.s = clamp01(colorControls.s - 0.05); applyColorsToGroup(); }
        if (e.key === 'L') { colorControls.l = clamp01(colorControls.l + 0.05); applyColorsToGroup(); }
        if (e.key === 'l') { colorControls.l = clamp01(colorControls.l - 0.05); applyColorsToGroup(); }
        if (e.key === 'J') { colorControls.jitterH = clamp01(colorControls.jitterH + 0.02); applyColorsToGroup(); }
        if (e.key === 'j') { colorControls.jitterH = clamp01(colorControls.jitterH - 0.02); applyColorsToGroup(); }
        if (e.key === 'r') { applyColorsToGroup(); }
        if (e.key >= '1' && e.key <= '9') {
            const idx = parseInt(e.key, 10) - 1;
            if (idx < colorSchemeNames.length) { colorControls.schemeIndex = idx; applyColorsToGroup(); }
        }
        if (e.key === '0') {
            const dorficIdx = colorSchemeNames.indexOf('dorficOrangeWhite');
            if (dorficIdx !== -1) { colorControls.schemeIndex = dorficIdx; applyColorsToGroup(); }
        }
    });
    // Apply initial colors from URL params
    applyColorsToGroup();
}

function initializeThreeTitle() {
    titleMount = document.getElementById('three-title');
    if (!titleMount) return;
    
    let w = Math.max(1, titleMount.clientWidth || (titleMount.parentElement ? titleMount.parentElement.clientWidth : 0) || window.innerWidth);
    let h = Math.max(1, titleMount.clientHeight || 170);
    
    titleRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    titleRenderer.setPixelRatio(window.devicePixelRatio);
    titleRenderer.setSize(w, h, false);
    titleRenderer.setClearColor(0x000000, 0);
    titleMount.innerHTML = '';
    titleMount.appendChild(titleRenderer.domElement);

    titleScene = new THREE.Scene();
    titleCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    titleCamera.position.set(0, 0, 16);

    // Lighting - bright to stand out
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2, 3, 5);
    titleScene.add(key);
    const fill = new THREE.DirectionalLight(0xa0b9ff, 1.2);
    fill.position.set(-3, 2, 2);
    titleScene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff0d0, 1.0);
    rim.position.set(0, -2, -4);
    titleScene.add(rim);
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    titleScene.add(ambient);

    // 3D text using bevelled ExtrudeGeometry
    const textLoader = new FontLoader();
    textLoader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', function(font) {
        // Helper to create a mesh with one material applied to whole geometry
        function createTextMesh(str, material) {
            const geo = new TextGeometry(str, {
                font: font,
                size: 3.0,
                height: 0.7,
                curveSegments: 8,
                bevelEnabled: true,
                bevelThickness: 0.25,
                bevelSize: 0.15,
                bevelSegments: 3
            });
            geo.computeBoundingBox();
            const mesh = new THREE.Mesh(geo, material);
            return { mesh, geo };
        }

    // Materials: EX and Research - colors that complement the soft pastel palette
    exMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffd700, // warm golden yellow
        metalness: 0.1,
        roughness: 0.3,
        reflectivity: 0.8,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        emissive: 0x886600
    });
    researchMaterial = new THREE.MeshPhongMaterial({
        color: 0xff69b4, // soft hot pink
        shininess: 80,
        specular: 0xffffff,
        emissive: 0x883355
    });

        const { mesh: exMeshLocal, geo: exGeo } = createTextMesh('EX', exMaterial);
        const { mesh: researchMeshLocal, geo: researchGeo } = createTextMesh('Research', researchMaterial);

        // Compute widths to center combined group
        const exBB = exGeo.boundingBox; 
        const exW = exBB.max.x - exBB.min.x;
        const resBB = researchGeo.boundingBox; 
        const resW = resBB.max.x - resBB.min.x;
        const spacing = 1;
        const totalW = exW + resW + spacing;
        exMeshLocal.position.x = -totalW / 2;
        researchMeshLocal.position.x = exMeshLocal.position.x + exW + spacing;

        // Store individual meshes for separate animation
        exMesh = exMeshLocal;
        researchMesh = researchMeshLocal;
        
        // Create group so we can rotate one handle
        const grp = new THREE.Group();
        grp.add(exMeshLocal);
        grp.add(researchMeshLocal);
        titleScene.add(grp);
        titleMesh = grp;
    });

    // Handle resize
    function resizeTitle() {
        if (!titleMount || !titleRenderer) return;
        const cw = Math.max(1, titleMount.clientWidth || (titleMount.parentElement ? titleMount.parentElement.clientWidth : 0) || window.innerWidth);
        const ch = Math.max(1, titleMount.clientHeight || 170);
        titleRenderer.setSize(cw, ch, false);
        titleCamera.aspect = cw / ch;
        titleCamera.updateProjectionMatrix();
    }
window.addEventListener('resize', resizeTitle);
setTimeout(resizeTitle, 450);
}

// Color picker event listeners
document.getElementById('ex-color').addEventListener('input', function(e) {
if (exMaterial) {
    const color = new THREE.Color(e.target.value);
    exMaterial.color.copy(color);
    // Update emissive to be a darker version of the color
    exMaterial.emissive.copy(color).multiplyScalar(0.3);
    document.getElementById('ex-color-value').textContent = e.target.value.toUpperCase();
}
});

document.getElementById('research-color').addEventListener('input', function(e) {
if (researchMaterial) {
    const color = new THREE.Color(e.target.value);
    researchMaterial.color.copy(color);
    // Update emissive to be a darker version of the color
    researchMaterial.emissive.copy(color).multiplyScalar(0.3);
    document.getElementById('research-color-value').textContent = e.target.value.toUpperCase();
}
});