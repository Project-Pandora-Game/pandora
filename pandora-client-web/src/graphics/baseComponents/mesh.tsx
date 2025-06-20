import { Mesh, MeshGeometry, State, Texture, type Shader, type TextureShader } from 'pixi.js';
import { RegisterPixiComponent } from '../reconciler/component.ts';
import { CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

export interface PixiMeshProps {
	vertices: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	texture: Texture;
	shader?: Shader;
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
export const PixiMesh = RegisterPixiComponent<Mesh<MeshGeometry, Shader>, never, ContainerEventMap, PixiMeshProps>('PixiMesh', {
	create(props) {
		const {
			vertices,
			uvs,
			indices,
			texture,
			shader,
			state,
			tint,
			alpha,
		} = props;

		const geometry = new MeshGeometry({
			positions: vertices,
			uvs,
			indices,
			shrinkBuffersToFit: true,
		});
		// Mark vertices as changeable
		geometry.getBuffer('aPosition').static = false;

		const mesh = new Mesh({
			geometry,
			texture,
			state,
			shader,
		});
		mesh.tint = tint ?? 0xffffff;
		mesh.alpha = alpha ?? 1;

		if (shader != null) {
			shader.resources.uTexture = texture.source;
			shader.resources.uSampler = texture.source.style;
			shader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
		}

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
			shader: oldShader,
			state: oldState,
			tint: oldTint,
			alpha: oldAlpha,
		} = oldProps as Partial<typeof newProps>;
		const {
			vertices,
			uvs,
			indices,
			texture,
			shader,
			state,
			tint,
			alpha,
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

		if (texture !== oldTexture || shader !== oldShader) {
			mesh.shader = shader ?? null;
			mesh.texture = texture;
			if (shader != null) {
				(shader as TextureShader).texture = texture;
				shader.resources.uTexture = texture.source;
				shader.resources.uSampler = texture.source.style;
				shader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
			}
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
