// Data types
export type HandPoint = { x: number; y: number; z: number };

export type GestureResult = {
    isCircle: boolean;
    center: { x: number; y: number };
    radius: number;
    score: number; // 0 to 1, how "perfect" the circle is
};

const HISTORY_SIZE = 40; // Approx 1.5 seconds at 30fps
const MIN_RADIUS = 0.05; // Min radius in normalized coordinates (0-1)
const MIN_POINTS = 20;

export class GestureRecognizer {
    private history: HandPoint[] = [];

    addPoint(point: HandPoint) {
        this.history.push(point);
        if (this.history.length > HISTORY_SIZE) {
            this.history.shift();
        }
    }

    detectCircle(): GestureResult {
        if (this.history.length < MIN_POINTS) {
            return { isCircle: false, center: { x: 0, y: 0 }, radius: 0, score: 0 };
        }

        // 1. Calculate Centroid
        let sumX = 0, sumY = 0;
        for (const p of this.history) {
            sumX += p.x;
            sumY += p.y;
        }
        const cx = sumX / this.history.length;
        const cy = sumY / this.history.length;

        // 2. Calculate Distances to Centroid (Radii)
        const distances: number[] = [];
        let sumDist = 0;

        // Also track bounding box to reject lines/small movements
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const p of this.history) {
            const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
            distances.push(d);
            sumDist += d;

            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        const meanRadius = sumDist / this.history.length;
        const width = maxX - minX;
        const height = maxY - minY;

        // Check 1: Must be large enough
        if (meanRadius < MIN_RADIUS) {
            return { isCircle: false, center: { x: cx, y: cy }, radius: meanRadius, score: 0 };
        }

        // Check 2: Aspect ratio should be roughly 1:1 (not a flat line)
        const aspectRatio = width / height;
        if (aspectRatio < 0.5 || aspectRatio > 2.0) {
            return { isCircle: false, center: { x: cx, y: cy }, radius: meanRadius, score: 0 };
        }

        // 3. Calculate Variance / Standard Deviation of Radius
        let sumSqDiff = 0;
        for (const d of distances) {
            sumSqDiff += (d - meanRadius) ** 2;
        }
        const variance = sumSqDiff / this.history.length;
        const stdDev = Math.sqrt(variance);

        // normalized error = stdDev / meanRadius
        // A perfect circle has 0 error.
        const circleError = stdDev / meanRadius;

        // Thresholds
        // < 0.15 is very good
        // < 0.25 is acceptable
        const isCircle = circleError < 0.25;

        // Score: 1.0 is perfect, 0.0 is terrible
        // Map 0.0 -> 1.0, 0.3 -> 0.0
        const score = Math.max(0, 1 - (circleError / 0.3));

        return {
            isCircle,
            center: { x: cx, y: cy },
            radius: meanRadius,
            score: isCircle ? score : 0
        };
    }

    getHistory() {
        return this.history;
    }

    clear() {
        this.history = [];
    }
}

export const gestureRecognizer = new GestureRecognizer();
