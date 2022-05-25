import { AtomicCondition, Condition, Coordinates, PointDefinition, TransformDefinition } from 'pandora-common';
import { AssetsDefinitionFile } from 'pandora-common/dist/assets/definitions';
import { AssetManagerClient, GetAssetManager, LoadAssetDefinitions, MirrorBoneLike, MirrorCondition, MirrorPoint, MirrorTransform, OverrideAssetManager } from '../../src/assets/assetManager';

describe('GetAssetManager()', () => {
	it('should return instance of AssetManagerClient', () => {
		expect(GetAssetManager()).toBeInstanceOf(AssetManagerClient);
	});
});

describe('OverrideAssetManager()', () => {
	it('should override the current assetManager reference', () => {
		const newManager = new AssetManagerClient();
		const oldManager = GetAssetManager();
		expect(GetAssetManager()).toBe(oldManager);
		OverrideAssetManager(newManager);
		expect(GetAssetManager()).toBe(newManager);
		expect(GetAssetManager()).not.toBe(oldManager);
	});
});

describe('LoadAssetDefinitions()', () => {
	it('should load asset definition into manager', () => {
		const mock = jest.spyOn(GetAssetManager(), 'load').mockImplementation();
		LoadAssetDefinitions('mock hash', 'mock data' as unknown as AssetsDefinitionFile);
		expect(mock).nthCalledWith(1, 'mock hash', 'mock data');
		mock.mockRestore();
	});
});

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
		['shift', 'test_r', { x: 1, y: 1 }, 'test_l', { x: -1, y: -1 }, undefined],
		['shift', 'test_l', { x: 1, y: 1 }, 'test_r', { x: -1, y: -1 }, undefined],
		['shift', 'test_r', { x: -1, y: -1 }, 'test_l', { x: 1, y: 1 }, undefined],
		['shift', 'test_l', { x: -1, y: -1 }, 'test_r', { x: 1, y: 1 }, undefined],
		['shift', 'test_r', 100, 'test_l', { x: NaN, y: NaN }, undefined],
		['shift', 'test_l', 100, 'test_r', { x: NaN, y: NaN }, undefined],
		// non-mirrored bone
		['shift', 'test', { x: 1, y: 1 }, 'test', { x: -1, y: 1 }, undefined],
		['shift', 'test', { x: -1, y: 1 }, 'test', { x: 1, y: 1 }, undefined],

		['rotate', 'test_r', 100, 'test_l', -100, undefined],
		['rotate', 'test_l', 100, 'test_r', -100, undefined],
		['rotate', 'test_r', -100, 'test_l', 100, undefined],
		['rotate', 'test_l', -100, 'test_r', 100, undefined],
		['rotate', 'test_r', { x: -1, y: -1 }, 'test_l', NaN, undefined],
		['rotate', 'test_l', { x: -1, y: -1 }, 'test_r', NaN, undefined],
	])(
		'should %p bone: %p, value: %p into bone: %p, value: %p',
		(type, ibone, ivalue, ebone, evalue, condition) => {
			const input = SetupTransform(ibone, type as 'rotate' | 'shift', condition, ivalue);
			const exp = SetupTransform(ebone, type as 'rotate' | 'shift', MirrorCondition(condition), evalue);
			expect(MirrorTransform(input)).toStrictEqual(exp);
		},
	);

	const conditions: AtomicCondition = {
		bone: 'test_l',
		operator: '=',
		value: 0,
	};

	it('should mirror condition', () => {
		const input = SetupTransform('test', 'rotate', [[conditions]], 100);
		const exp = SetupTransform('test', 'rotate', MirrorCondition([[conditions]]), -100);
		expect(MirrorTransform(input)).toStrictEqual(exp);
	});

});
function SetupPoint(pointType: string | undefined): PointDefinition {
	return {
		pos: [100, 100],
		mirror: false,
		transforms: [SetupTransform('test_r', 'rotate', undefined, 100)],
		pointType,
	};
}
describe('MirrorPoint()', () => {
	it('should mirror PointDefinition transforms & pointType', () => {
		const mock = SetupPoint('type_l');
		const { transforms, pointType } = mock;
		const mirror = MirrorPoint(mock);
		expect(mirror.transforms).toStrictEqual(transforms.map(MirrorTransform));
		expect(mirror.pointType).toStrictEqual(MirrorBoneLike(pointType));
	});
});
