import { useFrame } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { HandData } from '../../utils/handStore';

const RING_RADIUS = 1.5;
// Slightly larger geometry to close gap with particles (was 0.9)
const MESH_RADIUS_FACTOR = 0.94;

// Fragment Shader for Soft Vignette
const fragmentShader = `
  uniform sampler2D map;
  uniform float opacity;
  uniform float uTime;
  varying vec2 vUv;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec4 texColor = texture2D(map, vUv);
    
    vec2 center = vec2(0.5);
    vec2 p = vUv - center;
    float dist = length(p);

    // Calculate angle for polar noise
    float angle = atan(p.y, p.x);

    // Animated Noise
    // We add noise to the distance field
    float noiseVal = snoise(vec2(angle * 4.0, uTime * 2.0 + dist * 5.0));
    float distortion = noiseVal * 0.03; // Amplitude of the "flames"
    
    float noisyDist = dist + distortion;

    // Edge gradient
    // 0.45 is base radius, fade out to 0.48
    // With noise, it will wobble
    float alpha = 1.0 - smoothstep(0.42, 0.48, noisyDist);

    // Core visibility (optional: keeps center clear of noise artifacts if any)
    float core = 1.0 - smoothstep(0.48, 0.5, noisyDist);
    
    float finalAlpha = texColor.a * alpha * opacity;

    // Tint edges slightly orange for "fire" feel
    vec3 color = texColor.rgb;
    // Edge detection for coloring
    float edge = smoothstep(0.4, 0.48, noisyDist);
    color += vec3(0.5, 0.2, 0.0) * edge * 2.0;

    gl_FragColor = vec4(color, finalAlpha);
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
        const isFist = HandData.isFist;

        if (rawIsGesturing && !isFist) {
            s.stabilityScore += delta * 2.5;
        } else {
            // Instant decay
            const decay = isFist ? 10.0 : 4.0;
            s.stabilityScore -= delta * decay;
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
            portalMaterialRef.current.uniforms.uTime.value = stateRef.current.stabilityScore + performance.now() / 1000;
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
                <circleGeometry args={[RING_RADIUS * MESH_RADIUS_FACTOR, 64]} />
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
                        opacity: { value: 0 },
                        uTime: { value: 0 }
                    }}
                />
            </mesh>
        </group>
    );
}
