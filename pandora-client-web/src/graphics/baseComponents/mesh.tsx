import { Mesh, MeshGeometry, State, Texture } from 'pixi.js';
import { RegisterPixiComponent } from '../reconciler/component';
import { CONTAINER_EVENTS, type ContainerEventMap } from './container';

export interface PixiMeshProps {
	vertices: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	texture: Texture;
	state?: State;
	tint?: number;
	alpha?: number;
}

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
export const PixiMesh = RegisterPixiComponent<Mesh, never, ContainerEventMap, PixiMeshProps>('PixiMesh', {
	create(props) {
		const {
			vertices,
			uvs,
			indices,
			texture,
			state,
			tint,
			alpha,
		} = props;

		const geometry = new MeshGeometry({
			positions: vertices,
			uvs,
			indices,
		});
		// Mark vertices as changeable
		geometry.getBuffer('aPosition').static = false;

		const mesh = new Mesh({
			geometry,
			texture,
			state,
		});
		mesh.tint = tint ?? 0xffffff;
		mesh.alpha = alpha ?? 1;

		return mesh;
	},
	applyCustomProps(mesh, oldProps, newProps) {
		const {
			vertices: oldVertices,
			uvs: oldUvs,
			indices: oldIndices,
			texture: oldTexture,
			state: oldState,
			tint: oldTint,
			alpha: oldAlpha,
		} = oldProps as Partial<typeof newProps>;
		const {
			vertices,
			uvs,
			indices,
			texture,
			state,
			tint,
			alpha,
		} = newProps;

		let updated = false;

		if (
			uvs !== oldUvs ||
			indices !== oldIndices
		) {
			// If uvs or indices change, we have to recreate geometry
			// TODO: Check if this still is the case
			const newGeometry = new MeshGeometry({
				positions: vertices,
				uvs,
				indices,
			});
			newGeometry.getBuffer('aPosition').static = false;

			mesh.geometry.destroy();
			mesh.geometry = newGeometry;
			updated = true;
		} else if (vertices !== oldVertices) {
			mesh.geometry.getBuffer('aPosition').data = vertices;
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

		if (alpha !== oldAlpha) {
			mesh.alpha = alpha ?? 1;
			updated = true;
		}

		return updated;
	},
	autoProps: {},
	events: CONTAINER_EVENTS,
});
