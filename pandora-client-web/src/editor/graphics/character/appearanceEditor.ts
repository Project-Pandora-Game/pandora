import { Appearance, AssetGraphicsDefinition, AssetId, CharacterSize, LayerDefinition, LayerImageSetting, LayerMirror, LayerPriority } from 'pandora-common';
import { Texture } from 'pixi.js';
import { toast } from 'react-toastify';
import { AssetGraphics, AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GraphicsManagerInstance, IGraphicsLoader } from '../../../assets/graphicsManager';
import { LoadArrayBufferTexture, StripAssetHash } from '../../../graphics/utility';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Editor } from '../../editor';
import { cloneDeep } from 'lodash';
import { downloadZip, InputWithSizeMeta } from 'client-zip';

export class AppearanceEditor extends Appearance {
	private _enforce = true;

	public get enforce(): boolean {
		return this._enforce;
	}

	public set enforce(value: boolean) {
		if (this._enforce === value) {
			return;
		}
		this._enforce = value;
		if (this._enforce) {
			super.enforcePoseLimits();
		}
	}

	protected override enforcePoseLimits(): boolean {
		if (!this._enforce)
			return false;

		return super.enforcePoseLimits();
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

	override load(definition: AssetGraphicsDefinition): void {
		super.load(definition);
		this.onChange();
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	protected override createLayer(definition: LayerDefinition): AssetGraphicsLayer {
		const layer = super.createLayer(definition);
		layer.on('change', () => {
			this.onChange();
		});
		return layer;
	}

	addLayer(): void {
		const newLayer = this.createLayer({
			x: 0,
			y: 0,
			width: CharacterSize.WIDTH,
			height: CharacterSize.HEIGHT,
			priority: 'OVERLAY',
			points: [],
			mirror: LayerMirror.NONE,
			colorizationIndex: undefined,
			image: {
				image: '',
				overrides: [],
			},
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

	setScaleAs(layer: AssetGraphicsLayer, scaleAs: string | null): void {
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}

		if (scaleAs) {
			layer.definition.scaling = {
				scaleBone: scaleAs,
				stops: [],
			};
		} else {
			layer.definition.scaling = undefined;
		}

		layer.onChange();
		this.onChange();
	}

	addScalingStop(layer: AssetGraphicsLayer, value: number): void {
		if (value === 0 || !Number.isInteger(value) || value < -180 || value > 180 || !layer.definition.scaling) {
			throw new Error('Invalid value supplied');
		}

		if (layer.definition.scaling.stops.some((stop) => stop[0] === value))
			return;

		const newStops: [number, LayerImageSetting][] = [...layer.definition.scaling.stops, [value, cloneDeep(layer.definition.image)]];
		newStops.sort((a, b) => a[0] - b[0]);

		layer.definition.scaling.stops = newStops;

		layer.onChange();
		this.onChange();
	}

	removeScalingStop(layer: AssetGraphicsLayer, stop: number): void {
		if (!layer.definition.scaling) {
			throw new Error('Invalid value supplied');
		}

		layer.definition.scaling.stops = layer.definition.scaling.stops.filter((s) => s[0] !== stop);

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
			if (typeof layer.definition.points === 'string') {
				const manager = GraphicsManagerInstance.value;
				const template = manager?.getTemplate(layer.definition.points);
				if (!template) {
					throw new Error('Unknown point template');
				}
				layer.definition.points = cloneDeep(template);
				layer.onChange();
			}
			return;
		}

		if (typeof source === 'string') {
			const manager = GraphicsManagerInstance.value;
			const template = manager?.getTemplate(source);
			if (!template) {
				throw new Error('Unknown point template');
			}
			layer.definition.points = source;
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

	public getTextureImageSource(name: string): string | null {
		const buffer = this.fileContents.get(name);
		if (!buffer)
			return null;

		return URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
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
			const processSetting = (setting: LayerImageSetting): void => {
				{
					const layerImage = setting.image;
					images.add(layerImage);
					const layerImageBasename = StripAssetHash(layerImage);
					if (layerImage !== layerImageBasename) {
						setting.image = layerImageBasename;
						shouldUpdate = true;
					}
					const alphaImage = setting.alphaImage;
					if (alphaImage) {
						images.add(alphaImage);
						const alphaImageBasename = StripAssetHash(alphaImage);
						if (alphaImage !== alphaImageBasename) {
							setting.alphaImage = alphaImageBasename;
							shouldUpdate = true;
						}
					}
				}
				for (const override of setting.overrides.concat(setting.alphaOverrides ?? [])) {
					images.add(override.image);
					const basename = StripAssetHash(override.image);
					if (override.image !== basename) {
						override.image = basename;
						shouldUpdate = true;
					}
				}
			};
			processSetting(layer.definition.image);
			layer.definition.scaling?.stops.forEach((s) => processSetting(s[1]));
			if (shouldUpdate) {
				layer.onChange();
			}
		}
		return Promise.allSettled(
			Array.from(images.values())
				.filter((image) => image.trim())
				.map((image) =>
					loader
						.loadFileArrayBuffer(image)
						.then((result) => this.addTextureFromArrayBuffer(StripAssetHash(image), result)),
				),
		).then(() => undefined);
	}

	public async downloadZip(): Promise<void> {
		const graphicsDefinitionContent = `// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n` + JSON.stringify(this.export(), undefined, '\t');

		const now = new Date();

		const files: InputWithSizeMeta[] = [
			{ name: 'graphics.json', lastModified: now, input: graphicsDefinitionContent },
		];

		for (const [name, image] of this.fileContents.entries()) {
			files.push({
				name,
				input: image,
				lastModified: now,
			});
		}

		// get the ZIP stream in a Blob
		const blob = await downloadZip(files, {
			metadata: files,
		}).blob();

		// make and click a temporary link to download the Blob
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `${this.id.replace(/^a\//, '').replaceAll('/', '_')}.zip`;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}
}
