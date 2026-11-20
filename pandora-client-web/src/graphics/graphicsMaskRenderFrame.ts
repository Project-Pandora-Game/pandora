import { Bounds, Matrix, type Container } from 'pixi.js';
import type { RasterMaskBounds } from './graphicsMaskGeometry.ts';

interface MaskTransform {
	matrix: Matrix;
	filtered: boolean;
}

/** Resolve transforms once per render, without asking clothing meshes for CPU-skinned bounds. */
export class GraphicsMaskRenderFrame {
	private readonly _transforms = new Map<Container, MaskTransform | null>();
	private readonly _membership = new Map<Container, boolean>();
	private readonly _bounds = new Bounds();
	private readonly _width: number;
	private readonly _height: number;

	constructor(root: Container, width: number, height: number, transform?: Matrix) {
		this._width = width;
		this._height = height;
		this._membership.set(root, true);
		root.updateLocalTransform();
		this._transforms.set(root, this._canRender(root) ? {
			matrix: (transform ?? root.localTransform).clone(),
			filtered: root.effects?.some((effect) => effect.pipe === 'filter') ?? false,
		} : null);
	}

	public contains(container: Container | null): boolean {
		if (!container)
			return false;
		let result = this._membership.get(container);
		if (result === undefined) {
			result = this.contains(container.parent);
			this._membership.set(container, result);
		}
		return result;
	}

	private _canRender(container: Container): boolean {
		return container.visible && container.renderable && !container.culled && container.alpha > 0 && container.includeInBuild;
	}

	private _transform(container: Container): MaskTransform | null {
		if (this._transforms.has(container))
			return this._transforms.get(container)!;
		const parent = container.parent;
		const inherited = parent && this._canRender(container) ? this._transform(parent) : null;
		let result: MaskTransform | null = null;
		if (inherited) {
			container.updateLocalTransform();
			result = {
				matrix: inherited.matrix.clone().append(container.localTransform),
				filtered: inherited.filtered || (container.effects?.some((effect) => effect.pipe === 'filter') ?? false),
			};
		}
		this._transforms.set(container, result);
		return result;
	}

	public isVisible(container: Container | null, coverage: Readonly<RasterMaskBounds>): boolean {
		if (!container)
			return false;
		const transform = this._transform(container);
		if (!transform)
			return false;
		// Filters can sample outside the viewport; edge texels can clamp outside
		// the original canvas. Neither case is safe to reject using this rectangle.
		if (transform.filtered || coverage.x === 0 || coverage.y === 0 ||
			coverage.x + coverage.width === 1500 || coverage.y + coverage.height === 1500)
			return true;
		const bounds = this._bounds.clear();
		bounds.addFrame(coverage.x - 250, coverage.y, coverage.x + coverage.width - 250, coverage.y + coverage.height, transform.matrix);
		// Unknown/nonfinite projections must keep the conservative rendering path.
		if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite))
			return true;
		return bounds.maxX >= 0 && bounds.maxY >= 0 && bounds.minX <= this._width && bounds.minY <= this._height;
	}
}
