import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Room inventory (storing and picking up items)
export const TUTORIAL_WARDROBE_ROOM_INVENTORY: TutorialConfig = {
	id: 'wardrobeRoomInventory',
	name: `Character interactions: Room inventory`,
	description: (
		<p>
			This tutorial will teach you basics about Room's inventory.
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
