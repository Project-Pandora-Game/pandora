import { freeze, Immutable } from 'immer';
import type { Logger } from '../logging';
import { Assert, CloneDeepMutable } from '../utility';
import type { ItemId } from './appearanceTypes';
import { Asset } from './asset';
import { AppearanceRandomizationData, AssetAttributeDefinition, AssetBodyPart, AssetId, AssetsDefinitionFile, AssetSlotDefinition, AssetsPosePresets, AssetType, BackgroundTagDefinition, IChatroomBackgroundInfo } from './definitions';
import { BoneDefinition, BoneDefinitionCompressed, CharacterSize } from './graphics';
import { CreateItem, Item, ItemBundle } from './item';

export const FAKE_BONES: readonly string[] = ['backView', 'kneeling', 'sitting'];

export class AssetManager {
	protected readonly _assets: ReadonlyMap<AssetId, Asset>;
	protected readonly _bones: ReadonlyMap<string, BoneDefinition>;
	protected readonly _posePresets: Immutable<AssetsPosePresets>;
	protected readonly _backgrounds: readonly Immutable<IChatroomBackgroundInfo>[];

	public readonly definitionsHash: string;
	public readonly graphicsId: string;
	public readonly rawData: Immutable<AssetsDefinitionFile>;

	public readonly backgroundTags: ReadonlyMap<string, BackgroundTagDefinition>;
	public readonly attributes: ReadonlyMap<string, Readonly<AssetAttributeDefinition>>;
	public readonly bodyparts: readonly AssetBodyPart[];
	public readonly randomization: AppearanceRandomizationData;
	public readonly assetSlots: ReadonlyMap<string, Readonly<AssetSlotDefinition>>;

	public getAllAssets(): Asset[] {
		return [...this._assets.values()];
	}

	public getAssetById(id: AssetId): Asset | undefined {
		return this._assets.get(id);
	}

	public getAllBones(): BoneDefinition[] {
		return [...this._bones.values()];
	}

	public getPosePresets(): AssetsPosePresets {
		return CloneDeepMutable(this._posePresets);
	}

	public getBackgrounds(): readonly IChatroomBackgroundInfo[] {
		return CloneDeepMutable(this._backgrounds);
	}

	public getBackgroundById(id: string): IChatroomBackgroundInfo | null {
		return CloneDeepMutable(this._backgrounds.find((b) => b.id === id) ?? null);
	}

	public getAttributeDefinition(attribute: string): Readonly<AssetAttributeDefinition> | undefined {
		return this.attributes.get(attribute);
	}

	public getSlotDefinition(slot: string): Readonly<AssetSlotDefinition> | undefined {
		return this.assetSlots.get(slot);
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

	constructor(definitionsHash?: string, data?: Partial<Immutable<AssetsDefinitionFile>>) {
		this.definitionsHash = definitionsHash ?? '';

		// Note: Intentionally always assigning here instead of null coalescing,
		// to perform easy "migration" of asset data that might be missing fields
		const fullData: Immutable<AssetsDefinitionFile> = {
			assets: {},
			assetSlots: {},
			bones: {},
			posePresets: [],
			bodyparts: [],
			graphicsId: '',
			backgroundTags: {},
			backgrounds: [],
			attributes: {},
			randomization: {
				body: [],
				clothes: [],
			},
			...data,
		};

		this.rawData = freeze(fullData, true);

		this.bodyparts = fullData.bodyparts;
		this.graphicsId = fullData.graphicsId;
		this._posePresets = fullData.posePresets;
		this._backgrounds = fullData.backgrounds;
		this.randomization = fullData.randomization;

		//#region Load Background Tags
		const tags = new Map<string, Readonly<BackgroundTagDefinition>>();

		for (const [id, definition] of Object.entries(fullData.backgroundTags)) {
			tags.set(id, definition);
		}

		this.backgroundTags = tags;
		//#endregion

		//#region Load bones
		const bones = new Map<string, BoneDefinition>();

		for (const [name, bone] of Object.entries(fullData.bones)) {
			const parent = bone.parent ? bones.get(bone.parent) : undefined;
			if (bone.parent && !parent) {
				throw new Error(`Parents must be defined before bones that use them ('${name}' depends on '${bone.parent}', but parent not found)`);
			}
			const newBone = this.createBone(name, bone, parent);
			bones.set(name, newBone);

			if (!bone.mirror) continue;
			if (name.endsWith('_l') && !bone.mirror.endsWith('_r'))
				throw new Error(`Mirrored bone ${name} has invalid mirror name ${bone.mirror}, mirror must end with _r`);
			if (name.endsWith('_r') && !bone.mirror.endsWith('_l'))
				throw new Error(`Mirrored bone ${name} has invalid mirror name ${bone.mirror}, mirror must end with _l`);
			if (!name.endsWith('_l') && !name.endsWith('_r'))
				throw new Error(`Mirrored bone ${name} has invalid name, name must end with _l or _r`);

			bones.set(bone.mirror, this.createBone(bone.mirror, {
				...bone,
			}, parent?.mirror ?? parent, newBone));
		}
		for (const bone of FAKE_BONES) {
			bones.set(bone, this.createBone(bone, { type: 'fake' }));
		}

		this._bones = bones;
		//#endregion

		//#region Load attributes
		const attributes = new Map<string, Readonly<AssetAttributeDefinition>>();

		for (const [id, definition] of Object.entries(fullData.attributes)) {
			attributes.set(id, definition);
		}

		this.attributes = attributes;
		//#endregion

		//#region Load slots
		const assetSlots = new Map<string, Readonly<AssetSlotDefinition>>();

		for (const [id, definition] of Object.entries(fullData.assetSlots)) {
			assetSlots.set(id, definition);
		}

		this.assetSlots = assetSlots;
		//#endregion

		//#region Load assets
		const assets = new Map<AssetId, Asset>();

		for (const [id, definition] of Object.entries(fullData.assets)) {
			if (!id.startsWith('a/')) {
				throw new Error(`Asset without valid prefix: ${id}`);
			}
			const asset = new Asset(id as AssetId, definition);
			assets.set(id as AssetId, asset);
		}

		this._assets = assets;
		//#endregion
	}

	protected createBone(name: string, bone: Immutable<BoneDefinitionCompressed>, parent?: BoneDefinition, mirror?: BoneDefinition): BoneDefinition {
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

	public createItem<T extends AssetType>(id: ItemId, asset: Asset<T>, bundle: ItemBundle | null, logger?: Logger): Item<T> {
		Assert(this._assets.get(asset.id) === asset);
		return CreateItem<T>(id, asset, bundle ?? {
			id,
			asset: asset.id,
		}, {
			assetManager: this,
			doLoadTimeCleanup: bundle !== null,
			logger,
		});
	}
}
