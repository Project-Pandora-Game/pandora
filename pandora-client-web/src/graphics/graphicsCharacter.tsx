import { AssertNotNullable, Asset, ASSET_PREFERENCES_DEFAULT, AssetFrameworkCharacterState, AssetId, CharacterArmsPose, CharacterSize, CharacterView, CreateAssetPropertiesResult, GetLogger, MergeAssetProperties, ResolveAssetPreference } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useCharacterAppearanceItems } from '../character/character';
import { ChildrenProps } from '../common/reactTypes';
import { usePlayerData } from '../components/gameContext/playerContextProvider';
import { useObservable } from '../observable';
import { Container } from './baseComponents/container';
import { ComputedLayerPriority, ComputeLayerPriority, LayerState, LayerStateOverrides, PRIORITY_ORDER_REVERSE_PRIORITIES, useComputedLayerPriority } from './def';
import { GraphicsLayer, GraphicsLayerProps, SwapCullingDirection } from './graphicsLayer';
import { GraphicsSuspense } from './graphicsSuspense/graphicsSuspense';
import { nanoid } from 'nanoid';
import { PseudoRandom } from 'pandora-common/src/math/pseudoRandom';

export type PointLike = {
	x: number;
	y: number;
};

const logger = GetLogger('GraphicsCharacter');

export interface GraphicsCharacterProps extends ChildrenProps {
	layer?: (props: GraphicsLayerProps) => ReactElement;
	characterState: AssetFrameworkCharacterState;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	angle?: number;
	hitArea?: Rectangle;
	eventMode?: PIXI.EventMode;
	filters?: readonly Filter[];
	zIndex?: number;

	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: FederatedPointerEvent) => void;
	onPointerMove?: (event: FederatedPointerEvent) => void;
}

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;
export type LayerStateOverrideGetter = (layer: AssetGraphicsLayer) => LayerStateOverrides | undefined;
export type LayerGetSortOrder = (view: CharacterView) => readonly ComputedLayerPriority[];

function useLayerPriorityResolver(states: readonly LayerState[], armsPose: CharacterArmsPose): ReadonlyMap<LayerState, ComputedLayerPriority> {
	const calculate = useCallback((layers: readonly LayerState[]) => {
		const result = new Map<LayerState, ComputedLayerPriority>();
		for (const layer of layers) {
			result.set(layer, ComputeLayerPriority(layer.layer.definition.value.priority, armsPose));
		}
		return result;
	}, [armsPose]);

	const [actualCalculate, setActualCalculate] = useState<(layers: readonly LayerState[]) => ReadonlyMap<LayerState, ComputedLayerPriority>>(() => calculate);

	useEffect(() => {
		const cleanup: (() => void)[] = [];
		setActualCalculate(() => calculate);

		for (const state of states) {
			cleanup.push(state.layer.definition.subscribe(() => {
				setActualCalculate(() => (l: readonly LayerState[]) => calculate(l));
			}));
		}

		return () => {
			cleanup.forEach((c) => c());
		};
	}, [calculate, states]);

	return useMemo(() => actualCalculate(states), [actualCalculate, states]);
}

export const CHARACTER_PIVOT_POSITION: Readonly<PointLike> = {
	x: CharacterSize.WIDTH / 2, // Middle of the character image
	y: 1290, // The position where heels seemingly touch the floor
};

const MIN_BLINK_INTERVAL = 4_000; // ms
const MAX_BLINK_INTERVAL = 6_000; // ms
const BLINK_LENGTH = 250; // ms

function GraphicsCharacterWithManagerImpl({
	layer: Layer,
	characterState,
	position: positionOffset = { x: 0, y: 0 },
	scale: scaleExtra,
	pivot: pivotExtra,
	filters,
	onPointerDown,
	onPointerUp,
	onPointerUpOutside,
	onPointerMove,
	children,
	graphicsGetter,
	layerStateOverrideGetter,
	...graphicsProps
}: GraphicsCharacterProps & {
	graphicsGetter: GraphicsGetterFunction;
	layerStateOverrideGetter?: LayerStateOverrideGetter;
}, ref: React.ForwardedRef<PIXI.Container>): ReactElement {
	const items = useCharacterAppearanceItems(characterState);

	const assetPreferenceIsVisible = useAssetPreferenceVisibilityCheck();

	const [characterBlinking, setCharacterBlinking] = useState(false);
	const [blinkSeed, newBlinkSeed] = useReducer(() => nanoid(), nanoid());
	const blinkRandom = useMemo(() => new PseudoRandom(blinkSeed), [blinkSeed]);

	useEffect(() => {
		const blinkInterval = blinkRandom.between(MIN_BLINK_INTERVAL, MAX_BLINK_INTERVAL);

		let timeoutId: number | undefined;
		const intervalId = setInterval(() => {
			clearTimeout(timeoutId);
			setCharacterBlinking(true);

			timeoutId = setTimeout(() => {
				setCharacterBlinking(false);

				newBlinkSeed();
			}, BLINK_LENGTH);
		}, blinkInterval);

		return () => {
			clearInterval(intervalId);
			clearTimeout(timeoutId);
		};
	}, [setCharacterBlinking, blinkRandom, newBlinkSeed]);

	const layers = useMemo<LayerState[]>(() => {
		const visibleItems = items.slice();
		let properties = CreateAssetPropertiesResult();
		// Walk items in reverse and remove items that are hidden
		for (let i = visibleItems.length - 1; i >= 0; i--) {
			const item = visibleItems[i];

			let visible = true;

			// If player marked item as "do not render", then hide it
			visible &&= assetPreferenceIsVisible(item.asset);

			// If this item has any attribute that is hidden, hide it
			visible &&= !Array.from(item.getProperties().attributes)
				.some((a) => properties.attributesHides.has(a));

			// Update known properties
			properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);

			// Remove this item from rendering altogether, if not visible
			if (!visible) {
				visibleItems.splice(i, 1);
			}
		}

		const result: LayerState[] = [];
		for (const item of visibleItems) {
			const graphics = graphicsGetter(item.asset.id);
			if (!graphics) {
				if (item.asset.definition.hasGraphics) {
					logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				}
				continue;
			}
			result.push(
				...graphics.allLayers.map<LayerState>((layer) => ({
					layer,
					item,
					state: layerStateOverrideGetter?.(layer),
				})),
			);
		}
		return result;
	}, [items, assetPreferenceIsVisible, graphicsGetter, layerStateOverrideGetter]);

	const { view } = characterState.actualPose;

	const priorities = useLayerPriorityResolver(layers, characterState.actualPose);

	const priorityLayers = useMemo<ReadonlyMap<ComputedLayerPriority, ReactElement>>(() => {
		const result = new Map<ComputedLayerPriority, ReactElement>();
		for (const layerState of layers) {
			const priority = priorities.get(layerState);
			AssertNotNullable(priority);
			const reverse = PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority) !== (view === 'back');
			const lowerLayer = result.get(priority);
			const LayerElement = Layer ?? GraphicsLayer;

			result.set(priority, (
				<LayerElement
					key={ `${(layerState.item ?? layerState.layer.asset).id}-${layerState.layer.index}` }
					zIndex={ reverse ? 1 : -1 }
					lowerZIndex={ reverse ? 1 : -1 }
					layer={ layerState.layer }
					item={ layerState.item }
					state={ layerState.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
				>
					{ lowerLayer }
				</LayerElement>
			));
		}
		return result;
	}, [Layer, characterState, layers, priorities, view, characterBlinking]);

	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: CHARACTER_PIVOT_POSITION.x, y: 0 }), [pivotExtra]);
	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: view === 'back' ? -1 : 1, y: 1 }), [view, scaleExtra]);
	const position = useMemo<PointLike>(() => ({ x: (pivotExtra ? 0 : pivot.x) + positionOffset.x, y: 0 + positionOffset.y }), [pivot, pivotExtra, positionOffset]);

	const sortOrder = useComputedLayerPriority(characterState.actualPose);

	const actualFilters = useMemo<PIXI.Filter[] | undefined>(() => filters?.slice(), [filters]);

	return (
		<Container
			{ ...graphicsProps }
			ref={ ref }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			filters={ actualFilters }
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUpOutside }
			onpointermove={ onPointerMove }
			cursor='pointer'
		>
			<GraphicsSuspense loadingCirclePosition={ { x: 500, y: 750 } } sortableChildren>
				<SwapCullingDirection uniqueKey='filter' swap={ filters != null && filters.length > 0 }>
					<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
						{
							sortOrder.map((priority, i) => {
								const layer = priorityLayers.get(priority);
								return layer ? <Container key={ priority } zIndex={ i }>{ layer }</Container> : null;
							})
						}
						{ children }
					</SwapCullingDirection>
				</SwapCullingDirection>
			</GraphicsSuspense>
		</Container>
	);
}

export const GraphicsCharacterWithManager = React.forwardRef(GraphicsCharacterWithManagerImpl);

function GraphicsCharacterImpl(props: GraphicsCharacterProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => manager?.getAssetGraphicsById.bind(manager), [manager]);

	if (!manager || !graphicsGetter)
		return null;

	return <GraphicsCharacterWithManager { ...props } graphicsGetter={ graphicsGetter } ref={ ref } />;
}

export const GraphicsCharacter = React.forwardRef(GraphicsCharacterImpl);

export function useAssetPreferenceVisibilityCheck(): (asset: Asset) => boolean {
	const preferences = usePlayerData()?.assetPreferences ?? ASSET_PREFERENCES_DEFAULT;
	return useCallback((asset: Asset): boolean => {
		const resolution = ResolveAssetPreference(preferences, asset);
		if (resolution.preference === 'doNotRender')
			return false;
		return true;
	}, [preferences]);
}
