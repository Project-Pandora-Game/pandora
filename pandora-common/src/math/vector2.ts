export class Vector2 {
	public x: number;
	public y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	public clone(): Vector2 {
		return new Vector2(this.x, this.y);
	}
}
