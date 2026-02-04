import { HandData } from '../utils/handStore';
import { useFrame } from '@react-three/fiber'; // Not used in DOM component usually, but we need loop to check HandData?
// Actually simpler to just show static instructions or use a small loop ref if we want dynamic feedback.
// For now, static instructions are fine, maybe fade out if gesturing?

import { useEffect, useState } from 'react';

export function Instructions() {
    const [step, setStep] = useState(0);
    // 0 = No hands
    // 1 = Hands detected
    // 2 = Stabilizer found (Left)
    // 3 = Gesturing

    useEffect(() => {
        const interval = setInterval(() => {
            if (HandData.isGesturing) {
                setStep(3);
            } else if (HandData.left.present && HandData.right.present) {
                setStep(2);
            } else if (HandData.present) {
                setStep(1);
            } else {
                setStep(0);
            }
        }, 200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            textAlign: 'center',
            zIndex: 30,
            textShadow: '0 0 10px black',
            pointerEvents: 'none',
            fontFamily: 'sans-serif',
            opacity: step === 3 ? 0.0 : 1.0, // Hide when successful to enjoy view
            transition: 'opacity 0.5s ease'
        }}>
        </div>
    );
}
