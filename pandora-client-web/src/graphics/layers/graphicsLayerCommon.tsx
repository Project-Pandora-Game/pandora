import type { Immutable } from 'immer';
import {
	AppearanceItems,
	AssertNever,
	AssetFrameworkCharacterState,
	HexColorString,
	Item,
	type GraphicsLayer,
	type GraphicsLayerType,
	type LayerStateOverrides,
	type PointDefinitionCalculated,
	type Rectangle,
} from 'pandora-common';
import { Texture } from 'pixi.js';
import { ReactElement, createContext, useContext, useMemo } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useObservable, type ReadonlyObservable } from '../../observable.ts';
import { ConditionEvaluatorBase } from '../appearanceConditionEvaluator.ts';

type TransformEvalCacheEntryValue = WeakMap<Immutable<PointDefinitionCalculated[]>, Float32Array>;
type TransformEvalCacheEntry = {
	noItem: TransformEvalCacheEntryValue;
	withItem: WeakMap<Item, TransformEvalCacheEntryValue>;
};

const transformEvalCache = new WeakMap<ConditionEvaluatorBase, TransformEvalCacheEntry>();

export function EvalLayerVerticesTransform(evaluator: ConditionEvaluatorBase, item: Item | null, points: Immutable<PointDefinitionCalculated[]>): Float32Array {
	let cacheEntry: TransformEvalCacheEntry | undefined = transformEvalCache.get(evaluator);
	if (cacheEntry === undefined) {
		cacheEntry = {
			noItem: new WeakMap(),
			withItem: new WeakMap(),
		};
		transformEvalCache.set(evaluator, cacheEntry);
	}

	let value: TransformEvalCacheEntryValue = cacheEntry.noItem;
	if (item != null) {
		let itemValue: TransformEvalCacheEntryValue | undefined = cacheEntry.withItem.get(item);
		if (itemValue === undefined) {
			itemValue = new WeakMap();
			cacheEntry.withItem.set(item, itemValue);
		}
		value = itemValue;
	}

	let result: Float32Array | undefined = value.get(points);
	if (result === undefined) {
		result = new Float32Array(points
			.flatMap((point) => evaluator.evalTransform(
				point.pos,
				point.transforms,
				point.mirror,
				item,
			)));
		value.set(points, result);
	}
	return result;
}

export function useLayerVertices(
	evaluator: ConditionEvaluatorBase,
	points: Immutable<PointDefinitionCalculated[]>,
	layerArea: Immutable<Rectangle>,
	item: Item | null,
	normalize: boolean = false,
): Float32Array {
	return useMemo((): Float32Array => {
		// Eval transform
		const result = EvalLayerVerticesTransform(evaluator, item, points);

		// Normalize
		if (normalize) {
			const normalizedResult = new Float32Array(result.length);
			for (let i = 0; i < result.length; i++) {
				const odd = (i % 2) !== 0;
				normalizedResult[i] = (result[i] - (odd ? layerArea.y : layerArea.x)) /
					(odd ? layerArea.height : layerArea.width);
			}
			return normalizedResult;
		}
		return result;
	}, [layerArea, evaluator, item, points, normalize]);
}

export interface GraphicsLayerProps<TLayerType extends GraphicsLayerType = GraphicsLayerType> extends ChildrenProps {
	characterState: AssetFrameworkCharacterState;
	zIndex: number;
	lowerZIndex: number;
	layer: Immutable<Extract<GraphicsLayer, { type: TLayerType; }>>;
	item: Item | null;

	/**
	 * Displays the vertices in pose matching the uv pose instead of the normal one.
	 * Useful for showing exact cutout of the original texture (which is useful in Editor).
	 * @default false
	 */
	displayUvPose?: boolean;
	state?: LayerStateOverrides;

	/**
	 * Observable for whether the character the layer belongs to is currently mid-blink.
	 * If not passed, it is assumed to be `false`.
	 */
	characterBlinking?: ReadonlyObservable<boolean>;

	getTexture?: (path: string) => Texture;
}

export const ContextCullClockwise = createContext<boolean>(false);

export function SwapCullingDirection({ children, swap = true }: ChildrenProps & { swap?: boolean; }): ReactElement {
	const cullClockwise = useContext(ContextCullClockwise);
	return (
		<ContextCullClockwise.Provider value={ swap ? !cullClockwise : cullClockwise }>
			{ children }
		</ContextCullClockwise.Provider>
	);
}

export function SwapCullingDirectionObservable({ children, swap }: ChildrenProps & { swap: ReadonlyObservable<boolean>; }): ReactElement {
	return (
		<SwapCullingDirection swap={ useObservable(swap) }>
			{ children }
		</SwapCullingDirection>
	);
}

export function useItemColorString(items: AppearanceItems, item: Item | null, colorizationKey?: string | null): HexColorString | undefined {
	if (item == null || colorizationKey == null) {
		return undefined;
	} else if (item.isType('bodypart')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('personal')) {
		return item.resolveColor(items, colorizationKey);
	} else if (item.isType('roomDevice')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('roomDeviceWearablePart')) {
		return item.resolveColor(colorizationKey);
	} else if (item.isType('lock')) {
		return undefined;
	}
	AssertNever(item);
}

export function useItemColor(items: AppearanceItems, item: Item | null, colorizationKey?: string | null, state?: LayerStateOverrides): { color: number; alpha: number; } {
	let color = 0xffffff;
	let alpha = 1;
	const itemColor = useItemColorString(items, item, colorizationKey);
	if (itemColor) {
		color = Number.parseInt(itemColor.substring(1, 7), 16);
		if (itemColor.length > 7) {
			alpha = Number.parseInt(itemColor.substring(7, 9), 16) / 255;
		}
	}
	if (state) {
		color = state.color ?? color;
		alpha = state.alpha ?? alpha;
	}
	return { color, alpha };
}

export function useItemColorRibbon(items: AppearanceItems, item: Item | null): HexColorString | undefined {
	let color: HexColorString | undefined;

	if (item == null) {
		color = undefined;
	} else if (item.isType('bodypart')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('personal')) {
		color = item.getColorRibbon(items);
	} else if (item.isType('roomDevice')) {
		color = item.getColorRibbon();
	} else if (item.isType('roomDeviceWearablePart')) {
		color = item.getColorRibbon();
	} else if (item.isType('lock')) {
		color = undefined;
	} else {
		AssertNever(item);
	}

	return (color?.substring(0, 7) as HexColorString | undefined);
}
