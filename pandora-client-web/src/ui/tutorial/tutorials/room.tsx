import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Moving around in a room and for the "Room" tab of the space
// (basics of the room; only inside personal space for now)
export const TUTORIAL_ROOM: TutorialConfig = {
	id: 'room',
	name: `Pandora introduction`,
	description: (
		<p>
			This tutorial will teach you about the very basics of Pandora.
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
