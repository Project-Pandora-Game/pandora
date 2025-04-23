import type { AssetsPosePresets } from '../../../src/index.ts';
import type { AssetTestBones } from './testBones.ts';

export const ASSET_TEST_POSE_PRESETS: AssetsPosePresets<AssetTestBones> =
	[
		{
			category: 'View',
			poses: [
				{
					name: 'Front',
					view: 'front',
				},
				{
					name: 'Back',
					view: 'back',
				},
			],
		},
		{
			category: 'Arms (front)',
			preview: {
				y: 160,
				size: 720,
				basePose: {
					arms: {
						position: 'front',
						rotation: 'forward',
						fingers: 'spread',
					},
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 15,
						elbow_l: 15,
					},
				},
				highlight: ['ARM_LEFT', 'ARM_RIGHT'],
			},
			poses: [
				{
					name: 'Hanging side',
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 15,
						elbow_l: 15,
					},
					optional: {
						arms: {
							position: 'front',
							rotation: 'forward',
							fingers: 'spread',
						},
					},
				},
				{
					name: 'Hanging front',
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 22,
						elbow_l: 22,
					},
					optional: {
						arms: {
							position: 'front',
							rotation: 'down',
							fingers: 'spread',
						},
					},
				},
				{
					name: 'Touching hips',
					bones: {
						arm_r: 19,
						arm_l: 19,
						elbow_r: 112,
						elbow_l: 112,
					},
					optional: {
						arms: {
							position: 'front',
							rotation: 'down',
							fingers: 'spread',
						},
					},
				},
			],
		},
		{
			category: 'Arms (back)',
			preview: {
				y: 160,
				size: 720,
				basePose: {
					view: 'back',
					arms: {
						position: 'back',
						rotation: 'forward',
						fingers: 'spread',
					},
					bones: {
						arm_r: 104,
						arm_l: 104,
						elbow_r: -4,
						elbow_l: -4,
					},
				},
				highlight: ['ARM_LEFT', 'ARM_RIGHT'],
			},
			poses: [
				{
					name: 'Hands behind',
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 43,
						elbow_l: 43,
					},
					optional: {
						arms: {
							position: 'back',
							rotation: 'down',
							fingers: 'spread',
						},
					},
				},
				{
					name: 'Elbows together',
					bones: {
						arm_r: 104,
						arm_l: 104,
						elbow_r: -4,
						elbow_l: -4,
					},
					optional: {
						arms: {
							position: 'back',
							rotation: 'forward',
							fingers: 'spread',
						},
					},
				},
			],
		},
		{
			category: 'Arms (spread)',
			preview: {
				y: 0,
				size: 720,
				highlight: ['ARM_LEFT', 'ARM_RIGHT'],
				basePose: {
					arms: {
						position: 'front',
						rotation: 'up',
						fingers: 'spread',
					},
					bones: {
						arm_r: -25,
						arm_l: -25,
						elbow_r: -60,
						elbow_l: -60,
					},
				},
			},
			poses: [
				{
					name: 'Raised',
					bones: {
						arm_r: -25,
						arm_l: -25,
						elbow_r: -60,
						elbow_l: -60,
					},
					optional: {
						arms: {
							position: 'front',
							rotation: 'up',
							fingers: 'spread',
						},
					},
				},
				{
					name: 'T-Pose',
					bones: {
						arm_r: 0,
						arm_l: 0,
						elbow_r: 0,
						elbow_l: 0,
					},
					optional: {
						arms: {
							position: 'front',
							rotation: 'forward',
							fingers: 'spread',
						},
					},
					preview: {
						y: 0,
						size: 1000,
						highlight: ['ARM_LEFT', 'ARM_RIGHT'],
					},
				},
			],
		},
		{
			category: 'Legs (standing)',
			preview: {
				y: 650,
				size: 700,
				highlight: ['BODY', 'BREASTS'],
				basePose: {
					legs: 'standing',
					bones: {
						leg_r: 0,
						leg_l: 0,
					},
				},
			},
			poses: [
				{
					name: 'Normal',
					bones: {
						leg_r: 0,
						leg_l: 0,
					},
					legs: 'standing',
				},
				{
					name: 'Closed',
					bones: {
						leg_r: 2,
						leg_l: 2,
					},
					legs: 'standing',
				},
				{
					name: 'Spread',
					bones: {
						leg_r: -18,
						leg_l: -18,
					},
					legs: 'standing',
				},
				{
					name: 'Full split',
					bones: {
						leg_r: -85,
						leg_l: -85,
					},
					legs: 'standing',
					preview: {
						y: 500,
						size: 1200,
					},
				},
			],
		},
		{
			category: 'Legs (kneeling)',
			preview: {
				y: 292,
				size: 700,
				basePose: {
					arms: {
						position: 'back',
					},
					legs: 'kneeling',
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 15,
						elbow_l: 15,
						leg_r: 0,
						leg_l: 0,
					},
				},
				highlight: ['BODY', 'BREASTS'],
			},
			poses: [
				{
					name: 'Kneeling',
					bones: {
						leg_r: 0,
						leg_l: 0,
					},
					legs: 'kneeling',
				},
				{
					name: 'Kneeling spread',
					bones: {
						leg_r: -16,
						leg_l: -16,
					},
					legs: 'kneeling',
				},
			],
		},
		{
			category: 'Legs (sitting)',
			preview: {
				y: 515,
				size: 700,
				basePose: {
					arms: {
						position: 'front',
						rotation: 'down',
						fingers: 'spread',
					},
					legs: 'sitting',
					bones: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 22,
						elbow_l: 22,
						leg_r: 0,
						leg_l: 0,
					},
				},
				highlight: ['BODY', 'BREASTS'],
			},
			poses: [
				{
					name: 'Sitting',
					bones: {
						leg_r: 0,
						leg_l: 0,
					},
					legs: 'sitting',
				},
				{
					name: 'Sitting spread',
					bones: {
						leg_r: -16,
						leg_l: -16,
					},
					legs: 'sitting',
				},
			],
		},
		{
			category: 'Toes',
			poses: [
				{
					name: 'No tiptoeing',
					bones: {
						tiptoeing: 0,
					},
				},
				{
					name: 'Tiptoeing',
					bones: {
						tiptoeing: 110,
					},
				},

			],
		},
		{
			category: 'Character rotation',
			poses: [
				{
					name: 'Upright',
					bones: {
						character_rotation: 0,
					},
				},
				{
					name: 'Left',
					bones: {
						character_rotation: -90,
					},
				},
				{
					name: 'Right',
					bones: {
						character_rotation: 90,
					},
				},
				{
					name: 'Upside down',
					bones: {
						character_rotation: 180,
					},
				},
			],
		},
	];
