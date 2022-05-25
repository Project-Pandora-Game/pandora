import { BoneDefinition, BoneState } from 'pandora-common';
import { observable, ObservableClass } from '../../../observable';

type IObservableBone = {
	definition: BoneDefinition;
	rotation: number;
};
export class ObservableBone extends ObservableClass<IObservableBone> implements BoneState {
	@observable
	public definition: BoneDefinition;
	@observable
	public rotation: number = 0;

	public readonly mirror?: ObservableBone;
	public readonly parent?: ObservableBone;
	public readonly isMirror: boolean;

	constructor(definition: BoneDefinition, parent?: ObservableBone, mirrorOf?: ObservableBone) {
		super();
		this.isMirror = mirrorOf !== undefined;
		this.definition = definition;
		this.parent = parent;
		this.mirror = mirrorOf;
		if (definition.mirror && !this.isMirror) {
			this.mirror = new ObservableBone(definition.mirror, this.parent?.mirror ?? this.parent, this);
		}
	}
}
