export class Vector2 {
	public x: number;
	public y: number;

	constructor(x: number = 0, y: number = 0) {
		this.x = x;
		this.y = y;
	}

	public set(x: number, y: number): this {
		this.x = x;
		this.y = y;

		return this;
	}

	public zero(): this {
		return this.set(0, 0);
	}

	public assign(other: Vector2): this {
		return this.set(other.x, other.y);
	}

	public add(other: Vector2): this {
		this.x += other.x;
		this.y += other.y;

		return this;
	}

	public substract(other: Vector2): this {
		this.x -= other.x;
		this.y -= other.y;

		return this;
	}

	public multiplyByScalar(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;

		return this;
	}

	public clone(): Vector2 {
		return new Vector2(this.x, this.y);
	}

	/** Calculates length (norm) of this vector */
	public getLength(): number {
		return Math.hypot(this.x, this.y);
	}

	/** Calculates square length of this vector */
	public getLengthSq(): number {
		return (this.x * this.x) + (this.y * this.y);
	}
}
