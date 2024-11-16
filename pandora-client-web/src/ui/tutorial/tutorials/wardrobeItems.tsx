import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Creating, equiping, deleting items
// (just direct spawn/delete and configuration of items; no inner modules or room inventory)
export const TUTORIAL_WARDROBE_ITEMS: TutorialConfig = {
	id: 'wardrobeItems',
	name: `Character interactions: Items`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you the basics of how items work in Pandora.
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
