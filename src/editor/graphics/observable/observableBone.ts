import { BoneDefinitionCompressed, CharacterSize } from 'pandora-common';
import type { BoneState } from '../../../graphics/def';
import { observable, ObservableClass } from '../../../observable';

type IObservableBone = {
	x: number;
	y: number;
	rotation: number;
};
export class ObservableBone extends ObservableClass<IObservableBone> implements BoneState {
	private _name: string;

	@observable
	public x: number;
	@observable
	public y: number;
	@observable
	public rotation: number = 0;

	public mirror?: ObservableBone;
	public parent?: ObservableBone;

	constructor(name: string, bone: BoneDefinitionCompressed, parent?: ObservableBone, mirror?: ObservableBone) {
		super();
		this._name = name;
		this.x = bone.pos?.[0] ?? 0;
		this.y = bone.pos?.[1] ?? 0;
		this.mirror = mirror;
		this.parent = parent;
		if (mirror) {
			this.x = CharacterSize.WIDTH - this.x;
			mirror.mirror = this;
		}
	}

	public get name(): string {
		return this._name;
	}

	public get isMirror(): boolean {
		return !!this.mirror;
	}
}
