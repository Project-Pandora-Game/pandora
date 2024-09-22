import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Settings menu & profile
// (walk through setting's tabs, only talking about tabs themselves - each setting has context help; then let them open profile and talk about what is useful to put there)
export const TUTORIAL_SETTINGS_PROFILE: TutorialConfig = {
	id: 'settingsProfile',
	name: `Settings and Profile`,
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
