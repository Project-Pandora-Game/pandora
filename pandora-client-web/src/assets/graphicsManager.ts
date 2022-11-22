import { AssetGraphicsDefinition, AssetId, AssetsGraphicsDefinitionFile, PointTemplate } from 'pandora-common';
import { Texture } from 'pixi.js';
import { Observable } from '../observable';
import { AssetGraphics } from './assetGraphics';

export interface IGraphicsLoader {
	getCachedTexture(path: string): Texture | null;
	getTexture(path: string): Promise<Texture>;
	loadTextFile(path: string): Promise<string>;
	loadFileArrayBuffer(path: string, type?: string): Promise<ArrayBuffer>;
}

export class GraphicsManager {
	private readonly _assetGraphics: Map<AssetId, AssetGraphics> = new Map();
	private readonly _pointTemplates: Map<string, PointTemplate> = new Map();
	private _pointTemplateList: readonly string[] = [];

	public readonly definitionsHash: string;
	public readonly loader: IGraphicsLoader;

	constructor(loader: IGraphicsLoader, definitionsHash: string, data: AssetsGraphicsDefinitionFile) {
		this.loader = loader;
		this.definitionsHash = definitionsHash;
		this.loadPointTemplats(data.pointTemplates);
		this.loadAssets(data.assets);
	}

	public getAllAssetsGraphics(): AssetGraphics[] {
		return [...this._assetGraphics.values()];
	}

	public getAssetGraphicsById(id: AssetId): AssetGraphics | undefined {
		return this._assetGraphics.get(id);
	}

	public get pointTemplateList(): readonly string[] {
		return this._pointTemplateList;
	}

	public getTemplate(name: string): PointTemplate | undefined {
		return this._pointTemplates.get(name);
	}

	private loadAssets(assets: Record<AssetId, AssetGraphicsDefinition>): void {
		// First unload no-longer existing assets
		for (const id of this._assetGraphics.keys()) {
			if (assets[id] === undefined) {
				this._assetGraphics.delete(id);
			}
		}
		// Then load or update all defined assets
		for (const [id, definition] of Object.entries(assets)) {
			if (!id.startsWith('a/')) {
				throw new Error(`Asset without valid prefix: ${id}`);
			}
			let asset = this._assetGraphics.get(id as AssetId);
			if (asset) {
				asset.load(definition);
			} else {
				asset = this.createAssetGraphics(id as AssetId, definition);
				this._assetGraphics.set(id as AssetId, asset);
			}
		}
	}

	private loadPointTemplats(pointTemplates: Record<string, PointTemplate>): void {
		this._pointTemplates.clear();
		for (const [name, template] of Object.entries(pointTemplates)) {
			this._pointTemplates.set(name, template);
		}
		this._pointTemplateList = Array.from(this._pointTemplates.keys());
	}

	protected createAssetGraphics(id: AssetId, data: AssetGraphicsDefinition): AssetGraphics {
		return new AssetGraphics(id, data);
	}
}

export const GraphicsManagerInstance = new Observable<GraphicsManager | null>(null);
