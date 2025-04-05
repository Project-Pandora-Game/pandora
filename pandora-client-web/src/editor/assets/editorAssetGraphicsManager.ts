import { freeze, type Immutable } from 'immer';
import {
	AnyToString,
	Assert,
	AsyncSynchronized,
	GetLogger,
	Logger,
	LogLevel,
	type AssetGraphicsDefinition,
	type AssetId,
	type AssetSourceGraphicsInfo,
	type GraphicsDefinitionFile,
	type GraphicsSourceAutoMeshTemplate,
	type GraphicsSourceDefinitionFile,
	type LoggerConfig,
	type LogOutputDefinition,
	type PointTemplate,
	type PointTemplateSource,
} from 'pandora-common';
import type { Texture } from 'pixi.js';
import { GetCurrentAssetManager } from '../../assets/assetManager.tsx';
import { GraphicsManager, GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { ToastHandlePromise } from '../../persistentToast.ts';
import { EditorAssetGraphics, type EditorAssetGraphicsBuildLogResult } from './editorAssetGraphics.ts';
import { EditorBuildAssetGraphics } from './editorAssetGraphicsBuilding.ts';

/** Class that handles "source" asset graphics inside editor. */
export class EditorAssetGraphicsManagerClass {
	private readonly logger = GetLogger('EditorAssetGraphicsManager');

	private _originalSourceDefinitions: Immutable<GraphicsSourceDefinitionFile> = { assets: {}, pointTemplates: {}, automeshTemplates: {} };
	private _originalGraphicsDefinitions: Immutable<GraphicsDefinitionFile> = { assets: {}, pointTemplates: {}, imageFormats: {} };

	private _editedAssetGraphics = new Observable<ReadonlyMap<AssetId, EditorAssetGraphics>>(new Map());
	private readonly _editedGraphicsBuildCache = new Map<AssetId, Immutable<AssetGraphicsDefinition>>();

	public get editedAssetGraphics(): ReadonlyObservable<ReadonlyMap<AssetId, EditorAssetGraphics>> {
		return this._editedAssetGraphics;
	}

	private _automeshTemplates: Observable<Immutable<Record<string, GraphicsSourceAutoMeshTemplate>>>;
	public get automeshTemplates(): ReadonlyObservable<Immutable<Record<string, GraphicsSourceAutoMeshTemplate>>> {
		return this._automeshTemplates;
	}

	public readonly editedPointTemplates = new Observable<ReadonlyMap<string, Immutable<PointTemplateSource>>>(new Map());
	public get originalPointTempalates(): Immutable<Partial<GraphicsSourceDefinitionFile['pointTemplates']>> {
		return this._originalSourceDefinitions.pointTemplates;
	}

	constructor() {
		this._automeshTemplates = new Observable(this._originalSourceDefinitions.automeshTemplates);
		this.editedPointTemplates.subscribe(() => {
			this._reloadRuntimeGraphicsManager();
		});
	}

	public loadNewOriginalDefinitions(
		sourceDefinitions: Immutable<GraphicsSourceDefinitionFile>,
		graphicsDefinitions: Immutable<GraphicsDefinitionFile>,
	) {
		this._originalSourceDefinitions = freeze(sourceDefinitions, true);
		this._originalGraphicsDefinitions = freeze(graphicsDefinitions, true);
		this._automeshTemplates.value = this._originalSourceDefinitions.automeshTemplates;
		this._reloadRuntimeGraphicsManager();

		// Rebuild every single edited asset asynchronously, as asset manager might have changed
		Array.from(this.editedAssetGraphics.value.values())
			.forEach((a) => {
				this._onAssetDefinitionChanged(a)
					.catch((err) => {
						this.logger.error('Crash in asset definition change handler, during rebuild:', err);
					});
			});
	}

	public startEditAsset(asset: AssetId): EditorAssetGraphics {
		Assert(GraphicsManagerInstance.value != null, 'Runtime graphics manager should be loaded before editor graphics manager');

		const existingGraphics = this._editedAssetGraphics.value.get(asset);
		if (existingGraphics != null) {
			return existingGraphics;
		}

		let sourceInfo: Immutable<AssetSourceGraphicsInfo> | undefined = this._originalSourceDefinitions.assets[asset];
		// If the asst had no graphics before, create empty one
		if (sourceInfo == null) {
			sourceInfo = {
				definition: {
					layers: [],
				},
				originalImagesMap: {},
			};
		}
		const graphics = new EditorAssetGraphics(asset, sourceInfo.definition, () => {
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

		ToastHandlePromise(
			graphics.loadAllUsedImages(GraphicsManagerInstance.value.loader, sourceInfo.originalImagesMap),
			{
				pending: 'Importing asset images...',
				success: 'Asset successfully loaded',
				error: 'Error loading asset images, check console for details',
			},
		)
			.catch((err) => this.logger.error('Error importing asset for editing:', err));

		return graphics;
	}

	public discardAssetEdits(asset: AssetId): void {
		if (!this._editedAssetGraphics.value.has(asset))
			return;

		// Unregister edit and regenerate asset graphics
		this._editedAssetGraphics.produce((d) => {
			const result = new Map(d);
			result.delete(asset);
			return result;
		});

		this._editedGraphicsBuildCache.delete(asset);
		this._reloadRuntimeGraphicsManager();
	}

	@AsyncSynchronized()
	private async _onAssetDefinitionChanged(asset: EditorAssetGraphics): Promise<void> {
		// Ignore if the asset is no longer being edited
		if (this._editedAssetGraphics.value.get(asset.id) !== asset)
			return;

		const logResult: EditorAssetGraphicsBuildLogResult = {
			errors: 0,
			warnings: 0,
			logs: [],
		};
		const buildLogConfigOutput: LogOutputDefinition = {
			logLevel: LogLevel.DEBUG,
			logLevelOverrides: {},
			supportsColor: false,
			// onMessage: (prefix: string, message: unknown[], level: LogLevel) => void;
			onMessage(prefix, message, level) {
				if (level <= LogLevel.ERROR) {
					logResult.errors++;
				} else if (level <= LogLevel.WARNING) {
					logResult.warnings++;
				}
				logResult.logs.push({
					logLevel: level,
					content: [prefix, ...message.map((part) => {
						if (part && part instanceof Error) {
							// Custom error format without stack, as that is anyway useless with our minification
							return `[${part.name}: ${part.message}]`;
						}

						return AnyToString(part);
					})].join(' '),
				});
			},
		};
		const buildLogConfig: LoggerConfig = {
			printTime: false,
			timeLocale: undefined,
			onFatal: [],
			logOutputs: [buildLogConfigOutput],
		};
		const logger = new Logger('Build', '', buildLogConfig);
		const buildTextures = new Map<string, Texture>();

		try {
			const logicAsset = GetCurrentAssetManager().getAssetById(asset.id);
			if (logicAsset == null) {
				throw new Error('Asset not found');
			}

			const graphicsDefinition = await EditorBuildAssetGraphics(asset, logicAsset, logger, buildTextures);
			this._editedGraphicsBuildCache.set(asset.id, freeze(graphicsDefinition, true));
			asset.buildTextures.value = buildTextures;
		} catch (error) {
			logger.error('Build failed with error:', error);
		}
		asset.buildLog.value = logResult;

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

		const pointTemplates: Record<string, Immutable<PointTemplate>> = {
			...this._originalGraphicsDefinitions.pointTemplates,
		};
		for (const [id, template] of this.editedPointTemplates.value) {
			pointTemplates[id] = template.points;
		}

		const graphicsDefinitions: Immutable<GraphicsDefinitionFile> = {
			...this._originalGraphicsDefinitions,
			assets,
			pointTemplates,
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
