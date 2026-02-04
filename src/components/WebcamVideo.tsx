import { forwardRef, useEffect } from 'react';

// This component renders the video element that streams the webcam.
// It is forwardRef'd so the Hands logic can access the raw video element.

interface WebcamVideoProps {
    className?: string;
}

export const WebcamVideo = forwardRef<HTMLVideoElement, WebcamVideoProps>((props, ref) => {
    useEffect(() => {
        async function startCamera() {
            if (!ref || typeof ref === 'function') return;
            const video = ref.current;
            if (!video) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 1280,
                        height: 720,
                        facingMode: 'user',
                    },
                    audio: false,
                });

                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play();
                };
            } catch (err) {
                console.error("Error accessing webcam:", err);
            }
        }

        startCamera();
    }, [ref]);

    return (
        <div
            className={props.className}
            style={!props.className ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -1
            } : undefined}
        >
            <video
                ref={ref}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                playsInline
                muted
                autoPlay
            />
        </div>
    );
});

WebcamVideo.displayName = 'WebcamVideo';
