export class Vector3 {
	public x: number;
	public y: number;
	public z: number;

	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	public set(x: number, y: number, z: number): this {
		this.x = x;
		this.y = y;
		this.z = z;

		return this;
	}

	public zero(): this {
		return this.set(0, 0, 0);
	}

	public assign(other: Vector3): this {
		return this.set(other.x, other.y, other.z);
	}

	public add(other: Vector3): this {
		this.x += other.x;
		this.y += other.y;
		this.z += other.z;

		return this;
	}

	public substract(other: Vector3): this {
		this.x -= other.x;
		this.y -= other.y;
		this.z -= other.z;

		return this;
	}

	public multiplyByScalar(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;

		return this;
	}

	public clone(): Vector3 {
		return new Vector3(this.x, this.y, this.z);
	}

	/** Calculates length (norm) of this vector */
	public getLength(): number {
		return Math.hypot(this.x, this.y, this.z);
	}

	/** Calculates square length of this vector */
	public getLengthSq(): number {
		return (this.x * this.x) + (this.y * this.y) + (this.z * this.z);
	}
}
