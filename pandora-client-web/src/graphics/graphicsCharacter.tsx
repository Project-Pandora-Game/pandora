import type { Immutable } from 'immer';
import { nanoid } from 'nanoid';
import {
	Asset,
	ASSET_PREFERENCES_DEFAULT,
	AssetFrameworkCharacterState,
	AssetId,
	CharacterSize,
	CharacterView,
	CombineAppearancePoses,
	CreateAssetPropertiesResult,
	GetLogger,
	MergeAssetProperties,
	PseudoRandom,
	ResolveAssetPreference,
	type LayerPriority,
	type LayerStateOverrides,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedAssetGraphics } from '../assets/assetGraphics.ts';
import { GraphicsManagerInstance } from '../assets/graphicsManager.ts';
import { ChildrenProps } from '../common/reactTypes.ts';
import { usePlayerData } from '../components/gameContext/playerContextProvider.tsx';
import { Observable, useNullableObservable, useObservable } from '../observable.ts';
import { Container } from './baseComponents/container.ts';
import { TransitionedContainer, type PixiTransitionedContainer, type TransitionedContainerCustomProps } from './common/transitions/transitionedContainer.ts';
import { TransitionHandler, type TransitionHandlerValueProcessor } from './common/transitions/transitionHandler.ts';
import { LayerState, PRIORITY_ORDER_REVERSE_PRIORITIES, useComputedLayerPriority } from './def.ts';
import { useGraphicsSettings } from './graphicsSettings.tsx';
import { GraphicsSuspense } from './graphicsSuspense/graphicsSuspense.tsx';
import { GraphicsLayer } from './layers/graphicsLayer.tsx';
import { SwapCullingDirection, SwapCullingDirectionObservable, type GraphicsLayerProps } from './layers/graphicsLayerCommon.tsx';
import { useTickerRef } from './reconciler/tick.ts';

export type PointLike = {
	x: number;
	y: number;
};

const logger = GetLogger('GraphicsCharacter');

export type GraphicsCharacterLayerFilter = (layer: LayerState) => boolean;

export interface GraphicsCharacterProps extends ChildrenProps {
	layer?: (props: GraphicsLayerProps) => ReactElement;
	layerFilter?: GraphicsCharacterLayerFilter;
	characterState: AssetFrameworkCharacterState;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	angle?: number;
	hitArea?: Rectangle;
	eventMode?: PIXI.EventMode;
	filters?: readonly Filter[];
	zIndex?: number;

	/**
	 * Whether the blinking condition should be used for the graphics layer evaluators.
	 * @default false
	 */
	useBlinking?: boolean;

	movementTransitionDuration?: number;
	perPropertyMovementTransitionDuration?: TransitionedContainerCustomProps['perPropertyTransitionDuration'];

	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: FederatedPointerEvent) => void;
	onPointerMove?: (event: FederatedPointerEvent) => void;
}

export type GraphicsGetterFunction = (asset: AssetId) => LoadedAssetGraphics | undefined;
export type LayerStateOverrideGetter = (layer: Immutable<import('pandora-common').GraphicsLayer>) => LayerStateOverrides | undefined;
export type LayerGetSortOrder = (view: CharacterView) => readonly LayerPriority[];

export const CHARACTER_PIVOT_POSITION: Readonly<PointLike> = {
	x: CharacterSize.WIDTH / 2, // Middle of the character image
	y: 1290, // The position where heels seemingly touch the floor
};

const BLINK_INTERVAL_MIN = 4_000; // ms
const BLINK_INTERVAL_MAX = 6_000; // ms
const BLINK_LENGTH_MIN = 100; // ms
const BLINK_LENGTH_MAX = 400; // ms

const TRANSITION_CHARACTER_STATE_TICK = 50; // ms

const TRANSITION_CHARACTER_STATE_POSE: TransitionHandlerValueProcessor<AssetFrameworkCharacterState> = {
	mix(a, b, ratio) {
		// We base the animation off of "actualPose" despite doing it by setting "requestedPose",
		// as it looks more natural with most of the item limits
		return b.produceWithRequestedPose(CombineAppearancePoses(a.actualPose, b.actualPose, ratio));
	},
	isTransitionable(a, b) {
		return a.id === b.id;
	},
};

export function GraphicsCharacterWithManager({
	layer: Layer,
	layerFilter,
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
	useBlinking = false,
	movementTransitionDuration = 0,
	perPropertyMovementTransitionDuration,
	...graphicsProps
}: GraphicsCharacterProps & {
	graphicsGetter: GraphicsGetterFunction;
	layerStateOverrideGetter?: LayerStateOverrideGetter;
}): ReactElement {
	const { effectBlinking } = useGraphicsSettings();

	const [producedEffectiveCharacterState, setProducedEffectiveCharacterState] = useState<AssetFrameworkCharacterState>(characterState);
	const characterStateTransitionHandler = useRef<TransitionHandler<AssetFrameworkCharacterState> | null>(null);

	useEffect(() => {
		// If the transition is disabled, simply ignore the values
		if (!Number.isFinite(movementTransitionDuration) && movementTransitionDuration <= 0) {
			characterStateTransitionHandler.current?.cancel();
			characterStateTransitionHandler.current = null;
			setProducedEffectiveCharacterState(characterState);
			return;
		}

		// Re-generate transition if duration changed
		if (characterStateTransitionHandler.current?.config.transitionDuration !== movementTransitionDuration) {
			characterStateTransitionHandler.current?.cancel();
			characterStateTransitionHandler.current = new TransitionHandler({
				transitionDuration: movementTransitionDuration,
				valueProcessor: TRANSITION_CHARACTER_STATE_POSE,
				applyValue(newValue) {
					setProducedEffectiveCharacterState(newValue);
				},
			}, characterState);
		}

		// Trigger transition
		const transitionHander = characterStateTransitionHandler.current;
		transitionHander.setValue(characterState);
		// Tick immediately to start transition with current time
		transitionHander.tick(performance.now());

		let scheduledTick: number | undefined;
		function scheduleNextTickIfNeeded() {
			if (!transitionHander.needsUpdate)
				return;

			scheduledTick = setTimeout(function () {
				if (scheduledTick === undefined)
					return;

				transitionHander.tick(performance.now());
				scheduleNextTickIfNeeded();
			}, TRANSITION_CHARACTER_STATE_TICK);
		}

		scheduleNextTickIfNeeded();

		return () => {
			if (scheduledTick !== undefined) {
				clearTimeout(scheduledTick);
				scheduledTick = undefined;
			}
		};
	}, [movementTransitionDuration, characterState]);

	const effectiveCharacterState = (Number.isFinite(movementTransitionDuration) && movementTransitionDuration > 0) ? producedEffectiveCharacterState : characterState;
	const items = effectiveCharacterState.items;

	const assetPreferenceIsVisible = useAssetPreferenceVisibilityCheck();

	const characterBlinking = useMemo(() => new Observable<boolean>(false), []);

	useEffect(() => {
		if (!useBlinking || !effectBlinking) {
			characterBlinking.value = false;
			return;
		}

		const blinkRandom = new PseudoRandom(nanoid());

		let timeoutId: number | undefined;
		/** Whether next cycle should continue. Anti-race-condition for clearTimeout */
		let mounted: boolean = true;

		const doBlinkCycle = () => {
			const blinkInterval = blinkRandom.between(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX);
			const blinkLength = blinkRandom.between(BLINK_LENGTH_MIN, BLINK_LENGTH_MAX);

			// Blink start timeout
			timeoutId = setTimeout(() => {
				if (!mounted)
					return;
				characterBlinking.value = true;

				// Blink end timeout
				timeoutId = setTimeout(() => {
					if (!mounted)
						return;
					characterBlinking.value = false;

					// Loop
					doBlinkCycle();
				}, blinkLength);
			}, blinkInterval);
		};

		// Start blink loop
		doBlinkCycle();

		return () => {
			mounted = false;
			clearTimeout(timeoutId);
		};
	}, [characterBlinking, useBlinking, effectBlinking]);

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
				...graphics.layers.map((layer, layerIndex): LayerState => ({
					layerKey: `${item.id}-${layerIndex}`,
					layer,
					item,
					state: layerStateOverrideGetter?.(layer),
				})),
			);
		}

		if (layerFilter != null) {
			return result.filter(layerFilter);
		}

		return result;
	}, [items, assetPreferenceIsVisible, graphicsGetter, layerStateOverrideGetter, layerFilter]);

	const effectivePose = effectiveCharacterState.actualPose;
	const { view } = effectivePose;
	const sortOrder = useComputedLayerPriority(effectivePose);

	const priorityLayers = useMemo<ReadonlyMap<LayerPriority, ReactElement>>(() => {
		const result = new Map<LayerPriority, ReactElement>();
		for (const layerState of layers) {
			const priority = layerState.layer.priority;
			const reverse = PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority) !== (view === 'back');
			const lowerLayer = result.get(priority);
			const LayerElement = Layer ?? GraphicsLayer;

			result.set(priority, (
				<LayerElement
					key={ layerState.layerKey }
					zIndex={ reverse ? 1 : -1 }
					lowerZIndex={ reverse ? 1 : -1 }
					layer={ layerState.layer }
					item={ layerState.item }
					state={ layerState.state }
					characterState={ effectiveCharacterState }
					characterBlinking={ characterBlinking }
				>
					{ lowerLayer }
				</LayerElement>
			));
		}
		return result;
	}, [Layer, effectiveCharacterState, layers, view, characterBlinking]);

	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: CHARACTER_PIVOT_POSITION.x, y: 0 }), [pivotExtra]);
	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: view === 'back' ? -1 : 1, y: 1 }), [view, scaleExtra]);
	const position = useMemo<PointLike>(() => ({ x: (pivotExtra ? 0 : pivot.x) + positionOffset.x, y: 0 + positionOffset.y }), [pivot, pivotExtra, positionOffset]);

	const actualFilters = useMemo<PIXI.Filter[] | undefined>(() => filters?.slice(), [filters]);

	const swapCullingScale = useMemo(() => new Observable<boolean>(false), []);
	const onTransitionTick = useCallback((container: PixiTransitionedContainer) => {
		swapCullingScale.value = (container.scale.x >= 0) !== (container.scale.y >= 0);
	}, [swapCullingScale]);

	return (
		<TransitionedContainer
			{ ...graphicsProps }
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
			tickerRef={ useTickerRef() }
			transitionDuration={ movementTransitionDuration }
			perPropertyTransitionDuration={ perPropertyMovementTransitionDuration }
			onTransitionTick={ onTransitionTick }
		>
			<GraphicsSuspense loadingCirclePosition={ { x: 500, y: 750 } } sortableChildren>
				<SwapCullingDirection uniqueKey='filter' swap={ filters != null && filters.length > 0 }>
					<SwapCullingDirectionObservable swap={ swapCullingScale }>
						{
							sortOrder.map((priority, i) => {
								const layer = priorityLayers.get(priority);
								return layer ? <Container key={ priority } zIndex={ i }>{ layer }</Container> : null;
							})
						}
						{ children }
					</SwapCullingDirectionObservable>
				</SwapCullingDirection>
			</GraphicsSuspense>
		</TransitionedContainer>
	);
}

export function GraphicsCharacter(props: GraphicsCharacterProps): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const assetGraphics = useNullableObservable(manager?.assetGraphics);
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => assetGraphics == null ? undefined : ((id: AssetId) => assetGraphics[id]), [assetGraphics]);

	if (!graphicsGetter)
		return null;

	return <GraphicsCharacterWithManager { ...props } graphicsGetter={ graphicsGetter } />;
}

export function useAssetPreferenceVisibilityCheck(): (asset: Asset) => boolean {
	const preferences = usePlayerData()?.assetPreferences ?? ASSET_PREFERENCES_DEFAULT;
	return useCallback((asset: Asset): boolean => {
		const resolution = ResolveAssetPreference(preferences, asset);
		if (resolution.preference === 'doNotRender')
			return false;
		return true;
	}, [preferences]);
}
