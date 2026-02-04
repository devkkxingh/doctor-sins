import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { updateHandEntry, HandData } from '../utils/handStore';
import type { Landmark } from '../utils/handStore';
import { gestureRecognizer } from '../utils/gestureRecognition';
import { WebcamVideo } from './WebcamVideo';

export function HandTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function setupMediaPipe() {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
                );

                handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2 // Enable 2 hands
                });

                setLoading(false);
                detectLoop();
            } catch (err) {
                console.error("Failed to load MediaPipe:", err);
            }
        }

        setupMediaPipe();

        return () => {
            cancelAnimationFrame(requestRef.current);
            if (handLandmarkerRef.current) {
                handLandmarkerRef.current.close();
            }
        };
    }, []);

    const detectLoop = () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && handLandmarkerRef.current) {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());

            let rightHandFound = false;
            let leftHandFound = false;

            if (results.landmarks.length > 0) {
                // Iterate through detected hands
                results.handedness.forEach((handedness, index) => {
                    const rawLandmarks = results.landmarks[index];
                    const name = handedness[0].categoryName; // "Left" or "Right"

                    // Convert to consistent Landmark array
                    // Mirroring X to match user view
                    const landmarks: Landmark[] = rawLandmarks.map(l => ({
                        x: 1 - l.x,
                        y: l.y,
                        z: l.z
                    }));

                    const fingerTip = landmarks[8];
                    const x = fingerTip.x;
                    const y = fingerTip.y;

                    if (name === "Right") {
                        rightHandFound = true;
                        updateHandEntry('right', x, y, true, landmarks);

                        // Add to gesture recognizer
                        const aspect = window.innerWidth / window.innerHeight;
                        gestureRecognizer.addPoint({
                            x: x * aspect,
                            y: y,
                            z: 0
                        });

                    } else {
                        leftHandFound = true;
                        updateHandEntry('left', x, y, true, landmarks);
                    }
                });
            }

            if (!rightHandFound) {
                updateHandEntry('right', 0, 0, false);
                gestureRecognizer.clear();
            }
            if (!leftHandFound) {
                updateHandEntry('left', 0, 0, false);
            }

            // Gesture Detection Logic
            const gesture = gestureRecognizer.detectCircle();
            let finalScore = gesture.score;
            if (!leftHandFound) {
                finalScore = 0; // Hard requirement for 2-hand gesture per request
            }

            HandData.gestureScore = finalScore;
            HandData.isGesturing = gesture.isCircle && leftHandFound;
        }

        requestRef.current = requestAnimationFrame(detectLoop);
    };

    return (
        <>
            <WebcamVideo ref={videoRef} className="pip-video" />
            {loading && <div className="loading-overlay">Initializing Quantum Stabilizers...</div>}
        </>
    );
}
