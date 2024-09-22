import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Locks and storages
// (starting with storages, then continuing onto lock slots, potentially getting through all major lock types)
export const TUTORIAL_WARDROBE_LOCKS_STORAGES: TutorialConfig = {
	id: 'wardrobeLocksStorages',
	name: `Character interactions: Locks and Storages`,
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
