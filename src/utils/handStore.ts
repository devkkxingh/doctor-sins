export interface Landmark {
    x: number;
    y: number;
    z: number;
}

export const HandData = {
    present: false, // At least one hand

    // Right Hand (Dominant/Drawing)
    right: {
        present: false,
        x: 0,
        y: 0,
        landmarks: [] as Landmark[],
    },

    // Left Hand (Stabilizer/Anchor)
    left: {
        present: false,
        x: 0,
        y: 0,
        landmarks: [] as Landmark[],
    },

    gestureScore: 0,
    isGesturing: false,
    isFist: false // Global fist state (either hand)
};

// Heuristic: Check if finger tips are close to palm/wrist
function detectFist(landmarks: Landmark[]): boolean {
    if (!landmarks || landmarks.length < 21) return false;

    // Wrist is 0
    // Thumb tip is 4, Index 8, Middle 12, Ring 16, Pinky 20
    // Palms are roughly 0, 5, 9, 13, 17

    // Simple check: Index, Middle, Ring, Pinky tips should be close to base (proximal)
    // or just checking y-distance if relative to wrist?
    // Better: distance from Tip to Wrist (0) is small compared to full hand

    const wrist = landmarks[0];

    // Tips
    const tips = [8, 12, 16, 20];
    let foldedCount = 0;

    // Scale reference: Distance from Wrist(0) to MiddleMCP(9)
    const refDx = landmarks[9].x - wrist.x;
    const refDy = landmarks[9].y - wrist.y;
    const refDz = landmarks[9].z - wrist.z;
    const palmSize = Math.sqrt(refDx * refDx + refDy * refDy + refDz * refDz);

    // Threshold: INCREASED to 1.5x palm size to make it easier to trigger
    // Tips usually extend 2x palm size.
    const threshold = palmSize * 1.5;

    for (const tipIdx of tips) {
        const tip = landmarks[tipIdx];
        const dx = tip.x - wrist.x;
        const dy = tip.y - wrist.y;
        const dz = tip.z - wrist.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Console log for debugging (throttle this in real usage or use once)
        if (Math.random() < 0.01) {
            console.log(`Tip ${tipIdx} Distance: ${d.toFixed(3)}, Threshold: ${threshold.toFixed(3)}, Folded Count: ${foldedCount}`);
        }

        if (d < threshold) {
            foldedCount++;
        }
    }

    // Thumb is weird, ignore for now. If 4 fingers are folded, it's a fist.
    return foldedCount >= 4;
}

// Helper to update specific hand
export function updateHandEntry(hand: 'right' | 'left', x: number, y: number, present: boolean, landmarks: Landmark[] = []) {
    const entry = HandData[hand];
    entry.present = present;
    if (present) {
        entry.x = x;
        entry.y = y;
        entry.landmarks = landmarks;
    } else {
        entry.landmarks = []; // Clear landmarks if lost
    }

    // Global presence if either is there
    HandData.present = HandData.right.present || HandData.left.present;

    // Global Fist Check
    const rightFist = HandData.right.present ? detectFist(HandData.right.landmarks) : false;
    const leftFist = HandData.left.present ? detectFist(HandData.left.landmarks) : false;
    HandData.isFist = rightFist || leftFist;
}
