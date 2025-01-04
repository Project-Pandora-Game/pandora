import React from 'react';
import { ExternalLink } from '../../../components/common/link/externalLink';
import { usePlayerData } from '../../../components/gameContext/playerContextProvider';
import { MakeTutorialConditionFlag, type TutorialConfig } from '../tutorialSystem/tutorialConfig';

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
					conditions: [
						MakeTutorialConditionFlag('roomSceneMode', (value) => value.mode === 'moveCharacter'),
					],
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
								Clicking the circle with blue up/down arrow resets your elevation,<br />
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
							Please exit the movement mode by clicking the circle with the red/green arrows.
						</p>
					),
					conditions: [
						MakeTutorialConditionFlag('roomSceneMode', (value) => value.mode === 'normal'),
					],
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
							Lets move to the basic controls Pandora has.
						</p>
					),
					highlight: [{ query: '.roomScreen .interactionArea' }],
					conditions: [{ type: 'next' }],
				},
				{
					text: <>Open the "Personal Space" tab.</>,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
				},
				{
					text: (
						<>
							<p>
								As you can see, you are currently in your own "personal space".
							</p>
							<p>
								Every character has their own personal space, which functions as a singleplayer lobby - no other characters can enter it.<br />
								It cannot be deleted or given up. You will automatically end up in this space when your<br />
								selected character is not in any other space.<br />
								You can find more about personal spaces in the context help or in the wiki.
							</p>
							<p>
								The other type of space is a public (or private/invite-only) space.<br />
								Those will be covered by a later tutorial.
							</p>
						</>
					),
					highlight: [{
						query: '.roomScreen .tab-content',
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
					text: <>Open the "Personal Space" tab.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
				},
				{
					text: (
						<>
							<p>
								The "Personal space" tab allows you to do many actions, most of which will be explained in later tutorials.
							</p>
							<p>
								The part we would like to point out right now is the list of characters currently inside this space.<br />
								As this is a personal space, you can only see yourself here, but in a public room you can always see everyone currently inside using this list.
							</p>
						</>
					),
					highlight: [{ query: '.character-info' }],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								For each character there are several quick actions you can do, such as opening their Wardrobe or Profile.
							</p>
							<p>
								You can also click the character's name to open the same menu as when clicking their name in the room on the left.<br />
								Try doing so now.
							</p>
						</>
					),
					highlight: [{ query: '.character-info legend.player > button:has(.colorStrip)' }],
					conditions: [{
						type: 'elementQuery',
						query: '.context-menu',
					}],
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
							The second tab we will briefly cover in this tutorial is the "Chat".<br />
							Please switch to it now.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Chat'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Chat'),
					}],
				},
				{
					text: (
						<>
							<p>
								Chat is the most essential part of Pandora, as you use it to communicate with others and roleplay your character's actions.<br />
								It also shows actions that you or others do in the current space.
							</p>
							<p>
								As chat is a core part of Pandora, it also is a powerful tool.<br />
								While this tutorial will only introduce the basics, you can find more details about it in the <ExternalLink href='https://project-pandora.com/wiki/spaces'>"Spaces" wiki page</ExternalLink>.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		// TODO: Some important changes are also shown (showcase server message)
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
					text: <>Open the "Chat" tab.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Chat'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Chat'),
					}],
				},
				{
					text: function Text() {
						const player = usePlayerData();

						return (
							<>
								<p>
									The most common usage is your character saying something out loud.<br />
									To do that simply type a message and send it with [Enter].
								</p>
								<p>
									A good way to start might be greeting, followed by saying who you are - it is likely no-one saw your character before, after all.<br />
									Try saying "Hello! I'm { player?.name ?? '<your name>' }." now.
								</p>
							</>
						);
					},
					conditions: [{
						type: 'elementQuery',
						query: '.message.chat span',
						filter: (e) => ['hi', 'hello', 'greeting'].some((greeting) => e.innerText.toLowerCase().includes(greeting)),
					}],
					highlight: [{
						query: '.chatArea textarea',
					}],
				},
				{
					text: '',
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
					text: <>Open the "Chat" tab.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Chat'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Chat'),
					}],
				},
				{
					text: (
						<>
							<p>
								The second most common usage is your character performing an action.<br />
								This can be done by starting your message with a '*' (star) or using the '/me' command.<br />
								This type of action is called "emote".
							</p>
							<p>
								Example of this is your character waving.<br />
								Try emoting that using "*waves" now.
							</p>
							<p>
								<i>
									Note: Using a '*' will automatically add your character's name at the beginning of your emote.<br />
									If you want to avoid that (for example to roleplay something happening in the environment), you can use '**' (two stars) or the '/emote' command instead.
								</i>
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.message.me span',
						filter: (e) => ['wave'].some((greeting) => e.innerText.toLowerCase().includes(greeting)),
					}],
					highlight: [{
						query: '.chatArea textarea',
					}],
				},
				{
					text: '',
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
					text: <>Open the "Chat" tab.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Chat'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Chat'),
					}],
				},
				{
					text: (
						<>
							<p>
								Another type of messages similar to emotes are actions.<br />
								Actions differ from emotes in that they are not written by users,<br />
								but come from an action that was recognized, performed, and enforced by Pandora.<br />
								As such they cannot be forged or edited.
							</p>
							<p>
								These usually happen as a result of interacting with character's items,<br />
								but can also be created through the use of various commands.<br />
								Try doing just that by using the "/dice" command to roll a dice.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.message.action',
					}],
					highlight: [{
						query: '.chatArea textarea',
					}],
				},
				{
					text: '',
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
					text: <>Open the "Chat" tab.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Chat'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Chat'),
					}],
				},
				{
					text: (
						<>
							<p>
								The third most important usage is saying something out‑of‑character (OOC).<br />
								OOC means it isn't simply your character saying it, but you, as a person, are saying so.<br />
								This can be done by starting your message with a '((' (two opening parenthesis) or using the '/ooc' command.
							</p>
							<p>
								Try saying anything in OOC now.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.message.ooc',
					}],
					highlight: [{
						query: '.chatArea textarea',
					}],
				},
				{
					text: (
						<>
							<p>
								Remember, the [OOC] tag in front of a message signals everyone that this text was not spoken by your character but comes from the human user behind the screen.<br />
								It can be, for example, used to convey limits, talk about not being comfortable with how the scene is going, or to indicate that you have to leave the club soon.<br />
								It is especially used to ask to be let go or to stop the play, representing a kind of "safeword" usage.
							</p>
							<p>
								It is generally frowned upon using this to talk as your character in this way (IC‑in‑OOC), especially if done to circumvent some in‑character restrictions, such as the character being gagged.
								It also makes it confusing for others to differentiate if the message is meant to be understood as from the character or the user behind it.
							</p>
							<p>
								<strong>Please respect the responsible use of OOC and take the content seriously. It is no longer fun and games if someone asks to be freed in an OOC message!</strong>
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
					text: (
						<>
							<p>
								This concludes the tutorial regarding the basics of Pandora!
							</p>
							<p>
								The remaining tutorials always focus on one, more specific subject, but we recommend trying them in order, as later tutorials might build on knowledge from previous ones.
							</p>
							<p>
								If you ever need a short summary of this tutorial, you can find that and more in the <ExternalLink href='https://project-pandora.com/wiki/new'>"New User Guide" wiki page</ExternalLink>.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
