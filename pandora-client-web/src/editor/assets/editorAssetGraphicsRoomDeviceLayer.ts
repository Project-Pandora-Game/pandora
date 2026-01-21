import { Draft, Immutable, freeze } from 'immer';
import {
	AssertNever,
	CloneDeepMutable,
	type GraphicsSourceRoomDeviceAutoSpriteLayer,
	type GraphicsSourceRoomDeviceLayer,
	type GraphicsSourceRoomDeviceLayerMesh,
	type GraphicsSourceRoomDeviceLayerSlot,
	type GraphicsSourceRoomDeviceLayerSprite,
	type GraphicsSourceRoomDeviceLayerText,
	type GraphicsSourceRoomDeviceLayerType,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { EditorAssetGraphics } from './graphics/editorAssetGraphics.ts';
import type { EditorRoomLayersContainer } from './graphics/editorGraphicsLayerContainer.ts';

export class EditorAssetGraphicsRoomDeviceLayerContainer<TLayer extends GraphicsSourceRoomDeviceLayer> {
	public readonly container: EditorRoomLayersContainer;
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
		return this.container.layers.value.findIndex((l: EditorAssetGraphicsRoomDeviceLayerContainer<any>) => l === this);
	}

	private constructor(container: EditorRoomLayersContainer, definition: Immutable<TLayer>) {
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

	public static create(definition: Immutable<GraphicsSourceRoomDeviceLayer>, container: EditorRoomLayersContainer): EditorAssetGraphicsRoomDeviceLayer {
		switch (definition.type) {
			case 'slot':
				return new EditorAssetGraphicsRoomDeviceLayerContainer<GraphicsSourceRoomDeviceLayerSlot>(container, definition);
			case 'sprite':
				return new EditorAssetGraphicsRoomDeviceLayerContainer<GraphicsSourceRoomDeviceLayerSprite>(container, definition);
			case 'autoSprite':
				return new EditorAssetGraphicsRoomDeviceLayerContainer<GraphicsSourceRoomDeviceAutoSpriteLayer>(container, definition);
			case 'mesh':
				return new EditorAssetGraphicsRoomDeviceLayerContainer<GraphicsSourceRoomDeviceLayerMesh>(container, definition);
			case 'text':
				return new EditorAssetGraphicsRoomDeviceLayerContainer<GraphicsSourceRoomDeviceLayerText>(container, definition);
			default:
		}
		AssertNever(definition);
	}

	public static createNew(layer: GraphicsSourceRoomDeviceLayerType | Immutable<GraphicsSourceRoomDeviceLayer>, container: EditorRoomLayersContainer): EditorAssetGraphicsRoomDeviceLayer {
		let layerDefinition: GraphicsSourceRoomDeviceLayer;
		if (typeof layer === 'string') {
			switch (layer) {
				case 'slot':
					layerDefinition = {
						type: 'slot',
						name: '',
						slot: '',
						characterPosition: {
							offsetX: 0,
							offsetY: 0,
						},
					};
					break;
				case 'sprite':
					layerDefinition = {
						x: 0,
						y: 0,
						width: 1,
						height: 1,
						type: 'sprite',
						name: '',
						image: '',
					};
					break;
				case 'autoSprite':
					layerDefinition = {
						x: 0,
						y: 0,
						width: 1,
						height: 1,
						name: '',
						type: 'autoSprite',
						graphicalLayers: [
							{ name: '' },
						],
						variables: [],
						imageMap: {
							'': [''],
						},
					};
					break;
				case 'mesh':
					layerDefinition = {
						type: 'mesh',
						name: '',
						geometry: {
							type: '2d',
							positions: [],
							uvs: [],
							indices: [],
							topology: 'triangle-list',
						},
						image: {
							image: '',
						},
					};
					break;
				case 'text':
					layerDefinition = {
						type: 'text',
						name: '',
						dataModule: '',
						size: {
							width: 200,
							height: 100,
						},
						fontSize: 32,
					};
					break;
				default:
					AssertNever(layer);
			}
		} else {
			layerDefinition = CloneDeepMutable(layer);
		}
		return EditorAssetGraphicsRoomDeviceLayerContainer.create(freeze(layerDefinition, true), container);
	}
}

export type EditorAssetGraphicsRoomDeviceLayer<TLayerType extends GraphicsSourceRoomDeviceLayerType = GraphicsSourceRoomDeviceLayerType> = {
	[type in TLayerType]: EditorAssetGraphicsRoomDeviceLayerContainer<Extract<GraphicsSourceRoomDeviceLayer, { type: type; }>>;
}[TLayerType];
