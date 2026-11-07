import { State, type Texture } from 'pixi.js';
import { GraphicsSkinnedMesh } from '../graphicsSkinnedMesh.ts';
import type { GraphicsBonePalette } from '../graphicsBonePalette.ts';
import type { LayerVerticesTransformData } from '../layers/graphicsLayerCommon.tsx';
import { RegisterPixiComponent, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from '../reconciler/component.ts';
import { CONTAINER_AUTO_PROPS, CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

const SKINNED_MESH_AUTO_PROPS = {
	...CONTAINER_AUTO_PROPS,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<GraphicsSkinnedMesh>, true>>>;
type SkinnedMeshAutoProps = keyof typeof SKINNED_MESH_AUTO_PROPS;
interface SkinnedMeshCustomProps {
	vertices: LayerVerticesTransformData;
	uvs: Float32Array;
	indices: Uint32Array;
	texture: Texture;
	state?: State;
	bonePalette?: GraphicsBonePalette;
	tint?: number;
}

export type PixiSkinnedMeshProps = PixiComponentProps<GraphicsSkinnedMesh, SkinnedMeshAutoProps, ContainerEventMap, SkinnedMeshCustomProps>;

export const PixiSkinnedMesh = RegisterPixiComponent<GraphicsSkinnedMesh, SkinnedMeshAutoProps, ContainerEventMap, SkinnedMeshCustomProps>('PixiSkinnedMesh', {
	create(props) {
		const mesh = new GraphicsSkinnedMesh(props.vertices, props.uvs, props.indices, props.texture, props.state, props.bonePalette);
		mesh.tint = props.tint ?? 0xffffff;
		return mesh;
	},
	destroy(mesh) {
		mesh.destroy({ texture: false, textureSource: false, children: false });
	},
	applyCustomProps(mesh, oldProps, newProps) {
		const old = oldProps as Partial<SkinnedMeshCustomProps>;
		let updated = false;
		if (old.bonePalette !== newProps.bonePalette) {
			mesh.setBonePalette(newProps.bonePalette);
			updated = true;
		}
		if (old.vertices !== newProps.vertices || old.uvs !== newProps.uvs || old.indices !== newProps.indices || old.texture !== newProps.texture) {
			mesh.update(newProps.vertices, newProps.uvs, newProps.indices, newProps.texture);
			updated = true;
		}
		if (old.state !== newProps.state) {
			mesh.state = newProps.state ?? State.for2d();
			updated = true;
		}
		if (old.tint !== newProps.tint) {
			mesh.tint = newProps.tint ?? 0xffffff;
			updated = true;
		}
		return updated;
	},
	autoProps: SKINNED_MESH_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});
