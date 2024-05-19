import { DRAW_MODES, Mesh, MeshGeometry, MeshMaterial, State, Texture } from 'pixi.js';
import { DISPLAY_OBJECT_EVENTS, type DisplayObjectEventMap } from './container';
import { RegisterPixiComponent } from '../reconciler/component';

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
export const PixiMesh = RegisterPixiComponent<Mesh, never, DisplayObjectEventMap, PixiMeshProps>('PixiMesh', {
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

		const geometry = new MeshGeometry(vertices, uvs, indices);
		// Mark vertices as changeable
		geometry.getBuffer('aVertexPosition').static = false;

		const material = new MeshMaterial(texture);
		// Do not allow batch renderer to render the texture, if there is special state (it cannot handle it)
		if (state) {
			material.batchable = false;
		}

		const mesh = new Mesh(geometry, material, state);
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
			const newGeometry = new MeshGeometry(vertices, uvs, indices);
			newGeometry.getBuffer('aVertexPosition').static = false;

			mesh.geometry.destroy();
			mesh.geometry = newGeometry;
			updated = true;
		} else if (vertices !== oldVertices) {
			mesh.geometry.getBuffer('aVertexPosition').update(vertices);
			updated = true;
		}

		if (texture !== oldTexture) {
			mesh.texture = texture;
			updated = true;
		}

		if (state !== oldState) {
			mesh.state = state ?? State.for2d();
			if (state) {
				mesh.material.batchable = false;
			}
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
	events: DISPLAY_OBJECT_EVENTS,
});
