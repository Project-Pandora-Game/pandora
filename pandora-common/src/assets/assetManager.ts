import { freeze, Immutable } from 'immer';
import type { CharacterId } from '../character/characterTypes.ts';
import type { Logger } from '../logging/logger.ts';
import { Assert, AssertNotNullable, CloneDeepMutable } from '../utility/misc.ts';
import { Asset } from './asset.ts';
import type { AssetId } from './base.ts';
import { AppearanceRandomizationData, AssetAttributeDefinition, AssetBodyPart, AssetsDefinitionFile, AssetType, RoomBackgroundInfo, RoomBackgroundTagDefinition, type CharacterModifierInbuiltTemplates } from './definitions.ts';
import { BoneDefinition, BoneDefinitionCompressed, CharacterSize } from './graphics/index.ts';
import { CreateItemBundleFromTemplate, Item, ItemBundle, ItemTemplate, LoadItemFromBundle, type IItemCreationContext, type ItemId } from './item/index.ts';
import type { AssetsPosePresets } from './state/characterStatePose.ts';

export class AssetManager {
	protected readonly _assets: ReadonlyMap<AssetId, Asset>;
	protected readonly _bones: ReadonlyMap<string, BoneDefinition>;
	protected readonly _posePresets: Immutable<AssetsPosePresets>;
	protected readonly _backgrounds: readonly Immutable<RoomBackgroundInfo>[];

	public readonly definitionsHash: string;
	public readonly graphicsId: string;
	public readonly graphicsSourceId: string;
	public readonly rawData: Immutable<AssetsDefinitionFile>;

	public readonly backgroundTags: ReadonlyMap<string, RoomBackgroundTagDefinition>;
	public readonly attributes: ReadonlyMap<string, Immutable<AssetAttributeDefinition>>;
	public readonly bodyparts: readonly AssetBodyPart[];
	public readonly randomization: AppearanceRandomizationData;
	public readonly characterModifierTemplates: Immutable<CharacterModifierInbuiltTemplates>;

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

	public getBackgrounds(): readonly RoomBackgroundInfo[] {
		return CloneDeepMutable(this._backgrounds);
	}

	public getBackgroundById(id: string): RoomBackgroundInfo | null {
		return CloneDeepMutable(this._backgrounds.find((b) => b.id === id) ?? null);
	}

	public getAttributeDefinition(attribute: string): Immutable<AssetAttributeDefinition> | undefined {
		return this.attributes.get(attribute);
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

	constructor(definitionsHash: string, data?: Partial<Immutable<AssetsDefinitionFile>>) {
		this.definitionsHash = definitionsHash;

		// Note: Intentionally always assigning here instead of null coalescing,
		// to perform easy "migration" of asset data that might be missing fields
		const fullData: Immutable<AssetsDefinitionFile> = {
			assets: {},
			bones: {},
			posePresets: [],
			bodyparts: [],
			graphicsId: '',
			graphicsSourceId: '',
			backgroundTags: {},
			backgrounds: [],
			attributes: {},
			randomization: {
				body: [],
				clothes: [],
				pose: {},
			},
			characterModifierTemplates: {},
			...data,
		};

		this.rawData = freeze(fullData, true);

		this.bodyparts = fullData.bodyparts;
		this.graphicsId = fullData.graphicsId;
		this.graphicsSourceId = fullData.graphicsSourceId;
		this._posePresets = fullData.posePresets;
		this._backgrounds = fullData.backgrounds;
		this.randomization = fullData.randomization;
		this.characterModifierTemplates = fullData.characterModifierTemplates;

		//#region Load Background Tags
		const tags = new Map<string, Readonly<RoomBackgroundTagDefinition>>();

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

		this._bones = bones;
		//#endregion

		//#region Load attributes
		const attributes = new Map<string, Immutable<AssetAttributeDefinition>>();

		for (const [id, definition] of Object.entries(fullData.attributes)) {
			attributes.set(id, definition);
		}

		this.attributes = attributes;
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
			uiPositionOffset: (mirror && bone.uiPositionOffset != null) ? [-bone.uiPositionOffset[0], bone.uiPositionOffset[1]] : bone.uiPositionOffset,
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

	public createItem<T extends AssetType>(id: ItemId, asset: Asset<T>, creator: { id: CharacterId; }, logger?: Logger): Item<T> {
		Assert(this._assets.get(asset.id) === asset);

		return LoadItemFromBundle<T>(asset, {
			id,
			asset: asset.id,
			spawnedBy: creator.id,
		}, {
			assetManager: this,
			doLoadTimeCleanup: false,
			logger,
			loadItemFromBundle: LoadItemFromBundle,
		});
	}

	public createItemFromTemplate(template: Immutable<ItemTemplate>, creator: IItemCreationContext['creator']): Item | undefined {
		// Build a bundle from the template
		const bundle: ItemBundle | undefined = CreateItemBundleFromTemplate(template, {
			assetManager: this,
			creator,
			createItemBundleFromTemplate: CreateItemBundleFromTemplate,
		});

		// Fail if creating bundle failed for any reason
		if (bundle == null)
			return undefined;

		const rootAsset = this.getAssetById(bundle.asset);
		// Should be valid by now
		AssertNotNullable(rootAsset);

		return this.loadItemFromBundle(rootAsset, bundle);
	}

	public loadItemFromBundle<T extends AssetType>(asset: Asset<T>, bundle: ItemBundle, logger?: Logger): Item {
		Assert(this._assets.get(asset.id) === asset);
		Assert(asset.id === bundle.asset);
		return LoadItemFromBundle(asset, bundle, {
			assetManager: this,
			doLoadTimeCleanup: true,
			logger,
			loadItemFromBundle: LoadItemFromBundle,
		});
	}
}
