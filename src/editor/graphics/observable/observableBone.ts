import type { BoneDefinitionCompressed } from 'pandora-common/dist/character/asset/definition';
import type { BoneState } from '../../../graphics/def';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { observable, ObservableClass } from '../../../observable';

type IObservableBone = {
	x: number;
	y: number;
	rotation: number;
};
export class ObservableBone extends ObservableClass<IObservableBone> implements BoneState {
	private _name: string;

	@observable()
	public x: number;
	@observable()
	public y: number;
	@observable()
	public rotation: number = 0;

	private _baseRotation: number;

	public mirror?: ObservableBone;
	public parent?: ObservableBone;

	constructor(bone: BoneDefinitionCompressed, parent?: ObservableBone, mirror?: ObservableBone) {
		super();
		this._name = bone.name;
		this.x = bone.pos?.[0] ?? 0;
		this.y = bone.pos?.[1] ?? 0;
		this._baseRotation = bone.rotation ?? 0;
		this.mirror = mirror;
		this.parent = parent;
		if (mirror) {
			this.x = GraphicsCharacter.WIDTH - this.x;
			mirror.mirror = this;
		}
	}

	public get name() {
		return this._name;
	}

	public updateRotation(value: number): boolean {
		let update = (value + this._baseRotation + 360) % 360;
		if (update > 180) update -= 360;
		if (update !== this.rotation) {
			this.rotation = update;
			this.emit('rotation', update);
			return true;
		}
		return false;
	}

	public get isMirror(): boolean {
		return !!this.mirror;
	}
}
