import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import { HandTracker } from './HandTracker';
// Import particles later
import { Starfield } from './Particles/Starfield';
import { Portal } from './Particles/Portal';
import { Sparks } from './Particles/Sparks';
import { useThree } from '@react-three/fiber';

function SceneContent() {
    return (
        <group>
            <ambientLight intensity={0.5} />
            <Starfield />
            <Portal />
            <Sparks />
            <pointLight position={[0, 0, 2]} intensity={2.0} color="#ffaa00" distance={5} />
        </group>
    )
}

import { Instructions } from './Instructions';

export default function Experience() {
    return (
        <>
            <Instructions />
            {/* 2D Hand Tracker (DOM) */}
            <HandTracker />

            {/* 3D Scene */}
            <Canvas
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false, stencil: true }}
            >
                <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={75} />
                <color attach="background" args={['#000000']} />

                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>

                {/* Optional controls for debugging, maybe remove later for "Immersive" feel */}
                {/* <OrbitControls />  */}
            </Canvas>
        </>
    );
}
