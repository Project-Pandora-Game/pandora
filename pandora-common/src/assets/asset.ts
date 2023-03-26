import { Immutable } from 'immer';
import { AssetDefinition, AssetId } from './definitions';
import { GetModuleStaticAttributes } from './modules';

export class Asset {
	public readonly id: AssetId;
	public readonly definition: Immutable<AssetDefinition>;
	/** Attributes this asset can have statically, including reported by modules */
	public readonly staticAttributes: ReadonlySet<string>;

	constructor(id: AssetId, definition: Immutable<AssetDefinition>) {
		this.id = id;
		this.definition = definition;

		const staticAttributes = this.staticAttributes = new Set<string>();
		definition.attributes?.forEach((a) => staticAttributes.add(a));
		for (const module of Object.values(definition.modules ?? {})) {
			GetModuleStaticAttributes(module).forEach((a) => staticAttributes.add(a));
		}
	}
}
