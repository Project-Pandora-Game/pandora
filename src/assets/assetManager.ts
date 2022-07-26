import { Asset } from './asset';
import { AssetBodyPart, AssetDefinition, AssetId, AssetsDefinitionFile } from './definitions';
import { BoneDefinition, BoneDefinitionCompressed, CharacterSize } from './graphics';

export class AssetManager {
	private readonly _assets: Map<AssetId, Asset> = new Map();
	private readonly _bones: Map<string, BoneDefinition> = new Map();
	private _definitionsHash: string = '';

	get definitionsHash(): string {
		return this._definitionsHash;
	}

	private _graphicsId: string = '';
	get graphicsId(): string {
		return this._graphicsId;
	}

	private _bodyparts: readonly AssetBodyPart[] = [];
	get bodyparts(): readonly AssetBodyPart[] {
		return this._bodyparts;
	}

	public getAllAssets(): Asset[] {
		return [...this._assets.values()];
	}

	public getAssetById(id: AssetId): Asset | undefined {
		return this._assets.get(id);
	}

	public getAllBones(): BoneDefinition[] {
		return [...this._bones.values()];
	}

	/**
	 * Finds the bone with the given name.
	 * @param name - name of the bone
	 * @throws if the bone does not exist
	 * @returns the bone definition
	 */
	public getBoneByName(name: string): BoneDefinition {
		const bone = this._bones.get(name);
		if (!bone) {
			throw new Error(`Bone '${name}' not found`);
		}
		return bone;
	}

	public load(definitionsHash: string, data: AssetsDefinitionFile): void {
		this._definitionsHash = definitionsHash;
		this._bodyparts = data.bodyparts;
		this._graphicsId = data.graphicsId;

		this._bones.clear();
		this.loadBones(data.bones);

		this.loadAssets(data.assets);
	}

	private loadAssets(assets: Record<AssetId, AssetDefinition>): void {
		// First unload no-longer existing assets
		for (const id of this._assets.keys()) {
			if (assets[id] === undefined) {
				this._assets.delete(id);
			}
		}
		// Then load or update all defined assets
		for (const [id, definition] of Object.entries(assets)) {
			if (!id.startsWith('a/')) {
				throw new Error(`Asset without valid prefix: ${id}`);
			}
			let asset = this._assets.get(id as AssetId);
			if (asset) {
				asset.load(definition);
			} else {
				asset = this.createAsset(id as AssetId, definition);
				this._assets.set(id as AssetId, asset);
			}
		}
	}

	protected createAsset(id: AssetId, data: AssetDefinition): Asset {
		return new Asset(id, data);
	}

	protected loadBones(bones: Record<string, BoneDefinitionCompressed>): void {
		const next: Record<string, BoneDefinitionCompressed> = {};
		let allNext = true;
		let hasNext = false;
		for (const [name, bone] of Object.entries(bones)) {
			const parent = bone.parent ? this._bones.get(bone.parent) : undefined;
			if (bone.parent && !parent) {
				next[name] = bone;
				hasNext = true;
				continue;
			}
			allNext = false;
			const newBone = this.createBone(name, bone, parent);
			this._bones.set(name, newBone);

			if (!bone.mirror) continue;
			if (name.endsWith('_l') && !bone.mirror.endsWith('_r'))
				throw new Error(`Mirrored bone ${name} has invalid mirror name ${bone.mirror}, mirror must end with _r`);
			if (name.endsWith('_r') && !bone.mirror.endsWith('_l'))
				throw new Error(`Mirrored bone ${name} has invalid mirror name ${bone.mirror}, mirror must end with _l`);
			if (!name.endsWith('_l') && !name.endsWith('_r'))
				throw new Error(`Mirrored bone ${name} has invalid name, name must end with _l or _r`);

			this._bones.set(bone.mirror, this.createBone(bone.mirror, {
				...bone,
			}, parent?.mirror ?? parent, newBone));

		}
		if (allNext && hasNext) {
			throw new Error('Circular dependency detected');
		}
		if (hasNext) {
			this.loadBones(next);
		}
	}

	protected createBone(name: string, bone: BoneDefinitionCompressed, parent?: BoneDefinition, mirror?: BoneDefinition): BoneDefinition {
		const [x, y] = bone.pos ?? [0, 0];
		const res: BoneDefinition = {
			name,
			x: mirror ? CharacterSize.WIDTH - x : x,
			y,
			baseRotation: bone.baseRotation,
			mirror,
			isMirror: mirror !== undefined,
			parent,
			type: bone.type,
		};
		if (mirror) {
			mirror.mirror = res;
		}
		return res;
	}
}
