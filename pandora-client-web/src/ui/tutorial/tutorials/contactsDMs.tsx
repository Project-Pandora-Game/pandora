import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

// TODO: Contacts and DMs
// (talk about adding to contacts, seeing contacts online, blocking someone and its effects, and ability to send DMs)
// Low priority as it is hard to show without someone else present
export const TUTORIAL_CONTACTS_DMS: TutorialConfig = {
	id: 'contactsDMs',
	name: `Contacts and Direct Messages`,
	description: (
		<p>
			This tutorial will teach you about adding contacts,
			sending Direct Messages to other people even while they are offline,
			and blocking people you do not want to interact with.
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
