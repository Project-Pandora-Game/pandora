import { freeze, type Immutable } from 'immer';
import {
	type AssetId,
	type AssetSourceGraphicsDefinition,
	type GraphicsSourceDefinitionFile,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { EditorAssetGraphics } from './editorAssetGraphics.ts';

/** Class that handles "source" asset graphics inside editor. */
export class EditorAssetGraphicsManagerClass {
	private _originalDefinitions: Immutable<GraphicsSourceDefinitionFile> = { assets: {}, pointTemplates: {} };
	private _editedAssetGraphics = new Observable<ReadonlyMap<AssetId, EditorAssetGraphics>>(new Map());

	public get editedAssetGraphics(): ReadonlyObservable<ReadonlyMap<AssetId, EditorAssetGraphics>> {
		return this._editedAssetGraphics;
	}

	public loadNewOriginalDefinitions(data: Immutable<GraphicsSourceDefinitionFile>) {
		this._originalDefinitions = freeze(data, true);
	}

	public startEditAsset(asset: AssetId): EditorAssetGraphics {
		const existingGraphics = this._editedAssetGraphics.value.get(asset);
		if (existingGraphics != null) {
			return existingGraphics;
		}

		let sourceDefinition: Immutable<AssetSourceGraphicsDefinition> | undefined = this._originalDefinitions.assets[asset];
		// If the asst had no graphics before, create empty one
		if (sourceDefinition == null) {
			sourceDefinition = {
				layers: [],
			};
		}
		const graphics = new EditorAssetGraphics(asset, sourceDefinition, () => {
			this._onAssetDefinitionChanged(graphics);
		});

		this._editedAssetGraphics.produce((d) => {
			const result = new Map(d);
			result.set(asset, graphics);
			return result;
		});

		this._onAssetDefinitionChanged(graphics);

		return graphics;
	}

	private _onAssetDefinitionChanged(_asset: EditorAssetGraphics) {
		// TODO: Rebuild runtime graphics
	}
}

export const EditorAssetGraphicsManager = new EditorAssetGraphicsManagerClass();
