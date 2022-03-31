import type { Condition } from 'pandora-common/dist/character/asset/definition';
import type { GraphicsEvaluate } from './def';

export function GetAngle(x: number, y: number): number {
	const angle = Math.atan2(y, x);
	const degrees = 180 * angle / Math.PI;
	return (360 + Math.round(degrees)) % 360;
}

export function RotateVector(x: number, y: number, angle: number): [number, number] {
	angle *= (Math.PI / 180);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [x * cos - y * sin, x * sin + y * cos];
}

export function EvaluateCondition(condition: Condition, evaluate: GraphicsEvaluate): boolean {
	return condition.some((clause) => clause.every(evaluate));
}

export function Conjunction<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if (a.size > b.size) [a, b] = [b, a];
	return [...a].some((x) => b.has(x));
}

export function Clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
