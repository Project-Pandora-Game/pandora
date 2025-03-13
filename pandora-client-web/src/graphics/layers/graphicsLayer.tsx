import { Assert } from 'pandora-common';
import { ReactElement } from 'react';
import { GraphicsLayerAlphaImageMesh } from './graphicsLayerAlphaImageMesh.tsx';
import type { GraphicsLayerProps } from './graphicsLayerCommon.tsx';
import { GraphicsLayerMesh } from './graphicsLayerMesh.tsx';

export function GraphicsLayer({
	layer,
	...props
}: GraphicsLayerProps): ReactElement {
	if (layer.isType('mesh')) {
		return <GraphicsLayerMesh { ...props } layer={ layer } />;
	} else if (layer.isType('alphaImageMesh')) {
		return <GraphicsLayerAlphaImageMesh { ...props } layer={ layer } />;
	}
	Assert(false, 'Unsupported layer type');
}
