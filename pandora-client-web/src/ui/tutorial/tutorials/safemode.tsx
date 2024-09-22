import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Safemode & Timeout
// (that they exist, letting user try to enter timeout mode; not safemode as we don't want to force the timer on them)
export const TUTORIAL_SAFEMODE: TutorialConfig = {
	id: 'safemode',
	name: `Safemode and Timeout mode`,
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
