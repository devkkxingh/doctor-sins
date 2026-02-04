import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HandData } from '../../utils/handStore';
import type { Landmark } from '../../utils/handStore';

const PARTICLE_COUNT = 30000;

// Vertex shader
const vertexShader = `
  attribute float size;
  attribute vec3 targetPos;     
  attribute vec3 handPos;       
  
  uniform float uTime;
  uniform float uGather;        
  uniform float uHandMix;       
  
  varying float vGather;

  void main() {
    vGather = uGather;
    
    vec3 startPos = position;
    
    // Alive Universe: Flow
    float t = uTime * 0.5;
    
    startPos.x += sin(t + startPos.y * 0.1) * 0.5;
    startPos.y += cos(t * 0.8 + startPos.x * 0.1) * 0.5;
    startPos.z += sin(t * 0.5 + startPos.x * 0.1) * 0.2;
    
    // Interactive Hand Pos
    vec3 hPos = handPos;
    if (uHandMix > 0.0) {
        hPos.x += sin(t * 3.0 + position.y) * 0.02; 
        hPos.y += cos(t * 2.5 + position.x) * 0.02;
    }

    // Portal Ring Expansion
    // Synced with Portal Video Scale
    vec3 pPos = targetPos * uGather; 

    // Mix Sequence
    vec3 currentPos = mix(startPos, hPos, uHandMix);
    currentPos = mix(currentPos, pPos, uGather * uGather); 
    
    // Wobble
    if (uGather > 0.0 && uGather < 0.9) {
        float jitter = (1.0 - uGather) * 0.15; 
        currentPos += vec3(
            sin(uTime * 15.0 + position.y) * jitter,
            cos(uTime * 15.0 + position.x) * jitter,
            sin(uTime * 15.0) * jitter
        );
    }
    
    if (uGather > 0.9) {
         // Stable spin
         float rot = uTime * 0.2;
         float x = currentPos.x;
         float y = currentPos.y;
         float newX = x * cos(rot) - y * sin(rot);
         float newY = x * sin(rot) + y * cos(rot);
         
         currentPos.x = newX;
         currentPos.y = newY;
         
         currentPos += vec3(
            sin(uTime * 20.0 + position.y) * 0.02,
            cos(uTime * 20.0 + position.x) * 0.02,
            0.0
         );
    }

    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    
    float finalSize = size;
    finalSize *= (1.0 + uHandMix * 0.3 + uGather * 0.8); 
    
    gl_PointSize = finalSize * (30.0 / -mvPosition.z); 
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vGather;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float d = length(coord);
    if (d > 0.5) discard; 
    
    float strength = 1.0 - (d * 2.0);
    strength = pow(strength, 1.5);
    
    vec3 starColor = vec3(1.0, 1.0, 1.0); 
    vec3 portalColor = vec3(1.0, 0.9, 0.7); // Warm spark color
    
    vec3 finalColor = mix(starColor, portalColor, vGather);
    
    float alpha = strength * 0.8; 
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const BONES = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], // Palm
    [0, 17] // Wrist to pinky base
];

export function Starfield() {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const { viewport } = useThree();

    // Initial Static Data
    const [positions, sizes, targetPositions] = useMemo(() => {
        const p = new Float32Array(PARTICLE_COUNT * 3);
        const s = new Float32Array(PARTICLE_COUNT);
        const t = new Float32Array(PARTICLE_COUNT * 3);

        const ringRadius = 1.5;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Universe
            p[i * 3] = (Math.random() - 0.5) * 60;
            p[i * 3 + 1] = (Math.random() - 0.5) * 40;
            p[i * 3 + 2] = (Math.random() - 0.5) * 30;

            s[i] = (Math.random() * 0.8 + 0.3);

            // Portal Target: THIN RING (Center Clear)
            // Ensures video visibility
            // Only use 12% of particles for the portal ring to reduce density
            if (Math.random() < 0.12) {
                const angle = Math.random() * Math.PI * 2;

                // Thin band around the edge
                // 0.95 to 1.05 of radius
                const distR = 0.95 + Math.random() * 0.1;
                const r = distR * ringRadius;

                t[i * 3] = r * Math.cos(angle);
                t[i * 3 + 1] = r * Math.sin(angle);
                // Flat Z for portal ring (looks tighter)
                t[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
            } else {
                // Keep the rest as background stars
                // We set targetPos = startPos so they don't move to the ring
                // Note: The shader scales targetPos by uGather, so these will slightly
                // contract/breathe as portal opens, which adds a nice effect.
                t[i * 3] = p[i * 3];
                t[i * 3 + 1] = p[i * 3 + 1];
                t[i * 3 + 2] = p[i * 3 + 2];
            }
        }
        return [p, s, t];
    }, []);

    const currentHandPositionsRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

    useMemo(() => {
        for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
            currentHandPositionsRef.current[i] = positions[i];
        }
    }, [positions]);

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uGather: { value: 0 },
        uHandMix: { value: 0 }
    }), []);

    const stateRef = useRef({
        gather: 0,
        stabilityScore: 0,
        handMix: 0,
        time: 0
    });

    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.1);
        const s = stateRef.current;
        s.time += dt;

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = s.time;
            materialRef.current.uniforms.uGather.value = s.gather;
            materialRef.current.uniforms.uHandMix.value = s.handMix;
        }

        if (HandData.present && pointsRef.current) {
            const right = HandData.right.present ? HandData.right.landmarks : null;
            const left = HandData.left.present ? HandData.left.landmarks : null;

            const gpuPositions = pointsRef.current.geometry.attributes.handPos.array as Float32Array;
            const currentPositions = currentHandPositionsRef.current;

            let needsUpdate = false;

            const w = viewport.width;
            const h = viewport.height;

            const mapToWorld = (l: Landmark) => {
                return {
                    x: (l.x - 0.5) * w,
                    y: -(l.y - 0.5) * h,
                    z: 0
                };
            };

            const baseLerpFactor = dt * 6.0;

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                let activeLandmarks: Landmark[] | null = null;
                if (right && left) {
                    activeLandmarks = (i % 2 === 0) ? right : left;
                } else if (right) {
                    activeLandmarks = right;
                } else if (left) {
                    activeLandmarks = left;
                }

                let targetX = 0, targetY = 0, targetZ = 0;
                let hasTarget = false;

                if (activeLandmarks && activeLandmarks.length >= 21) {
                    hasTarget = true;
                    // Volume/Cloud Hands
                    const boneIdx = i % BONES.length;
                    const bone = BONES[boneIdx];
                    const p1 = activeLandmarks[bone[0]];
                    const p2 = activeLandmarks[bone[1]];

                    const w1 = mapToWorld(p1);
                    const w2 = mapToWorld(p2);

                    const seed = i * 1337.1;
                    const rand = (Math.sin(seed) * 43758.5453) - Math.floor((Math.sin(seed) * 43758.5453));

                    const segmentX = w1.x + (w2.x - w1.x) * rand;
                    const segmentY = w1.y + (w2.y - w1.y) * rand;

                    const angle = seed * 100;
                    const radius = 0.15;
                    const rx = Math.cos(angle) * radius * Math.random();
                    const ry = Math.sin(angle) * radius * Math.random();
                    const rz = (Math.random() - 0.5) * radius;

                    targetX = segmentX + rx;
                    targetY = segmentY + ry;
                    targetZ = rz;
                } else {
                    targetX = currentPositions[i * 3];
                    targetY = currentPositions[i * 3 + 1];
                    targetZ = currentPositions[i * 3 + 2];
                }

                if (hasTarget) {
                    const speedVar = 0.1 + 0.9 * ((i * 12.9898) % 1.0);
                    const effectiveLerp = baseLerpFactor * speedVar;

                    const cx = currentPositions[i * 3];
                    const cy = currentPositions[i * 3 + 1];
                    const cz = currentPositions[i * 3 + 2];

                    const nx = cx + (targetX - cx) * effectiveLerp;
                    const ny = cy + (targetY - cy) * effectiveLerp;
                    const nz = cz + (targetZ - cz) * effectiveLerp;

                    currentPositions[i * 3] = nx;
                    currentPositions[i * 3 + 1] = ny;
                    currentPositions[i * 3 + 2] = nz;

                    gpuPositions[i * 3] = nx;
                    gpuPositions[i * 3 + 1] = ny;
                    gpuPositions[i * 3 + 2] = nz;

                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                pointsRef.current.geometry.attributes.handPos.needsUpdate = true;
            }
        }

        const rawIsGesturing = HandData.isGesturing && HandData.gestureScore > 0.15;

        // Instant Collapse
        if (rawIsGesturing) {
            s.stabilityScore += dt * 2.5;
        } else {
            s.stabilityScore -= dt * 4.0;
        }
        s.stabilityScore = Math.max(0, Math.min(2.0, s.stabilityScore));

        const isPortalMode = s.stabilityScore > 0.5;

        // SYNCED EXPANSION SPEED
        // Reduced to 0.6 to match Portal.tsx progress speed
        if (isPortalMode) {
            s.gather += dt * 0.6; // SLOW INCREASE
        } else {
            s.gather -= dt * 3.0; // Fast collapse
        }
        s.gather = Math.max(0, Math.min(1.0, s.gather));

        const targetHandMix = (HandData.present && !isPortalMode) ? 1.0 : 0.0;
        const diff = targetHandMix - s.handMix;
        s.handMix += diff * dt * 5.0;
        s.handMix = Math.max(0, Math.min(1.0, s.handMix));
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-targetPos"
                    count={targetPositions.length / 3}
                    array={targetPositions}
                    itemSize={3}
                    args={[targetPositions, 3]}
                />
                <bufferAttribute
                    attach="attributes-handPos"
                    count={currentHandPositionsRef.current.length / 3}
                    array={currentHandPositionsRef.current}
                    itemSize={3}
                    args={[currentHandPositionsRef.current, 3]}
                />
                <bufferAttribute
                    attach="attributes-size"
                    count={sizes.length}
                    array={sizes}
                    itemSize={1}
                    args={[sizes, 1]}
                />
            </bufferGeometry>
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                uniforms={uniforms}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}
