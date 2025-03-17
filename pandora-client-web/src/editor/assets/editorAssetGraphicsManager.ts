import { freeze, type Immutable } from 'immer';
import {
	Assert,
	AsyncSynchronized,
	GetLogger,
	type AssetGraphicsDefinition,
	type AssetId,
	type AssetSourceGraphicsDefinition,
	type GraphicsDefinitionFile,
	type GraphicsSourceDefinitionFile,
} from 'pandora-common';
import { GraphicsManager, GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { EditorAssetGraphics } from './editorAssetGraphics.ts';
import { EditorBuildAssetGraphics } from './editorAssetGraphicsBuilding.ts';

/** Class that handles "source" asset graphics inside editor. */
export class EditorAssetGraphicsManagerClass {
	private readonly logger = GetLogger('EditorAssetGraphicsManager');

	private _originalSourceDefinitions: Immutable<GraphicsSourceDefinitionFile> = { assets: {}, pointTemplates: {} };
	private _originalGraphicsDefinitions: Immutable<GraphicsDefinitionFile> = { assets: {}, pointTemplates: {}, imageFormats: {} };

	private _editedAssetGraphics = new Observable<ReadonlyMap<AssetId, EditorAssetGraphics>>(new Map());
	private readonly _editedGraphicsBuildCache = new Map<AssetId, Immutable<AssetGraphicsDefinition>>();

	public get editedAssetGraphics(): ReadonlyObservable<ReadonlyMap<AssetId, EditorAssetGraphics>> {
		return this._editedAssetGraphics;
	}

	public loadNewOriginalDefinitions(
		sourceDefinitions: Immutable<GraphicsSourceDefinitionFile>,
		graphicsDefinitions: Immutable<GraphicsDefinitionFile>,
	) {
		this._originalSourceDefinitions = freeze(sourceDefinitions, true);
		this._originalGraphicsDefinitions = freeze(graphicsDefinitions, true);
		this._reloadRuntimeGraphicsManager();
	}

	public startEditAsset(asset: AssetId): EditorAssetGraphics {
		const existingGraphics = this._editedAssetGraphics.value.get(asset);
		if (existingGraphics != null) {
			return existingGraphics;
		}

		let sourceDefinition: Immutable<AssetSourceGraphicsDefinition> | undefined = this._originalSourceDefinitions.assets[asset];
		// If the asst had no graphics before, create empty one
		if (sourceDefinition == null) {
			sourceDefinition = {
				layers: [],
			};
		}
		const graphics = new EditorAssetGraphics(asset, sourceDefinition, () => {
			this._onAssetDefinitionChanged(graphics)
				.catch((err) => {
					this.logger.error('Crash in asset definition change handler:', err);
				});
		});

		this._editedAssetGraphics.produce((d) => {
			const result = new Map(d);
			result.set(asset, graphics);
			return result;
		});

		this._onAssetDefinitionChanged(graphics)
			.catch((err) => {
				this.logger.error('Crash in asset definition change handler:', err);
			});

		// TODO
		// graphics.loadAllUsedImages(this.manager.loader)
		// 	.catch((err) => logger.error('Error importing asset for editing', err));

		return graphics;
	}

	@AsyncSynchronized()
	private async _onAssetDefinitionChanged(asset: EditorAssetGraphics): Promise<void> {
		const logger = this.logger.prefixMessages(`Graphics build for asset '${asset.id}':\n\t`);
		try {
			const graphicsDefinition = await EditorBuildAssetGraphics(asset, logger);
			this._editedGraphicsBuildCache.set(asset.id, freeze(graphicsDefinition, true));
		} catch (error) {
			logger.error('Build failed with error:', error);
		}

		this._reloadRuntimeGraphicsManager();
	}

	private _editorGraphicsVersion: number = 0;
	private _reloadRuntimeGraphicsManager() {
		Assert(GraphicsManagerInstance.value != null, 'Runtime graphics manager should be loaded before editor graphics manager');

		const assets: Partial<Record<AssetId, Immutable<AssetGraphicsDefinition>>> = {
			...this._originalGraphicsDefinitions.assets,
		};
		// Replace editor-built assets
		for (const [assetId, assetGraphics] of this._editedGraphicsBuildCache) {
			assets[assetId] = assetGraphics;
		}
		freeze(assets);

		const graphicsDefinitions: Immutable<GraphicsDefinitionFile> = {
			...this._originalGraphicsDefinitions,
			assets,
		};
		freeze(graphicsDefinitions);
		this._editorGraphicsVersion++;

		const graphicsManager = new GraphicsManager(
			GraphicsManagerInstance.value.loader,
			`editor:${this._editorGraphicsVersion}`,
			graphicsDefinitions,
		);
		GraphicsManagerInstance.value = graphicsManager;
	}
}

export const EditorAssetGraphicsManager = new EditorAssetGraphicsManagerClass();
