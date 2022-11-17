import { AssetDefinition, AssetId } from './definitions';

export class Asset {
	public readonly id: AssetId;
	public definition!: AssetDefinition;

	constructor(id: AssetId, definition: AssetDefinition) {
		this.id = id;
		this.load(definition);
	}

	public load(definition: AssetDefinition) {
		this.definition = definition;
	}
}
