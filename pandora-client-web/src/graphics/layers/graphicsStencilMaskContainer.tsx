import { Application, MeshGeometry, Texture, type Container as PixiContainer } from 'pixi.js';
import { useContext, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { Container } from '../baseComponents/container.ts';
import type { PixiMeshProps } from '../baseComponents/mesh.tsx';
import { GraphicsRasterStencilMask } from '../graphicsStencilMask.ts';
import { GraphicsDirectMask } from '../graphicsDirectMask.ts';
import { GraphicsMaskScopeContext } from '../graphicsMaskScope.tsx';
import type { MaskRasterFormat } from '../graphicsMaskTexture.ts';

export interface GraphicsStencilMaskContainerProps extends ChildrenProps {
	app: Application;
	texture: Texture;
	maskMesh?: Pick<PixiMeshProps, 'vertices' | 'uvs' | 'indices'>;
	rasterScope?: object;
	rasterFormat?: MaskRasterFormat;
	directShader?: boolean;
}

/** Retain GPU resources across pose changes; only their input buffers change. */
export function GraphicsStencilMaskContainer({ app, texture, maskMesh, children, rasterScope, rasterFormat, directShader = false }: GraphicsStencilMaskContainerProps): ReactElement {
	const contextScope = useContext(GraphicsMaskScopeContext);
	const scope = rasterScope ?? contextScope;
	const [target, setTarget] = useState<PixiContainer | null>(null);
	const [host, setHost] = useState<PixiContainer | null>(null);
	const active = texture !== Texture.EMPTY && maskMesh != null;
	const resource = useRef<{ geometry: MeshGeometry; raster: GraphicsRasterStencilMask; } | null>(null);
	const inputs = useRef({ texture, maskMesh });
	inputs.current = { texture, maskMesh };

	useLayoutEffect(() => {
		const initial = inputs.current;
		if (!target || !host || !active || !initial.maskMesh)
			return undefined;
		const geometry = new MeshGeometry({ positions: initial.maskMesh.vertices, uvs: initial.maskMesh.uvs, indices: initial.maskMesh.indices });
		geometry.batchMode = 'no-batch';
		geometry.getBuffer('aPosition').static = false;
		const raster = new GraphicsRasterStencilMask(app, initial.texture, geometry, scope, rasterFormat);
		resource.current = { geometry, raster };
		host.measurable = false;
		host.addChild(raster.effect.root);
		if (!('gl' in app.renderer) && !('gpu' in app.renderer)) throw new Error('Direct masking requires WebGL or WebGPU');
		const effect = directShader ? new GraphicsDirectMask(app.renderer, raster, rasterFormat) : raster.effect;
		target.addEffect(effect);
		return () => {
			resource.current = null;
			target.removeEffect(effect);
			if (effect instanceof GraphicsDirectMask) effect.destroy();
			host.removeChild(raster.effect.root);
			raster.destroy();
			geometry.destroy();
		};
	}, [target, host, active, app, scope, rasterFormat, directShader]);

	useLayoutEffect(() => {
		const current = resource.current;
		if (!current || !maskMesh)
			return;
		const { geometry, raster } = current;
		if (geometry.positions !== maskMesh.vertices)
			geometry.positions = maskMesh.vertices;
		if (geometry.uvs !== maskMesh.uvs)
			geometry.uvs = maskMesh.uvs;
		if (geometry.indices !== maskMesh.indices)
			geometry.indices = maskMesh.indices;
		raster.update(texture, geometry);
	}, [texture, maskMesh]);

	return <Container ref={ setTarget }><Container ref={ setHost } />{ children }</Container>;
}

/** Experimental fused binary mask, sharing the stencil mode's retained RG8 raster cache. */
export function GraphicsDirectMaskContainer(props: Omit<GraphicsStencilMaskContainerProps, 'directShader'>): ReactElement {
	return <GraphicsStencilMaskContainer { ...props } directShader />;
}
