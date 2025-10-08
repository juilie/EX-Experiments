import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Post-processing imports removed

export class MarchingCubesScene {
    constructor(container) {
        this.container = container;
        this.camera = null;
        this.scene = null;
        this.renderer = null;
        // Post-processing variables removed
        this.group = null;
        this.effect = null;
        this.materials = null;
        this.current_material = 'plastic';
        this.resolution = 28;
        this.effectController = null;
        this.time = 0;
        this.clock = new THREE.Clock();
        this.light = null;
        this.pointLight = null;
        this.ambientLight = null;
        
        this.init();
    }

    generateMaterials() {
        // environment map
        const path = 'swedish/';
        const format = '.png';
        const urls = [
            path + 'px' + format, path + 'nx' + format,
            path + 'py' + format, path + 'ny' + format,
            path + 'pz' + format, path + 'nz' + format
        ];

        const cubeTextureLoader = new THREE.CubeTextureLoader();
        const reflectionCube = cubeTextureLoader.load(urls);
        const refractionCube = cubeTextureLoader.load(urls);
        refractionCube.mapping = THREE.CubeRefractionMapping;

        // Using default texture instead of external file
        const texture = new THREE.Texture();

        // toon-like materials using built-in shaders
        const toonMaterial1 = new THREE.MeshToonMaterial({ color: 0x9c0000 });
        const toonMaterial2 = new THREE.MeshToonMaterial({ color: 0x0066cc });
        const hatchingMaterial = new THREE.MeshToonMaterial({ color: 0xffffff });
        const dottedMaterial = new THREE.MeshToonMaterial({ color: 0x00ff00 });

        const materials = {
            'shiny': new THREE.MeshStandardMaterial({ color: 0x9c0000, envMap: reflectionCube, roughness: 0.1, metalness: 1.0 }),
            'chrome': new THREE.MeshLambertMaterial({ color: 0xffffff, envMap: reflectionCube }),
            'liquid': new THREE.MeshLambertMaterial({ color: 0xffffff, envMap: refractionCube, refractionRatio: 0.85 }),
            'matte': new THREE.MeshPhongMaterial({ specular: 0x494949, shininess: 1 }),
            'flat': new THREE.MeshLambertMaterial({ /*TODO flatShading: true */ }),
            'textured': new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 1 }),
            'colors': new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 2, vertexColors: true }),
            'multiColors': new THREE.MeshPhongMaterial({ shininess: 2, vertexColors: true }),
            'plastic': new THREE.MeshPhongMaterial({ specular: 0xc1c1c1, shininess: 250 }),
            'toon1': toonMaterial1,
            'toon2': toonMaterial2,
            'hatching': hatchingMaterial,
            'dotted': dottedMaterial
        };

        return materials;
    }

    updateCubes(object, time, numblobs, floor, wallx, wallz) {
        object.reset();

        // fill the field with some metaballs
        const rainbow = [
            new THREE.Color(0xff0000),
            new THREE.Color(0xffbb00),
            new THREE.Color(0xffff00),
            new THREE.Color(0x00ff00),
            new THREE.Color(0x0000ff),
            new THREE.Color(0x9400bd),
            new THREE.Color(0xc800eb)
        ];
        const subtract = 12;
        const strength = 1.2 / ((Math.sqrt(numblobs) - 1) / 4 + 1);

        for (let i = 0; i < numblobs; i++) {
            const ballx = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
            const bally = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77; // dip into the floor
            const ballz = Math.cos(i + 1.32 * time * 0.1 * Math.sin((0.92 + 0.53 * i))) * 0.27 + 0.5;

            if (this.current_material === 'multiColors') {
                object.addBall(ballx, bally, ballz, strength, subtract, rainbow[i % 7]);
            } else {
                object.addBall(ballx, bally, ballz, strength, subtract);
            }
        }

        if (floor) object.addPlaneY(2, 12);
        if (wallz) object.addPlaneZ(2, 12);
        if (wallx) object.addPlaneX(2, 12);

        object.update();
    }

    setupGui() {
        // Configure defaults without showing any GUI
        this.effectController = {
            material: 'plastic',
            speed: 0.8,
            numBlobs: 8,
            resolution: 24,
            isolation: 70,
            floor: false,
            wallx: false,
            wallz: false,
            dummy: function() {}
        };
    }

    init() {
        const width = document.documentElement.clientWidth;
        const height = document.documentElement.clientHeight;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        this.renderer.setClearColor(0x000000, 0); // Transparent to reveal cloud background
        this.renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 1.5)));
        this.renderer.setSize(width, height);
        this.renderer.setAnimationLoop(() => this.animate());
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
        this.camera.position.set(-500, 500, 1500);

        this.scene = new THREE.Scene();
        this.scene.background = null; // Keep transparent so clouds show through

        // CONTROLS
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.minDistance = 500;
        controls.maxDistance = 5000;

        this.group = new THREE.Object3D();
        this.scene.add(this.group);

        // Lighting for marching cubes - cooler tones
        this.light = new THREE.DirectionalLight(0xffffff, 2);
        this.light.position.set(0.5, 0.5, 1);
        this.scene.add(this.light);

        this.pointLight = new THREE.PointLight(0x4a90e2, 2, 0, 0); // Cool blue instead of orange
        this.pointLight.position.set(0, 0, 100);
        // this.scene.add(this.pointLight);

        this.ambientLight = new THREE.AmbientLight(0x1a1a2e, 1.5); // Cool dark blue ambient
        this.scene.add(this.ambientLight);

        // MARCHING CUBES SETUP
        this.materials = this.generateMaterials();
        this.current_material = 'plastic';

        this.resolution = 24;
        this.effect = new MarchingCubes(this.resolution, this.materials[this.current_material], true, true, 100000);
        this.effect.position.set(0, 0, 0);
        this.effect.scale.set(650, 650, 650);

        this.effect.enableUvs = false;
        this.effect.enableColors = false;

        this.scene.add(this.effect);

        // Setup GUI
        this.setupGui();

        // Post-processing setup removed - using direct rendering

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        const width = document.documentElement.clientWidth || 1;
        const height = document.documentElement.clientHeight || 1;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        this.render();
    }

    render() {
        const delta = this.clock.getDelta();
        this.time += delta * this.effectController.speed * 0.5;

        // Update marching cubes
        if (this.effectController.resolution !== this.resolution) {
            this.resolution = this.effectController.resolution;
            this.effect.init(Math.floor(this.resolution));
        }

        if (this.effectController.isolation !== this.effect.isolation) {
            this.effect.isolation = this.effectController.isolation;
        }

        this.updateCubes(
            this.effect, 
            this.time, 
            this.effectController.numBlobs, 
            this.effectController.floor, 
            this.effectController.wallx, 
            this.effectController.wallz
        );

        this.renderer.render(this.scene, this.camera);
    }

    // Public method to get the renderer for external use
    getRenderer() {
        return this.renderer;
    }

    // Public method to get the scene for external use
    getScene() {
        return this.scene;
    }
}
