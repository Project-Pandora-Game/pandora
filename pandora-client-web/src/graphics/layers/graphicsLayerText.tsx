import type { Immutable } from 'immer';
import { EMPTY_ARRAY, PANDORA_FONTS, type ItemRoomDevice, type RoomDeviceGraphicsLayerText } from 'pandora-common';
import { ItemModuleText } from 'pandora-common/dist/assets/modules/text.js';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, useLayoutEffect, useMemo, useRef } from 'react';
import { useNullableObservable } from '../../observable.ts';
import { useAppearanceConditionEvaluator } from '../appearanceConditionEvaluator.ts';
import { Container } from '../baseComponents/container.ts';
import { Sprite } from '../baseComponents/sprite.ts';
import { usePixiAppOptional } from '../reconciler/appContext.ts';
import { useItemColor, type GraphicsLayerProps } from './graphicsLayerCommon.tsx';

export function GraphicsLayerText({
	characterState,
	layer,
	item,
	state,
	characterBlinking,
}: GraphicsLayerProps<'text'>): ReactElement {
	const app = usePixiAppOptional();

	const currentlyBlinking = useNullableObservable(characterBlinking) ?? false;
	const evaluator = useAppearanceConditionEvaluator(characterState, currentlyBlinking);

	const dataModule = item?.getModules().get(layer.dataModule);
	const textModule = (dataModule != null && dataModule instanceof ItemModuleText) ? dataModule : undefined;

	const ref = useRef<PIXI.Sprite>(null);

	const pivot = useMemo(() => {
		switch (textModule?.align ?? 'left') {
			case 'left':
				return new PIXI.Point(0, 0.5);
			case 'center':
				return new PIXI.Point(0.5, 0.5);
			case 'right':
				return new PIXI.Point(1, 0.5);
		}
	}, [textModule]);

	const position = useMemo(() => {
		const point = new PIXI.Point(layer.x, layer.y);
		if (layer.followBone != null) {
			evaluator.evalBoneTransform(layer.followBone).apply(point, point);
		}
		return point;
	}, [layer, evaluator]);

	const { color, alpha } = useItemColor(characterState.items, item, layer.colorizationKey, state);

	useLayoutEffect(() => {
		const sprite = ref.current;
		if (app == null || textModule == null || sprite == null)
			return;

		const style = new PIXI.TextStyle({
			fontFamily: PANDORA_FONTS[textModule.font].cssSelector,
			fontSize: layer.fontSize,
			fill: color,
			align: textModule.align,
		});

		const textTexture = app.renderer.canvasText.getTexture({
			text: textModule.text,
			style,
		});

		sprite.texture = textTexture;
		const { width, height } = textTexture.frame;
		const scale = Math.min(layer.width / width, layer.height / height, 1);
		sprite.scale = scale;
		sprite.pivot = { x: pivot.x * width, y: pivot.y * height };
		sprite.position = { x: pivot.x * layer.width, y: pivot.y * layer.height };

		return () => {
			sprite.texture = PIXI.Texture.EMPTY;
			sprite.scale = 1;
			sprite.pivot = { x: 0, y: 0 };
			sprite.position = { x: 0, y: 0 };
			app.renderer.canvasText.returnTexture(textTexture);
		};
	}, [app, textModule, color, layer, pivot]);

	return (
		<Container
			position={ position }
			angle={ (layer.followBone != null ? evaluator.evalBoneTransformAngle(layer.followBone) : 0) + layer.angle }
		>
			<Sprite
				ref={ ref }
				alpha={ alpha }
			/>
		</Container>
	);
}

export const GraphicsLayerRoomDeviceText = memo(function GraphicsLayerRoomDeviceText({
	layer,
	item,
	getFilters,
}: {
	item: ItemRoomDevice;
	layer: Immutable<RoomDeviceGraphicsLayerText>;
	getFilters: () => (readonly PIXI.Filter[] | undefined);
}): ReactElement {
	const app = usePixiAppOptional();

	const dataModule = item?.getModules().get(layer.dataModule);
	const textModule = (dataModule != null && dataModule instanceof ItemModuleText) ? dataModule : undefined;

	const ref = useRef<PIXI.Sprite>(null);

	const pivot = useMemo(() => {
		switch (textModule?.align ?? 'left') {
			case 'left':
				return new PIXI.Point(0, 0.5);
			case 'center':
				return new PIXI.Point(0.5, 0.5);
			case 'right':
				return new PIXI.Point(1, 0.5);
		}
	}, [textModule]);

	const position = useMemo(() => {
		return new PIXI.Point(layer.offset?.x ?? 0, layer.offset?.y ?? 0);
	}, [layer]);

	const { color, alpha } = useItemColor(EMPTY_ARRAY, item, layer.colorizationKey);

	const actualFilters = useMemo<PIXI.Filter[] | undefined>(() => getFilters()?.slice(), [getFilters]);

	useLayoutEffect(() => {
		const sprite = ref.current;
		if (app == null || textModule == null || sprite == null)
			return;

		const style = new PIXI.TextStyle({
			fontFamily: PANDORA_FONTS[textModule.font].cssSelector,
			fontSize: layer.fontSize,
			fill: color,
			align: textModule.align,
		});

		const textTexture = app.renderer.canvasText.getTexture({
			text: textModule.text,
			style,
		});

		sprite.texture = textTexture;
		const { width, height } = textTexture.frame;
		const scale = Math.min(layer.size.width / width, layer.size.height / height, 1);
		sprite.scale = scale;
		sprite.pivot = { x: pivot.x * width, y: pivot.y * height };
		sprite.position = { x: pivot.x * layer.size.width, y: pivot.y * layer.size.height };

		return () => {
			sprite.texture = PIXI.Texture.EMPTY;
			sprite.scale = 1;
			sprite.pivot = { x: 0, y: 0 };
			sprite.position = { x: 0, y: 0 };
			app.renderer.canvasText.returnTexture(textTexture);
		};
	}, [app, textModule, color, layer, pivot]);

	return (
		<Container
			position={ position }
			angle={ layer.angle ?? 0 }
		>
			<Sprite
				ref={ ref }
				alpha={ alpha }
				filters={ actualFilters }
			/>
		</Container>
	);
});
