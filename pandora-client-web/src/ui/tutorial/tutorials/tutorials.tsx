import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';
import { ExternalLink } from '../../../components/common/link/externalLink';

// TODO: entry tutorial
// TODO: should it autostart?
export const TUTORIAL_TUTORIALS: TutorialConfig = {
	id: 'tutorials',
	name: `Tutorials and Wiki`,
	description: (
		<p>
			This tutorial will teach you about tutorials.<br />
			<i>There is definitely no <ExternalLink href='https://en.wikipedia.org/wiki/Inception'>Inception</ExternalLink> to be seen here.</i>
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
