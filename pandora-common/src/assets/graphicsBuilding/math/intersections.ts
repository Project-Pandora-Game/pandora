import { Immutable } from 'immer';
import type { CoordinatesCompressed } from '../../graphics/common.ts';

type Point = Immutable<CoordinatesCompressed>;
type Line = readonly [Point, Point];
type TrianglePoints = readonly [Point, Point, Point];
type RectanglePoints = readonly [x1: number, y1: number, x2: number, y2: number];

// Function to check if a point (px, py) is inside a rectangle
function PointInRectangle([px, py]: Point, [x1, y1, x2, y2]: RectanglePoints): boolean {
	return px >= x1 && px <= x2 && py >= y1 && py <= y2;
}

function PointInTriangle(point: Point, triangle: TrianglePoints): boolean {
	function sign(p1: Point, p2: Point, p3: Point) {
		return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
	}

	const d1 = sign(point, triangle[0], triangle[1]);
	const d2 = sign(point, triangle[1], triangle[2]);
	const d3 = sign(point, triangle[2], triangle[0]);

	const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

	return !(hasNeg && hasPos);
}

function LinesIntersect(a: Line, b: Line): boolean {
	function orientation([px, py]: Point, [qx, qy]: Point, [rx, ry]: Point) {
		return Math.sign((qy - py) * (rx - qx) - (qx - px) * (ry - qy));
	}

	const o1 = orientation(a[0], a[1], b[0]);
	const o2 = orientation(a[0], a[1], b[1]);
	const o3 = orientation(b[0], b[1], a[0]);
	const o4 = orientation(b[0], b[1], a[1]);

	if (o1 !== o2 && o3 !== o4) return true; // General case

	// If they intereset with only an edge, we don't really care.
	// This is because the edge would be covered by another triangle already

	return false; // Parallel lines, no intersection
}

export function TriangleRectangleOverlap(
	triangle: TrianglePoints,
	rectangle: RectanglePoints,
): boolean {
	// Simple case: Some triangle point is in the rectangle
	if (PointInRectangle(triangle[0], rectangle) ||
		PointInRectangle(triangle[1], rectangle) ||
		PointInRectangle(triangle[2], rectangle)
	) {
		return true;
	}

	// Slightly more complex case: Some rectangle point is in the triangle
	const rectangleCorners: Point[] = [
		[rectangle[0], rectangle[1]],
		[rectangle[2], rectangle[1]],
		[rectangle[2], rectangle[3]],
		[rectangle[0], rectangle[3]],
	];
	for (const corner of rectangleCorners) {
		if (PointInTriangle(corner, triangle)) {
			return true;
		}
	}

	// Annoying case: Neither point is inside the other, but they still overlap
	// This thankfully implies that some edge must overlap as well
	const triangleEdges: Line[] = [
		[triangle[0], triangle[1]],
		[triangle[1], triangle[2]],
		[triangle[2], triangle[0]],
	];
	const rectangleEdges: Line[] = [
		[rectangleCorners[0], rectangleCorners[1]],
		[rectangleCorners[1], rectangleCorners[2]],
		[rectangleCorners[2], rectangleCorners[3]],
		[rectangleCorners[3], rectangleCorners[0]],
	];
	for (const tEdge of triangleEdges) {
		for (const rEdge of rectangleEdges) {
			if (LinesIntersect(tEdge, rEdge))
				return true;
		}
	}

	// If none of the above is true, then they do not overlap
	return false;
}
