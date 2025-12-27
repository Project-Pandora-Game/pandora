import { Draft, Immutable, freeze } from 'immer';
import {
	AssertNever,
	CharacterSize,
	CloneDeepMutable,
	LayerMirror,
	type GraphicsSourceAlphaImageMeshLayer,
	type GraphicsSourceAutoMeshLayer,
	type GraphicsSourceLayer,
	type GraphicsSourceLayerType,
	type GraphicsSourceMeshLayer,
	type GraphicsSourceTextLayer,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { EditorAssetGraphics } from './graphics/editorAssetGraphics.ts';
import type { EditorWornLayersContainer } from './graphics/editorAssetGraphicsWorn.ts';

export class EditorAssetGraphicsWornLayerContainer<TLayer extends GraphicsSourceLayer> {
	public readonly container: EditorWornLayersContainer;
	private _definition: Observable<Immutable<TLayer>>;

	public readonly type: TLayer['type'];

	public get assetGraphics(): EditorAssetGraphics {
		return this.container.assetGraphics;
	}

	public get definition(): ReadonlyObservable<Immutable<TLayer>> {
		return this._definition;
	}

	public get index(): number {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return this.container.layers.value.findIndex((l: EditorAssetGraphicsWornLayerContainer<any>) => l === this);
	}

	private constructor(container: EditorWornLayersContainer, definition: Immutable<TLayer>) {
		this.container = container;
		this.type = definition.type;
		this._definition = new Observable(freeze(definition));
	}

	public modifyDefinition(producer: (draft: Draft<Immutable<TLayer>>) => void): void {
		this._definition.produceImmer(producer);
	}

	public setName(name: string): void {
		this.modifyDefinition((d) => {
			d.name = name;
		});
	}

	public deleteFromAsset(): void {
		this.container.deleteLayer(this);
	}

	public reorderOnAsset(shift: number): void {
		this.container.moveLayerRelative(this, shift);
	}

	public static create(definition: Immutable<GraphicsSourceLayer>, container: EditorWornLayersContainer): EditorAssetGraphicsWornLayer {
		switch (definition.type) {
			case 'mesh':
				return new EditorAssetGraphicsWornLayerContainer<GraphicsSourceMeshLayer>(container, definition);
			case 'alphaImageMesh':
				return new EditorAssetGraphicsWornLayerContainer<GraphicsSourceAlphaImageMeshLayer>(container, definition);
			case 'autoMesh':
				return new EditorAssetGraphicsWornLayerContainer<GraphicsSourceAutoMeshLayer>(container, definition);
			case 'text':
				return new EditorAssetGraphicsWornLayerContainer<GraphicsSourceTextLayer>(container, definition);
			default:
		}
		AssertNever(definition);
	}

	public static createNew(layer: GraphicsSourceLayerType | Immutable<GraphicsSourceLayer>, container: EditorWornLayersContainer): EditorAssetGraphicsWornLayer {
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
		return EditorAssetGraphicsWornLayerContainer.create(freeze(layerDefinition, true), container);
	}
}

export type EditorAssetGraphicsWornLayer<TLayerType extends GraphicsSourceLayerType = GraphicsSourceLayerType> = {
	[type in TLayerType]: EditorAssetGraphicsWornLayerContainer<Extract<GraphicsSourceLayer, { type: type; }>>;
}[TLayerType];
