import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_WARDROBE_ITEM_COLLECTIONS: TutorialConfig = {
	id: 'wardrobeItemCollections',
	name: `Item collections`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial explains how you can save any kind of items together in an item collection to save inside Pandora or for exporting as a template.
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
