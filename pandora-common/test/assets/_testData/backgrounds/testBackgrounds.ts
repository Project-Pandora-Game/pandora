import { isEqual } from 'lodash-es';
import { Assert, CalculateBackgroundDataFromCalibrationData, RoomBackgroundCalibrationDataSchema, type RoomBackgroundCalibrationData, type RoomBackgroundInfo, type RoomBackgroundTagDefinition } from '../../../../src/index.ts';

type CategoryDefinition = {
	name: string;
	tags: Record<string, string>;
};

const TEST_TAGS_DEFINITION = {
	location: {
		name: 'Location',
		tags: {
			inside: 'Inside',
			outside: 'Outside',
		},
	},
	space: {
		name: 'Space',
		tags: {
			space_small: 'Small',
			space_large: 'Large',
		},
	},
} as const satisfies Record<string, CategoryDefinition>;

type BackgroundCategoryKeys = keyof typeof TEST_TAGS_DEFINITION;
type BackgroundTags = typeof TEST_TAGS_DEFINITION[BackgroundCategoryKeys]['tags'];
type KeysOfUnion<T> = T extends T ? keyof T : never;
export type TestBackgroundTagNames = KeysOfUnion<BackgroundTags>;

interface TestIntermediateRoomBackgroundDefinition extends Pick<RoomBackgroundInfo, 'id' | 'name'> {
	tags: TestBackgroundTagNames[];
	calibration: RoomBackgroundCalibrationData;
}

const BACKGROUNDS: TestIntermediateRoomBackgroundDefinition[] = [
	{
		id: 'couch_living_room',
		name: 'Couch living room',
		calibration: {
			imageSize: [5463, 3298],
			cameraCenterOffset: [0, -42],
			areaCoverage: 1.83,
			ceiling: 4643,
			areaDepthRatio: 0.37,
			baseScale: 2.14,
			fov: 80,
		},
		tags: ['inside', 'space_large'],
	},
	{
		id: 'club_room',
		name: 'Club room',
		calibration: {
			imageSize: [4000, 2914],
			cameraCenterOffset: [0, 100],
			areaCoverage: 4,
			ceiling: 3300,
			areaDepthRatio: 0.24,
			baseScale: 1.2,
			fov: 80,
		},
		tags: ['inside', 'space_small'],
	},
	{
		id: 'sea_house',
		name: 'Sea house',
		calibration: {
			imageSize: [5789, 3015],
			cameraCenterOffset: [0, 236],
			areaCoverage: 2,
			ceiling: 0,
			areaDepthRatio: 0.47,
			baseScale: 2,
			fov: 80,
		},
		tags: ['outside', 'space_large'],
	},
];

export function AssetTestLoadBackgroundTags(): Record<string, RoomBackgroundTagDefinition> {
	const result: Record<string, RoomBackgroundTagDefinition> = {};
	for (const { name: category, tags } of Object.values(TEST_TAGS_DEFINITION)) {
		for (const [tagKey, name] of Object.entries(tags)) {
			result[tagKey] = {
				name,
				category,
			};
		}
	}
	return result;
}

export function AssetTestLoadBackgrounds(): RoomBackgroundInfo[] {
	return BACKGROUNDS.map((background): RoomBackgroundInfo => {
		const id = background.id;

		const parsedCalibration = RoomBackgroundCalibrationDataSchema.parse(background.calibration);
		Assert(isEqual(parsedCalibration, background.calibration));

		return {
			...CalculateBackgroundDataFromCalibrationData(`background_${id}.jpg`, parsedCalibration),
			id,
			name: background.name,
			preview: `background_${id}_preview.jpg`,
			tags: background.tags,
		};
	});
}

