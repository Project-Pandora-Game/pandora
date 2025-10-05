import { downloadZip, type InputWithSizeMeta } from 'client-zip';
import { freeze, type Immutable } from 'immer';
import { AssetSourceGraphicsRoomDeviceDefinitionSchema, type AssetId, type AssetSourceGraphicsRoomDeviceDefinition, type AssetSourceGraphicsRoomDeviceSlotDefinition, type GraphicsSourceLayer, type GraphicsSourceLayerType, type GraphicsSourceRoomDeviceLayer, type GraphicsSourceRoomDeviceLayerType } from 'pandora-common';
import { DownloadAsFile } from '../../../common/downloadHelper.ts';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';
import { EditorAssetGraphicsRoomDeviceLayerContainer, type EditorAssetGraphicsRoomDeviceLayer } from '../editorAssetGraphicsRoomDeviceLayer.ts';
import { EditorAssetGraphicsWornLayerContainer, type EditorAssetGraphicsWornLayer } from '../editorAssetGraphicsWornLayer.ts';
import { EditorAssetGraphicsBase } from './editorAssetGraphicsBase.ts';
import type { EditorWornLayersContainer } from './editorAssetGraphicsWorn.ts';

export class EditorAssetGraphicsRoomDevice extends EditorAssetGraphicsBase {
	private readonly _layers = new Observable<readonly EditorAssetGraphicsRoomDeviceLayer[]>([]);
	public get layers(): ReadonlyObservable<readonly EditorAssetGraphicsRoomDeviceLayer[]> {
		return this._layers;
	}

	private readonly _slotGraphics = new Observable<ReadonlyMap<string, EditorAssetGraphicsRoomDeviceSlot>>(new Map());
	public get slotGraphics(): ReadonlyObservable<ReadonlyMap<string, EditorAssetGraphicsRoomDeviceSlot>> {
		return this._slotGraphics;
	}

	constructor(id: AssetId, definition: Immutable<AssetSourceGraphicsRoomDeviceDefinition>, onChange?: () => void) {
		super(id, onChange);
		this.load(definition);
	}

	public load(definition: Immutable<AssetSourceGraphicsRoomDeviceDefinition>): void {
		freeze(definition, true);
		this._layers.value = definition.layers.map((l): EditorAssetGraphicsRoomDeviceLayer => {
			const layer = EditorAssetGraphicsRoomDeviceLayerContainer.create(l, this);
			layer.definition.subscribe(() => {
				this.onChange();
			});
			return layer;
		});
		const slots = new Map(this.slotGraphics.value);
		for (const [slot, slotDefinition] of Object.entries(definition.slots)) {
			slots.set(slot, new EditorAssetGraphicsRoomDeviceSlot(this, slotDefinition, () => {
				this.onChange();
			}));
		}
		this.onChange();
	}

	public export(): Immutable<AssetSourceGraphicsRoomDeviceDefinition> {
		const slots: Record<string, Immutable<AssetSourceGraphicsRoomDeviceSlotDefinition>> = {};

		for (const [slot, graphics] of this._slotGraphics.value) {
			slots[slot] = graphics.export();
		}

		return {
			layers: this._layers.value.map((l) => l.definition.value),
			slots,
		};
	}

	public addLayer(layer: GraphicsSourceRoomDeviceLayerType | Immutable<GraphicsSourceRoomDeviceLayer>, insertIndex?: number): EditorAssetGraphicsRoomDeviceLayer {
		const newLayer = EditorAssetGraphicsRoomDeviceLayerContainer.createNew(layer, this);
		newLayer.definition.subscribe(() => {
			this.onChange();
		});
		this._layers.produce((v) => v.toSpliced(insertIndex ?? v.length, 0, newLayer));
		this.onChange();
		return newLayer;
	}

	public deleteLayer(layer: EditorAssetGraphicsRoomDeviceLayer): void {
		const index = this._layers.value.indexOf(layer);
		if (index < 0)
			return;

		this._layers.produce((layers) => layers.filter((l) => l !== layer));

		this.onChange();
	}

	public moveLayerRelative(layer: EditorAssetGraphicsRoomDeviceLayer, shift: number): void {
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

	public createDefinitionString(): string {
		return JSON.stringify(AssetSourceGraphicsRoomDeviceDefinitionSchema.parse(this.export()), undefined, '\t').trim() + '\n';
	}

	public async downloadZip(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		const now = new Date();

		const files: InputWithSizeMeta[] = [
			{ name: 'roomDeviceGraphics.json', lastModified: now, input: graphicsDefinitionContent },
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
}

export class EditorAssetGraphicsRoomDeviceSlot implements EditorWornLayersContainer {
	private readonly _layers = new Observable<readonly EditorAssetGraphicsWornLayer[]>([]);
	public get layers(): ReadonlyObservable<readonly EditorAssetGraphicsWornLayer[]> {
		return this._layers;
	}

	public readonly assetGraphics: EditorAssetGraphicsRoomDevice;

	private readonly onChange: (() => void);

	constructor(assetGraphics: EditorAssetGraphicsRoomDevice, definition: Immutable<AssetSourceGraphicsRoomDeviceSlotDefinition>, onChange: () => void) {
		this.assetGraphics = assetGraphics;
		this.onChange = onChange;
		freeze(definition, true);
		this._layers.value = definition.layers.map((l): EditorAssetGraphicsWornLayer => {
			const layer = EditorAssetGraphicsWornLayerContainer.create(l, this);
			layer.definition.subscribe(() => {
				this.onChange();
			});
			return layer;
		});
	}

	public export(): Immutable<AssetSourceGraphicsRoomDeviceSlotDefinition> {
		return {
			layers: this._layers.value.map((l) => l.definition.value),
		};
	}

	public addLayer(layer: GraphicsSourceLayerType | Immutable<GraphicsSourceLayer>, insertIndex?: number): EditorAssetGraphicsWornLayer {
		const newLayer = EditorAssetGraphicsWornLayerContainer.createNew(layer, this);
		newLayer.definition.subscribe(() => {
			this.onChange();
		});
		this._layers.produce((v) => v.toSpliced(insertIndex ?? v.length, 0, newLayer));
		this.onChange();
		return newLayer;
	}

	public deleteLayer(layer: EditorAssetGraphicsWornLayer): void {
		const index = this._layers.value.indexOf(layer);
		if (index < 0)
			return;

		this._layers.produce((layers) => layers.filter((l) => l !== layer));

		this.onChange();
	}

	public moveLayerRelative(layer: EditorAssetGraphicsWornLayer, shift: number): void {
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
}
