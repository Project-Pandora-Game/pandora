export function Vector2GetAngle(x: number, y: number): number {
	const angle = Math.atan2(y, x);
	const degrees = 180 * angle / Math.PI;
	return (360 + Math.round(degrees)) % 360;
}

export function Vector2Rotate(x: number, y: number, angle: number): [number, number] {
	angle *= (Math.PI / 180);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [x * cos - y * sin, x * sin + y * cos];
}
