import { Mesh, MeshGeometry, State, Texture, type ColorSource } from 'pixi.js';
import { RegisterPixiComponent, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from '../reconciler/component.ts';
import { CONTAINER_AUTO_PROPS, CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

const PIXI_MESH_AUTO_PROPS = {
	...CONTAINER_AUTO_PROPS,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<Mesh>, true>>>;
export type PixiMeshAutoProps = keyof typeof PIXI_MESH_AUTO_PROPS;

export interface PixiMeshCustomProps {
	vertices: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	texture: Texture;
	state?: State;
	tint?: ColorSource;
}

export type PixiMeshProps = PixiComponentProps<Mesh, PixiMeshAutoProps, ContainerEventMap, PixiMeshCustomProps>;

/**
 * Base mesh class.
 *
 * This class empowers you to have maximum flexibility to render any kind of WebGL visuals you can think of.
 * This class assumes a certain level of WebGL knowledge.
 * If you know a bit this should abstract enough away to make your life easier!
 *
 * Pretty much ALL WebGL can be broken down into the following:
 * - Geometry - The structure and data for the mesh. This can include anything from positions, uvs, normals, colors etc..
 * - Shader - This is the shader that PixiJS will render the geometry with (attributes in the shader must match the geometry)
 * - State - This is the state of WebGL required to render the mesh.
 *
 * Through a combination of the above elements you can render anything you want, 2D or 3D!
 */
export const PixiMesh = RegisterPixiComponent<Mesh, PixiMeshAutoProps, ContainerEventMap, PixiMeshCustomProps>('PixiMesh', {
	create(props) {
		const {
			vertices,
			uvs,
			indices,
			texture,
			state,
			tint,
		} = props;

		const geometry = new MeshGeometry({
			positions: vertices,
			uvs,
			indices,
			shrinkBuffersToFit: true,
		});
		// Workaround: Pixi breaks when batchability is 'auto' and the heuristics changes. Instead force it to be consistent.
		geometry.batchMode = 'no-batch';
		// Mark vertices as changeable
		geometry.getBuffer('aPosition').static = false;

		const mesh = new Mesh({
			geometry,
			texture,
			state,
		});
		mesh.tint = tint ?? 0xffffff;

		return mesh;
	},
	destroy: (mesh) => {
		// We need to manually destroy the geometry to clean up properly
		const geometry = mesh.geometry;
		mesh.destroy({
			texture: false,
			textureSource: false,
			children: false,
		});
		geometry.destroy(true);
	},
	applyCustomProps(mesh, oldProps, newProps) {
		const {
			vertices: oldVertices,
			uvs: oldUvs,
			indices: oldIndices,
			texture: oldTexture,
			state: oldState,
			tint: oldTint,
		} = oldProps as Partial<typeof newProps>;
		const {
			vertices,
			uvs,
			indices,
			texture,
			state,
			tint,
		} = newProps;

		let updated = false;

		if (vertices !== oldVertices) {
			mesh.geometry.getBuffer('aPosition').data = vertices;
			updated = true;
		}
		if (uvs !== oldUvs) {
			mesh.geometry.getBuffer('aUV').data = uvs;
			updated = true;
		}
		if (indices !== oldIndices) {
			mesh.geometry.indexBuffer.data = indices;
			updated = true;
		}

		if (texture !== oldTexture) {
			mesh.texture = texture;
			updated = true;
		}

		if (state !== oldState) {
			mesh.state = state ?? State.for2d();
			updated = true;
		}

		if (tint !== oldTint) {
			mesh.tint = tint ?? 0xffffff;
			updated = true;
		}

		return updated;
	},
	autoProps: PIXI_MESH_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});
