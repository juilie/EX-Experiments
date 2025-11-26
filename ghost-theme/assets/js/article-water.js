// Water Background Implementation for article pages
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

(function() {
    // Check WebGL support
                function checkWebGLSupport() {
                    try {
                        const canvas = document.createElement('canvas');
                        return !!(window.WebGLRenderingContext && 
                            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
                    } catch (e) {
                        return false;
                    }
                }
                
                if (!checkWebGLSupport()) {
                    console.log('WebGL not supported, skipping water background');
                    return;
                }

                // Water simulation parameters
                var WIDTH = 128;
                var BOUNDS = 800; // Smaller water surface for better zoom
                var BOUNDS_HALF = BOUNDS * 0.5;

                var container, camera, scene, renderer;
                var waterMesh, gpuCompute, heightmapVariable, waterUniforms;
                // SimplexNoise - loaded from CDN script tag in post.hbs
                // This assumes THREE.SimplexNoise is available globally
                var simplex = new THREE.SimplexNoise();
                var mouseCoords = new THREE.Vector2();
                var mouseMoved = false;
                var frameCount = 0;

                init();
                animate();

                function init() {
                    container = document.getElementById('water-canvas');
                    
                    // Camera positioned to look directly at water surface
                    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 3000);
                    camera.position.set(0, 0, 400); // Positioned behind the water plane
                    camera.lookAt(0, 0, -100); // Look at the water surface

                    scene = new THREE.Scene();
                    scene.background = new THREE.Color(0xffffff); // Dark blue background

                    // Lighting for water
                    var ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
                    scene.add(ambientLight);

                    var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
                    directionalLight.position.set(1, 1, 1);
                    scene.add(directionalLight);

                    renderer = new THREE.WebGLRenderer({ 
                        canvas: container,
                        alpha: true,
                        antialias: true 
                    });
                    renderer.setClearColor(0x001122, 0.3);
                    renderer.setPixelRatio(window.devicePixelRatio);
                    renderer.setSize(window.innerWidth, window.innerHeight);

                    initWater();

                    // Add mouse interaction
                    document.addEventListener('mousemove', onDocumentMouseMove, false);
                    document.addEventListener('touchmove', onDocumentTouchMove, false);

                    window.addEventListener('resize', onWindowResize, false);
                }

                function initWater() {
                    var materialColor = 0xffffff;

                    var geometry = new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);

                    // Water material using the extracted shaders
                    var material = new THREE.ShaderMaterial({
                        uniforms: {
                            heightmap: { value: null },
                            colorNum: { value: 4.0 },
                            pixelSize: { value: 2.0 },
                            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                            diffuse: { value: new THREE.Color(0xf0fbff) },
                            opacity: { value: 1.0 },
                            emissive: { value: new THREE.Color(0x000000) },
                            specular: { value: new THREE.Color(0x111111) },
                            shininess: { value: 80.0 }
                        },
                        vertexShader: `uniform sampler2D heightmap;
			#define PHONG
			varying vec3 vViewPosition;
			#ifndef FLAT_SHADED
				varying vec3 vNormal;
			#endif
			#include <common>
			#include <uv_pars_vertex>
			#include <uv2_pars_vertex>
			#include <displacementmap_pars_vertex>
			#include <envmap_pars_vertex>
			#include <color_pars_vertex>
			#include <morphtarget_pars_vertex>
			#include <skinning_pars_vertex>
			#include <shadowmap_pars_vertex>
			#include <logdepthbuf_pars_vertex>
			#include <clipping_planes_pars_vertex>
			void main() {
				vec2 cellSize = vec2( 1.0 / WIDTH, 1.0 / WIDTH );
				#include <uv_vertex>
				#include <uv2_vertex>
				#include <color_vertex>
				vec3 objectNormal = vec3(
					( texture2D( heightmap, uv + vec2( - cellSize.x, 0 ) ).x - texture2D( heightmap, uv + vec2( cellSize.x, 0 ) ).x ) * WIDTH / BOUNDS,
					( texture2D( heightmap, uv + vec2( 0, - cellSize.y ) ).x - texture2D( heightmap, uv + vec2( 0, cellSize.y ) ).x ) * WIDTH / BOUNDS,
					1.0 );
				#include <morphnormal_vertex>
				#include <skinbase_vertex>
				#include <skinnormal_vertex>
				#include <defaultnormal_vertex>
			#ifndef FLAT_SHADED
				vNormal = normalize( transformedNormal );
			#endif
				float heightValue = texture2D( heightmap, uv ).x;
				vec3 transformed = vec3( position.x, position.y, heightValue );
				#include <displacementmap_vertex>
				#include <morphtarget_vertex>
				#include <skinning_vertex>
				#include <project_vertex>
				#include <logdepthbuf_vertex>
				#include <clipping_planes_vertex>
				vViewPosition = - mvPosition.xyz;
				#include <worldpos_vertex>
				#include <envmap_vertex>
				#include <shadowmap_vertex>
			}`,
                        fragmentShader: `uniform float colorNum;
			uniform float pixelSize;
			uniform vec2 resolution;
			uniform vec3 diffuse;
			uniform float opacity;
			uniform vec3 emissive;
			uniform vec3 specular;
			uniform float shininess;
			
			varying vec3 vViewPosition;
			varying vec3 vNormal;
			
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

            vec3 dither(vec2 screenPos, vec3 color) {
                int x = int(mod(screenPos.x, 8.0));
                int y = int(mod(screenPos.y, 8.0));
                float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
                
                color.rgb += threshold * 0.5;
                color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
                color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
                color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
                return color;
            }

			void main() {
				// Basic Phong lighting calculation
				vec3 normal = normalize(vNormal);
				vec3 viewDir = normalize(vViewPosition);
				
				// Simple lighting
				vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
				float diff = max(dot(normal, lightDir), 0.0);
				float spec = pow(max(dot(normal, normalize(lightDir + viewDir)), 0.0), shininess);
				
				vec3 diffuseColor = diffuse * diff;
				vec3 specularColor = specular * spec;
				vec3 finalColor = diffuseColor + specularColor + emissive;
				
				// Apply dithering effect
				vec2 uv = gl_FragCoord.xy / resolution.xy;
				vec2 pixelatedCoord = floor(gl_FragCoord.xy / pixelSize) * pixelSize;
finalColor = dither(pixelatedCoord, finalColor);
				
				gl_FragColor = vec4(finalColor, opacity);
			}`
                    });

                    material.transparent = true;

                    // Defines
                    material.defines.WIDTH = WIDTH.toFixed(1);
                    material.defines.BOUNDS = BOUNDS.toFixed(1);

                    waterUniforms = material.uniforms;

                    waterMesh = new THREE.Mesh(geometry, material);
                    waterMesh.rotation.x = 0; // No rotation - plane parallel to X/Y axes
                    waterMesh.position.z = -100; // Position water in front of camera on Z-axis
                    waterMesh.matrixAutoUpdate = false;
                    waterMesh.updateMatrix();

                    scene.add(waterMesh);

                    // GPU computation setup
                    // GPUComputationRenderer loaded from CDN script tag in post.hbs
                    gpuCompute = new THREE.GPUComputationRenderer(WIDTH, WIDTH, renderer);

                    var heightmap0 = gpuCompute.createTexture();
                    fillTexture(heightmap0);

                    heightmapVariable = gpuCompute.addVariable(
                        "heightmap", 
                        `#include <common>
			uniform vec2 mousePos;
			uniform float mouseSize;
			uniform float viscosityConstant;
			#define deltaTime ( 1.0 / 60.0 )
			#define GRAVITY_CONSTANT ( resolution.x * deltaTime * 1.0 )
			void main()	{
				vec2 cellSize = 1.0 / resolution.xy;
				vec2 uv = gl_FragCoord.xy * cellSize;
				vec4 heightmapValue = texture2D( heightmap, uv );
				vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
				vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
				vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
				vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );
				float sump = north.x + south.x + east.x + west.x - 4.0 * heightmapValue.x;
				float accel = sump * GRAVITY_CONSTANT;
				heightmapValue.y += accel;
				heightmapValue.x += heightmapValue.y * deltaTime;
				heightmapValue.x += sump * viscosityConstant;
				float mousePhase = clamp( length( ( uv - vec2( 0.5 ) ) * BOUNDS - vec2( mousePos.x, - mousePos.y ) ) * PI / mouseSize, 0.0, PI );
				heightmapValue.x += cos( mousePhase ) + 1.0;
				gl_FragColor = heightmapValue;
			}`, 
                        heightmap0
                    );

                    gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

                    heightmapVariable.material.uniforms.mousePos = { value: new THREE.Vector2(10000, 10000) };
                    heightmapVariable.material.uniforms.mouseSize = { value: 50.0 }; // Larger mouse effect
                    heightmapVariable.material.uniforms.viscosityConstant = { value: 0.05 }; // More viscosity to slow down waves
                    heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

                    var error = gpuCompute.init();
                    if (error !== null) {
                        console.error('GPU computation error:', error);
                    }
                }

                function fillTexture(texture) {
                    var waterMaxHeight = 10;

                    function noise(x, y, z) {
                        var multR = waterMaxHeight;
                        var mult = 0.025;
                        var r = 0;
                        for (var i = 0; i < 15; i++) {
                            r += multR * simplex.noise3d(x * mult, y * mult, z * mult);
                            multR *= 0.53 + 0.025 * i;
                            mult *= 1.25;
                        }
                        return r;
                    }

                    var pixels = texture.image.data;
                    var p = 0;
                    for (var j = 0; j < WIDTH; j++) {
                        for (var i = 0; i < WIDTH; i++) {
                            var x = i * 128 / WIDTH;
                            var y = j * 128 / WIDTH;

                            pixels[p + 0] = noise(x, y, 123.4);
                            pixels[p + 1] = 0;
                            pixels[p + 2] = 0;
                            pixels[p + 3] = 1;

                            p += 4;
                        }
                    }
                }

                function onWindowResize() {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                    // Update resolution uniform for dithering
                    if (waterUniforms && waterUniforms.resolution) {
                        waterUniforms.resolution.value.set(window.innerWidth, window.innerHeight);
                    }
                }

                function animate() {
                    requestAnimationFrame(animate);
                    frameCount++;
                    // Slow down the animation by only updating every 3rd frame
                    if (frameCount % 3 === 0) {
                        render();
                    }
                }

                function onDocumentMouseMove(event) {
                    mouseCoords.set(
                        (event.clientX / window.innerWidth) * 2 - 1,
                        (event.clientY / window.innerHeight) * 2 - 1  // Keep original Y coordinate
                    );
                    mouseMoved = true;
                }

                function onDocumentTouchMove(event) {
                    if (event.touches.length === 1) {
                        event.preventDefault();
                        mouseCoords.set(
                            (event.touches[0].pageX / window.innerWidth) * 2 - 1,
                            (event.touches[0].pageY / window.innerHeight) * 2 - 1  // Keep original Y coordinate
                        );
                        mouseMoved = true;
                    }
                }

                function render() {
                    // Update mouse position for water interaction
                    if (mouseMoved) {
                        // Convert screen coordinates to world coordinates on the water plane
                        // Use raycasting to properly project mouse position onto the water plane
                        var raycaster = new THREE.Raycaster();
                        raycaster.setFromCamera(mouseCoords, camera);
                        
                        // Create a plane at the water's Z position
                        var waterPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 100); // Normal pointing towards camera, distance 100
                        var intersectionPoint = new THREE.Vector3();
                        
                        if (raycaster.ray.intersectPlane(waterPlane, intersectionPoint)) {
                            // Convert world coordinates to water texture coordinates
                            var worldX = intersectionPoint.x;
                            var worldY = intersectionPoint.y;
                            heightmapVariable.material.uniforms.mousePos.value.set(worldX, worldY);
                        }
                        mouseMoved = false;
                    } else {
                        // Reset mouse position when not moving
                        heightmapVariable.material.uniforms.mousePos.value.set(10000, 10000);
                    }

                    // Do the GPU computation
                    gpuCompute.compute();
                    
                    // Get compute output
                    waterUniforms.heightmap.value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
                    
                    // Render the scene
                    renderer.render(scene, camera);
                }
            })();