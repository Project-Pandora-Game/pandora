import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Moving around in a room and for the "Room" tab of the space
// (basics of the room; only inside personal space for now)
/*
- On the left there is a room view. Contains background image, characters and may contain room devices
- You can drag empty space to move around and use mouse wheel (desktop) or pinch (mobile) to zoom; double-click empty space to reset the room's focus
- You can click on your name to open menu for your character
- You can drag name of your character to quickly move your character; note about who can move character (you can move yourself unless some items prevent it, admin can move anyone)
- On the right you have controls with various tabs
  - Personal room
	- Each character has its personal room that no one else can enter. Meeting with other characters can happen in public or private "space"s. (those have similar, but slightly different tab, will be mentioned in later tutorials)
	- Contains list of characters and quick actions. You can again click the character's name to open its menu
	- Other options (Room inventory, List of spaces, Room construction mode, ...) will be covered in later tutorials
  - Chat
	- You see most of what happens in the room here (showcase action)
	- Some important changes are also shown (showcase server message)
	- Type a message to say something as your character and send with Enter (what your character says can be impacted by worn items)
	- Type a message starting with `*` to emote your character doing something (you can also do `**` to emote without your character's name being added at the beginning)
	- Type a message starting with `((` or use the `/ooc` command to say something Out-Of-Character
	- Chat can do much more, such as ability to edit messages you sent, whispering to a specific person, or many chat commands. Those will be covered in a later tutorial or in the Wiki
  - Pose & Expressions will be covered in later tutorials
- You can find summary of this and more in the wiki page "New User Guide"!
*/
export const TUTORIAL_ROOM: TutorialConfig = {
	id: 'room',
	name: `Pandora introduction`,
	description: (
		<p>
			This tutorial will teach you about the very basics of Pandora.
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
