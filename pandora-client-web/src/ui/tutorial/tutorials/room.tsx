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
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								Now that you have a character, lets look at what you can do in Pandora.
							</p>
							<p>
								This tutorial will explain what you see right now - the room and the controls - as well as some basic actions you can do.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								First lets have a look at the "Header".<br />
								Header shows some basic information about your state and allows quickly navigating to some other screens.
							</p>
							<p>
								<i>
									Note: If you are on a mobile device, or a device with a narrow screen, the contents of the header might be collapsed.
									To open the header in such a case, you can click the "hamburger" button that appears in the top-right corner of the screen.
								</i>
							</p>
						</>
					),
					highlight: [{ query: '.Header', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							On the very left (or top if you are are on a narrow device) you can see your currently selected character's name.<br />
							This can be useful, as Pandora allows you to open multiple characters from the same account at the same time - so long you open each in a different browser tab.
						</p>
					),
					highlight: [{ query: '.Header .leftHeader > span', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							On the the right (or bottom) you can see the account you are currently logged into.<br />
							While Pandora does not forbid the creation of multiple accounts, you cannot log into multiple accounts at the same time.
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > span', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							The "Leave" button allows you to leave the current space (more on that in later tutorials),<br />
							change to another character, or completely log out of your account.
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > button[title="Leave"]', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							The "Settings" button opens the settings. Those are explained in later tutorial.
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > button[title="Settings"]', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						// TODO: Update text once tutorial for contacts/DMs is ready
						<p>
							The "Contacts" button opens your contact list, where you can see people you added (or blocked), as well as new contact requests.<br />
							It also allows you to send direct messages to others - even while they are offline.<br />
							<i>Tutorial for this is not yet ready.</i>
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > button[title="Contacts"]', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						// TODO: Update text once notifications menu is implemented
						<p>
							The "Notifications" button is work in progress...<br />
							Currently you can click it to simply clear any pending notifications.<br />
							Later on we are planning for it to open a list of pending notifications, allowing you to go through them.
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > button[title="Notifications"]', inset: true }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							And finally, the "Wiki" button was already mentioned in the previous tutorial.<br />
							Perhaps unsurprisingly, it opens Pandora's wiki.
						</p>
					),
					highlight: [{ query: '.Header .rightHeader > button[title="Wiki"]', inset: true }],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								Now lets explain the screen you currently see in front of you.
							</p>
							<p>
								The "Room" screen has two parts.<br />
								On the left you can see the room your character is currently inside.
							</p>
						</>
					),
					highlight: [{ query: '.roomScreen .room-scene' }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							On the right are various controls, such as information about the current room/space, chat, and some controls for your character.
						</p>
					),
					highlight: [{ query: '.roomScreen .interactionArea' }],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								The room view shows the room's background, any characters currently visible inside, and any room devices/items deployed in the room (if the room has any).<br />
							</p>
							<p>
								<i>
									Note: The room background is just an image and cannot be interacted with.<br />
									Later, you will learn about items placeable into the room that can be interacted with.
								</i>
							</p>
						</>
					),
					highlight: [{ query: '.roomScreen .room-scene' }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							You can use your mouse and drag any empty space to move the camera around (or drag with your finger on a touchscreen).<br />
							Mouse wheel (desktop) or pinching gesture (mobile) can be used to zoom in or out.<br />
							Finally, double-clicking any empty space will reset the camera to show the whole room.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								In the room, you can find your character. Under each character you can see their name.
							</p>
							<p>
								<i>Note: You can hide character names with a toggle in the "Personal space" tab.</i>
							</p>
						</>
					),
					// TODO: Graphics highlight - player character.
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								Click on your character's name to open its context menu.
							</p>
							<p>
								<i>Note: This can be done even if the name is hidden - just click where the name would be.</i>
							</p>
						</>
					),
					// TODO: Graphics highlight - player character's label.
					conditions: [{
						type: 'elementQuery',
						query: '.context-menu',
					}],
				},
				{
					text: (
						<>
							<p>
								In the context menu you can do several quick actions with the character.<br />
								The actions available to you will change depending on various things, such as if this is your character or not,<br />
								or if you are the current space's administrator.
							</p>
							<p>
								At the top of the menu you can see the name of the character again.<br />
								Next to the name in parenthesis is the character's unique identifier. This "id" is used in many menus,<br />
								so it is useful to be aware of it.
							</p>
							<p>
								<i>Note: All character identifiers are in the form of small letter "c" followed by one or more digits.</i>
							</p>
						</>
					),
					highlight: [
						{ query: '.context-menu' },
					],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								The actions you can do with your own character are:
							</p>
							<ul>
								<li>Open its wardrobe. (this is covered in much more detail in later tutorials)</li>
							</ul>
						</>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Wardrobe'),
					}],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<ul>
							<li>Open your character's and your account's profile. (this is explained in later tutorial)</li>
						</ul>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Profile'),
					}],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<ul>
							<li>Enter move mode, allowing for movement in the room.</li>
						</ul>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Move'),
					}],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<ul>
							<li>Enter posing mode, allowing for custom poses. (posing is explained in later tutorial)</li>
						</ul>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Pose'),
					}],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							Please click the "Move" button to switch to the move mode.
						</p>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Move'),
					}],
					conditions: [{ type: 'next' }],
					// TODO: Can we get automatic advancement conditions for this?
				},
				{
					text: (
						<>
							<p>
								In this mode you can see two circles with arrows under the character.<br />
								By dragging the red/green arrows, you can move in the room.<br />
								By dragging the blue up/down arrow, you can fly! Or sink into the ground...<br />
								This can be useful for finely positioning your character elevation against another object.
							</p>
							<p>
								You can also click the circles:<br />
								Clicking the circle with blue up/down arrow resets your "flying",<br />
								while clicking the circle with red/green arrows exits the move mode.
							</p>
							<p>
								In the middle of the character there is also third button that allows you to quickly switch to character posing mode.
							</p>
							<p>
								Feel free to experiment with moving your character and then click next.
							</p>
						</>
					),
					// TODO: If we get highlight can we do this one at a time?
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							Please exit the movement mode by clicking the circle with red/green arrows and then click next.
						</p>
					),
					// TODO: Can we get automatic advancement conditions for this?
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							You can also quickly move the character without having to switch to move mode every time.<br />
							To quickly move your character simply drag its name instead of clicking it.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							Great! That is all for the room part of the screen for now.<br />
							Lets move to the basic controls Pandora has.<br />
							<br />
							[ WORK IN PROGRESS ]
						</p>
					),
					highlight: [{ query: '.roomScreen .interactionArea' }],
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
