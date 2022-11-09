import * as PIXI from 'pixi.js';
import { DraggablePointDisplay } from '../draggable';
import { EditorLayer, EDITOR_LAYER_Z_INDEX_EXTRA } from './editorLayer';
import { BoneName } from 'pandora-common';
import { GraphicsLayerProps, useLayerPoints, useLayerVertices } from '../../../graphics/graphicsLayer';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { useEditor } from '../../editorContextProvider';
import { useObservable } from '../../../observable';
import { Container, Graphics } from '@saitonakamura/react-pixi';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator';
import { max, min } from 'lodash';
import { useLayerDefinition } from '../../../assets/assetGraphics';

export function SetupLayer({
	layer,
	item,
	appearanceContainer,
	...props
}: GraphicsLayerProps): ReactElement {
	const editor = useEditor();
	const showHelpers = useObservable(editor.targetLayer) === layer;

	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const { scaling, height, width } = useLayerDefinition(layer);

	const uvPose = useMemo<Record<BoneName, number>>(() => {
		if (scaling) {
			let settingValue: number | undefined;
			const stops = scaling.stops.map((stop) => stop[0]);
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				settingValue = max(stops.filter((stop) => stop > 0 && stop <= value));
			} else if (value < 0) {
				settingValue = min(stops.filter((stop) => stop < 0 && stop >= value));
			}
			if (settingValue) {
				return { [scaling.scaleBone]: settingValue };
			}
		}
		return {};
	}, [evaluator, scaling]);

	const uv = useLayerVertices(evaluator, points, layer, item, true, uvPose);

	const drawWireFrame = useCallback((g: PIXI.Graphics) => {
		g.clear().lineStyle(1, 0x333333, 0.2);
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [uv[2 * p] * width, uv[2 * p + 1] * height]);
			g.drawPolygon(poly);
		}
	}, [height, triangles, uv, width]);

	const displayPoints = useObservable(editor.targetLayerPoints);

	return (
		<>
			<EditorLayer
				{ ...props }
				layer={ layer }
				item={ item }
				verticesPoseOverride={ uvPose }
				appearanceContainer={ appearanceContainer }
			/>
			{
				!showHelpers ? null : (
					<Graphics
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
						draw={ drawWireFrame }
					/>
				)
			}
			{
				!showHelpers ? null : (
					<Container
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
					>
						{ displayPoints.map((p, i) => <DraggablePointDisplay draggablePoint={ p } key={ i } />) }
					</Container>
				)
			}
		</>
	);
}

// export class SetupLayer extends EditorLayer {
// 	protected override calculateVertices(normalize: boolean = false, valueOverrides?: Record<BoneName, number>): Float64Array {
// 		return super.calculateVertices(normalize, valueOverrides ?? {});
// 	}

// 	private _showSprite: boolean = false;
// 	protected show(value: boolean): void {
// 		if (value !== this._showSprite) {
// 			this._showSprite = value;
// 			this.update({ force: true });
// 		}
// 	}

// 	protected override updateChild(): void {
// 		if (this._showSprite) {
// 			this.result = new Sprite(this.texture);
// 		} else {
// 			super.updateChild();
// 		}
// 	}

// 	override destroy() {
// 		this.show(false);
// 		super.destroy();
// 	}
// }
