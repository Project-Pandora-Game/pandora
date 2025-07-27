import type { Coordinates } from '../assets/index.ts';

/** Generates an infinite spiral, starting with a center and going one up and clockwise around center. */
export function* GenerateSpiralCurve(centerX: number, centerY: number): Generator<Coordinates, void, unknown> {
	// Center
	yield { x: centerX, y: centerY };

	// Gradually increasing distance
	for (let d = 1; ; d++) {
		// Top from center to the right
		for (let x = 0; x < d; x++) {
			yield { x: centerX + x, y: centerY - d };
		}
		// Right side downwards
		for (let y = -d; y < d; y++) {
			yield { x: centerX + d, y: centerY + y };
		}
		// Bottom from right to left
		for (let x = d; x > -d; x--) {
			yield { x: centerX + x, y: centerY + d };
		}
		// Left from bottom up
		for (let y = d; y > -d; y--) {
			yield { x: centerX - d, y: centerY + y };
		}
		// Top from corner to center
		for (let x = -d; x < 0; x++) {
			yield { x: centerX + x, y: centerY - d };
		}
	}
}
