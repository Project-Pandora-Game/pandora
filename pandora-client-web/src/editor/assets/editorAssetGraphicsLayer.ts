import { Draft, Immutable, freeze } from 'immer';
import {
	AssertNever,
	type GraphicsSourceAlphaImageMeshLayer,
	type GraphicsSourceAutoMeshLayer,
	type GraphicsSourceLayer,
	type GraphicsSourceLayerType,
	type GraphicsSourceMeshLayer,
	type GraphicsSourceTextLayer,
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

	public modifyDefinition(producer: (draft: Draft<Immutable<TLayer>>) => void): void {
		this._definition.produceImmer(producer);
	}

	public setHeight(height: number): void {
		if (height > 0) {
			this.modifyDefinition((d) => {
				d.height = height;
			});
		}
	}

	public setWidth(width: number): void {
		if (width > 0) {
			this.modifyDefinition((d) => {
				d.width = width;
			});
		}
	}

	public setXOffset(offset: number): void {
		this.modifyDefinition((d) => {
			d.x = offset;
		});
	}

	public setYOffset(offset: number): void {
		this.modifyDefinition((d) => {
			d.y = offset;
		});
	}

	public setName(name: string): void {
		this.modifyDefinition((d) => {
			d.name = name;
		});
	}

	public static create(definition: Immutable<GraphicsSourceLayer>, asset: EditorAssetGraphics): EditorAssetGraphicsLayer {
		switch (definition.type) {
			case 'mesh':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceMeshLayer>(asset, definition);
			case 'alphaImageMesh':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceAlphaImageMeshLayer>(asset, definition);
			case 'autoMesh':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceAutoMeshLayer>(asset, definition);
			case 'text':
				return new EditorAssetGraphicsLayerContainer<GraphicsSourceTextLayer>(asset, definition);
			default:
		}
		AssertNever(definition);
	}
}

export type EditorAssetGraphicsLayer<TLayerType extends GraphicsSourceLayerType = GraphicsSourceLayerType> = {
	[type in TLayerType]: EditorAssetGraphicsLayerContainer<Extract<GraphicsSourceLayer, { type: type; }>>;
}[TLayerType];
