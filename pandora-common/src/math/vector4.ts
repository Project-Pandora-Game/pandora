/* eslint-disable one-var */
import type { Matrix4x4 } from './matrix4x4.ts';

export class Vector4 {
	public x: number;
	public y: number;
	public z: number;
	public w: number;

	constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	public set(x: number, y: number, z: number, w: number): this {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;

		return this;
	}

	public zero(): this {
		return this.set(0, 0, 0, 0);
	}

	public assign(other: Vector4): this {
		return this.set(other.x, other.y, other.z, other.w);
	}

	public add(other: Vector4): this {
		this.x += other.x;
		this.y += other.y;
		this.z += other.z;
		this.w += other.w;

		return this;
	}

	public substract(other: Vector4): this {
		this.x -= other.x;
		this.y -= other.y;
		this.z -= other.z;
		this.w -= other.w;

		return this;
	}

	public multiplyByScalar(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		this.w *= scalar;

		return this;
	}

	public multiplyByMatrix4x4(m: Matrix4x4): this {
		const x = this.x, y = this.y, z = this.z, w = this.w;
		const e = m.elements;

		this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
		this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
		this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
		this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;

		return this;
	}

	public clone(): Vector4 {
		return new Vector4(this.x, this.y, this.z, this.w);
	}

	/** Calculates length (norm) of this vector */
	public getLength(): number {
		return Math.hypot(this.x, this.y, this.z, this.w);
	}

	/** Calculates square length of this vector */
	public getLengthSq(): number {
		return (this.x * this.x) + (this.y * this.y) + (this.z * this.z) + (this.w * this.w);
	}
}
