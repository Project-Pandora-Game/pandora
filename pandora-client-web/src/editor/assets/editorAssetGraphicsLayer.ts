import { Draft, Immutable, freeze } from 'immer';
import {
	Assert,
	AssertNever,
	LayerImageOverride,
	LayerImageSetting,
	LayerPriority,
	type GraphicsSourceAlphaImageMeshLayer,
	type GraphicsSourceLayer,
	type GraphicsSourceLayerType,
	type GraphicsSourceMeshLayer,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { EditorAssetGraphics } from './editorAssetGraphics.ts';

export class EditorAssetGraphicsLayerContainer<TLayer extends GraphicsSourceLayer> {
	public readonly asset: EditorAssetGraphics;
	private _definition: Observable<Immutable<TLayer>>;

	public readonly type: TLayer['type'];

	public get definition(): ReadonlyObservable<Immutable<TLayer>> {
		return this._definition;
	}

	public get index(): number {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.asset.layers.value.findIndex((l: EditorAssetGraphicsLayerContainer<any>) => l === this);
	}

	private constructor(asset: EditorAssetGraphics, definition: Immutable<TLayer>) {
		this.asset = asset;
		this.type = definition.type;
		this._definition = new Observable(freeze(definition));
	}

	public _modifyDefinition(producer: (draft: Draft<Immutable<TLayer>>) => void): void {
		this._definition.produceImmer(producer);
	}

	private _modifyImageSettingsForScalingStop(stop: number | null | undefined, producer: (draft: Draft<Immutable<LayerImageSetting>>) => void): void {
		this._modifyDefinition((d) => {
			if (!stop) {
				producer(d.image);
				return;
			}
			const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
			if (!res) {
				throw new Error('Failed to get stop');
			}
			producer(res);
		});
	}

	public setPriority(priority: LayerPriority): void {
		this._modifyDefinition((d) => {
			d.priority = priority;
		});
	}

	public setHeight(height: number): void {
		if (height > 0) {
			this._modifyDefinition((d) => {
				d.height = height;
			});
		}
	}

	public setWidth(width: number): void {
		if (width > 0) {
			this._modifyDefinition((d) => {
				d.width = width;
			});
		}
	}

	public setXOffset(offset: number): void {
		this._modifyDefinition((d) => {
			d.x = offset;
		});
	}

	public setYOffset(offset: number): void {
		this._modifyDefinition((d) => {
			d.y = offset;
		});
	}

	public setColorizationKey(colorizationKey: string | null): void {
		Assert(colorizationKey === null || colorizationKey.trim().length > 0, 'Colorization key must be null or non-empty');

		this._modifyDefinition((d) => {
			Assert(d.type === 'mesh', 'Colorization key can only be set on mesh layer');
			d.colorizationKey = colorizationKey === null ? undefined : colorizationKey;
		});
	}

	public setPointType(pointType: string[]): void {
		this._modifyDefinition((d) => {
			d.pointType = pointType.length === 0 ? undefined : pointType.slice();
		});
	}

	public setImage(image: string, stop?: number): void {
		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.image = image;
		});
	}

	public setImageOverrides(imageOverrides: LayerImageOverride[], stop?: number): void {
		this._modifyImageSettingsForScalingStop(stop, (settings) => {
			settings.overrides = imageOverrides.slice();
		});
	}

	public setName(name: string): void {
		this._modifyDefinition((d) => {
			d.name = name;
		});
	}

	public static create(definition: Immutable<GraphicsSourceLayer>, asset: EditorAssetGraphics): EditorAssetGraphicsLayer {
		switch (definition.type) {
			case 'mesh':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceMeshLayer>(asset, definition);
			case 'alphaImageMesh':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceAlphaImageMeshLayer>(asset, definition);
			default:
		}
		AssertNever(definition);
	}
}

export type EditorAssetGraphicsLayer<TLayerType extends GraphicsSourceLayerType = GraphicsSourceLayerType> = {
	[type in TLayerType]: EditorAssetGraphicsLayerContainer<Extract<GraphicsSourceLayer, { type: type; }>>;
}[TLayerType];
