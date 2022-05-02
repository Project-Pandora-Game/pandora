import { BoneDefinitionCompressed, Condition, PointDefinitionCompressed, AssetDefinitionCompressed, LayerPriority, ConditionCompressed, LayerMirror } from 'pandora-common/dist/character/asset/definition';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';

export const boneDefinition: Readonly<BoneDefinitionCompressed>[] = [
	{
		name: 'arm_r',
		pos: [578, 432],
		mirror: 'arm_l',
	},
	{
		name: 'elbow_r',
		pos: [728, 434],
		mirror: 'elbow_l',
		parent: 'arm_r',
	},
	{
		name: 'leg_r',
		pos: [533, 707],
		// rotation: 90,
		mirror: 'leg_l',
		rotation: -10,
	},
	{
		name: 'arm_width',
	},
	{
		name: 'leg_width',
	},
	{
		name: 'breasts',
	},
	{
		name: 'waist',
	},
	{
		name: 'hips',
	},
	{
		name: 'kneeling',
	},
	{
		name: 'sitting',
	},
	{
		name: 'tiptoeing',
	},
];

type TransformDefinitionOld =
	// rot <bone> <strength> [condition]
	['rot', string, number, Condition?] |
	// shift <bone> <x> <y> [condition]
	['shift', string, number, number, Condition?];

type PointDefinitionOld = {
	pos: [number, number];
	mirror?: true;
	pointType?: string;
	transforms?: TransformDefinitionOld[];
};

export const bodyPointsOld: PointDefinitionOld[] = [
	// Head helpers
	{ pos: [546, 365], mirror: true, pointType: 'body' },
	{ pos: [583, 325], mirror: true, pointType: 'body' },
	{ pos: [557, 187], mirror: true, pointType: 'body' },
	{ pos: [530, 387], mirror: true, pointType: 'body' },
	// Right arm
	{
		pos: [559, 403],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'arm_r', 0.1],
		],
		mirror: true,
		pointType: 'bodyarm',
	},
	{
		pos: [573, 399],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'arm_r', 0.3],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [588, 403],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'arm_r', 0.6],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [601, 405],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'arm_r', 0.8],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [714, 408],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'elbow_r', 0.05, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.1, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [718, 408],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.15, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [728, 408],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.15, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [734, 408],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'elbow_r', 1.08, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [744, 408],
		transforms: [
			['shift', 'arm_width', 0, -4],
			['rot', 'elbow_r', 1, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.8, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [876, 408],
		transforms: [
			['shift', 'arm_width', 0, -2],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [938, 365],
		transforms: [
			['shift', 'arm_width', 0, -1],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [999, 408],
		transforms: [
			['shift', 'arm_width', 1, -1],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [999, 462],
		transforms: [
			['shift', 'arm_width', 1, 1],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [938, 514],
		transforms: [
			['shift', 'arm_width', 0, 1],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [876, 462],
		transforms: [
			['shift', 'arm_width', 0, 2],
			['rot', 'elbow_r', 1],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [744, 462],
		transforms: [
			['shift', 'arm_width', 0, 4],
			['rot', 'elbow_r', 0.8, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 1, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [734, 462],
		transforms: [
			['shift', 'arm_width', 0, 4],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 1.08, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [728, 462],
		transforms: [
			['shift', 'arm_width', 0, 4],
			['rot', 'elbow_r', 0.15, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [718, 462],
		transforms: [
			['shift', 'arm_width', 0, 4],
			['rot', 'elbow_r', 0.15, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.6, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{
		pos: [714, 462],
		transforms: [
			['shift', 'arm_width', 0, 4],
			['rot', 'elbow_r', 0.1, [[{ 'bone': 'elbow_r', 'operator': '>', 'value': 0 }]]],
			['rot', 'elbow_r', 0.05, [[{ 'bone': 'elbow_r', 'operator': '<', 'value': 0 }]]],
			['rot', 'arm_r', 1],
		],
		mirror: true,
		pointType: 'arm',
	},
	{ pos: [736, 434], transforms: [['rot', 'arm_r', 1]], mirror: true, pointType: 'arm' },
	{ pos: [597, 465], transforms: [['rot', 'arm_r', 0.5]], mirror: true, pointType: 'arm' },
	{ pos: [587, 476], transforms: [['rot', 'arm_r', 0.2]], mirror: true, pointType: 'bodyarm' },
	{ pos: [578, 432], mirror: true, pointType: 'bodyarm' },
	{ pos: [619, 435], transforms: [['rot', 'arm_r', 1]], mirror: true, pointType: 'arm' },
	{ pos: [581, 512], transforms: [['rot', 'arm_r', 0.05]], mirror: true, pointType: 'body' },
	// Left arm mirrored from right
	// Body and legs
	{ pos: [553, 714], transforms: [['shift', 'sitting', -10, -25]], mirror: true, pointType: 'body' },
	{
		pos: [602, 676],
		transforms: [
			['shift', 'hips', 8, 0],
			['shift', 'sitting', 0, -10],
			['rot', 'leg_r', 0.2],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [614, 714],
		transforms: [
			['shift', 'hips', 8, 0],
			['shift', 'hips', 12, 0, [[{ 'bone': 'hips', 'operator': '<', 'value': 0 }]]],
			['shift', 'sitting', 0, -20],
			['rot', 'leg_r', 0.5],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [616, 762],
		transforms: [
			['shift', 'leg_width', 6, 0],
			['shift', 'hips', 2, 0],
			['shift', 'hips', 16, 0, [[{ 'bone': 'hips', 'operator': '<', 'value': 0 }]]],
			['shift', 'sitting', 0, -40],
			['rot', 'leg_r', 0.7],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [582, 954],
		transforms: [
			['shift', 'leg_width', 10, 0],
			['shift', 'kneeling', 6, 0],
			['shift', 'sitting', 20, -170],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [585, 1000],
		transforms: [
			['shift', 'leg_width', 10, 0],
			['shift', 'kneeling', -7, -2],
			['shift', 'sitting', 20, -180],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [584, 1339],
		transforms: [
			['shift', 'leg_width', 4, 2],
			['shift', 'kneeling', -38, -330],
			['shift', 'sitting', 15, -135],
			['shift', 'tiptoeing', -5, 30],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [507, 1341],
		transforms: [
			['shift', 'leg_width', 0, 2],
			['shift', 'kneeling', 20, -340],
			['shift', 'sitting', 10, -135],
			['shift', 'tiptoeing', -5, 30],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [519, 957],
		transforms: [
			['shift', 'sitting', 7, -170],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [513, 1002],
		transforms: [
			['shift', 'kneeling', 12, -18],
			['shift', 'sitting', 15, -180],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [565, 1002],
		transforms: [
			['shift', 'leg_width', 7, 0],
			['shift', 'sitting', 14, -180],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [539, 1002],
		transforms: [
			['shift', 'leg_width', 4, 0],
			['shift', 'sitting', 12, -180],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [501, 778],
		transforms: [
			['shift', 'hips', -1, 0],
			['shift', 'sitting', 5, -20],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [500, 750],
		transforms: [
			['shift', 'hips', -1, 0],
			['shift', 'sitting', 0, 0],
		],
		mirror: true,
		pointType: 'body',
	},
	{ pos: [500, 630], pointType: 'body' },
	{ pos: [500, 493], pointType: 'body' },
	{ pos: [500, 600], pointType: 'body' },
	{ pos: [563, 558], transforms: [['shift', 'waist', 20, 0]], mirror: true, pointType: 'body' },
	{ pos: [567, 581], transforms: [['shift', 'waist', 20, 0]], mirror: true, pointType: 'body' },
	{ pos: [577, 616], transforms: [['shift', 'waist', 12, 0]], mirror: true, pointType: 'body' },
	{
		pos: [592, 650],
		transforms: [
			['shift', 'waist', 4, 0],
			['shift', 'hips', 4, 0],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [501, 1258],
		transforms: [
			['shift', 'leg_width', 0, 2],
			['shift', 'kneeling', 30, -252],
			['shift', 'sitting', 12, -135],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [513, 839],
		transforms: [
			['shift', 'sitting', 8, -70],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [600, 1264],
		transforms: [
			['shift', 'leg_width', 5, 0],
			['shift', 'kneeling', -38, -263],
			['shift', 'sitting', 15, -140],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
	{
		pos: [507, 1324],
		transforms: [
			['shift', 'leg_width', 0, 2],
			['shift', 'kneeling', 20, -323],
			['shift', 'sitting', 10, -135],
			['shift', 'tiptoeing', -5, 30],
			['rot', 'leg_r', 1],
		],
		mirror: true,
		pointType: 'body',
	},
];

function CompressCondition(conditions?: Condition): ConditionCompressed | undefined {
	return conditions?.map((segment) => segment.map(({ bone, operator, value }) => ([bone, operator, value])));
}

const bodyPoints: PointDefinitionCompressed[] = bodyPointsOld.map((p) => {
	const { pos, transforms, mirror, pointType } = p;
	const point: PointDefinitionCompressed = {
		pos,
		mirror,
		pointType,
	};
	if (transforms) {
		point.transforms = transforms.map((t) => {
			if (t[0] === 'rot') {
				return ['rotate', t[1], t[2], CompressCondition(t[3])];
			} else {
				return ['shift', t[1], [t[2], t[3]], CompressCondition(t[4])];
			}
		});
	}
	return point;
});

const IMAGE_PREFIX = 'https://demos.project-pandora.com/img/';

export const assetDefinition: AssetDefinitionCompressed[] = [
	{
		id: 'asset-body',
		description: 'Body',
		layers: [
			{
				rect: [0, 0, GraphicsCharacter.WIDTH, GraphicsCharacter.HEIGHT],
				image: IMAGE_PREFIX + 'body.png',
				priority: LayerPriority.BODY,
				points: bodyPoints,
				mirror: LayerMirror.NONE,
				pointType: ['body', 'bodyarm'],
			},
			{
				rect: [0, 0, GraphicsCharacter.WIDTH, GraphicsCharacter.HEIGHT],
				image: IMAGE_PREFIX + 'body.png',
				priority: LayerPriority.ARMS,
				points: '0',
				mirror: LayerMirror.SELECT,
				pointType: ['bodyarm', 'arm'],
				imageOverrides: [
					[IMAGE_PREFIX + 'body_armsdown.png', [[['elbow_r', '>=', 10]]]],
					[IMAGE_PREFIX + 'body_armsup.png', [[['elbow_r', '<=', -5]]]],
				],
			},
		],
	},
];
