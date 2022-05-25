import { PointDefinition, TransformDefinition, CharacterSize } from 'pandora-common';
import { MirrorTransform } from '../../graphics/mirroring';

export class MirrorPointDefinition implements PointDefinition {
	private _pair: MirrorPointDefinition | undefined;
	public pos: [number, number];
	public mirror: boolean;
	public transforms: TransformDefinition[];
	public pointType?: string;

	constructor({ pos, mirror, transforms, pointType }: PointDefinition, pair?: MirrorPointDefinition) {
		this._pair = pair;
		this.pos = pos;
		this.mirror = mirror;
		this.transforms = transforms;
		this.pointType = pointType;
		if (pointType && !pointType.endsWith('_l') && !pointType.endsWith('_r')) {
			this.pointType += pos[0] < CharacterSize.WIDTH / 2 ? '_r' : '_l';
		}

		this.updatePair();
	}

	public isMirrored(): boolean {
		return !!this._pair;
	}

	public createPair(): MirrorPointDefinition {
		this._pair ??= new MirrorPointDefinition(this, this);
		return this._pair;
	}

	public removePair(): void {
		if (this._pair) {
			this._pair._pair = undefined;
			this._pair = undefined;
		}
	}

	public updatePair(keys?: (keyof PointDefinition)[]): void {
		if (!this._pair) {
			return;
		}
		const { pos, mirror, transforms, pointType } = this;
		if (!keys || keys.includes('pos')) {
			this._pair.pos = [CharacterSize.WIDTH - pos[0], pos[1]];
		}
		if (!keys || keys.includes('mirror')) {
			this._pair.mirror = !mirror;
		}
		if (!keys || keys.includes('transforms')) {
			this._pair.transforms = transforms.map(MirrorTransform);
		}
		if (!keys || keys.includes('pointType')) {
			this._pair.pointType = pointType && pointType.replace(/_r$/, '_l').replace(/_l$/, '_r');
		}
	}
}
