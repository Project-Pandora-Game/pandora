import { downloadZip, type InputWithSizeMeta } from 'client-zip';
import { freeze, type Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	Assert,
	AssertNever,
	AssetSourceGraphicsDefinitionSchema,
	CharacterSize,
	EMPTY_ARRAY,
	LayerMirror,
	type AssetId,
	type AssetSourceGraphicsDefinition,
	type GraphicsLayerType,
	type GraphicsSourceLayer,
} from 'pandora-common';
import { Texture } from 'pixi.js';
import type { IGraphicsLoader } from '../../assets/graphicsManager.ts';
import { DownloadAsFile } from '../../common/downloadHelper.ts';
import { LoadArrayBufferImageResource } from '../../graphics/utility.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { EditorAssetGraphicsLayer, EditorAssetGraphicsLayerContainer } from './editorAssetGraphicsLayer.ts';

export class EditorAssetGraphics {
	public readonly id: AssetId;
	public onChangeHandler: (() => void) | undefined;

	private readonly _layers = new Observable<readonly EditorAssetGraphicsLayer[]>([]);
	public get layers(): ReadonlyObservable<readonly EditorAssetGraphicsLayer[]> {
		return this._layers;
	}

	constructor(id: AssetId, definition: Immutable<AssetSourceGraphicsDefinition>, onChange?: () => void) {
		this.id = id;
		this.load(definition);
		this.onChangeHandler = onChange;
	}

	public load(definition: Immutable<AssetSourceGraphicsDefinition>): void {
		freeze(definition, true);
		this._layers.value = definition.layers.map((l): EditorAssetGraphicsLayer => {
			const layer = EditorAssetGraphicsLayerContainer.create(l, this);
			layer.definition.subscribe(() => {
				this.onChange();
			});
			return layer;
		});
		this.onChange();
	}

	public export(): Immutable<AssetSourceGraphicsDefinition> {
		return {
			layers: this._layers.value.map((l) => l.definition.value),
		};
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	public addLayer(type: GraphicsLayerType): void {
		let layerDefinition: GraphicsSourceLayer;
		switch (type) {
			case 'mesh':
				layerDefinition = {
					x: 0,
					y: 0,
					width: CharacterSize.WIDTH,
					height: CharacterSize.HEIGHT,
					name: '',
					priority: 'OVERLAY',
					type: 'mesh',
					points: '',
					mirror: LayerMirror.NONE,
					colorizationKey: undefined,
					image: {
						image: '',
						overrides: [],
					},
				};
				break;
			case 'alphaImageMesh':
				layerDefinition = {
					x: 0,
					y: 0,
					width: CharacterSize.WIDTH,
					height: CharacterSize.HEIGHT,
					name: '',
					priority: 'OVERLAY',
					type: 'alphaImageMesh',
					points: '',
					mirror: LayerMirror.NONE,
					image: {
						image: '',
						overrides: [],
					},
				};
				break;
			default:
				AssertNever(type);
		}
		const newLayer = EditorAssetGraphicsLayerContainer.create(freeze(layerDefinition, true), this);
		newLayer.definition.subscribe(() => {
			this.onChange();
		});
		this._layers.produce((v) => [...v, newLayer]);
		this.onChange();
	}

	public deleteLayer(layer: EditorAssetGraphicsLayer): void {
		const index = this._layers.value.indexOf(layer);
		if (index < 0)
			return;

		this._layers.produce((layers) => layers.filter((l) => l !== layer));

		this.onChange();
	}

	public moveLayerRelative(layer: EditorAssetGraphicsLayer, shift: number): void {
		const currentPos = this._layers.value.indexOf(layer);
		if (currentPos < 0)
			return;

		const newPos = currentPos + shift;
		if (newPos < 0 && newPos >= this._layers.value.length)
			return;

		const newLayers = this._layers.value.slice();
		newLayers.splice(currentPos, 1);
		newLayers.splice(newPos, 0, layer);
		this._layers.value = newLayers;

		this.onChange();
	}

	public setScaleAs(layer: EditorAssetGraphicsLayer, scaleAs: string | null): void {
		layer.modifyDefinition((d) => {
			if (scaleAs) {
				d.scaling = {
					scaleBone: scaleAs,
					stops: [],
				};
			} else {
				d.scaling = undefined;
			}
		});
	}

	public addScalingStop(layer: EditorAssetGraphicsLayer, value: number): void {
		if (value === 0 || !Number.isInteger(value) || value < -180 || value > 180) {
			throw new Error('Invalid value supplied');
		}

		layer.modifyDefinition((d) => {
			Assert(d.scaling, 'Cannot add scaling stop if not scaling');

			if (d.scaling.stops.some((stop) => stop[0] === value))
				return;

			d.scaling.stops.push([value, cloneDeep(d.image)]);
			d.scaling.stops.sort((a, b) => a[0] - b[0]);
		});
	}

	public removeScalingStop(layer: EditorAssetGraphicsLayer, stop: number): void {
		layer.modifyDefinition((d) => {
			Assert(d.scaling, 'Cannot remove scaling stop if not scaling');

			d.scaling.stops = d.scaling.stops.filter((s) => s[0] !== stop);
		});
	}

	private readonly fileContents = new Map<string, ArrayBuffer>();
	private readonly _textures = new Observable<ReadonlyMap<string, Texture>>(new Map<string, Texture>([['', Texture.EMPTY]]));
	public get textures(): ReadonlyObservable<ReadonlyMap<string, Texture>> {
		return this._textures;
	}

	private _loadedTextures = new Observable<readonly string[]>(EMPTY_ARRAY);
	public get loadedTextures(): ReadonlyObservable<readonly string[]> {
		return this._loadedTextures;
	}

	public async addTextureFromArrayBuffer(name: string, buffer: ArrayBuffer): Promise<void> {
		const texture = new Texture({
			source: await LoadArrayBufferImageResource(buffer),
			label: `Editor: ${name}`,
		});
		this.fileContents.set(name, buffer);
		this._textures.produceImmer((d) => {
			d.set(name, texture);
		});
		if (!this._loadedTextures.value.includes(name)) {
			this._loadedTextures.produce((v) => [...v, name]);
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
		this._textures.produceImmer((d) => {
			d.delete(name);
		});
		this._loadedTextures.produce((v) => v.filter((t) => t !== name));
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

	public loadAllUsedImages(loader: IGraphicsLoader, originalImagesMap: Record<string, string>): Promise<void> {
		return Promise.allSettled(
			Object.entries(originalImagesMap)
				.map(([image, source]) =>
					loader
						.loadFileArrayBuffer(source)
						.then((result) => this.addTextureFromArrayBuffer(image, result)),
				),
		).then(() => undefined);
	}

	public createDefinitionString(): string {
		return `// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n` +
			JSON.stringify(AssetSourceGraphicsDefinitionSchema.parse(this.export()), undefined, '\t').trim() +
			'\n';
	}

	public async downloadZip(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

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

		DownloadAsFile(blob, `${this.id.replace(/^a\//, '').replaceAll('/', '_')}.zip`);
	}

	public async exportDefinitionToClipboard(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		await navigator.clipboard.writeText(graphicsDefinitionContent);
	}
}
