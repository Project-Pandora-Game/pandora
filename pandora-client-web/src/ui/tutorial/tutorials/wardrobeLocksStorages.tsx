import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

// TODO: Locks and storages
// (starting with storages, then continuing onto lock slots, potentially getting through all major lock types)
export const TUTORIAL_WARDROBE_LOCKS_STORAGES: TutorialConfig = {
	id: 'wardrobeLocksStorages',
	name: `Character interactions: Locks and Storages`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you about items that can be locked, the locks themselves, and items that can store other items inside them.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<>
							[ WORK IN PROGRESS ]
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
