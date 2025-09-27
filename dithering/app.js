import { 
    OrbitControls,
    OrthographicCamera,
    useFBO,
  } from "@react-three/drei";
  import { Canvas, useFrame, useThree } from "@react-three/fiber";
  import { wrapEffect, EffectComposer } from "@react-three/postprocessing";
  import { useControls } from "leva";
  import { Effect } from "postprocessing";
  import { Suspense, useRef, useState } from "react";
  import * as THREE from "three";
  import { v4 as uuidv4 } from "uuid";
  
  import fragmentShader from "!!raw-loader!./fragmentShader.glsl";
  import waveVertexShader from "!!raw-loader!./waveVertexShader.glsl";
  import waveFragmentShader from "!!raw-loader!./waveFragmentShader.glsl";
  import './scene.css';
  
  const DPR = 1;
  
  class RetroEffectImpl extends Effect {
    constructor() {
      const uniforms = new Map([
        ["colorNum", new THREE.Uniform(4.0)],
        ["pixelSize", new THREE.Uniform(2.0)],
      ]);
  
      super("RetroEffect", fragmentShader, {
        uniforms,
      });
  
      this.uniforms = uniforms;
    }
  
    set colorNum(value) {
      this.uniforms.get("colorNum").value = value;
    }
  
    get colorNum() {
      return this.uniforms.get("colorNum").value;
    }
  
    set pixelSize(value) {
      this.uniforms.get("pixelSize").value = value;
    }
  
    get pixelSize() {
      return this.uniforms.get("pixelSize").value;
    }
  }
  
  const RetroEffect = wrapEffect(RetroEffectImpl);
  
  const DitheredWaves = () => {
    const mesh = useRef();
    const effect = useRef();
  
    const { viewport } = useThree();
  
    const uniforms = {
      time: {
        value: 0.0,
      },
      resolution: new THREE.Uniform(new THREE.Vector2()),
    };
  
    useFrame((state) => {
      const { clock } = state;
      mesh.current.material.uniforms.time.value = clock.getElapsedTime();
      mesh.current.material.uniforms.resolution.value = new THREE.Vector2(
        window.innerWidth * DPR,
        window.innerHeight * DPR
      );
    })
  
    return (
      <>
        <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            key={uuidv4()}
            fragmentShader={waveFragmentShader}
            vertexShader={waveVertexShader}
            uniforms={uniforms}
            wireframe={false}
          />
          {/* <meshBasicMaterial color="black" /> */}
        </mesh>
        <EffectComposer>
          <RetroEffect ref={effect} />
        </EffectComposer>
      </>
    );
  };
  
  const Scene = () => {
    return (
      <Canvas shadows camera={{ position: [0, 0, 6] }} dpr={[1, 2]}>
        <DitheredWaves />
      </Canvas>
    );
  };
  
  
  export default Scene;