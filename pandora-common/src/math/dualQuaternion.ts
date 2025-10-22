/* eslint-disable one-var */
import { Assert } from '../utility/misc.ts';
import type { Matrix4x4 } from './matrix4x4.ts';
import { Quaternion } from './quaternion.ts';
import type { Vector3 } from './vector3.ts';

const TempQuaternion1 = /*@__PURE__*/ new Quaternion();
const TempQuaternion2 = /*@__PURE__*/ new Quaternion();

export class DualQuaternion {
	/** The real part of the Quaternion */
	public a: number;
	/** The real part of the Quaternion, dual part */
	public ae: number;
	/** The `i` part of the Quaternion */
	public b: number;
	/** The `i` part of the Quaternion, dual part */
	public be: number;
	/** The `j` part of the Quaternion */
	public c: number;
	/** The `j` part of the Quaternion, dual part */
	public ce: number;
	/** The `k` part of the Quaternion */
	public d: number;
	/** The `k` part of the Quaternion, dual part */
	public de: number;

	/** The `x` coordinate when considering this quaternion as 3d space rotation */
	public get x(): number {
		return this.b;
	}
	public set x(value: number) {
		this.b = value;
	}

	/** The dual part of `x` coordinate when considering this quaternion as 3d space rotation */
	public get xe(): number {
		return this.be;
	}
	public set xe(value: number) {
		this.be = value;
	}

	/** The `y` coordinate when considering this quaternion as 3d space rotation */
	public get y(): number {
		return this.c;
	}
	public set y(value: number) {
		this.c = value;
	}

	/** The dual part of `y` coordinate when considering this quaternion as 3d space rotation */
	public get ye(): number {
		return this.ce;
	}
	public set ye(value: number) {
		this.ce = value;
	}

	/** The dual part of `z` coordinate when considering this quaternion as 3d space rotation */
	public get ze(): number {
		return this.de;
	}
	public set ze(value: number) {
		this.de = value;
	}

	/** The `w` coordinate when considering this quaternion as 3d space rotation */
	public get w(): number {
		return this.a;
	}
	public set w(value: number) {
		this.a = value;
	}

	/** The dual part of `w` coordinate when considering this quaternion as 3d space rotation */
	public get we(): number {
		return this.ae;
	}
	public set we(value: number) {
		this.ae = value;
	}

	constructor(a: number = 0, b: number = 0, c: number = 0, d: number = 0, ae: number = 0, be: number = 0, ce: number = 0, de: number = 0) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
		this.ae = ae;
		this.be = be;
		this.ce = ce;
		this.de = de;
	}

	public set(a: number, b: number, c: number, d: number, ae: number, be: number, ce: number, de: number): this {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
		this.ae = ae;
		this.be = be;
		this.ce = ce;
		this.de = de;

		return this;
	}

	public assign(other: DualQuaternion): this {
		return this.set(other.a, other.b, other.c, other.d, other.ae, other.be, other.ce, other.de);
	}

	public assignReal(real: Quaternion): this {
		this.a = real.a;
		this.b = real.b;
		this.c = real.c;
		this.d = real.d;

		return this;
	}

	public assignDual(dual: Quaternion): this {
		this.ae = dual.a;
		this.be = dual.b;
		this.ce = dual.c;
		this.de = dual.d;

		return this;
	}

	public clone(): DualQuaternion {
		return new DualQuaternion(this.a, this.b, this.c, this.d, this.ae, this.be, this.ce, this.de);
	}

	public add(other: DualQuaternion): this {
		this.a += other.a;
		this.b += other.b;
		this.c += other.c;
		this.d += other.d;
		this.ae += other.ae;
		this.be += other.be;
		this.ce += other.ce;
		this.de += other.de;

		return this;
	}

	public multiply(other: DualQuaternion): this {
		const aReal = new Quaternion();
		const aDual = new Quaternion();
		const bReal = new Quaternion();
		const bDual = new Quaternion();

		this.extractRealQuaternion(aReal);
		this.extractDualQuaternion(aDual);
		other.extractRealQuaternion(bReal);
		other.extractDualQuaternion(bDual);

		const dualResult = new Quaternion()
			.assign(aReal).multiply(bDual)
			.add(new Quaternion().assign(aDual).multiply(bReal));

		const realResult = new Quaternion().assign(aReal).multiply(bReal);

		return this.set(realResult.a, realResult.b, realResult.c, realResult.d, dualResult.a, dualResult.b, dualResult.c, dualResult.d);
	}

	public multiplyByScalar(scalar: number): this {
		this.a *= scalar;
		this.b *= scalar;
		this.c *= scalar;
		this.d *= scalar;
		this.ae *= scalar;
		this.be *= scalar;
		this.ce *= scalar;
		this.de *= scalar;

		return this;
	}

	public extractRealQuaternion(target: Quaternion): void {
		target.set(this.a, this.b, this.c, this.d);
	}

	public extractDualQuaternion(target: Quaternion): void {
		target.set(this.ae, this.be, this.ce, this.de);
	}

	public toTransformationMatrix(target: Matrix4x4): void {
		const b0 = TempQuaternion1;
		const be = TempQuaternion2;

		this.extractRealQuaternion(b0);
		const b0len = b0.getLength();
		Assert(b0len !== 0);
		b0.multiplyByScalar(1 / b0len);

		this.extractDualQuaternion(be);
		be.multiplyByScalar(1 / b0len);

		const x0 = b0.x, y0 = b0.y, z0 = b0.z, w0 = b0.w;

		const t0 = 2 * (- be.w * x0 + be.x * w0 - be.y * z0 + be.z * y0);
		const t1 = 2 * (- be.w * y0 + be.x * z0 + be.y * w0 - be.z * x0);
		const t2 = 2 * (- be.w * z0 - be.x * y0 + be.y * x0 + be.z * w0);

		target.set(
			(1 - 2 * y0 * y0 - 2 * z0 * z0), (2 * x0 * y0 - 2 * w0 * z0), (2 * x0 * z0 + 2 * w0 * y0), t0,
			(2 * x0 * y0 + 2 * w0 * z0), (1 - 2 * x0 * x0 - 2 * z0 * z0), (2 * y0 * z0 - 2 * w0 * x0), t1,
			(2 * x0 * z0 - 2 * w0 * y0), (2 * y0 * z0 + 2 * w0 * x0), (1 - 2 * x0 * x0 - 2 * y0 * y0), t2,
			0, 0, 0, 1,
		);
	}

	public fromRotationTranslation(rotation: Quaternion, translation: Vector3): this {
		this.assignReal(rotation);

		const dual = new Quaternion(0, translation.x, translation.y, translation.z);
		dual.multiply(rotation);
		dual.multiplyByScalar(0.5);
		this.assignDual(dual);

		return this;
	}

	public fromRotationAroundPoint(rotation: Quaternion, point: Vector3): this {
		this.assignReal(rotation);

		const dual = TempQuaternion1.assign(rotation);
		const tmp = TempQuaternion2.set(0, point.x, point.y, point.z);
		dual.multiply(tmp);
		dual.multiplyByScalar(-0.5);

		tmp.set(0, point.x, point.y, point.z);
		tmp.multiply(rotation);
		tmp.multiplyByScalar(0.5);
		dual.add(tmp);

		this.assignDual(dual);

		return this;
	}
}
