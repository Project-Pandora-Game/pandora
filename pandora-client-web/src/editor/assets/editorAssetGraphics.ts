import { downloadZip, type InputWithSizeMeta } from 'client-zip';
import { freeze, type Immutable } from 'immer';
import {
	AssertNever,
	AssetSourceGraphicsDefinitionSchema,
	CharacterSize,
	CloneDeepMutable,
	LayerMirror,
	type AssetId,
	type AssetSourceGraphicsDefinition,
	type GraphicsSourceLayer,
	type GraphicsSourceLayerType,
	type LogLevel,
} from 'pandora-common';
import { Texture } from 'pixi.js';
import type { IGraphicsLoader } from '../../assets/graphicsManager.ts';
import { DownloadAsFile } from '../../common/downloadHelper.ts';
import { LoadArrayBufferImageResource } from '../../graphics/utility.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { EditorAssetGraphicsLayer, EditorAssetGraphicsLayerContainer } from './editorAssetGraphicsLayer.ts';

export interface EditorAssetGraphicsBuildLogResult {
	warnings: number;
	errors: number;
	logs: {
		logLevel: LogLevel;
		content: string;
	}[];
}

export class EditorAssetGraphics {
	public readonly id: AssetId;
	public onChangeHandler: (() => void) | undefined;

	private readonly _layers = new Observable<readonly EditorAssetGraphicsLayer[]>([]);
	public get layers(): ReadonlyObservable<readonly EditorAssetGraphicsLayer[]> {
		return this._layers;
	}

	public readonly buildLog = new Observable<Immutable<EditorAssetGraphicsBuildLogResult> | null>(null);
	public readonly buildTextures = new Observable<ReadonlyMap<string, Texture> | null>(null);

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

	public addLayer(layer: GraphicsSourceLayerType | Immutable<GraphicsSourceLayer>, insertIndex?: number): EditorAssetGraphicsLayer {
		let layerDefinition: GraphicsSourceLayer;
		if (typeof layer === 'string') {
			switch (layer) {
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
				case 'autoMesh':
					layerDefinition = {
						x: 0,
						y: 0,
						width: CharacterSize.WIDTH,
						height: CharacterSize.HEIGHT,
						name: '',
						type: 'autoMesh',
						points: '',
						automeshTemplate: '',
						graphicalLayers: [
							{ name: '' },
						],
						variables: [],
						imageMap: {
							'': [''],
						},
					};
					break;
				case 'text':
					layerDefinition = {
						x: CharacterSize.WIDTH / 2 - 100,
						y: CharacterSize.HEIGHT / 2,
						width: 200,
						height: 50,
						type: 'text',
						name: '',
						priority: 'OVERLAY',
						angle: 0,
						dataModule: '',
						followBone: null,
						fontSize: 32,
					};
					break;
				default:
					AssertNever(layer);
			}
		} else {
			layerDefinition = CloneDeepMutable(layer);
		}
		const newLayer = EditorAssetGraphicsLayerContainer.create(freeze(layerDefinition, true), this);
		newLayer.definition.subscribe(() => {
			this.onChange();
		});
		this._layers.produce((v) => v.toSpliced(insertIndex ?? v.length, 0, newLayer));
		this.onChange();
		return newLayer;
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

	private readonly fileContents = new Map<string, ArrayBuffer>();
	private readonly _textures = new Observable<ReadonlyMap<string, Texture>>(new Map<string, Texture>([['', Texture.EMPTY]]));
	public get textures(): ReadonlyObservable<ReadonlyMap<string, Texture>> {
		return this._textures;
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
