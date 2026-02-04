import { useFrame } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { HandData } from '../../utils/handStore';

const RING_RADIUS = 1.5;

// Fragment Shader for Soft Vignette
const fragmentShader = `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(map, vUv);
    
    // Distance from center (0.5, 0.5)
    float dist = distance(vUv, vec2(0.5));
    
    // Wider Gradient
    // Start fading early at 0.2, gone by 0.5. Very soft.
    float alpha = 1.0 - smoothstep(0.2, 0.49, dist);
    
    // Apply opacity
    float finalAlpha = texColor.a * alpha * opacity;
    
    gl_FragColor = vec4(texColor.rgb, finalAlpha);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function Portal() {
    const groupRef = useRef<THREE.Group>(null);
    const portalMaterialRef = useRef<THREE.ShaderMaterial>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);

    const stateRef = useRef({
        progress: 0,
        isOpen: false,
        stabilityScore: 0
    });

    useEffect(() => {
        const vid = document.createElement('video');
        vid.src = '/videos/m2-res_720p.mp4';
        vid.crossOrigin = 'Anonymous';
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.play().catch(e => console.warn("Video autoplay failed", e));

        const texture = new THREE.VideoTexture(vid);
        setVideoTexture(texture);
        videoRef.current = vid;

        return () => {
            vid.pause();
            vid.remove();
            texture.dispose();
        }
    }, []);

    useFrame((_, delta) => {
        const s = stateRef.current;

        // Stability Logic matches Starfield
        const rawIsGesturing = HandData.isGesturing && HandData.gestureScore > 0.15;

        if (rawIsGesturing) {
            s.stabilityScore += delta * 2.5;
        } else {
            // Instant decay
            s.stabilityScore -= delta * 4.0;
        }
        s.stabilityScore = Math.max(0, Math.min(2.0, s.stabilityScore));

        const shouldOpen = s.stabilityScore > 0.5;

        if (shouldOpen) {
            s.progress += delta * 0.6; // Match Starfield expansion
            if (s.progress > 0.95) s.isOpen = true;
        } else {
            // Instant Close
            s.progress -= delta * 3.0;
            if (s.progress < 0.1) s.isOpen = false;
        }

        s.progress = Math.max(0, Math.min(1.0, s.progress));

        if (groupRef.current) {
            const scale = s.progress;
            // Match expanding ring logic: if progress is low, it's small.
            groupRef.current.scale.set(scale, scale, scale);
            groupRef.current.visible = s.progress > 0.01;
        }

        if (portalMaterialRef.current) {
            // Fade in content
            const contentOpacity = THREE.MathUtils.smoothstep(s.progress, 0.4, 1.0);
            portalMaterialRef.current.uniforms.opacity.value = contentOpacity;
        }

        if (portalMaterialRef.current && videoTexture) {
            portalMaterialRef.current.uniforms.map.value = videoTexture;
        }

        if (videoRef.current) {
            if (s.progress > 0.1 && videoRef.current.paused) videoRef.current.play().catch(() => { });
            else if (s.progress <= 0.01 && !videoRef.current.paused) videoRef.current.pause();
        }
    });

    return (
        <group ref={groupRef} scale={[0, 0, 0]}>
            <mesh position={[0, 0, -0.1]}>
                <circleGeometry args={[RING_RADIUS * 0.9, 64]} />
                <shaderMaterial
                    ref={portalMaterialRef}
                    vertexShader={vertexShader}
                    fragmentShader={fragmentShader}
                    transparent
                    depthWrite={false}
                    // Additive blending makes the video act like light
                    blending={THREE.AdditiveBlending}
                    uniforms={{
                        map: { value: null },
                        opacity: { value: 0 }
                    }}
                />
            </mesh>
        </group>
    );
}
