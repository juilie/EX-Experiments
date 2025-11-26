import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

    let container, stats;
    let camera, scene, renderer;
    let composer, renderPass, saoPass, ditheringPass;
    let group;
    
    // Color scheme controls
    let colorSchemes, colorSchemeNames, colorControls;
    
    // 2D Chatbox overlay variables
    let overlayCanvas, overlayCtx;
    let chatboxes2D = [];
    let customFontLoaded = false;
    let lastSpawnTime = 0;
    let spawnInterval = 1200;
    let pixelScale = 2;
    
    // Cloud image system
    let cloudImages = [];
    let lastCloudSpawnTime = 0;
    let cloudSpawnInterval = 3000;
    
    // Wandering HUD scanner system
    let wanderingScanners = [];
    let maxScanners = 3;
    let detectionDistance = 80;

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
      overlayCanvas.style.zIndex = '100';
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
      customFontLoaded = true; // Use system fonts for simplicity
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

    function drawChatboxes() {
      if (!overlayCtx) return;
      
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      
      const currentTime = performance.now();
      
      const speed = window.chatboxControls ? window.chatboxControls.speed : 1.0;
      const connectionDistance = window.chatboxControls ? window.chatboxControls.connectionDistance * 12 : 40;
      
      if (currentTime - lastSpawnTime > spawnInterval) {
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
      
      overlayCtx.fillStyle = 'black';
      overlayCtx.textBaseline = 'middle';
      
      const textBaseFontSize = chatbox.height * 0.4;
      const fontFamily = 'monospace';
      
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
    const form = document.getElementById('newsletter-form');
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

  init();
  setupNewsletterForm();

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

      window.addEventListener( 'resize', onWindowResize );

    }

    // Color schemes and controls
    function initializeColorSchemes() {
      colorSchemes = {
      dorficOrangeWhite: () => {
        if (Math.random() < 0.5) {
          const hue = 0.08 + (Math.random() - 0.5) * 0.02;
          const s = clamp01((colorControls.s || 0.55) + (Math.random() - 0.5) * 0.08);
          const l = clamp01((colorControls.l || 0.50) + (Math.random() - 0.5) * 0.06);
          return { h: hue, s, l };
        } else {
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

    }

  