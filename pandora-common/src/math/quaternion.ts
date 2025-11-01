/* eslint-disable one-var */
import type { Vector3 } from './vector3.ts';

export class Quaternion {
	/** The real part of the Quaternion */
	public a: number;
	/** The `i` part of the Quaternion */
	public b: number;
	/** The `j` part of the Quaternion */
	public c: number;
	/** The `k` part of the Quaternion */
	public d: number;

	/** The `x` coordinate when considering this quaternion as 3d space rotation */
	public get x(): number {
		return this.b;
	}
	public set x(value: number) {
		this.b = value;
	}

	/** The `y` coordinate when considering this quaternion as 3d space rotation */
	public get y(): number {
		return this.c;
	}
	public set y(value: number) {
		this.c = value;
	}

	/** The `z` coordinate when considering this quaternion as 3d space rotation */
	public get z(): number {
		return this.d;
	}
	public set z(value: number) {
		this.d = value;
	}

	/** The `w` coordinate when considering this quaternion as 3d space rotation */
	public get w(): number {
		return this.a;
	}
	public set w(value: number) {
		this.a = value;
	}

	constructor(a: number = 0, b: number = 0, c: number = 0, d: number = 0) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
	}

	public set(a: number, b: number, c: number, d: number): this {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;

		return this;
	}

	public unit(): this {
		return this.set(1, 0, 0, 0);
	}

	public assign(other: Quaternion): this {
		return this.set(other.a, other.b, other.c, other.d);
	}

	public add(other: Quaternion): this {
		this.a += other.a;
		this.b += other.b;
		this.c += other.c;
		this.d += other.d;

		return this;
	}

	public multiply(other: Quaternion): this {
		const aa = this.a, ab = this.b, ac = this.c, ad = this.d;
		const ba = other.a, bb = other.b, bc = other.c, bd = other.d;

		this.a = aa * ba - ab * bb - ac * bc - ad * bd;
		this.b = ab * ba + aa * bb + ac * bd - ad * bc;
		this.c = ac * ba + aa * bc + ad * bb - ab * bd;
		this.d = ad * ba + aa * bd + ab * bc - ac * bb;

		return this;
	}

	/** Similar to `multiply`, but does `this = other * this` */
	public leftMultiply(other: Quaternion): this {
		const aa = other.a, ab = other.b, ac = other.c, ad = other.d;
		const ba = this.a, bb = this.b, bc = this.c, bd = this.d;

		this.a = aa * ba - ab * bb - ac * bc - ad * bd;
		this.b = ab * ba + aa * bb + ac * bd - ad * bc;
		this.c = ac * ba + aa * bc + ad * bb - ab * bd;
		this.d = ad * ba + aa * bd + ab * bc - ac * bb;

		return this;
	}

	public multiplyByScalar(scalar: number): this {
		this.a *= scalar;
		this.b *= scalar;
		this.c *= scalar;
		this.d *= scalar;

		return this;
	}

	public clone(): Quaternion {
		return new Quaternion(this.a, this.b, this.c, this.d);
	}

	public setFromAxisAngle(axis: Vector3, angle: number): this {
		const halfAngle = angle / 2;
		const s = Math.sin(halfAngle);

		this.x = axis.x * s;
		this.y = axis.y * s;
		this.z = axis.z * s;
		this.w = Math.cos(halfAngle);

		return this;
	}

	public static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
		return new Quaternion().setFromAxisAngle(axis, angle);
	}

	/** Calculates length (norm) of this quaternion */
	public getLength(): number {
		return Math.hypot(this.a, this.b, this.c, this.d);
	}

	public normalize(): this {
		const l = this.getLength();

		if (l === 0) {
			this.a = 1;
			this.b = 0;
			this.c = 0;
			this.d = 0;
			return this;
		}

		return this.multiplyByScalar(1 / l);
	}
}
