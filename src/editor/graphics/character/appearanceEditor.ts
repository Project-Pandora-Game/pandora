import { Appearance, Asset, AssetGraphicsDefinition, AssetId, CharacterSize, ItemId, LayerMirror, LayerPriority } from 'pandora-common';
import { Texture } from 'pixi.js';
import { toast } from 'react-toastify';
import { AssetGraphics, AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { IGraphicsLoader } from '../../../assets/graphicsManager';
import { LoadArrayBufferTexture, StripAssetHash } from '../../../graphics/utility';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Editor } from '../../editor';
import { cloneDeep } from 'lodash';

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
		this.onChange();
	}

	deleteLayer(layer: AssetGraphicsLayer): void {
		const index = this.layers.indexOf(layer);
		if (index < 0)
			return;

		// Prevent deletion if the layer has dependants
		const dependant = this.layers.find((l) => l !== layer && l.definition.points === index);
		if (dependant) {
			toast(`Failed to delete layer, because layer '${dependant.name}' depends on it`, TOAST_OPTIONS_ERROR);
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

	setLayerPriority(layer: AssetGraphicsLayer, priority: LayerPriority): void {
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}

		layer.definition.priority = priority;

		layer.onChange();
		this.onChange();
	}

	public layerMirrorFrom(layer: AssetGraphicsLayer, source: number | string | null): void {
		if (layer.mirror && layer.isMirror)
			return this.layerMirrorFrom(layer.mirror, source);

		if (!this.layers.includes(layer)) {
			throw new Error('Cannot configure unknown layer');
		}

		if (source === null) {
			if (typeof layer.definition.points === 'number') {
				const points = this.layers[layer.definition.points].definition.points;
				if (!Array.isArray(points)) {
					throw new Error('More than one jump in points reference');
				}
				layer.definition.points = cloneDeep(points);
				layer.onChange();
			}
			return;
		}

		if (typeof source === 'string') {
			const template = this.editor.pointTemplates.get(source);
			if (!template) {
				throw new Error('Unknown point template');
			}
			layer.definition.points = cloneDeep(template);
			layer.onChange();
			return;
		}

		if (source === layer.index) {
			throw new Error('Cannot mirror layer from itself');
		}

		const sourceLayer = this.layers[source];
		if (!Array.isArray(sourceLayer?.definition.points)) {
			throw new Error('Cannot mirror from layer that doesn\'t have own points');
		}

		layer.definition.points = source;
		layer.onChange();
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
					changed.push(layer);
				}
			}
		}
		for (const layer of changed) {
			layer.onChange();
		}
	}

	private readonly fileContents = new Map<string, ArrayBuffer>();
	private readonly textures = new Map<string, Texture>([['', Texture.EMPTY]]);
	private _loadedTextures: readonly string[] = [];
	public get loadedTextures(): readonly string[] {
		return this._loadedTextures;
	}

	public getTexture(image: string): Promise<Texture> {
		const texture = this.textures.get(image);
		return texture ? Promise.resolve(texture) : Promise.reject();
	}

	public async addTextureFromArrayBuffer(name: string, buffer: ArrayBuffer): Promise<void> {
		const texture = await LoadArrayBufferTexture(buffer);
		this.fileContents.set(name, buffer);
		this.textures.set(name, texture);
		if (!this._loadedTextures.includes(name)) {
			this._loadedTextures = [...this._loadedTextures, name];
		}
		this.onChange();
	}

	public deleteTexture(name: string): void {
		this.fileContents.delete(name);
		this.textures.delete(name);
		this._loadedTextures = this._loadedTextures.filter((t) => t !== name);
		this.onChange();
	}

	public async addTexturesFromFiles(files: FileList): Promise<void> {
		for (let i = 0; i < files.length; i++) {
			const file = files.item(i);
			if (!file || !file.name.endsWith('.png'))
				continue;
			const buffer = await file.arrayBuffer();
			await this.addTextureFromArrayBuffer(file.name, buffer);
		}
	}

	public loadAllUsedImages(loader: IGraphicsLoader): Promise<void> {
		const images = new Set<string>();
		for (const layer of this.layers) {
			let shouldUpdate = false;
			{
				const layerImage = layer.definition.image;
				images.add(layerImage);
				const layerImageBasename = StripAssetHash(layerImage);
				if (layerImage !== layerImageBasename) {
					layer.definition.image = layerImageBasename;
					shouldUpdate = true;
				}
			}
			for (const override of layer.definition.imageOverrides) {
				images.add(override.image);
				const basename = StripAssetHash(override.image);
				if (override.image !== basename) {
					override.image = basename;
					shouldUpdate = true;
				}
			}
			if (shouldUpdate) {
				layer.onChange();
			}
		}
		return Promise.allSettled(
			Array.from(images.values())
				.map((image) =>
					loader
						.loadFileArrayBuffer(image)
						.then((result) => this.addTextureFromArrayBuffer(StripAssetHash(image), result)),
				),
		).then(() => undefined);
	}
}
