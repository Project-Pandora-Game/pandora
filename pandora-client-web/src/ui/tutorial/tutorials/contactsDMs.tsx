import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Contacts and DMs
// (talk about adding to contacts, seeing contacts online, blocking someone and its effects, and ability to send DMs)
// Low priority as it is hard to show without someone else present
export const TUTORIAL_CONTACTS_DMS: TutorialConfig = {
	id: 'contactsDMs',
	name: `Contacts and Direct Messages`,
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
