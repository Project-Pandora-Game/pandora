import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: entry tutorial
// TODO: should it autostart?
export const TUTORIAL_TUTORIALS: TutorialConfig = {
	id: 'tutorials',
	name: `Totorials and Wiki`,
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
