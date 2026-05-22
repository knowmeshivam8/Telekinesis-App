/* =============================================
   Antigravity — AR Telekinesis App v3
   Supernatural Powers + Spiderman Web Effect
   ============================================= */

(function () {
    'use strict';

    // ─── CONFIG ────────────────────────────────────
    const CONFIG = {
        particleCount: 80,
        repulsionRadius: 350,
        repulsionStrength: 18,
        attractionRadius: 350,
        attractionStrength: 10,
        friction: 0.945,
        returnStrength: 0.002,
        palmOpenThreshold: 0.25,
        fistThreshold: 0.12,
        pinchThreshold: 0.06,
        maxSpeed: 24,
        particleMinSize: 3,
        particleMaxSize: 10,
        trailLength: 6,
        webStrandCount: 12,
        webSegments: 20,
        colors: [
            new THREE.Color(0xff8c00),   // dark orange
            new THREE.Color(0xffa500),   // orange
            new THREE.Color(0xffb347),   // light orange
            new THREE.Color(0xff6b00),   // deep orange
            new THREE.Color(0xffd700),   // gold
            new THREE.Color(0xe65100),   // burnt orange
            new THREE.Color(0xffab40),   // amber
        ],
    };

    // ─── DOM ELEMENTS ──────────────────────────────
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('scene-canvas');
    const overlay = document.getElementById('overlay');
    const statusText = document.getElementById('status-text');
    const hud = document.getElementById('hud');
    const hudCamera = document.getElementById('hud-camera');
    const hudHand = document.getElementById('hud-hand');
    const hudForce = document.getElementById('hud-force');
    const instruction = document.getElementById('instruction');

    // ─── THREE.JS SCENE SETUP ─────────────────────
    const scene = new THREE.Scene();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const camera = new THREE.OrthographicCamera(
        -W / 2, W / 2, H / 2, -H / 2, 0.1, 1000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        alpha: false,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);

    // ─── FULL CAMERA BACKGROUND ───────────────────
    let webcamTexture = null;
    let webcamMesh = null;

    function setupWebcamBackground() {
        webcamTexture = new THREE.VideoTexture(videoEl);
        webcamTexture.minFilter = THREE.LinearFilter;
        webcamTexture.magFilter = THREE.LinearFilter;

        // Full-screen camera feed — no dark overlay
        const planeW = window.innerWidth;
        const planeH = window.innerHeight;
        const geo = new THREE.PlaneGeometry(planeW, planeH);
        const mat = new THREE.MeshBasicMaterial({
            map: webcamTexture,
            transparent: false,
        });
        webcamMesh = new THREE.Mesh(geo, mat);
        webcamMesh.position.z = -10;
        // Mirror horizontally
        webcamMesh.scale.x = -1;
        scene.add(webcamMesh);
    }

    // ─── VIGNETTE OVERLAY ─────────────────────────
    const vignetteGeo = new THREE.PlaneGeometry(W, H);
    const vignetteMat = new THREE.ShaderMaterial({
        uniforms: {
            uResolution: { value: new THREE.Vector2(W, H) },
            uIntensity: { value: 0.45 },
        },
        vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec2 uResolution;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center) * 1.4;
        float vignette = smoothstep(0.4, 1.2, dist);
        gl_FragColor = vec4(0.0, 0.0, 0.02, vignette * uIntensity);
      }
    `,
        transparent: true,
        depthWrite: false,
    });
    const vignetteMesh = new THREE.Mesh(vignetteGeo, vignetteMat);
    vignetteMesh.position.z = -5;
    scene.add(vignetteMesh);

    // ─── PARTICLE SYSTEM ──────────────────────────
    const particles = [];

    class Particle {
        constructor() {
            this.x = (Math.random() - 0.5) * window.innerWidth;
            this.y = (Math.random() - 0.5) * window.innerHeight;
            this.z = Math.random() * 10 - 5;
            this.originX = this.x;
            this.originY = this.y;
            this.vx = 0;
            this.vy = 0;
            this.vz = 0;
            this.size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
            this.baseSize = this.size;
            this.colorIndex = Math.floor(Math.random() * CONFIG.colors.length);
            this.color = CONFIG.colors[this.colorIndex].clone();
            this.baseColor = this.color.clone();
            this.glowIntensity = 0.4 + Math.random() * 0.6;
            this.phase = Math.random() * Math.PI * 2;
            this.floatSpeed = 0.3 + Math.random() * 0.5;
            this.floatAmp = 0.3 + Math.random() * 0.6;
            // Trail positions
            this.trail = [];
            for (let t = 0; t < CONFIG.trailLength; t++) {
                this.trail.push({ x: this.x, y: this.y });
            }
            this.isExcited = false;
        }
    }

    // ── Main particles ──
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    const sizes = new Float32Array(CONFIG.particleCount);
    const alphas = new Float32Array(CONFIG.particleCount);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const p = new Particle();
        particles.push(p);
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        colors[i * 3] = p.color.r;
        colors[i * 3 + 1] = p.color.g;
        colors[i * 3 + 2] = p.color.b;
        sizes[i] = p.size;
        alphas[i] = p.glowIntensity;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() },
            uTime: { value: 0 },
        },
        vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * 3.5;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;

        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.3);

        float core = 1.0 - smoothstep(0.0, 0.12, d);

        vec3 color = vColor * glow * 1.5 + vec3(1.0) * core * 0.8;
        float alpha = glow * vAlpha;

        gl_FragColor = vec4(color, alpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    particlePoints.position.z = 5;
    scene.add(particlePoints);

    // ── Trail particles (motion blur) ──
    const TRAIL_PARTICLE_COUNT = CONFIG.particleCount * CONFIG.trailLength;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL_PARTICLE_COUNT * 3);
    const trailCol = new Float32Array(TRAIL_PARTICLE_COUNT * 3);
    const trailSiz = new Float32Array(TRAIL_PARTICLE_COUNT);
    const trailAlp = new Float32Array(TRAIL_PARTICLE_COUNT);

    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('aColor', new THREE.BufferAttribute(trailCol, 3));
    trailGeo.setAttribute('aSize', new THREE.BufferAttribute(trailSiz, 1));
    trailGeo.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlp, 1));

    const trailMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() },
        },
        vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * 2.0;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * glow, glow * vAlpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const trailPoints = new THREE.Points(trailGeo, trailMaterial);
    trailPoints.position.z = 4;
    scene.add(trailPoints);

    // ─── RIPPLE / SHOCKWAVE SYSTEM ────────────────
    const ripples = [];
    const MAX_RIPPLES = 20;

    function createRippleMesh() {
        const geo = new THREE.RingGeometry(0.5, 1, 64);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0xff8c00) },
                uOpacity: { value: 1.0 },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float alpha = uOpacity * smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
          gl_FragColor = vec4(uColor * 1.5, alpha);
        }
      `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.position.z = 6;
        scene.add(mesh);
        return mesh;
    }

    const rippleMeshPool = [];
    for (let i = 0; i < MAX_RIPPLES; i++) {
        rippleMeshPool.push(createRippleMesh());
    }

    function spawnRipple(x, y, intensity, color) {
        const mesh = rippleMeshPool.find(m => !m.visible);
        if (!mesh) return;
        mesh.position.set(x, y, 6);
        mesh.scale.set(1, 1, 1);
        mesh.visible = true;
        mesh.material.uniforms.uOpacity.value = 0.7 * intensity;
        mesh.material.uniforms.uColor.value.copy(color || CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)]);
        ripples.push({
            mesh,
            life: 1.0,
            speed: 2.0 + Math.random() * 1.5,
            maxScale: 120 + Math.random() * 80,
        });
    }

    // ─── PALM GLOW (per hand) ─────────────────────
    function createGlowMesh(color) {
        const geo = new THREE.CircleGeometry(1, 64);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: color.clone() },
                uOpacity: { value: 0 },
                uPulse: { value: 0 },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uPulse;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - vec2(0.5)) * 2.0;
          float glow = 1.0 - smoothstep(0.0, 1.0, d);
          glow = pow(glow, 1.8);
          // Pulsing energy
          float pulse = 1.0 + sin(uPulse * 8.0) * 0.15;
          gl_FragColor = vec4(uColor * pulse * 1.3, glow * uOpacity);
        }
      `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = 7;
        scene.add(mesh);
        return mesh;
    }

    const glowMeshes = [
        createGlowMesh(new THREE.Color(0xff8c00)),
        createGlowMesh(new THREE.Color(0xffd700)),
    ];

    // ─── ENERGY ARC (two-hand effect) ─────────────
    const arcSegments = 40;
    const arcGeo = new THREE.BufferGeometry();
    const arcPositions = new Float32Array(arcSegments * 3);
    const arcColors = new Float32Array(arcSegments * 3);
    const arcAlphas = new Float32Array(arcSegments);
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
    arcGeo.setAttribute('aColor', new THREE.BufferAttribute(arcColors, 3));
    arcGeo.setAttribute('aAlpha', new THREE.BufferAttribute(arcAlphas, 1));

    const arcMat = new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 6.0 * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.2);
        gl_FragColor = vec4(vColor * 2.0, glow * vAlpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const arcPoints = new THREE.Points(arcGeo, arcMat);
    arcPoints.position.z = 8;
    arcPoints.visible = false;
    scene.add(arcPoints);

    // ─── ENERGY BALL (two-hand orb) ──────────────
    const energyBallGeo = new THREE.CircleGeometry(1, 64);
    const energyBallMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor1: { value: new THREE.Color(0xff8c00) },
            uColor2: { value: new THREE.Color(0xffd700) },
            uOpacity: { value: 0 },
            uTime: { value: 0 },
            uIntensity: { value: 0 },
        },
        vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        // Multi-layered glow
        float core = 1.0 - smoothstep(0.0, 0.25, d);
        float innerGlow = 1.0 - smoothstep(0.0, 0.55, d);
        float outerGlow = 1.0 - smoothstep(0.0, 1.0, d);
        // Pulsing
        float pulse = 1.0 + sin(uTime * 6.0) * 0.12 + sin(uTime * 13.0) * 0.06;
        // Swirling color mix
        float swirl = sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 3.0 + uTime * 4.0) * 0.5 + 0.5;
        vec3 color = mix(uColor1, uColor2, swirl);
        // Composite layers
        vec3 finalColor = color * outerGlow * 0.6
                        + color * innerGlow * 1.2
                        + vec3(1.0) * core * 0.9 * uIntensity;
        float alpha = outerGlow * uOpacity * pulse;
        gl_FragColor = vec4(finalColor * pulse, alpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const energyBall = new THREE.Mesh(energyBallGeo, energyBallMat);
    energyBall.position.z = 8.5;
    scene.add(energyBall);

    // Outer ring glow for the ball
    const ballRingGeo = new THREE.RingGeometry(0.85, 1, 64);
    const ballRingMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0xff6b00) },
            uOpacity: { value: 0 },
            uTime: { value: 0 },
        },
        vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float edgeGlow = smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
        float pulse = 1.0 + sin(uTime * 10.0) * 0.2;
        gl_FragColor = vec4(uColor * pulse * 1.5, edgeGlow * uOpacity);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    const ballRing = new THREE.Mesh(ballRingGeo, ballRingMat);
    ballRing.position.z = 8.6;
    scene.add(ballRing);

    let energyBallTargetOpacity = 0;
    let energyBallCurrentOpacity = 0;

    // ─── LIGHTNING BOLT (pinch effect) ────────────
    const boltSegments = 20;
    const boltGeo = new THREE.BufferGeometry();
    const boltPositions = new Float32Array(boltSegments * 3);
    const boltCol = new Float32Array(boltSegments * 3);
    const boltAlp = new Float32Array(boltSegments);
    boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
    boltGeo.setAttribute('aColor', new THREE.BufferAttribute(boltCol, 3));
    boltGeo.setAttribute('aAlpha', new THREE.BufferAttribute(boltAlp, 1));

    const boltMat = new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 5.0 * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.4, d);
        gl_FragColor = vec4(vColor * 2.5, glow * vAlpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const boltPoints = new THREE.Points(boltGeo, boltMat);
    boltPoints.position.z = 9;
    boltPoints.visible = false;
    scene.add(boltPoints);

    // ─── SPIDERMAN WEB STRANDS ──────────────────
    const WEB_STRANDS = CONFIG.webStrandCount;
    const WEB_SEGS = CONFIG.webSegments;
    const webTotalPoints = WEB_STRANDS * WEB_SEGS * 2; // line segments need pairs
    const webGeo = new THREE.BufferGeometry();
    const webPositions = new Float32Array(webTotalPoints * 3);
    const webColors = new Float32Array(webTotalPoints * 3);
    webGeo.setAttribute('position', new THREE.BufferAttribute(webPositions, 3));
    webGeo.setAttribute('color', new THREE.BufferAttribute(webColors, 3));

    const webMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        linewidth: 1,
    });
    const webLines = new THREE.LineSegments(webGeo, webMat);
    webLines.position.z = 12;
    webLines.visible = false;
    scene.add(webLines);

    // Web strand dots (nodes at intersections)
    const webDotCount = WEB_STRANDS * WEB_SEGS;
    const webDotGeo = new THREE.BufferGeometry();
    const webDotPos = new Float32Array(webDotCount * 3);
    const webDotCol = new Float32Array(webDotCount * 3);
    const webDotSiz = new Float32Array(webDotCount);
    webDotGeo.setAttribute('position', new THREE.BufferAttribute(webDotPos, 3));
    webDotGeo.setAttribute('aColor', new THREE.BufferAttribute(webDotCol, 3));
    webDotGeo.setAttribute('aSize', new THREE.BufferAttribute(webDotSiz, 1));

    const webDotMat = new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader: `
      attribute vec3 aColor; attribute float aSize;
      varying vec3 vColor; uniform float uPixelRatio;
      void main() { vColor = aColor;
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
        fragmentShader: `
      varying vec3 vColor;
      void main() { float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float g = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * 2.0, g * 0.9);
      }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const webDotPoints = new THREE.Points(webDotGeo, webDotMat);
    webDotPoints.position.z = 12.5;
    webDotPoints.visible = false;
    scene.add(webDotPoints);

    // Store web animation state
    let webAnimProgress = 0; // 0 to 1 animation
    let webActive = false;
    let webSeed = 0; // random seed for strand variation
    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
        [0, 5], [5, 6], [6, 7], [7, 8],       // index
        [0, 9], [9, 10], [10, 11], [11, 12],   // middle
        [0, 13], [13, 14], [14, 15], [15, 16], // ring
        [0, 17], [17, 18], [18, 19], [19, 20], // pinky
        [5, 9], [9, 13], [13, 17],           // palm
    ];

    // Line segments for skeleton (each connection = 2 points)
    const skelMaxHands = 2;
    const skelPointsPerHand = HAND_CONNECTIONS.length * 2;
    const skelTotal = skelMaxHands * skelPointsPerHand;
    const skelGeo = new THREE.BufferGeometry();
    const skelPositions = new Float32Array(skelTotal * 3);
    const skelColors = new Float32Array(skelTotal * 3);
    skelGeo.setAttribute('position', new THREE.BufferAttribute(skelPositions, 3));
    skelGeo.setAttribute('color', new THREE.BufferAttribute(skelColors, 3));

    const skelMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        linewidth: 1,
    });
    const skelLines = new THREE.LineSegments(skelGeo, skelMat);
    skelLines.position.z = 10;
    scene.add(skelLines);

    // Hand joint dots
    const jointTotal = skelMaxHands * 21;
    const jointGeo = new THREE.BufferGeometry();
    const jointPos = new Float32Array(jointTotal * 3);
    const jointCol = new Float32Array(jointTotal * 3);
    const jointSiz = new Float32Array(jointTotal);
    jointGeo.setAttribute('position', new THREE.BufferAttribute(jointPos, 3));
    jointGeo.setAttribute('aColor', new THREE.BufferAttribute(jointCol, 3));
    jointGeo.setAttribute('aSize', new THREE.BufferAttribute(jointSiz, 1));

    const jointMat = new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main() {
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.5);
        float core = 1.0 - smoothstep(0.0, 0.1, d);
        vec3 c = vColor * glow * 1.5 + vec3(1.0) * core;
        gl_FragColor = vec4(c, glow);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const jointPoints = new THREE.Points(jointGeo, jointMat);
    jointPoints.position.z = 11;
    scene.add(jointPoints);

    // ─── GESTURE LABEL ────────────────────────────
    const gestureLabel = document.createElement('div');
    gestureLabel.id = 'gesture-label';
    gestureLabel.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    z-index: 50; font-family: 'Inter', sans-serif; font-size: 1rem;
    letter-spacing: 0.1em; text-transform: uppercase; color: rgba(200,200,255,0.8);
    padding: 8px 24px; background: rgba(10,10,20,0.5); backdrop-filter: blur(8px);
    border: 1px solid rgba(139,92,246,0.2); border-radius: 30px;
    transition: opacity 0.3s, color 0.3s;
    opacity: 0; pointer-events: none;
  `;
    document.body.appendChild(gestureLabel);

    // ─── HAND TRACKING STATE ──────────────────────
    const GESTURE = { NONE: 0, OPEN: 1, FIST: 2, PINCH: 3, WEB: 4 };
    const handState = {
        hands: [],
        rawLandmarks: [],    // raw landmark arrays per hand
    };

    // ─── MEDIAPIPE HANDS ──────────────────────────
    function initMediaPipe() {
        statusText.textContent = 'Loading hand tracking model…';

        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
            },
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6,
        });

        hands.onResults(onHandResults);

        statusText.textContent = 'Requesting camera access…';

        const cam = new Camera(videoEl, {
            onFrame: async () => {
                await hands.send({ image: videoEl });
            },
            width: 640,
            height: 480,
        });

        cam.start().then(() => {
            statusText.textContent = 'Camera active. Show your hands!';
            hudCamera.classList.add('active');
            setupWebcamBackground();

            setTimeout(() => {
                overlay.classList.add('hidden');
                hud.classList.add('visible');
                instruction.classList.add('visible');
                setTimeout(() => instruction.classList.remove('visible'), 7000);
            }, 1000);
        }).catch((err) => {
            statusText.textContent = 'Camera error: ' + err.message;
            console.error('Camera error:', err);
        });
    }

    // ─── GESTURE DETECTION ────────────────────────
    function computePalmCenter(landmarks) {
        const indices = [0, 5, 9, 13, 17];
        let sx = 0, sy = 0;
        for (const i of indices) {
            sx += landmarks[i].x;
            sy += landmarks[i].y;
        }
        return { x: sx / indices.length, y: sy / indices.length };
    }

    function computeOpenness(landmarks) {
        const tips = [4, 8, 12, 16, 20];
        const mcps = [2, 5, 9, 13, 17];
        let totalExtension = 0;
        for (let i = 0; i < tips.length; i++) {
            const dx = landmarks[tips[i]].x - landmarks[mcps[i]].x;
            const dy = landmarks[tips[i]].y - landmarks[mcps[i]].y;
            totalExtension += Math.sqrt(dx * dx + dy * dy);
        }
        const wrist = landmarks[0];
        const midMcp = landmarks[9];
        const handSize = Math.sqrt(
            (wrist.x - midMcp.x) ** 2 + (wrist.y - midMcp.y) ** 2
        );
        const normalizedOpenness = totalExtension / (handSize * 5);
        return Math.min(1, Math.max(0, (normalizedOpenness - 0.35) / 0.55));
    }

    function detectPinch(landmarks) {
        const dx = landmarks[4].x - landmarks[8].x;
        const dy = landmarks[4].y - landmarks[8].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function fingerExtension(landmarks, tipIdx, mcpIdx) {
        const dx = landmarks[tipIdx].x - landmarks[mcpIdx].x;
        const dy = landmarks[tipIdx].y - landmarks[mcpIdx].y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function detectWebPose(landmarks) {
        // Spiderman pose: index+pinky extended, middle+ring curled toward palm
        const wrist = landmarks[0];
        const midMcp = landmarks[9];
        const handSize = Math.sqrt((wrist.x - midMcp.x) ** 2 + (wrist.y - midMcp.y) ** 2);
        if (handSize < 0.01) return false;

        const indexExt = fingerExtension(landmarks, 8, 5) / handSize;
        const middleExt = fingerExtension(landmarks, 12, 9) / handSize;
        const ringExt = fingerExtension(landmarks, 16, 13) / handSize;
        const pinkyExt = fingerExtension(landmarks, 20, 17) / handSize;

        // Index & pinky extended (>0.6), middle & ring curled (<0.5)
        return indexExt > 0.55 && pinkyExt > 0.45 && middleExt < 0.55 && ringExt < 0.55;
    }

    function classifyGesture(landmarks) {
        const openness = computeOpenness(landmarks);
        const pinchDist = detectPinch(landmarks);

        // Check Spiderman web pose first (highest priority)
        if (detectWebPose(landmarks)) {
            return { gesture: GESTURE.WEB, openness, pinchDist };
        }
        if (pinchDist < CONFIG.pinchThreshold) {
            return { gesture: GESTURE.PINCH, openness, pinchDist };
        }
        if (openness > CONFIG.palmOpenThreshold) {
            return { gesture: GESTURE.OPEN, openness, pinchDist };
        }
        if (openness < CONFIG.fistThreshold) {
            return { gesture: GESTURE.FIST, openness, pinchDist };
        }
        return { gesture: GESTURE.NONE, openness, pinchDist };
    }

    function onHandResults(results) {
        handState.hands = [];
        handState.rawLandmarks = [];

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            hudHand.classList.add('active');

            for (const landmarks of results.multiHandLandmarks) {
                const palm = computePalmCenter(landmarks);
                const { gesture, openness, pinchDist } = classifyGesture(landmarks);

                const screenX = -(palm.x - 0.5) * window.innerWidth;
                const screenY = -(palm.y - 0.5) * window.innerHeight;

                // Thumb and index screen positions for pinch effect
                const thumbX = -(landmarks[4].x - 0.5) * window.innerWidth;
                const thumbY = -(landmarks[4].y - 0.5) * window.innerHeight;
                const indexX = -(landmarks[8].x - 0.5) * window.innerWidth;
                const indexY = -(landmarks[8].y - 0.5) * window.innerHeight;

                // Wrist direction (for web aiming)
                const wristX = -(landmarks[0].x - 0.5) * window.innerWidth;
                const wristY = -(landmarks[0].y - 0.5) * window.innerHeight;
                const middleBaseX = -(landmarks[9].x - 0.5) * window.innerWidth;
                const middleBaseY = -(landmarks[9].y - 0.5) * window.innerHeight;

                handState.hands.push({
                    palmX: screenX,
                    palmY: screenY,
                    wristX, wristY,
                    aimDirX: middleBaseX - wristX,
                    aimDirY: middleBaseY - wristY,
                    openness,
                    gesture,
                    pinchDist,
                    thumbX, thumbY,
                    indexX, indexY,
                });
                handState.rawLandmarks.push(landmarks);
            }
        } else {
            hudHand.classList.remove('active');
        }
    }

    // ─── HELPER: convert landmark to screen coords ──
    function lmToScreen(lm) {
        return {
            x: -(lm.x - 0.5) * window.innerWidth,
            y: -(lm.y - 0.5) * window.innerHeight,
        };
    }

    // ─── PHYSICS & ANIMATION ──────────────────────
    let lastTime = performance.now();
    let rippleTimer = 0;
    let time = 0;
    let currentGestureText = '';

    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 16.67, 3);
        lastTime = now;
        time += 0.016;

        particleMaterial.uniforms.uTime.value = time;

        // ── Determine active gestures ──
        const anyActive = handState.hands.some(h => h.gesture !== GESTURE.NONE);
        const twoHandsActive = handState.hands.length === 2 &&
            handState.hands[0].gesture !== GESTURE.NONE &&
            handState.hands[1].gesture !== GESTURE.NONE;

        if (anyActive) {
            hudForce.classList.add('active');
        } else {
            hudForce.classList.remove('active');
        }

        // ── Gesture label ──
        let labelText = '';
        let labelColor = 'rgba(200,200,255,0.8)';
        if (twoHandsActive) {
            const hDist = Math.sqrt((handState.hands[0].palmX - handState.hands[1].palmX) ** 2 + (handState.hands[0].palmY - handState.hands[1].palmY) ** 2);
            labelText = hDist < 350 ? '🔮 ENERGY BALL' : '⚡ ENERGY ARC';
            labelColor = hDist < 350 ? '#ffab40' : '#ffd700';
        } else if (handState.hands.length > 0) {
            const h = handState.hands[0];
            if (h.gesture === GESTURE.OPEN) {
                labelText = '✋ REPULSION';
                labelColor = '#ff8c00';
            } else if (h.gesture === GESTURE.FIST) {
                labelText = '✊ GRAVITY PULL';
                labelColor = '#ffd700';
            } else if (h.gesture === GESTURE.PINCH) {
                labelText = '🤏 ENERGY BEAM';
                labelColor = '#ff6b00';
            } else if (h.gesture === GESTURE.WEB) {
                labelText = '🕷️ WEB SHOOT';
                labelColor = '#e2e8f0';
            }
        }
        if (labelText !== currentGestureText) {
            currentGestureText = labelText;
            gestureLabel.textContent = labelText;
            gestureLabel.style.color = labelColor;
            gestureLabel.style.borderColor = labelColor + '44';
            gestureLabel.style.opacity = labelText ? '1' : '0';
        }

        // ── Update particles ──
        const posAttr = particleGeometry.getAttribute('position');
        const colAttr = particleGeometry.getAttribute('aColor');
        const sizeAttr = particleGeometry.getAttribute('aSize');
        const alphaAttr = particleGeometry.getAttribute('aAlpha');

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Idle float
            p.phase += p.floatSpeed * 0.016;
            const floatX = Math.sin(p.phase) * p.floatAmp;
            const floatY = Math.cos(p.phase * 0.7) * p.floatAmp;

            let excited = false;

            for (const hand of handState.hands) {
                const dx = p.x - hand.palmX;
                const dy = p.y - hand.palmY;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                if (hand.gesture === GESTURE.OPEN && dist < CONFIG.repulsionRadius) {
                    // ── REPULSION (open palm) ──
                    const force = CONFIG.repulsionStrength * hand.openness * (1 - dist / CONFIG.repulsionRadius);
                    const angle = Math.atan2(dy, dx);
                    p.vx += Math.cos(angle) * force * dt;
                    p.vy += Math.sin(angle) * force * dt;
                    p.size = p.baseSize * (1 + (1 - dist / CONFIG.repulsionRadius) * 2.5 * hand.openness);
                    excited = true;
                    // Shift color toward cyan
                    p.color.lerp(new THREE.Color(0xff8c00), 0.05);
                } else if (hand.gesture === GESTURE.FIST && dist < CONFIG.attractionRadius) {
                    // ── ATTRACTION (fist) ──
                    const force = CONFIG.attractionStrength * (1 - dist / CONFIG.attractionRadius);
                    const angle = Math.atan2(dy, dx);
                    p.vx -= Math.cos(angle) * force * dt;
                    p.vy -= Math.sin(angle) * force * dt;
                    p.size = p.baseSize * (1 + (1 - dist / CONFIG.attractionRadius) * 1.5);
                    excited = true;
                    // Shift color toward purple
                    p.color.lerp(new THREE.Color(0xffd700), 0.05);
                } else if (hand.gesture === GESTURE.PINCH && dist < CONFIG.repulsionRadius * 0.8) {
                    // ── SPIRAL (pinch) ──
                    const force = 6 * (1 - dist / (CONFIG.repulsionRadius * 0.8));
                    const angle = Math.atan2(dy, dx);
                    // Tangential + slight outward
                    p.vx += (-Math.sin(angle) * force * 0.7 + Math.cos(angle) * force * 0.3) * dt;
                    p.vy += (Math.cos(angle) * force * 0.7 + Math.sin(angle) * force * 0.3) * dt;
                    p.size = p.baseSize * (1 + (1 - dist / (CONFIG.repulsionRadius * 0.8)) * 2);
                    excited = true;
                    // Shift color toward pink
                    p.color.lerp(new THREE.Color(0xff6b00), 0.05);
                }
            }

            // Two-hand energy field: particles between hands get excited
            if (twoHandsActive) {
                const h0 = handState.hands[0];
                const h1 = handState.hands[1];
                const midX = (h0.palmX + h1.palmX) / 2;
                const midY = (h0.palmY + h1.palmY) / 2;
                const handDist = Math.sqrt((h0.palmX - h1.palmX) ** 2 + (h0.palmY - h1.palmY) ** 2);
                const dxm = p.x - midX;
                const dym = p.y - midY;
                const distMid = Math.sqrt(dxm * dxm + dym * dym);

                if (distMid < handDist * 0.6) {
                    // Orbital force around midpoint
                    const angle = Math.atan2(dym, dxm);
                    const orbForce = 5 * (1 - distMid / (handDist * 0.6));
                    p.vx += -Math.sin(angle) * orbForce * dt;
                    p.vy += Math.cos(angle) * orbForce * dt;
                    p.size = p.baseSize * 2.5;
                    excited = true;
                    p.color.lerp(new THREE.Color(0xffab40), 0.08);
                }
            }

            if (!excited) {
                // Slowly return to base color
                p.color.lerp(p.baseColor, 0.02);
            }
            p.isExcited = excited;

            // Return to origin
            p.vx += (p.originX - p.x) * CONFIG.returnStrength * dt;
            p.vy += (p.originY - p.y) * CONFIG.returnStrength * dt;

            // Friction
            p.vx *= CONFIG.friction;
            p.vy *= CONFIG.friction;

            // Clamp speed
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > CONFIG.maxSpeed) {
                p.vx = (p.vx / speed) * CONFIG.maxSpeed;
                p.vy = (p.vy / speed) * CONFIG.maxSpeed;
            }

            // Integrate
            p.x += (p.vx + floatX) * dt;
            p.y += (p.vy + floatY) * dt;

            // Soft boundary
            const hw = window.innerWidth / 2 + 50;
            const hh = window.innerHeight / 2 + 50;
            if (p.x > hw) p.vx -= 0.5 * dt;
            if (p.x < -hw) p.vx += 0.5 * dt;
            if (p.y > hh) p.vy -= 0.5 * dt;
            if (p.y < -hh) p.vy += 0.5 * dt;

            // Size decay
            if (!excited) p.size += (p.baseSize - p.size) * 0.05;

            // Brightness
            const brightness = 0.35 + Math.min(0.65, speed * 0.06);

            // Update trail
            p.trail.pop();
            p.trail.unshift({ x: p.x, y: p.y });

            // Write main particle
            posAttr.array[i * 3] = p.x;
            posAttr.array[i * 3 + 1] = p.y;
            posAttr.array[i * 3 + 2] = p.z;
            colAttr.array[i * 3] = p.color.r;
            colAttr.array[i * 3 + 1] = p.color.g;
            colAttr.array[i * 3 + 2] = p.color.b;
            sizeAttr.array[i] = p.size;
            alphas[i] = brightness;

            // Write trail particles
            for (let t = 0; t < CONFIG.trailLength; t++) {
                const ti = i * CONFIG.trailLength + t;
                const trailAlpha = speed > 1 ? (1 - t / CONFIG.trailLength) * 0.4 * Math.min(1, speed * 0.1) : 0;
                trailPos[ti * 3] = p.trail[t].x;
                trailPos[ti * 3 + 1] = p.trail[t].y;
                trailPos[ti * 3 + 2] = p.z - 1;
                trailCol[ti * 3] = p.color.r;
                trailCol[ti * 3 + 1] = p.color.g;
                trailCol[ti * 3 + 2] = p.color.b;
                trailSiz[ti] = p.size * (1 - t / CONFIG.trailLength) * 0.6;
                trailAlp[ti] = trailAlpha;
            }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        trailGeo.getAttribute('position').needsUpdate = true;
        trailGeo.getAttribute('aColor').needsUpdate = true;
        trailGeo.getAttribute('aSize').needsUpdate = true;
        trailGeo.getAttribute('aAlpha').needsUpdate = true;

        // ── Palm glow ──
        for (let hi = 0; hi < 2; hi++) {
            const gm = glowMeshes[hi];
            const hand = handState.hands[hi];
            if (hand && hand.gesture !== GESTURE.NONE) {
                gm.position.x = hand.palmX;
                gm.position.y = hand.palmY;

                // Color by gesture
                const gestureColors = {
                    [GESTURE.OPEN]: new THREE.Color(0xff8c00),
                    [GESTURE.FIST]: new THREE.Color(0xffd700),
                    [GESTURE.PINCH]: new THREE.Color(0xff6b00),
                    [GESTURE.WEB]: new THREE.Color(0xe2e8f0),
                };
                const gc = gestureColors[hand.gesture] || new THREE.Color(0xff8c00);
                gm.material.uniforms.uColor.value.lerp(gc, 0.1);
                gm.material.uniforms.uPulse.value = time;

                const targetScale = hand.gesture === GESTURE.FIST ? 60 : 100 + hand.openness * 130;
                gm.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 0.12);
                const targetOpacity = hand.gesture === GESTURE.FIST ? 0.5 : 0.4 * hand.openness;
                gm.material.uniforms.uOpacity.value += (targetOpacity - gm.material.uniforms.uOpacity.value) * 0.1;
            } else {
                gm.material.uniforms.uOpacity.value *= 0.9;
                if (gm.material.uniforms.uOpacity.value < 0.01) gm.material.uniforms.uOpacity.value = 0;
            }
        }

        // ── Ripples (spawn for open palm and fist) ──
        rippleTimer += dt;
        if (rippleTimer > 5) {
            rippleTimer = 0;
            for (const hand of handState.hands) {
                if (hand.gesture === GESTURE.OPEN && hand.openness > 0.3) {
                    spawnRipple(hand.palmX, hand.palmY, hand.openness, new THREE.Color(0xff8c00));
                } else if (hand.gesture === GESTURE.FIST) {
                    spawnRipple(hand.palmX, hand.palmY, 0.5, new THREE.Color(0xffd700));
                }
            }
        }

        // ── Update ripples ──
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.life -= 0.02 * r.speed * dt;
            const progress = 1 - r.life;
            const scale = progress * r.maxScale;
            r.mesh.scale.set(scale, scale, 1);
            r.mesh.material.uniforms.uOpacity.value = r.life * 0.5;
            if (r.life <= 0) {
                r.mesh.visible = false;
                ripples.splice(i, 1);
            }
        }

        // ── Energy arc + energy ball between two hands ──
        if (twoHandsActive) {
            arcPoints.visible = true;
            const h0 = handState.hands[0];
            const h1 = handState.hands[1];
            const handDist = Math.sqrt((h0.palmX - h1.palmX) ** 2 + (h0.palmY - h1.palmY) ** 2);
            const midX = (h0.palmX + h1.palmX) / 2;
            const midY = (h0.palmY + h1.palmY) / 2;

            const aPosAttr = arcGeo.getAttribute('position');
            const aColAttr = arcGeo.getAttribute('aColor');
            const aAlpAttr = arcGeo.getAttribute('aAlpha');

            for (let s = 0; s < arcSegments; s++) {
                const t2 = s / (arcSegments - 1);
                const baseX = h0.palmX + (h1.palmX - h0.palmX) * t2;
                const baseY = h0.palmY + (h1.palmY - h0.palmY) * t2;
                const jitter = Math.sin(t2 * 12 + time * 20) * 15 + Math.cos(t2 * 8 + time * 15) * 10;
                const perpX = -(h1.palmY - h0.palmY);
                const perpY = (h1.palmX - h0.palmX);
                const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

                aPosAttr.array[s * 3] = baseX + (perpX / perpLen) * jitter;
                aPosAttr.array[s * 3 + 1] = baseY + (perpY / perpLen) * jitter;
                aPosAttr.array[s * 3 + 2] = 0;

                const colorT = Math.sin(t2 * Math.PI);
                const c = new THREE.Color(0xff8c00).lerp(new THREE.Color(0xffd700), colorT);
                aColAttr.array[s * 3] = c.r;
                aColAttr.array[s * 3 + 1] = c.g;
                aColAttr.array[s * 3 + 2] = c.b;

                const endFade = Math.sin(t2 * Math.PI);
                aAlpAttr.array[s] = endFade * 0.9;
            }
            aPosAttr.needsUpdate = true;
            aColAttr.needsUpdate = true;
            aAlpAttr.needsUpdate = true;

            // ── Energy ball: forms when hands are close ──
            const ballThreshold = 350; // px - starts forming
            const ballFullAt = 120;    // px - full intensity
            if (handDist < ballThreshold) {
                const closeness = 1 - Math.max(0, (handDist - ballFullAt) / (ballThreshold - ballFullAt));
                const ballRadius = 30 + closeness * 70; // grows as hands get closer
                energyBallTargetOpacity = 0.3 + closeness * 0.7;

                energyBall.position.x = midX;
                energyBall.position.y = midY;
                energyBall.scale.set(ballRadius, ballRadius, 1);

                ballRing.position.x = midX;
                ballRing.position.y = midY;
                const ringScale = ballRadius * (1.1 + Math.sin(time * 5) * 0.08);
                ballRing.scale.set(ringScale, ringScale, 1);
                ballRingMat.uniforms.uTime.value = time;
                ballRingMat.uniforms.uOpacity.value += (closeness * 0.6 - ballRingMat.uniforms.uOpacity.value) * 0.15;

                energyBallMat.uniforms.uTime.value = time;
                energyBallMat.uniforms.uIntensity.value += (closeness - energyBallMat.uniforms.uIntensity.value) * 0.1;

                // Spawn ripples from ball center
                if (rippleTimer <= 0 && closeness > 0.3) {
                    spawnRipple(midX, midY, closeness * 0.7, new THREE.Color(0xffab40));
                }
            } else {
                energyBallTargetOpacity = 0;
            }
        } else {
            arcPoints.visible = false;
            energyBallTargetOpacity = 0;
        }

        // ── Smooth energy ball opacity ──
        energyBallCurrentOpacity += (energyBallTargetOpacity - energyBallCurrentOpacity) * 0.12;
        energyBallMat.uniforms.uOpacity.value = energyBallCurrentOpacity;
        if (energyBallCurrentOpacity < 0.01) {
            energyBallCurrentOpacity = 0;
            ballRingMat.uniforms.uOpacity.value = 0;
        }

        // ── Lightning bolt for pinch ──
        const pinchHand = handState.hands.find(h => h.gesture === GESTURE.PINCH);
        if (pinchHand) {
            boltPoints.visible = true;
            const bPosAttr = boltGeo.getAttribute('position');
            const bColAttr = boltGeo.getAttribute('aColor');
            const bAlpAttr = boltGeo.getAttribute('aAlpha');

            for (let s = 0; s < boltSegments; s++) {
                const t2 = s / (boltSegments - 1);
                const baseX = pinchHand.thumbX + (pinchHand.indexX - pinchHand.thumbX) * t2;
                const baseY = pinchHand.thumbY + (pinchHand.indexY - pinchHand.thumbY) * t2;
                const jag = (Math.random() - 0.5) * 18 * Math.sin(t2 * Math.PI);

                const perpX = -(pinchHand.indexY - pinchHand.thumbY);
                const perpY = (pinchHand.indexX - pinchHand.thumbX);
                const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

                bPosAttr.array[s * 3] = baseX + (perpX / perpLen) * jag;
                bPosAttr.array[s * 3 + 1] = baseY + (perpY / perpLen) * jag;
                bPosAttr.array[s * 3 + 2] = 0;

                const c = new THREE.Color(0xff6b00).lerp(new THREE.Color(0xffffff), Math.random() * 0.3);
                bColAttr.array[s * 3] = c.r;
                bColAttr.array[s * 3 + 1] = c.g;
                bColAttr.array[s * 3 + 2] = c.b;
                bAlpAttr.array[s] = Math.sin(t2 * Math.PI) * 0.8;
            }
            bPosAttr.needsUpdate = true;
            bColAttr.needsUpdate = true;
            bAlpAttr.needsUpdate = true;
        } else {
            boltPoints.visible = false;
        }

        // ── Spiderman web strands ──
        const webHand = handState.hands.find(h => h.gesture === GESTURE.WEB);
        if (webHand) {
            if (!webActive) { webSeed = Math.random() * 1000; }
            webActive = true;
            webAnimProgress = Math.min(1, webAnimProgress + 0.08 * dt);
            webLines.visible = true;
            webDotPoints.visible = true;

            const wPosAttr = webGeo.getAttribute('position');
            const wColAttr = webGeo.getAttribute('color');
            const dPosAttr = webDotGeo.getAttribute('position');
            const dColAttr = webDotGeo.getAttribute('aColor');
            const dSizAttr = webDotGeo.getAttribute('aSize');

            const aimLen = Math.sqrt(webHand.aimDirX ** 2 + webHand.aimDirY ** 2) || 1;
            const aimX = webHand.aimDirX / aimLen;
            const aimY = webHand.aimDirY / aimLen;
            const webLength = 400 * webAnimProgress;

            for (let s = 0; s < WEB_STRANDS; s++) {
                // Fan strands around aim direction
                const spreadAngle = (s / (WEB_STRANDS - 1) - 0.5) * 0.7; // ±0.35 rad spread
                const baseAngle = Math.atan2(aimY, aimX);
                const strandAngle = baseAngle + spreadAngle;
                const dirX = Math.cos(strandAngle);
                const dirY = Math.sin(strandAngle);
                // Perpendicular for sag
                const perpSagX = -dirY;
                const perpSagY = dirX;
                const strandRand = Math.sin(webSeed + s * 7.3) * 0.5 + 0.5;

                let prevX = webHand.wristX;
                let prevY = webHand.wristY;

                for (let seg = 0; seg < WEB_SEGS; seg++) {
                    const t = (seg + 1) / WEB_SEGS;
                    const segProgress = Math.min(1, webAnimProgress * 1.5 - t * 0.3);
                    if (segProgress <= 0) {
                        // Not yet animated — collapse to wrist
                        const li = (s * WEB_SEGS + seg) * 2;
                        wPosAttr.array[li * 3] = prevX; wPosAttr.array[li * 3 + 1] = prevY; wPosAttr.array[li * 3 + 2] = 0;
                        wPosAttr.array[(li + 1) * 3] = prevX; wPosAttr.array[(li + 1) * 3 + 1] = prevY; wPosAttr.array[(li + 1) * 3 + 2] = 0;
                        wColAttr.array[li * 3] = 0; wColAttr.array[(li + 1) * 3] = 0;
                        const di = s * WEB_SEGS + seg;
                        dPosAttr.array[di * 3] = prevX; dPosAttr.array[di * 3 + 1] = prevY;
                        dSizAttr.array[di] = 0;
                        continue;
                    }

                    const dist = t * webLength;
                    // Sag: gravity-like droop, more at middle of strand
                    const sagAmount = Math.sin(t * Math.PI) * 15 * (1 + strandRand);
                    // Slight jitter for organic feel
                    const jitter = Math.sin(time * 3 + seg * 2.1 + s * 4.7) * 3;

                    const nx = webHand.wristX + dirX * dist + perpSagX * (sagAmount + jitter);
                    const ny = webHand.wristY + dirY * dist + perpSagY * (sagAmount + jitter);

                    // Line segment from prev to current
                    const li = (s * WEB_SEGS + seg) * 2;
                    wPosAttr.array[li * 3] = prevX;
                    wPosAttr.array[li * 3 + 1] = prevY;
                    wPosAttr.array[li * 3 + 2] = 0;
                    wPosAttr.array[(li + 1) * 3] = nx;
                    wPosAttr.array[(li + 1) * 3 + 1] = ny;
                    wPosAttr.array[(li + 1) * 3 + 2] = 0;

                    // White/silver color with slight blue tint fading along strand
                    const brightness = 0.85 - t * 0.25;
                    wColAttr.array[li * 3] = brightness;
                    wColAttr.array[li * 3 + 1] = brightness;
                    wColAttr.array[li * 3 + 2] = brightness + 0.1;
                    wColAttr.array[(li + 1) * 3] = brightness * 0.9;
                    wColAttr.array[(li + 1) * 3 + 1] = brightness * 0.9;
                    wColAttr.array[(li + 1) * 3 + 2] = brightness * 0.9 + 0.08;

                    // Dot at junction
                    const di = s * WEB_SEGS + seg;
                    dPosAttr.array[di * 3] = nx;
                    dPosAttr.array[di * 3 + 1] = ny;
                    dPosAttr.array[di * 3 + 2] = 0;
                    dColAttr.array[di * 3] = 0.9; dColAttr.array[di * 3 + 1] = 0.92; dColAttr.array[di * 3 + 2] = 1.0;
                    dSizAttr.array[di] = (seg % 3 === 0) ? 5 : 2.5; // bigger nodes at intersections

                    prevX = nx;
                    prevY = ny;
                }
            }
            wPosAttr.needsUpdate = true;
            wColAttr.needsUpdate = true;
            dPosAttr.needsUpdate = true;
            dColAttr.needsUpdate = true;
            dSizAttr.needsUpdate = true;
        } else {
            if (webActive) {
                webAnimProgress -= 0.06 * dt;
                if (webAnimProgress <= 0) {
                    webAnimProgress = 0;
                    webActive = false;
                    webLines.visible = false;
                    webDotPoints.visible = false;
                }
            }
        }

        // ── Hand skeleton rendering ──
        const skelPosAttr = skelGeo.getAttribute('position');
        const skelColAttr = skelGeo.getAttribute('color');
        const jPosAttr = jointGeo.getAttribute('position');
        const jColAttr = jointGeo.getAttribute('aColor');
        const jSizAttr = jointGeo.getAttribute('aSize');

        // Reset all to invisible
        for (let i = 0; i < skelTotal * 3; i++) skelPosAttr.array[i] = 0;
        for (let i = 0; i < skelTotal * 3; i++) skelColAttr.array[i] = 0;
        for (let i = 0; i < jointTotal * 3; i++) jPosAttr.array[i] = 0;
        for (let i = 0; i < jointTotal; i++) jSizAttr.array[i] = 0;

        for (let hi = 0; hi < handState.rawLandmarks.length && hi < 2; hi++) {
            const landmarks = handState.rawLandmarks[hi];
            const hand = handState.hands[hi];
            const skelColor = hand.gesture === GESTURE.OPEN
                ? new THREE.Color(0xff8c00)
                : hand.gesture === GESTURE.FIST
                    ? new THREE.Color(0xffd700)
                    : hand.gesture === GESTURE.PINCH
                        ? new THREE.Color(0xff6b00)
                        : hand.gesture === GESTURE.WEB
                            ? new THREE.Color(0xe2e8f0)
                            : new THREE.Color(0xcc8844);

            // Lines
            for (let ci = 0; ci < HAND_CONNECTIONS.length; ci++) {
                const [a, b] = HAND_CONNECTIONS[ci];
                const pa = lmToScreen(landmarks[a]);
                const pb = lmToScreen(landmarks[b]);
                const idx = (hi * skelPointsPerHand + ci * 2) * 3;
                skelPosAttr.array[idx] = pa.x;
                skelPosAttr.array[idx + 1] = pa.y;
                skelPosAttr.array[idx + 2] = 0;
                skelPosAttr.array[idx + 3] = pb.x;
                skelPosAttr.array[idx + 4] = pb.y;
                skelPosAttr.array[idx + 5] = 0;

                skelColAttr.array[idx] = skelColor.r;
                skelColAttr.array[idx + 1] = skelColor.g;
                skelColAttr.array[idx + 2] = skelColor.b;
                skelColAttr.array[idx + 3] = skelColor.r;
                skelColAttr.array[idx + 4] = skelColor.g;
                skelColAttr.array[idx + 5] = skelColor.b;
            }

            // Joints
            for (let ji = 0; ji < 21; ji++) {
                const pos = lmToScreen(landmarks[ji]);
                const jIdx = (hi * 21 + ji);
                jPosAttr.array[jIdx * 3] = pos.x;
                jPosAttr.array[jIdx * 3 + 1] = pos.y;
                jPosAttr.array[jIdx * 3 + 2] = 0;
                jColAttr.array[jIdx * 3] = skelColor.r;
                jColAttr.array[jIdx * 3 + 1] = skelColor.g;
                jColAttr.array[jIdx * 3 + 2] = skelColor.b;
                // Tips = bigger dots
                const isTip = [4, 8, 12, 16, 20].includes(ji);
                jSizAttr.array[jIdx] = isTip ? 10 : 6;
            }
        }

        skelPosAttr.needsUpdate = true;
        skelColAttr.needsUpdate = true;
        jPosAttr.needsUpdate = true;
        jColAttr.needsUpdate = true;
        jSizAttr.needsUpdate = true;

        renderer.render(scene, camera);
    }

    // ─── RESIZE ───────────────────────────────────
    window.addEventListener('resize', () => {
        const w = window.innerWidth;
        const h = window.innerHeight;

        camera.left = -w / 2;
        camera.right = w / 2;
        camera.top = h / 2;
        camera.bottom = -h / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);

        vignetteMat.uniforms.uResolution.value.set(w, h);
        vignetteMesh.geometry.dispose();
        vignetteMesh.geometry = new THREE.PlaneGeometry(w, h);

        if (webcamMesh) {
            webcamMesh.geometry.dispose();
            webcamMesh.geometry = new THREE.PlaneGeometry(w, h);
        }
    });

    // ─── INIT ─────────────────────────────────────
    initMediaPipe();
    animate();
})();
