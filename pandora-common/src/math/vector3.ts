export class Vector3 {
	public x: number;
	public y: number;
	public z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	public clone(): Vector3 {
		return new Vector3(this.x, this.y, this.z);
	}
}
