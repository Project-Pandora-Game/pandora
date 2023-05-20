import { Immutable } from 'immer';
import { AssetDefinition, AssetId, AssetType, IsWearableAssetDefinition, WearableAssetType } from './definitions';
import { GetModuleStaticAttributes } from './modules';
import { Assert } from '../utility';

export class Asset<Type extends AssetType = AssetType> {
	public readonly id: AssetId;
	public readonly definition: Immutable<AssetDefinition<Type>>;
	/** Attributes this asset can have statically, including reported by modules */
	public readonly staticAttributes: ReadonlySet<string>;

	public get type(): Type {
		return this.definition.type as Type;
	}

	public isType<T extends AssetType>(type: T): this is Asset<T> {
		return this.definition.type === type;
	}

	public isWearable(): this is Asset<WearableAssetType> {
		return IsWearableAssetDefinition(this.definition);
	}

	constructor(id: AssetId, definition: Immutable<AssetDefinition<Type>>) {
		this.id = id;
		this.definition = definition;
		Assert(definition.id === id);

		const staticAttributes = this.staticAttributes = new Set<string>();
		if (definition.type === 'personal') {
			definition.attributes?.forEach((a) => staticAttributes.add(a));
			for (const module of Object.values(definition.modules ?? {})) {
				GetModuleStaticAttributes(module).forEach((a) => staticAttributes.add(a));
			}
		} else if (definition.type === 'roomDevice') {
			definition.staticAttributes?.forEach((a) => staticAttributes.add(a));
		} else if (definition.type === 'roomDeviceWearablePart') {
			definition.attributes?.forEach((a) => staticAttributes.add(a));
		}
	}

	/** Returns if this asset can be manually spawned */
	public canBeSpawned(): boolean {
		return !this.isType('roomDeviceWearablePart');
	}
}

export function FilterAssetType<T extends AssetType>(type: T): (asset: Asset) => asset is Asset<T> {
	return (asset): asset is Asset<T> => asset.isType(type);
}

export function FilterAssetWearable(asset: Asset): asset is Asset<WearableAssetType> {
	return asset.isWearable();
}
