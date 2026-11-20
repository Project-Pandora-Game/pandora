import { Container, Matrix } from 'pixi.js';
import { GraphicsMaskRenderFrame } from '../../src/graphics/graphicsMaskRenderFrame.ts';

const coverage = { x: 256, y: 96, width: 64, height: 64 };

describe('mask render visibility', () => {
	it('uses current transforms, including reflection, without querying mesh bounds', () => {
		const root = new Container();
		const parent = root.addChild(new Container());
		const target = parent.addChild(new Container());
		parent.position.set(600, 0);
		parent.scale.x = -1;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
		parent.position.x = 150;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(true);
	});

	it('honors an explicit capture transform and ignores parents outside the rendered subtree', () => {
		const outer = new Container();
		outer.position.x = 10000;
		const root = outer.addChild(new Container());
		root.position.x = 1000;
		const target = root.addChild(new Container());
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
		expect(new GraphicsMaskRenderFrame(root, 400, 400, new Matrix()).isVisible(target, coverage)).toBe(true);
	});

	it.each(['visible', 'renderable', 'culled', 'alpha', 'includeInBuild'] as const)('skips a %s-disabled ancestor and refreshes on return', (property) => {
		const root = new Container();
		const parent = root.addChild(new Container());
		const target = parent.addChild(new Container());
		const old = parent[property];
		if (property === 'alpha') parent.alpha = 0;
		else if (property === 'culled') parent.culled = true;
		else parent[property] = false;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).contains(target)).toBe(true);
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
		if (property === 'alpha') parent.alpha = old as number;
		else parent[property] = old as boolean;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(true);
	});

	it('keeps edge-clamped and filtered masks conservative even outside the viewport', () => {
		const root = new Container();
		const target = root.addChild(new Container());
		target.position.x = 1000;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, { ...coverage, x: 0 })).toBe(true);
		target.addEffect({
			pipe: 'filter', priority: 1,
			destroy() { /* No resources in this visibility fixture. */ },
		});
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(true);
	});

	it('rejects detached masks and respects rotated nested transforms', () => {
		const root = new Container();
		const target = new Container();
		expect(new GraphicsMaskRenderFrame(root, 400, 400).contains(target)).toBe(false);
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
		root.addChild(target);
		target.rotation = Math.PI;
		target.position.set(200, 200);
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(true);
		target.position.y = 1000;
		expect(new GraphicsMaskRenderFrame(root, 400, 400).isVisible(target, coverage)).toBe(false);
	});
});
