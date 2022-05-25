import { nanoid } from 'nanoid';
import { Appearance, Asset, AssetGraphicsDefinition, ItemId } from 'pandora-common';
import { AssetGraphics } from '../../../assets/assetGraphics';

export class AppearanceEditor extends Appearance {

	// Unrestricted adding and removing of items
	public override allowCreateItem(id: ItemId, _asset: Asset): boolean {
		return this.getItemById(id) === undefined;
	}

	public override allowRemoveItem(id: ItemId): boolean {
		return this.getItemById(id) !== undefined;
	}
}

export class EditorAssetGraphics extends AssetGraphics {

	constructor() {
		super(`a/editor/${nanoid()}`, {
			layers: [],
		});
	}

	export(): AssetGraphicsDefinition {
		return {
			layers: this.layers.map((l) => l.definition),
		};
	}
}
