import { Appearance, Asset, AssetGraphicsDefinition, AssetId, CharacterSize, ItemId, LayerMirror, LayerPriority } from 'pandora-common';
import { toast } from 'react-toastify';
import { AssetGraphics, AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Editor } from '../../editor';

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
	readonly editor: Editor;
	public onChangeHandler: (() => void) | undefined;

	constructor(editor: Editor, id: AssetId, definition?: AssetGraphicsDefinition, onChange?: () => void) {
		super(id, definition ?? {
			layers: [],
		});
		this.editor = editor;
		this.onChangeHandler = onChange;
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	addLayer(): void {
		const newLayer = this.createLayer({
			x: 0,
			y: 0,
			width: CharacterSize.WIDTH,
			height: CharacterSize.HEIGHT,
			image: '',
			priority: LayerPriority.OVERLAY,
			points: [],
			mirror: LayerMirror.NONE,
			imageOverrides: [],
		});
		this.layers = [...this.layers, newLayer];
		newLayer.buildPoints();
		this.onChange();
	}

	removeLayer(layer: AssetGraphicsLayer): void {
		const index = this.layers.indexOf(layer);
		if (index < 0)
			return;

		// Prevent deletion if the layer has dependants
		const dependant = this.layers.find((l) => l !== layer && l.definition.points === index);
		if (dependant) {
			toast(`Failed to remove layer, because layer '${dependant.name}' depends on it`, TOAST_OPTIONS_ERROR);
			return;
		}

		const pointsMap = this.makePointDependenciesMap();
		pointsMap.delete(layer);

		this.layers = this.layers.filter((l) => l !== layer);

		this.applyPointDependenciesMap(pointsMap);

		this.onChange();
	}

	moveLayerRelative(layer: AssetGraphicsLayer, shift: number): void {
		const currentPos = this.layers.indexOf(layer);
		if (currentPos < 0)
			return;

		const newPos = currentPos + shift;
		if (newPos < 0 && newPos >= this.layers.length)
			return;

		const pointsMap = this.makePointDependenciesMap();

		const newLayers = this.layers.slice();
		newLayers.splice(currentPos, 1);
		newLayers.splice(newPos, 0, layer);
		this.layers = newLayers;

		this.applyPointDependenciesMap(pointsMap);

		this.onChange();
	}

	private makePointDependenciesMap(): Map<AssetGraphicsLayer, AssetGraphicsLayer> {
		const result = new Map<AssetGraphicsLayer, AssetGraphicsLayer>();
		for (const layer of this.layers) {
			if (typeof layer.definition.points === 'number') {
				result.set(layer, this.layers[layer.definition.points]);
			}
		}
		return result;
	}

	private applyPointDependenciesMap(map: Map<AssetGraphicsLayer, AssetGraphicsLayer>) {
		const changed: AssetGraphicsLayer[] = [];
		for (const layer of this.layers) {
			if (typeof layer.definition.points === 'number') {
				const sourceLayer = map.get(layer);
				if (!sourceLayer) {
					throw new Error(`Failed to apply point map, layer '${layer.name}' not found in map`);
				}
				const sourceIndex = this.layers.indexOf(sourceLayer);
				if (sourceIndex < 0) {
					throw new Error(`Failed to apply point map, depencency layer '${sourceLayer.name}' for '${layer.name}' not found`);
				}
				if (layer.definition.points !== sourceIndex) {
					layer.definition.points = sourceIndex;
					layer.updateMirror();
					changed.push(layer);
				}
			}
		}
		for (const layer of changed) {
			layer.buildPoints();
		}
	}
}
