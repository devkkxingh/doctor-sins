import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HandData } from '../../utils/handStore';

const SPARK_COUNT = 500;
const RING_RADIUS = 1.5;

const vertexShader = `
  attribute float size;
  attribute float speed;
  attribute vec3 velocity;
  attribute float life; // 0 to 1
  
  varying float vLife;
  
  void main() {
    vLife = life;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (20.0 / -mvPosition.z) * life;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vLife;
  
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    
    // Hot core
    vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.9, 0.5), vLife);
    float alpha = smoothstep(0.5, 0.0, r) * vLife;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export function Sparks() {
    const pointsRef = useRef<THREE.Points>(null);

    // Initialize Particles
    const [positions, velocities, sizes, lifes] = useMemo(() => {
        const p = new Float32Array(SPARK_COUNT * 3);
        const v = new Float32Array(SPARK_COUNT * 3);
        const s = new Float32Array(SPARK_COUNT);
        const l = new Float32Array(SPARK_COUNT);

        for (let i = 0; i < SPARK_COUNT; i++) {
            // Start dead
            l[i] = 0;

            // Random start pos on ring
            const angle = Math.random() * Math.PI * 2;
            p[i * 3] = Math.cos(angle) * RING_RADIUS;
            p[i * 3 + 1] = Math.sin(angle) * RING_RADIUS;
            p[i * 3 + 2] = 0;

            v[i * 3] = (Math.random() - 0.5) * 0.1;
            v[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
            v[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

            s[i] = Math.random() * 0.5 + 0.2;
        }

        return [p, v, s, l];
    }, []);

    useFrame((_, delta) => {
        if (!pointsRef.current) return;

        const dt = Math.min(delta, 0.1);
        const isPortalOpen = HandData.isGesturing && HandData.gestureScore > 0.5;

        const positionsAttr = pointsRef.current.geometry.attributes.position;
        const velocityAttr = pointsRef.current.geometry.attributes.velocity;
        const lifeAttr = pointsRef.current.geometry.attributes.life;

        const posArray = positionsAttr.array as Float32Array;
        const velArray = velocityAttr.array as Float32Array;
        const lifeArray = lifeAttr.array as Float32Array;

        for (let i = 0; i < SPARK_COUNT; i++) {
            let life = lifeArray[i];

            if (life > 0) {
                // Determine tangetial velocity if we want them to spin off
                // Simply move by velocity
                posArray[i * 3] += velArray[i * 3] * dt * 5.0; // Speed multiplier
                posArray[i * 3 + 1] += velArray[i * 3 + 1] * dt * 5.0;
                posArray[i * 3 + 2] += velArray[i * 3 + 2] * dt * 5.0;

                // Gravity/Drag
                velArray[i * 3 + 1] -= dt * 0.5; // Mild gravity?

                // Decay
                life -= dt * 1.5;
            } else if (isPortalOpen) {
                // Respawn chance
                if (Math.random() < 0.05) {
                    life = 1.0;

                    // Spawn on ring
                    const angle = Math.random() * Math.PI * 2;
                    // Slightly thick ring spawn
                    const r = RING_RADIUS * (0.95 + Math.random() * 0.1);

                    posArray[i * 3] = Math.cos(angle) * r;
                    posArray[i * 3 + 1] = Math.sin(angle) * r;
                    posArray[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

                    // Tangential Velocity
                    // Vector from center is (cos, sin)
                    // Tangent is (-sin, cos)
                    const speed = 2.0 + Math.random() * 2.0;
                    velArray[i * 3] = -Math.sin(angle) * speed + (Math.random() - 0.5);
                    velArray[i * 3 + 1] = Math.cos(angle) * speed + (Math.random() - 0.5);
                    velArray[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
                }
            }

            lifeArray[i] = Math.max(0, life);
        }

        positionsAttr.needsUpdate = true;
        lifeAttr.needsUpdate = true;
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
                    attach="attributes-velocity"
                    count={velocities.length / 3}
                    array={velocities}
                    itemSize={3}
                    args={[velocities, 3]}
                />
                <bufferAttribute
                    attach="attributes-size"
                    count={sizes.length}
                    array={sizes}
                    itemSize={1}
                    args={[sizes, 1]}
                />
                <bufferAttribute
                    attach="attributes-life"
                    count={lifes.length}
                    array={lifes}
                    itemSize={1}
                    args={[lifes, 1]}
                />
            </bufferGeometry>
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}
