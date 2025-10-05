import type { Immutable } from 'immer';
import type { AssetId, LogLevel } from 'pandora-common';
import { Texture } from 'pixi.js';
import type { IGraphicsLoader } from '../../../assets/graphicsManager.ts';
import { LoadArrayBufferImageResource } from '../../../graphics/utility.ts';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';

export interface EditorAssetGraphicsBuildLogResult {
	warnings: number;
	errors: number;
	logs: {
		logLevel: LogLevel;
		content: string;
	}[];
}

export abstract class EditorAssetGraphicsBase {
	public readonly id: AssetId;
	public onChangeHandler: (() => void) | undefined;

	public readonly buildLog = new Observable<Immutable<EditorAssetGraphicsBuildLogResult> | null>(null);
	public readonly buildTextures = new Observable<ReadonlyMap<string, Texture> | null>(null);

	constructor(id: AssetId, onChange?: () => void) {
		this.id = id;
		this.onChangeHandler = onChange;
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	protected readonly fileContents = new Map<string, ArrayBuffer>();
	protected readonly _textures = new Observable<ReadonlyMap<string, Texture>>(new Map<string, Texture>([['', Texture.EMPTY]]));
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

	public abstract createDefinitionString(): string;

	public async exportDefinitionToClipboard(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		await navigator.clipboard.writeText(graphicsDefinitionContent);
	}
}
