import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';
import { ExternalLink } from '../../../components/common/link/externalLink';

// TODO: entry tutorial
// TODO: should it autostart?
// TODO: Maybe let's not auto-create first character. It can be nice to make it clear you can have multiple.
/*
- Tell them how to move the tutorial dialog and skip the tutorial altogether if they want
- Welcome new player to Pandora (based on the current greeting page
  - Tell what Pandora is
  - Tell about rules and ooc and safeword importance, setting the tone
  - Mention permissions, limits, player safety safemode and that restraints are strict, saying it will be covered in other tutorials
  - Pandora is in active development - suggestions and bug reports are welcome; link to Discord?
  - Say that now it is time to make their first character!
- Have them create their first character and name it [this step should be skipped on-reruns... somehow]
- Show them the wiki button (should we make them enter the wiki or not?)
- Show them the currently active tutorial UI and where they can find more tutorials
- Have them open the list of available tutorials
- Recommend starting the "Pandora introduction" tutorial
*/
export const TUTORIAL_TUTORIALS: TutorialConfig = {
	id: 'tutorials',
	name: `Tutorials and Wiki`,
	description: (
		<p>
			This tutorial will teach you about tutorials.<br />
			<i>There is definitely no <ExternalLink href='https://en.wikipedia.org/wiki/Inception'>Tutorialception</ExternalLink> to be seen here.</i>
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
