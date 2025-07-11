import { Assert } from 'pandora-common';
import { Mesh, State, type Geometry, type Shader } from 'pixi.js';
import type { ReactNode } from 'react';
import { RegisterPixiComponent } from '../reconciler/component.ts';
import { CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

export type PixiCustomMeshGeometryCreator<TGeometry extends Geometry> = (existingGeometry: TGeometry | null) => TGeometry;
export type PixiCustomMeshShaderCreator<TShader extends Shader> = (existingShader: TShader | null) => TShader;

export interface PixiCustomMeshProps<TGeometry extends Geometry, TShader extends Shader> {
	geometry: PixiCustomMeshGeometryCreator<TGeometry>;
	shader: PixiCustomMeshShaderCreator<TShader>;

	state?: State;
	tint?: number;
	alpha?: number;
}

/**
 * Mesh class that allows for custom geometry and shader.
 *
 * This class empowers you to have more than maximum flexibility to render any kind of WebGL visuals you can think of.
 * This class assumes a lot of WebGL knowledge.
 * If you know a bit this should abstract enough away to make your life easier!
 *
 * Pretty much ALL WebGL can be broken down into the following:
 * - Geometry - The structure and data for the mesh. This can include anything from positions, uvs, normals, colors etc..
 * - Shader - This is the shader that PixiJS will render the geometry with (attributes in the shader must match the geometry)
 * - State - This is the state of WebGL required to render the mesh.
 *
 * Through a combination of the above elements you can render anything you want, 2D or 3D!
 */
export const PixiCustomMesh = RegisterPixiComponent<Mesh<Geometry, Shader>, never, ContainerEventMap, PixiCustomMeshProps<Geometry, Shader>>('PixiCustomMesh', {
	create(props) {
		const {
			geometry,
			shader,
			state,
			tint,
			alpha,
		} = props;

		const geometryInstance = geometry(null);
		const shaderInstance = shader(null);

		const mesh = new Mesh({
			geometry: geometryInstance,
			shader: shaderInstance,
			state,
		});
		mesh.tint = tint ?? 0xffffff;
		mesh.alpha = alpha ?? 1;

		return mesh;
	},
	destroy: (mesh) => {
		// We need to manually destroy the geometry to clean up properly
		const geometry = mesh.geometry;
		const shader = mesh.shader;
		mesh.destroy({
			texture: false,
			textureSource: false,
			children: false,
		});
		geometry.destroy(true);
		shader?.destroy();
	},
	applyCustomProps(mesh, oldProps, newProps) {
		const {
			geometry: oldGeometry,
			shader: oldShader,
			state: oldState,
			tint: oldTint,
			alpha: oldAlpha,
		} = oldProps as Partial<typeof newProps>;
		const {
			geometry,
			shader,
			state,
			tint,
			alpha,
		} = newProps;

		let updated = false;

		if (geometry !== oldGeometry) {
			const geometryInstance = mesh.geometry;
			const newGeometryInstance = geometry(geometryInstance);
			if (newGeometryInstance !== geometryInstance) {
				mesh.geometry = newGeometryInstance;
				geometryInstance.destroy(true);
			}
			updated = true;
		}

		if (shader !== oldShader) {
			const shaderInstance = mesh.shader;
			Assert(shaderInstance != null);
			const newShaderInstance = shader(shaderInstance);
			if (newShaderInstance !== shaderInstance) {
				mesh.shader = newShaderInstance;
				shaderInstance.destroy();
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
}) as (<TGeometry extends Geometry, TShader extends Shader>(props: PixiCustomMeshProps<TGeometry, TShader>) => ReactNode);
