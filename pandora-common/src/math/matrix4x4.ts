/* eslint-disable one-var */

export type Matrix4x4Elements = [
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
	number, number, number, number,
];

export class Matrix4x4 {
	/** Elements of the matrix, in column-major order. */
	public readonly elements: Matrix4x4Elements;

	/** Create matrix. Elements are given in row-major order. */
	constructor(
		n11: number = 0, n12: number = 0, n13: number = 0, n14: number = 0,
		n21: number = 0, n22: number = 0, n23: number = 0, n24: number = 0,
		n31: number = 0, n32: number = 0, n33: number = 0, n34: number = 0,
		n41: number = 0, n42: number = 0, n43: number = 0, n44: number = 0,
	) {
		this.elements = [
			n11, n21, n31, n41,
			n12, n22, n32, n42,
			n13, n23, n33, n43,
			n14, n24, n34, n44,
		];
	}

	public set(
		n11: number, n12: number, n13: number, n14: number,
		n21: number, n22: number, n23: number, n24: number,
		n31: number, n32: number, n33: number, n34: number,
		n41: number, n42: number, n43: number, n44: number,
	): this {
		this.elements[0] = n11;
		this.elements[1] = n21;
		this.elements[2] = n31;
		this.elements[3] = n41;
		this.elements[4] = n12;
		this.elements[5] = n22;
		this.elements[6] = n32;
		this.elements[7] = n42;
		this.elements[8] = n13;
		this.elements[9] = n23;
		this.elements[10] = n33;
		this.elements[11] = n43;
		this.elements[12] = n14;
		this.elements[13] = n24;
		this.elements[14] = n34;
		this.elements[15] = n44;

		return this;
	}

	/** Resets this matrix to a zero matrix */
	public zero(): this {
		return this.set(
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
			0, 0, 0, 0,
		);
	}

	/** Resets this matrix to an identity matrix */
	public identity(): this {
		return this.set(
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		);
	}

	public setFromMatrix4x4(m: Matrix4x4): void {
		for (let i = 0; i < 16; i++) {
			this.elements[i] = m.elements[i];
		}
	}

	public clone(): Matrix4x4 {
		return new Matrix4x4(
			this.elements[0], this.elements[4], this.elements[8], this.elements[12],
			this.elements[1], this.elements[5], this.elements[9], this.elements[13],
			this.elements[2], this.elements[6], this.elements[10], this.elements[14],
			this.elements[3], this.elements[7], this.elements[11], this.elements[15],
		);
	}

	public multiplyByMatrix4x4(other: Matrix4x4): this {
		const a = this.elements;
		const b = other.elements;

		const a11 = a[0], a12 = a[4], a13 = a[8], a14 = a[12];
		const a21 = a[1], a22 = a[5], a23 = a[9], a24 = a[13];
		const a31 = a[2], a32 = a[6], a33 = a[10], a34 = a[14];
		const a41 = a[3], a42 = a[7], a43 = a[11], a44 = a[15];

		const b11 = b[0], b12 = b[4], b13 = b[8], b14 = b[12];
		const b21 = b[1], b22 = b[5], b23 = b[9], b24 = b[13];
		const b31 = b[2], b32 = b[6], b33 = b[10], b34 = b[14];
		const b41 = b[3], b42 = b[7], b43 = b[11], b44 = b[15];

		a[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
		a[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
		a[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
		a[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
		a[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
		a[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
		a[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
		a[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
		a[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
		a[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
		a[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
		a[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
		a[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
		a[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
		a[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
		a[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

		return this;
	}

	/**
	 * Inverts this matrix, using the [analytic method]{@link https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution}.
	 * You can not invert with a determinant of zero. If you attempt this, the method produces a zero matrix instead.
	 */
	public invert(): this {
		// Borrowed from three.js: https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js
		// based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
		const te = this.elements,

			n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3],
			n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7],
			n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11],
			n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15],

			t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
			t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
			t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
			t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

		const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

		if (det === 0) {
			return this.zero();
		}

		const detInv = 1 / det;

		te[0] = t11 * detInv;
		te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
		te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
		te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

		te[4] = t12 * detInv;
		te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
		te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
		te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

		te[8] = t13 * detInv;
		te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
		te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
		te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

		te[12] = t14 * detInv;
		te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
		te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
		te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

		return this;

	}
}
