export class Chatboxes2D {
    constructor() {
        this.overlayCanvas = null;
        this.overlayCtx = null;
        this.chatboxes2D = [];
        this.customFontLoaded = false;
        this.lastSpawnTime = 0;
        this.spawnInterval = 1200; // Spawn new chatbox every 1.2 seconds
        this.pixelScale = 2; // How much to scale down for pixelation
        
        // Homepage elements
        this.showHomepageUI = true;
        this.enterButtonHovered = false;
        
        // Cloud image system
        this.cloudImages = [];
        this.lastCloudSpawnTime = 0;
        this.cloudSpawnInterval = 3000; // Spawn every 3 seconds
        
        // Wandering HUD scanner system
        this.wanderingScanners = [];
        this.maxScanners = 3;
        this.detectionDistance = 80;
        
        // Intro sequence variables (disabled)
        this.introStartTime = 0;
        this.introPhase = 'normal';
        this.introDuration = 0;
        this.stragglerDuration = 0;
        this.transitionDuration = 0;
        
        this.init();
    }

    init() {
        this.createOverlayCanvas();
        this.loadCustomFont();
        this.create2DChatboxes();
        this.setupHomepageUI();
        this.initializeWanderingScanners();
        
        // Spawn initial cloud image immediately
        setTimeout(() => {
            if (this.cloudImages.length === 0) {
                this.cloudImages.push(this.createCloudImage());
                console.log('Spawned initial cloud image');
            }
        }, 100);
    }

    createOverlayCanvas() {
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'fixed';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.zIndex = '100';
        this.overlayCanvas.style.imageRendering = 'pixelated';
        this.overlayCanvas.style.imageRendering = 'crisp-edges';
        this.overlayCanvas.style.overflow = 'hidden';
        document.body.appendChild(this.overlayCanvas);
        
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        // Disable antialiasing for crisp pixels
        this.overlayCtx.imageSmoothingEnabled = false;
        this.overlayCtx.webkitImageSmoothingEnabled = false;
        this.overlayCtx.mozImageSmoothingEnabled = false;
        this.overlayCtx.msImageSmoothingEnabled = false;
        
        this.resizeOverlayCanvas();
    }

    loadCustomFont() {
        const font = new FontFace('Epmarugo', 'url(assets/epmarugo.ttf)');
        font.load().then(function(loadedFont) {
            document.fonts.add(loadedFont);
            this.customFontLoaded = true;
        }.bind(this)).catch(function(error) {
            console.warn('Custom font failed to load:', error);
            this.customFontLoaded = false;
        }.bind(this));
    }

    resizeOverlayCanvas() {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        
        // Set actual canvas size to lower resolution
        this.overlayCanvas.width = Math.floor(viewportWidth / this.pixelScale);
        this.overlayCanvas.height = Math.floor(viewportHeight / this.pixelScale);
        
        // Scale up the canvas display size to exact viewport
        this.overlayCanvas.style.width = viewportWidth + 'px';
        this.overlayCanvas.style.height = viewportHeight + 'px';
    }

    setupHomepageUI() {
        const homepageUI = document.getElementById('homepage-ui');
        const enterButton = document.getElementById('enter-button');
        
        if (enterButton) {
            enterButton.addEventListener('click', function() {
                // Hide homepage UI
                homepageUI.classList.add('hidden');
                this.showHomepageUI = false;
                console.log('Welcome to EX Research!');
            }.bind(this));
        }
    }

    create2DChatboxes() {
        this.chatboxes2D = [];
        
        // Create 8-12 initial chatboxes spread around the screen
        const initialCount = 8 + Math.floor(Math.random() * 5);
        
        for (let i = 0; i < initialCount; i++) {
            const chatbox = this.createNewChatbox();
            // Better distribution - spread them more evenly across the screen
            const gridCols = Math.ceil(Math.sqrt(initialCount));
            const gridRows = Math.ceil(initialCount / gridCols);
            const col = i % gridCols;
            const row = Math.floor(i / gridCols);
            
            // Add some randomness to the grid positions
            const cellWidth = (this.overlayCanvas.width / this.pixelScale) / gridCols;
            const cellHeight = (this.overlayCanvas.height / this.pixelScale) / gridRows;
            
            chatbox.x = (col * cellWidth) + (Math.random() * cellWidth * 0.8);
            chatbox.y = (row * cellHeight) + (Math.random() * cellHeight * 0.8);
            
            // Make sure they stay within bounds
            chatbox.x = Math.max(0, Math.min(chatbox.x, this.overlayCanvas.width / this.pixelScale - chatbox.width));
            chatbox.y = Math.max(0, Math.min(chatbox.y, this.overlayCanvas.height / this.pixelScale - chatbox.height));
            
            this.chatboxes2D.push(chatbox);
        }
        
        console.log(`Created ${initialCount} initial chatboxes`);
    }

    createNewChatbox(startX = null, speedTier = 'normal') {
        // Base dimensions that will appear consistent on screen regardless of pixelation
        const baseWidth = 240;
        const baseHeight = 72;
        
        // Scale dimensions inversely with pixelation to maintain consistent screen size
        const scaledWidth = baseWidth / this.pixelScale;
        const scaledHeight = baseHeight / this.pixelScale;
        const scaledMargin = 80 / this.pixelScale;
        
        const x = startX !== null ? startX : this.overlayCanvas.width + scaledMargin/4;
        const caretMargin = 20 / this.pixelScale;
        const y = Math.random() * (this.overlayCanvas.height - scaledHeight - caretMargin);
        
        // Different speeds based on tier
        let baseVelocity, verticalDrift;
        switch (speedTier) {
            case 'superfast':
                baseVelocity = (-5 - Math.random() * 6) / this.pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 1.5) / this.pixelScale;
                break;
            case 'fast':
                baseVelocity = (-3 - Math.random() * 3) / this.pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 1.0) / this.pixelScale;
                break;
            case 'medium':
                baseVelocity = (-1.5 - Math.random() * 2) / this.pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.6) / this.pixelScale;
                break;
            case 'slow':
                baseVelocity = (-0.8 - Math.random() * 1.2) / this.pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.4) / this.pixelScale;
                break;
            default: // 'normal'
                baseVelocity = (-0.5 - Math.random() * 0.8) / this.pixelScale;
                verticalDrift = ((Math.random() - 0.5) * 0.2) / this.pixelScale;
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
            textStyles: this.generateRandomTextStyles(),
            styleUpdateTime: 0,
            speedTier: speedTier
        };
    }

    generateRandomTextStyles() {
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

    createCloudImage() {
        const exNumber = Math.floor(Math.random() * 9) + 1;
        const img = document.createElement('img');
        img.src = `assets/ex${exNumber}.png`;
        img.className = 'cloud-image';
        
        console.log(`Creating cloud image: ${img.src}`);
        
        // Random position
        const x = Math.random() * (window.innerWidth - 200) + 100;
        const y = Math.random() * (window.innerHeight - 200) + 100;
        
        // Random final size
        const finalWidth = 150 + Math.random() * 300;
        const finalHeight = 100 + Math.random() * 200;
        
        img.style.left = x + 'px';
        img.style.top = y + 'px';
        img.style.width = '0px';
        img.style.height = '0px';
        img.style.transform = 'translate(-50%, -50%)';
        
        img.onload = function() {
            console.log('Cloud image loaded successfully:', img.src);
        };
        
        img.onerror = function() {
            console.error('Failed to load cloud image:', img.src);
        };
        
        document.body.appendChild(img);
        console.log('Cloud image added to DOM at position:', x, y);
        
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

    createWanderingScanner() {
        const scanner = document.createElement('div');
        scanner.className = 'hud-scanner';
        
        // Add frame elements for cooler look
        const frame = document.createElement('div');
        frame.className = 'hud-scanner-frame';
        scanner.appendChild(frame);
        
        const corners = document.createElement('div');
        corners.className = 'hud-scanner-corners';
        scanner.appendChild(corners);
        
        const line = document.createElement('div');
        line.className = 'hud-scanner-line';
        scanner.appendChild(line);
        
        // Random starting position
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;
        
        scanner.style.left = startX + 'px';
        scanner.style.top = startY + 'px';
        scanner.style.transform = 'translate(-50%, -50%)';
        scanner.style.width = '20px';
        scanner.style.height = '20px';
        scanner.setAttribute('data-status', 'Scanning');
        
        document.body.appendChild(scanner);
        
        // Random wandering direction and speed
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
        
        console.log('Created wandering scanner at', startX, startY);
        return scannerData;
    }

    initializeWanderingScanners() {
        for (let i = 0; i < this.maxScanners; i++) {
            this.wanderingScanners.push(this.createWanderingScanner());
        }
    }

    updateCloudImages(currentTime) {
        // Update debug status
        if (window.cloudDebug) {
            const timeSinceSpawn = Math.round((currentTime - this.lastCloudSpawnTime) / 100) / 10;
            window.cloudDebug.status = `Next: ${Math.max(0, Math.round((this.cloudSpawnInterval - (currentTime - this.lastCloudSpawnTime)) / 100) / 10)}s, Active: ${this.cloudImages.length}, Enabled: ${window.cloudControls && window.cloudControls.enabled ? 'YES' : 'NO'}`;
        }
        
        // Debug logging
        if (currentTime % 1000 < 16) {
            console.log('Cloud spawn check:', {
                cloudControlsEnabled: window.cloudControls && window.cloudControls.enabled,
                showHomepageUI: this.showHomepageUI,
                introPhase: this.introPhase,
                timeSinceLastSpawn: currentTime - this.lastCloudSpawnTime,
                spawnInterval: this.cloudSpawnInterval
            });
        }
        
        // Spawn new cloud images
        if (window.cloudControls && window.cloudControls.enabled && 
            currentTime - this.lastCloudSpawnTime > this.cloudSpawnInterval) {
            console.log('Auto-spawning new cloud image...');
            this.cloudImages.push(this.createCloudImage());
            this.lastCloudSpawnTime = currentTime;
        }
        
        // Update existing cloud images
        this.cloudImages = this.cloudImages.filter(cloud => {
            const elapsed = currentTime - cloud.startTime;
            
            if (cloud.phase === 'scaling') {
                const progress = Math.min(elapsed / cloud.scaleDuration, 1);
                cloud.currentWidth = cloud.finalWidth * progress;
                cloud.currentHeight = cloud.finalHeight * progress;
                
                cloud.element.style.width = cloud.currentWidth + 'px';
                cloud.element.style.height = cloud.currentHeight + 'px';
                
                if (progress >= 1) {
                    cloud.phase = 'ready';
                    this.assignScannerToCloud(cloud);
                }
            } else if (cloud.phase === 'ready') {
                // Cloud is ready to be detected by wandering scanners
            } else if (cloud.phase === 'being_scanned') {
                // Cloud is being scanned, wait for completion
            }
            
            return cloud.phase !== 'complete';
        });
    }

    updateWanderingScanners(currentTime) {
        // Ensure we have the right number of scanners
        while (this.wanderingScanners.length < this.maxScanners) {
            this.wanderingScanners.push(this.createWanderingScanner());
        }
        
        this.wanderingScanners.forEach(scanner => {
            if (!scanner.element || !scanner.element.parentNode) return;
            
            if (scanner.phase === 'wandering') {
                scanner.currentX += scanner.velocityX;
                scanner.currentY += scanner.velocityY;
                
                // Bounce off screen edges
                if (scanner.currentX < 0 || scanner.currentX > window.innerWidth) {
                    scanner.velocityX *= -1;
                    scanner.currentX = Math.max(0, Math.min(window.innerWidth, scanner.currentX));
                }
                if (scanner.currentY < 0 || scanner.currentY > window.innerHeight) {
                    scanner.velocityY *= -1;
                    scanner.currentY = Math.max(0, Math.min(window.innerHeight, scanner.currentY));
                }
                
                // Randomly change direction occasionally
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
                    console.log(`Scanner analyzing cloud: ${scanner.targetWidth}x${scanner.targetHeight}`);
                }
                
            } else if (scanner.phase === 'scanning') {
                const elapsed = currentTime - scanner.scanStartTime;
                const growthElapsed = currentTime - scanner.growthStartTime;
                
                // Grow to match image size
                if (growthElapsed < 300) {
                    const growthProgress = growthElapsed / 300;
                    const easeProgress = 1 - Math.pow(1 - growthProgress, 3);
                    
                    const currentWidth = scanner.initialWidth + (scanner.targetWidth - scanner.initialWidth) * easeProgress;
                    const currentHeight = scanner.initialHeight + (scanner.targetHeight - scanner.initialHeight) * easeProgress;
                    
                    scanner.element.style.width = currentWidth + 'px';
                    scanner.element.style.height = currentHeight + 'px';
                }
                
                // Complete scan
                if (elapsed > 800) {
                    scanner.targetCloud.element.remove();
                    scanner.targetCloud.phase = 'complete';
                    
                    scanner.phase = 'returning';
                    scanner.returnStartTime = currentTime;
                    scanner.element.classList.remove('scanning');
                    console.log('Scanner completed analysis, returning to patrol');
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
            
            // Update visual position
            scanner.element.style.left = scanner.currentX + 'px';
            scanner.element.style.top = scanner.currentY + 'px';
        });
    }

    assignScannerToCloud(cloud) {
        let nearestScanner = null;
        let nearestDistance = Infinity;
        
        this.wanderingScanners.forEach(scanner => {
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
            console.log('Assigned scanner to new cloud image');
        } else {
            console.log('No available scanners for new cloud');
        }
    }

    drawChatboxes() {
        if (!this.overlayCtx) return;
        
        // Clear canvas
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        const currentTime = performance.now();
        
        // Update cloud images
        this.updateCloudImages(currentTime);
        
        // Update wandering scanners
        this.updateWanderingScanners(currentTime);
        
        // Initialize intro timing
        if (this.introStartTime === 0) {
            this.introStartTime = currentTime;
        }
        
        // Determine current intro phase
        const timeSinceStart = currentTime - this.introStartTime;
        if (timeSinceStart < this.introDuration) {
            this.introPhase = 'flood';
        } else if (timeSinceStart < this.introDuration + this.stragglerDuration) {
            this.introPhase = 'stragglers';
        } else if (timeSinceStart < this.introDuration + this.stragglerDuration + this.transitionDuration) {
            this.introPhase = 'transition';
        } else {
            this.introPhase = 'normal';
        }
        
        const speed = window.chatboxControls ? window.chatboxControls.speed : 1.0;
        const connectionDistance = window.chatboxControls ? window.chatboxControls.connectionDistance * 12 : 40;
        
        // Handle spawning based on intro phase
        if (this.introPhase === 'flood') {
            if (currentTime - this.lastSpawnTime > 50) {
                for (let i = 0; i < 8; i++) {
                    let speedTier;
                    const rand = Math.random();
                    if (rand < 0.4) speedTier = 'superfast';
                    else if (rand < 0.7) speedTier = 'fast';
                    else speedTier = 'medium';
                    
                    this.chatboxes2D.push(this.createNewChatbox(null, speedTier));
                }
                this.lastSpawnTime = currentTime;
            }
        } else if (this.introPhase === 'stragglers') {
            if (currentTime - this.lastSpawnTime > 200) {
                for (let i = 0; i < 2; i++) {
                    let speedTier;
                    const rand = Math.random();
                    if (rand < 0.3) speedTier = 'medium';
                    else if (rand < 0.7) speedTier = 'slow';
                    else speedTier = 'normal';
                    
                    this.chatboxes2D.push(this.createNewChatbox(null, speedTier));
                }
                this.lastSpawnTime = currentTime;
            }
        } else if (this.introPhase === 'transition') {
            const transitionProgress = (timeSinceStart - this.introDuration - this.stragglerDuration) / this.transitionDuration;
            const currentSpawnRate = 200 + (this.spawnInterval - 200) * transitionProgress;
            if (currentTime - this.lastSpawnTime > currentSpawnRate) {
                this.chatboxes2D.push(this.createNewChatbox(null, 'normal'));
                this.lastSpawnTime = currentTime;
            }
        } else {
            if (currentTime - this.lastSpawnTime > this.spawnInterval) {
                this.chatboxes2D.push(this.createNewChatbox(null, 'normal'));
                this.lastSpawnTime = currentTime;
            }
        }
        
        // Update positions and remove chatboxes that have left the screen
        this.chatboxes2D = this.chatboxes2D.filter(chatbox => {
            chatbox.x += chatbox.vx * speed;
            chatbox.y += chatbox.vy * speed;
            
            // Randomly update text styling every 2-4 seconds
            if (currentTime - chatbox.styleUpdateTime > 2000 + Math.random() * 2000) {
                chatbox.textStyles = this.generateRandomTextStyles();
                chatbox.styleUpdateTime = currentTime;
            }
            
            // Keep vertical position within bounds with soft bouncing
            const caretMargin = 20 / this.pixelScale;
            if (chatbox.y < 0) {
                chatbox.y = 0;
                chatbox.vy = Math.abs(chatbox.vy) * 0.5;
            }
            if (chatbox.y > this.overlayCanvas.height - chatbox.height - caretMargin) {
                chatbox.y = this.overlayCanvas.height - chatbox.height - caretMargin;
                chatbox.vy = -Math.abs(chatbox.vy) * 0.5;
            }
            
            return chatbox.x > -chatbox.width - 20;
        });
        
        // Draw connection lines
        this.overlayCtx.strokeStyle = 'black';
        this.overlayCtx.lineWidth = Math.max(1, Math.round(2 / this.pixelScale));
        
        for (let i = 0; i < this.chatboxes2D.length; i++) {
            for (let j = i + 1; j < this.chatboxes2D.length; j++) {
                const dx = (this.chatboxes2D[i].x + this.chatboxes2D[i].width/2) - (this.chatboxes2D[j].x + this.chatboxes2D[j].width/2);
                const dy = (this.chatboxes2D[i].y + this.chatboxes2D[i].height/2) - (this.chatboxes2D[j].y + this.chatboxes2D[j].height/2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < connectionDistance) {
                    this.overlayCtx.beginPath();
                    this.overlayCtx.moveTo(this.chatboxes2D[i].x + this.chatboxes2D[i].width/2, this.chatboxes2D[i].y + this.chatboxes2D[i].height/2);
                    this.overlayCtx.lineTo(this.chatboxes2D[j].x + this.chatboxes2D[j].width/2, this.chatboxes2D[j].y + this.chatboxes2D[j].height/2);
                    this.overlayCtx.stroke();
                }
            }
        }
        
        // Draw speech bubbles
        this.chatboxes2D.forEach(chatbox => {
            this.drawSpeechBubble(chatbox);
        });
    }

    drawSpeechBubble(chatbox) {
        const baseCaretSize = 20;
        const baseCaretOffset = 32;
        
        const caretSize = baseCaretSize / this.pixelScale;
        const caretX = chatbox.x + (baseCaretOffset / this.pixelScale);
        const caretY = chatbox.y + chatbox.height;

        const isFF7Style = window.chatboxControls && window.chatboxControls.style === 'ff7';

        if (isFF7Style) {
            const gradient = this.overlayCtx.createLinearGradient(
                chatbox.x, chatbox.y, 
                chatbox.x, chatbox.y + chatbox.height
            );
            gradient.addColorStop(0, '#1e3a5f');
            gradient.addColorStop(0.5, '#0f1f3d');
            gradient.addColorStop(1, '#061426');
            
            this.overlayCtx.fillStyle = gradient;
            this.overlayCtx.strokeStyle = '#4a6fa5';
            this.overlayCtx.lineWidth = Math.max(1, Math.round(2 / this.pixelScale));
        } else {
            this.overlayCtx.fillStyle = 'white';
            this.overlayCtx.strokeStyle = 'black';
            this.overlayCtx.lineWidth = Math.max(1, Math.round(4 / this.pixelScale));
        }

        // First, fill both the box and caret as one shape
        this.overlayCtx.beginPath();
        this.overlayCtx.rect(chatbox.x, chatbox.y, chatbox.width, chatbox.height);
        this.overlayCtx.moveTo(caretX - caretSize, caretY);
        this.overlayCtx.lineTo(caretX + caretSize, caretY);
        this.overlayCtx.lineTo(caretX, caretY + caretSize);
        this.overlayCtx.closePath();
        this.overlayCtx.fill();

        // Now stroke the box but skip the bottom section where caret connects
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(chatbox.x, chatbox.y);
        this.overlayCtx.lineTo(chatbox.x + chatbox.width, chatbox.y);
        this.overlayCtx.lineTo(chatbox.x + chatbox.width, chatbox.y + chatbox.height);
        this.overlayCtx.lineTo(caretX + caretSize, caretY);
        this.overlayCtx.moveTo(caretX - caretSize, caretY);
        this.overlayCtx.lineTo(chatbox.x, caretY);
        this.overlayCtx.lineTo(chatbox.x, chatbox.y);
        this.overlayCtx.stroke();

        // Stroke only the outer edges of the caret
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(caretX - caretSize, caretY);
        this.overlayCtx.lineTo(caretX, caretY + caretSize);
        this.overlayCtx.lineTo(caretX + caretSize, caretY);
        this.overlayCtx.stroke();
        
        // Draw text with random styling
        this.overlayCtx.fillStyle = isFF7Style ? 'white' : 'black';
        this.overlayCtx.textBaseline = 'middle';
        
        const textBaseFontSize = chatbox.height * 0.4;
        const fontFamily = this.customFontLoaded ? 'Epmarugo' : 'monospace';
        
        // Calculate total text width to center it
        let totalWidth = 0;
        chatbox.textStyles.forEach(fragment => {
            const fontSize = textBaseFontSize * fragment.sizeMultiplier;
            const weight = fragment.bold ? 'bold' : 'normal';
            this.overlayCtx.font = `${weight} ${fontSize}px ${fontFamily}`;
            totalWidth += this.overlayCtx.measureText(fragment.text).width;
        });
        
        const maxWidth = chatbox.width * 0.9;
        const textScale = totalWidth > maxWidth ? maxWidth / totalWidth : 1;
        
        let currentX = chatbox.x + (chatbox.width - (totalWidth * textScale)) / 2;
        const textY = chatbox.y + chatbox.height / 2;
        
        chatbox.textStyles.forEach(fragment => {
            const fontSize = (textBaseFontSize * fragment.sizeMultiplier) * textScale;
            const weight = fragment.bold ? 'bold' : 'normal';
            this.overlayCtx.font = `${weight} ${fontSize}px ${fontFamily}`;
            
            this.overlayCtx.fillText(fragment.text, currentX, textY);
            currentX += this.overlayCtx.measureText(fragment.text).width;
        });
    }

    // Public method to handle window resize
    onWindowResize() {
        this.resizeOverlayCanvas();
    }

    // Public method to get the overlay canvas for external use
    getOverlayCanvas() {
        return this.overlayCanvas;
    }
}
