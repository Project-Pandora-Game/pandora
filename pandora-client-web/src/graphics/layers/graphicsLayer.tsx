import { AssertNever } from 'pandora-common';
import { ReactElement } from 'react';
import { GraphicsLayerAlphaImageMesh } from './graphicsLayerAlphaImageMesh.tsx';
import type { GraphicsLayerProps } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMesh } from './graphicsLayerMesh.tsx';
import { GraphicsLayerText } from './graphicsLayerText.tsx';

export function GraphicsLayer({
	layer,
	...props
}: GraphicsLayerProps): ReactElement {
	switch (layer.type) {
		case 'mesh':
			return <GraphicsLayerMesh { ...props } layer={ layer } />;
		case 'alphaImageMesh':
			return <GraphicsLayerAlphaImageMesh { ...props } layer={ layer } />;
		case 'text':
			return <GraphicsLayerText { ...props } layer={ layer } />;
	}
	AssertNever(layer);
}
