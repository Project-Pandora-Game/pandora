import { describe, expect, it } from '@jest/globals';
import { AppearanceLimitTree } from '../../src/index.ts';

describe('AppearanceLimitTree', () => {
	it('Starts valid', () => {
		const tree = new AppearanceLimitTree();

		expect(tree.valid).toBe(true);
	});

	it('Is valid after merge', () => {
		const tree = new AppearanceLimitTree();

		tree.merge({
			view: 'front',
		});

		expect(tree.valid).toBe(true);
	});

	it('Is invalid after conflicting merges', () => {
		const tree = new AppearanceLimitTree();

		tree.merge({
			view: 'front',
		});

		tree.merge({
			view: 'back',
		});

		expect(tree.valid).toBe(false);
	});

	it('Is invalid with conflicting options', () => {
		const tree = new AppearanceLimitTree();

		tree.merge({
			view: 'front',
		});

		tree.merge({
			options: [
				{ view: 'back' },
				{ view: 'back' },
			],
		});

		expect(tree.valid).toBe(false);
	});

	it('Is invalid with nested conflicting options', () => {
		const tree = new AppearanceLimitTree();

		tree.merge({
			view: 'front',
		});

		tree.merge({
			options: [
				{
					options: [
						{ view: 'back' },
						{ view: 'back' },
					],
				},
				{
					options: [
						{ view: 'back' },
						{ view: 'back' },
					],
				},
			],
		});

		expect(tree.valid).toBe(false);
	});
});
