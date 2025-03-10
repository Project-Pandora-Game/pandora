import { GetLogger } from 'pandora-common';
import { USER_DEBUG } from '../config/Environment.ts';

type ContextData = {
	context: WebGLRenderingContext | WebGL2RenderingContext;
	program: Set<WebGLProgram>;
	texture: Set<WebGLTexture>;
	renderBuffer: Set<WebGLRenderbuffer>;
	buffer: Set<WebGLBuffer>;
	framebuffer: Set<WebGLFramebuffer>;
	shader: Set<WebGLShader>;
};

const contexts: ContextData[] = [];

/* eslint-disable @typescript-eslint/unbound-method, prefer-rest-params */

/**
 * This function applies global Pixi.js settings we need
 */
export function DebugInitResourceRetentionMonitor(): void {
	if (!USER_DEBUG)
		return;

	const logger = GetLogger('ResourceRetentionDebug');

	(window as unknown as Record<string, unknown>).pandoraGpuResourceDebugData = contexts;

	const tmpCanvas = document.createElement('canvas');
	const canvasPrototype = Object.getPrototypeOf(tmpCanvas) as Record<string, unknown>;
	const originalCreateContext = canvasPrototype.getContext as HTMLCanvasElement['getContext'];
	canvasPrototype.getContext = function (type: string) {
		if (type !== 'webgl2' && type !== 'webgl') {
			if (type !== '2d') {
				logger.error('Unknown context type', type);
			}
			// @ts-expect-error: Debug only
			return originalCreateContext.apply(this, arguments);
		}
		// @ts-expect-error: Debug only
		const context = originalCreateContext.apply(this, arguments) as (WebGL2RenderingContext | WebGLRenderingContext | null);
		if (context != null) {
			logger.info('New context created', type, '\n', new Error());
			const data: ContextData = {
				context,
				program: new Set(),
				texture: new Set(),
				renderBuffer: new Set(),
				buffer: new Set(),
				framebuffer: new Set(),
				shader: new Set(),
			};
			contexts.push(data);
			// Program
			{
				const createProgram = context.createProgram;
				context.createProgram = function () {
					// @ts-expect-error: Debug only
					const program = createProgram.apply(context, arguments);
					if (program == null) {
						logger.warning('Program create failed\n', new Error());
					} else {
						data.program.add(program);
					}
					return program;
				};
				const deleteProgram = context.deleteProgram;
				context.deleteProgram = function (program) {
					if (program != null) {
						data.program.delete(program);
					}
					// @ts-expect-error: Debug only
					return deleteProgram.apply(context, arguments);
				};
			}
			// Texture
			{
				const createTexture = context.createTexture;
				context.createTexture = function () {
					// @ts-expect-error: Debug only
					const texture = createTexture.apply(context, arguments);
					if (texture == null) {
						logger.warning('Texture create failed\n', new Error());
					} else {
						data.texture.add(texture);
					}
					return texture;
				};
				const deleteTexture = context.deleteTexture;
				context.deleteTexture = function (texture) {
					if (texture != null) {
						data.texture.delete(texture);
					}
					// @ts-expect-error: Debug only
					return deleteTexture.apply(context, arguments);
				};
			}
			// Render buffer
			{
				const createRenderbuffer = context.createRenderbuffer;
				context.createRenderbuffer = function () {
					// @ts-expect-error: Debug only
					const buffer = createRenderbuffer.apply(context, arguments);
					if (buffer == null) {
						logger.warning('Renderbuffer create failed\n', new Error());
					} else {
						data.renderBuffer.add(buffer);
					}
					return buffer;
				};
				const deleteRenderbuffer = context.deleteRenderbuffer;
				context.deleteRenderbuffer = function (buffer) {
					if (buffer != null) {
						data.renderBuffer.delete(buffer);
					}
					// @ts-expect-error: Debug only
					return deleteRenderbuffer.apply(context, arguments);
				};
			}
			// Buffer
			{
				const createBuffer = context.createBuffer;
				context.createBuffer = function () {
					// @ts-expect-error: Debug only
					const buffer = createBuffer.apply(context, arguments);
					if (buffer == null) {
						logger.warning('Buffer create failed\n', new Error());
					} else {
						data.buffer.add(buffer);
					}
					return buffer;
				};
				const deleteBuffer = context.deleteBuffer;
				context.deleteBuffer = function (buffer) {
					if (buffer != null) {
						data.buffer.delete(buffer);
					}
					// @ts-expect-error: Debug only
					return deleteBuffer.apply(context, arguments);
				};
			}
			// Frame buffer
			{
				const createFramebuffer = context.createFramebuffer;
				context.createFramebuffer = function () {
					// @ts-expect-error: Debug only
					const buffer = createFramebuffer.apply(context, arguments);
					if (buffer == null) {
						logger.warning('Frame buffer create failed\n', new Error());
					} else {
						data.framebuffer.add(buffer);
					}
					return buffer;
				};
				const deleteFramebuffer = context.deleteFramebuffer;
				context.deleteFramebuffer = function (buffer) {
					if (buffer != null) {
						data.framebuffer.delete(buffer);
					}
					// @ts-expect-error: Debug only
					return deleteFramebuffer.apply(context, arguments);
				};
			}
			// Shader
			{
				const createShader = context.createShader;
				context.createShader = function () {
					// @ts-expect-error: Debug only
					const shader = createShader.apply(context, arguments);
					if (shader == null) {
						logger.warning('Shader create failed\n', new Error());
					} else {
						data.shader.add(shader);
					}
					return shader;
				};
				const deleteShader = context.deleteShader;
				context.deleteShader = function (buffer) {
					if (buffer != null) {
						data.shader.delete(buffer);
					}
					// @ts-expect-error: Debug only
					return deleteShader.apply(context, arguments);
				};
			}
		}
		return context;
	};
}
