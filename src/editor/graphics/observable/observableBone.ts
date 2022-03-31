import type { BoneDefinitionCompressed } from 'pandora-common/dist/character/asset/definition';
import type { BoneState } from '../../../graphics/def';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { ObservableSet } from '../../../observable';

type IObservableBone = {
	x: number;
	y: number;
	rotation: number;
};
export class ObservableBone extends ObservableSet<IObservableBone> implements BoneState {
	private _name: string;
	private _x: number;
	private _y: number;
	private _rotation: number = 0;
	private _baseRotation: number;

	public mirror?: ObservableBone;
	public parent?: ObservableBone;

	constructor(bone: BoneDefinitionCompressed, parent?: ObservableBone, mirror?: ObservableBone) {
		super();
		this._name = bone.name;
		this._x = bone.pos?.[0] ?? 0;
		this._y = bone.pos?.[1] ?? 0;
		this._baseRotation = bone.rotation ?? 0;
		this.mirror = mirror;
		this.parent = parent;
		if (mirror) {
			this._x = GraphicsCharacter.WIDTH - this._x;
			mirror.mirror = this;
		}
	}

	public get name() {
		return this._name;
	}

	public get x() {
		return this._x;
	}
	public set x(value: number) {
		if (this._x !== value) {
			this._x = value;
			this.dispatch('x', value);
		}
	}

	public get y() {
		return this._y;
	}
	public set y(value: number) {
		if (this._y !== value) {
			this._y = value;
			this.dispatch('y', value);
		}
	}

	public get rotation() {
		return this._rotation;
	}

	public updateRotation(value: number): boolean {
		let update = (value + this._baseRotation + 360) % 360;
		if (update > 180) update -= 360;
		if (update !== this._rotation) {
			this._rotation = update;
			this.dispatch('rotation', update);
			return true;
		}
		return false;
	}

	public get isMirror(): boolean {
		return !!this.mirror;
	}
}
