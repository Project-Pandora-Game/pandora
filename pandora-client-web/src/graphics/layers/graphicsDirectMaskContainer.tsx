import { Application, MeshGeometry, Texture, type Container as PixiContainer } from 'pixi.js';
import { useContext, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { useGraphicsTextureResolution } from '../../assets/assetGraphicsCalculations.ts';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { Container } from '../baseComponents/container.ts';
import type { PixiMeshProps } from '../baseComponents/mesh.tsx';
import { GraphicsMaskRaster } from '../graphicsMaskRaster.ts';
import { GraphicsDirectMask } from '../graphicsDirectMask.ts';
import { GraphicsMaskScopeContext } from '../graphicsMaskScope.tsx';

export interface GraphicsDirectMaskContainerProps extends ChildrenProps {
	app: Application;
	texture: Texture;
	maskMesh?: Pick<PixiMeshProps, 'vertices' | 'uvs' | 'indices'>;
	rasterScope?: object;
}

/** Apply masks in mesh shaders, retaining the raster cache and shared clipping across native draw families. */
export function GraphicsDirectMaskContainer({ app, texture, maskMesh, children, rasterScope }: GraphicsDirectMaskContainerProps): ReactElement {
	const resolution = Number(useGraphicsTextureResolution());
	const contextScope = useContext(GraphicsMaskScopeContext);
	const scope = rasterScope ?? contextScope;
	const [target, setTarget] = useState<PixiContainer | null>(null);
	const [host, setHost] = useState<PixiContainer | null>(null);
	const active = texture !== Texture.EMPTY && maskMesh != null;
	const resource = useRef<{ geometry: MeshGeometry; raster: GraphicsMaskRaster; } | null>(null);
	const inputs = useRef({ texture, maskMesh });
	inputs.current = { texture, maskMesh };

	useLayoutEffect(() => {
		const initial = inputs.current;
		if (!target || !host || !active || !initial.maskMesh)
			return undefined;
		const geometry = new MeshGeometry({ positions: initial.maskMesh.vertices, uvs: initial.maskMesh.uvs, indices: initial.maskMesh.indices });
		geometry.batchMode = 'no-batch';
		geometry.getBuffer('aPosition').static = false;
		const raster = new GraphicsMaskRaster(app, initial.texture, geometry, scope, resolution);
		resource.current = { geometry, raster };
		host.measurable = false;
		host.addChild(raster.anchor);
		if (!('gl' in app.renderer)) throw new Error('Direct masking requires WebGL');
		const effect = new GraphicsDirectMask(app.renderer, raster);
		target.addEffect(effect);
		return () => {
			resource.current = null;
			target.removeEffect(effect);
			effect.destroy();
			host.removeChild(raster.anchor);
			raster.destroy();
			geometry.destroy();
		};
	}, [target, host, active, app, scope, resolution]);

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
