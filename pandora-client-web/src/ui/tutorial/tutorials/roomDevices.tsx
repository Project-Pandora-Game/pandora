import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Room devices
// (spawn room device, deploy it, move it, entering, leaving, storing; final note on permissions)
export const TUTORIAL_ROOM_DEVICES: TutorialConfig = {
	id: 'roomDevices',
	name: `Room devices`,
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
