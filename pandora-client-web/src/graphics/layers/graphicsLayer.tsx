import { AssertNever } from 'pandora-common';
import type { GraphicsCharacterLayerBuilder } from '../graphicsCharacter.tsx';
import { GraphicsLayerAlphaImageMesh } from './graphicsLayerAlphaImageMesh.tsx';
import { GraphicsLayerMesh } from './graphicsLayerMesh.tsx';
import { GraphicsLayerText } from './graphicsLayerText.tsx';

export const GraphicsCharacterDefaultLayerBuilder: GraphicsCharacterLayerBuilder = function (layer, previousLayers, reverse, characterState, characterBlinking, debugConfig) {
	switch (layer.layer.type) {
		case 'mesh': {
			previousLayers ??= [];
			const res = (
				<GraphicsLayerMesh
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				/>
			);
			if (reverse) {
				previousLayers.unshift(res);
			} else {
				previousLayers.push(res);
			}
			return previousLayers;
		}
		case 'alphaImageMesh': {
			return [
				<GraphicsLayerAlphaImageMesh
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				>
					{ previousLayers }
				</GraphicsLayerAlphaImageMesh>,
			];
		}
		case 'text': {
			previousLayers ??= [];
			const res = (
				<GraphicsLayerText
					key={ layer.layerKey }
					layer={ layer.layer }
					item={ layer.item }
					state={ layer.state }
					characterState={ characterState }
					characterBlinking={ characterBlinking }
					debugConfig={ debugConfig }
				/>
			);
			if (reverse) {
				previousLayers.unshift(res);
			} else {
				previousLayers.push(res);
			}
			return previousLayers;
		}
	}
	AssertNever(layer.layer);
};
