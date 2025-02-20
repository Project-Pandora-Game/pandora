import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Room inventory (storing and picking up items)
export const TUTORIAL_WARDROBE_ROOM_INVENTORY: TutorialConfig = {
	id: 'wardrobeRoomInventory',
	name: `Character interactions: Room inventory`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you the basics about Room inventory.
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
