import { describe, expect, it } from '@jest/globals';
import type { Coordinates } from '../../../src/assets/graphics/common.ts';
import type { AtomicPoseCondition, Condition, PoseCondition } from '../../../src/assets/graphics/conditions.ts';
import { MirrorAtomicPoseCondition, MirrorBoneLike, MirrorCondition, MirrorTransform } from '../../../src/assets/graphics/mirroring.ts';
import type { TransformDefinition } from '../../../src/assets/graphics/points.ts';

describe('MirrorBoneLike()', () => {
	it.each([
		[undefined, undefined],
		['test_r', 'test_l'],
		['test_l', 'test_r'],
		['test_r_l', 'test_r_r'],
		['test_r_r', 'test_r_l'],
	])(
		'should return %p given %p',
		(result, test) => {
			expect(MirrorBoneLike(test)).toBe(result);
		},
	);
});

describe('MirrorCondition()', () => {
	it.each([
		[undefined, undefined],
		[[], []],
		[[[{ bone: 'test_l' }]], [[{ bone: 'test_r' }]]],
	])(
		'should return %p given %p',
		(result, test) => {
			expect(MirrorCondition(test as undefined | Condition)).toStrictEqual(result);
		},
	);
});

function SetupTransform(bone: string,
	type: TransformDefinition['type'],
	condition: TransformDefinition['condition'],
	value: TransformDefinition['value']): TransformDefinition {
	switch (type) {
		case 'const-shift':
			return {
				type,
				condition,
				value: value as Coordinates,
			};
		case 'shift':
			return {
				bone,
				type,
				condition,
				value: value as Coordinates,
			};
		case 'rotate':
			return {
				bone,
				type,
				condition,
				value: value as number,
			};
	}
}
describe('MirrorTransform()', () => {

	it.each([
		['shift', 'test_r', { x: 1, y: 1 }, 'test_l', { x: -1, y: 1 }, undefined],
		['shift', 'test_l', { x: 1, y: 1 }, 'test_r', { x: -1, y: 1 }, undefined],
		['shift', 'test_r', { x: -1, y: -1 }, 'test_l', { x: 1, y: -1 }, undefined],
		['shift', 'test_l', { x: -1, y: -1 }, 'test_r', { x: 1, y: -1 }, undefined],
		['shift', 'test', { x: 1, y: 1 }, 'test', { x: -1, y: 1 }, undefined],
		['shift', 'test', { x: -1, y: 1 }, 'test', { x: 1, y: 1 }, undefined],

		['const-shift', 'test_r', { x: 1, y: 1 }, 'test_l', { x: -1, y: 1 }, undefined],
		['const-shift', 'test_l', { x: 1, y: 1 }, 'test_r', { x: -1, y: 1 }, undefined],
		['const-shift', 'test_r', { x: -1, y: -1 }, 'test_l', { x: 1, y: -1 }, undefined],
		['const-shift', 'test_l', { x: -1, y: -1 }, 'test_r', { x: 1, y: -1 }, undefined],
		['const-shift', 'test', { x: 1, y: 1 }, 'test', { x: -1, y: 1 }, undefined],
		['const-shift', 'test', { x: -1, y: 1 }, 'test', { x: 1, y: 1 }, undefined],

		['rotate', 'test_r', 100, 'test_l', -100, undefined],
		['rotate', 'test_l', 100, 'test_r', -100, undefined],
		['rotate', 'test_r', -100, 'test_l', 100, undefined],
		['rotate', 'test_l', -100, 'test_r', 100, undefined],
	])(
		'should %p bone: %p, value: %p into bone: %p, value: %p',
		(type, ibone, ivalue, ebone, evalue, condition: PoseCondition | undefined) => {
			const input = SetupTransform(ibone, type as 'rotate' | 'shift', condition, ivalue);
			const exp = SetupTransform(ebone, type as 'rotate' | 'shift', condition?.map(MirrorAtomicPoseCondition), evalue);
			expect(MirrorTransform(input)).toStrictEqual(exp);
		},
	);

	const conditions: AtomicPoseCondition = {
		bone: 'test_l',
		operator: '=',
		value: 0,
	};

	it('should mirror condition', () => {
		const input = SetupTransform('test', 'rotate', [conditions], 100);
		const exp = SetupTransform('test', 'rotate', [MirrorAtomicPoseCondition(conditions)], -100);
		expect(MirrorTransform(input)).toStrictEqual(exp);
	});

});

describe('MirrorPoint()', () => {
	it.todo('should mirror PointDefinition transforms & pointType');
});

describe('MakeMirroredPoints()', () => {
	it.todo('should mirror point if necessary');
});
