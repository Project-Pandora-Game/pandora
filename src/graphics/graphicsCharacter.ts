import type { ICharacterData } from 'pandora-common';
import type { BoneState, LayerState } from './def';
import { AssetState, AtomicCondition, TransformDefinition } from 'pandora-common/dist/assets';
import { Container } from 'pixi.js';
import { Character } from '../character/character';
import { GraphicsLayer } from './graphicsLayer';
import { EvaluateCondition, RotateVector } from './utility';
import { GetAssetStateManager } from './stateManager';

export class GraphicsCharacter extends Container {
	private readonly _character: Character;
	private _layers: LayerState[] = [];
	protected bones: BoneState[] = GetAssetStateManager().getInitialBoneStates();

	constructor(character: Character) {
		super();

		this.sortableChildren = true;
		this._character = character;

		const cleanup = this._character.on('update', (data) => this.update(data));
		this.on('destroy', () => cleanup);

		this.update(this._character.data);
	}

	protected update(data: Partial<ICharacterData>): void {
		let update = false;
		if (data.assets) {
			const create = (asset: AssetState) => GetAssetStateManager().getLayers(asset);
			this._layers = data.assets.flatMap(create);
			update = true;
		}
		const updatedBones = new Set<string>();
		if (data.bones) {
			const bones = data.bones;
			this.bones.forEach((bone) => {
				const rotation = bones.find((b) => b[0] === bone.name)?.[1] ?? 0;
				if (bone.rotation !== rotation) {
					bone.rotation = rotation;
					updatedBones.add(bone.name);
					update = true;
				}
			});
		}
		if (update) {
			this.layerUpdate(updatedBones);
		}
	}

	protected createLayer = GraphicsLayer.create;
	private _graphicsLayers = new Map<string, GraphicsLayer>();
	protected layerUpdate(bones: Set<string>): void {
		this._evalCacheClear();
		const keys = new Set<string>();
		for (const { asset, layer, state, index } of this._layers) {
			const key = `${asset.id}-${index}`;
			keys.add(key);
			let graphics = this._graphicsLayers.get(key);
			if (!graphics) {
				this._graphicsLayers.set(key, graphics = this.createLayer({ layer, state, character: this, transform: this.evalTransform, evaluate: this.evalCondition }));
				this.addChild(graphics);
			} else {
				graphics.update({ bones, state });
			}
		}
		for (const [key, graphics] of this._graphicsLayers) {
			if (!keys.has(key)) {
				this._graphicsLayers.delete(key);
				this.removeChild(graphics);
				graphics.destroy();
			}
		}
		this.sortChildren();
	}

	//#region Point transform
	private readonly _evalCache = new Map<string, boolean>();
	protected evalCondition = this._evalCondition.bind(this);
	private _evalCondition(condition: AtomicCondition): boolean {
		const key = `${condition.bone}-${condition.operator}-${condition.value}`;
		let result = this._evalCache.get(key);
		if (result === undefined) {
			const bone = this.getBone(condition.bone);
			this._evalCache.set(key, result = this._evalConditionCore(condition, bone));
		}
		return result;
	}
	private _evalCacheClear = (): void => this._evalCache.clear();
	private _evalConditionCore({ operator, value }: AtomicCondition, { rotation }: BoneState): boolean {
		switch (operator) {
			case '>':
				return rotation > value;
			case '<':
				return rotation < value;
			case '=':
				return rotation === value;
			case '!=':
				return rotation !== value;
			case '>=':
				return rotation >= value;
			case '<=':
				return rotation <= value;
		}
		throw new Error(`_evalConditionCore invalid operator: ${operator as string}`);
	}
	protected evalTransform = this._evalTransform.bind(this);
	private _evalTransform([x, y]: [number, number], transforms: readonly TransformDefinition[]): [number, number] {
		let [resX, resY] = [x, y];
		for (const transform of transforms) {
			const { type, bone: boneName, condition } = transform;
			const bone = this.getBone(boneName);
			if (condition && !EvaluateCondition(condition, this.evalCondition)) {
				continue;
			}
			switch (type) {
				case 'rotate': {
					let vecX = resX - bone.x;
					let vecY = resY - bone.y;
					const value = transform.value * bone.rotation;
					[vecX, vecY] = RotateVector(vecX, vecY, value);
					resX = bone.x + vecX;
					resY = bone.y + vecY;
					break;
				}
				case 'shift': {
					const percent = bone.rotation / 180;
					resX += percent * transform.value.x;
					resY += percent * transform.value.y;
					break;
				}
			}
		}
		return [resX, resY];
	}
	//#endregion

	private getBone(name: string): BoneState {
		const bone = this.bones.find((b) => b.name === name);
		if (!bone) {
			throw new Error(`Bone ${name} not found in: [${this.bones.map((b) => b.name).join(', ')}]`);
		}
		return bone;
	}
}
