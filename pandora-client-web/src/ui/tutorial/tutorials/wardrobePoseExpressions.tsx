import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Pose and Expressions tutorial
export const TUTORIAL_WARDROBE_POSING_EXPRESSIONS: TutorialConfig = {
	id: 'wardrobePoseExpressions',
	name: `Character interactions: Pose and Expressions`,
	description: (
		<p>
			This tutorial will teach you posing your character and changing its expression.
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
