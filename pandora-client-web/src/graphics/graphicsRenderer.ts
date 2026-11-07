import { GetLogger } from 'pandora-common';
import { Application, RendererType, type ApplicationOptions } from 'pixi.js';
import { Observable } from '../observable.ts';
import type { GraphicsRendererPreference } from './graphicsSettings.tsx';

export interface GraphicsRendererInitialization {
	requested: GraphicsRendererPreference;
	active: GraphicsRendererPreference | null;
	/** At least one graphics application needed WebGL after WebGPU was requested. */
	webgpuFallback: boolean;
}

/** Records actual initialization; choosing WebGPU does not assert that it started. */
export const GraphicsRendererStatus = new Observable<GraphicsRendererInitialization | null>(null);
const logger = GetLogger('GraphicsRenderer');
const RENDERER_NAMES: Readonly<Record<number, GraphicsRendererPreference | undefined>> = {
	[RendererType.WEBGL]: 'webgl',
	[RendererType.WEBGPU]: 'webgpu',
};

export async function CreateGraphicsApplication(options: Partial<ApplicationOptions>, preference: GraphicsRendererPreference): Promise<Application> {
	let app = new Application();
	try {
		try {
			await app.init({ ...options, preference: preference === 'webgpu' ? ['webgpu', 'webgl'] : ['webgl'] });
		} catch (error) {
			CleanupFailedApplication(app);
			if (preference !== 'webgpu')
				throw error;
			logger.warning('WebGPU could not start; trying WebGL.', error);
			app = new Application();
			await app.init({ ...options, preference: ['webgl'] });
		}
		const active = RENDERER_NAMES[app.renderer.type] ?? null;
		if (active == null)
			throw new Error('Graphics initialized with an unexpected renderer');
		GraphicsRendererStatus.value = {
			requested: preference,
			active,
			webgpuFallback: GraphicsRendererStatus.value?.webgpuFallback === true || (preference === 'webgpu' && active === 'webgl'),
		};
		return app;
	} catch (error) {
		CleanupFailedApplication(app);
		GraphicsRendererStatus.value = { requested: preference, active: null, webgpuFallback: GraphicsRendererStatus.value?.webgpuFallback ?? false };
		throw error;
	}
}

function CleanupFailedApplication(app: Application): void {
	// init() can reject before a renderer or application plugins exist. Destroy
	// what was created without calling uninitialized plugin cleanup methods.
	try {
		if (app.renderer) {
			app.destroy(true, { children: true });
		} else if (app.stage && !app.stage.destroyed) {
			app.stage.destroy({ children: true });
		}
	} catch (error) {
		logger.warning('Could not fully clean up a failed graphics application.', error);
	}
}
