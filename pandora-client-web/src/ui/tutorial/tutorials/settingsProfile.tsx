import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

// TODO: Settings menu & profile
// (walk through setting's tabs, only talking about tabs themselves - each setting has context help; then let them open profile and talk about what is useful to put there)
export const TUTORIAL_SETTINGS_PROFILE: TutorialConfig = {
	id: 'settingsProfile',
	name: `Settings and Profile`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will briefly go through settings you can tweak and through setting up your public profile.
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
