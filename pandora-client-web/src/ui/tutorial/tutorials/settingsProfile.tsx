import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_SETTINGS_PROFILE: TutorialConfig = {
	id: 'settingsProfile',
	name: `Settings and Profiles`,
	description: (
		<p>
			This tutorial will briefly go over settings you can tweak and how to create your public profiles.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Welcome to the tutorial on profiles as well as Pandora's settings screen!<br />
							In this tutorial you will briefly be shown where to set up your character and account profiles.
							You will also get a quick summary of all settings tabs. Especially the "Graphics" tab is important
							if you experience any performance issues with Pandora on your device.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
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
								Let's start by opening your character's profile.<br />
								In general, you can open any character's profile in two main ways:
								Either by clicking on the name below their character to open the character's
								context menu or the way we will do it now.
							</p>
							<p>
								Find your character in the current tab by its name and click the
								"Profile" button to go to your character's profile.
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.character-info fieldset.character:has(legend.player)',
						},
						{
							query: '.character-info fieldset.character:has(legend.player) .Button',
							filter: (e) => e.innerText.includes('Profile'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: /^\/profiles($|\/character\/c)/,
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the profiles screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/profiles($|\/character\/c)/,
					}],
				},
				{
					text: <p>Please switch back to the "Character" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.profileScreen .tab.active',
						filter: (e) => e.innerText.includes('Character'),
					}],
					highlight: [{
						query: '.profileScreen .tab',
						filter: (e) => e.innerText.includes('Character'),
						inset: true,
					}],
				},
				{
					text: (
						<>
							<p>
								This is your character's profile/bio. Each character has its own profile. You typically
								want to tell others a bit about your character, what they are looking for, including likes/dislikes and limits.
							</p>
							<p>
								You can type in your profile after pressing the edit button. Be sure to save your profile with
								the according button before leaving the screen.
							</p>
							<p>
								There are links to set your character's pronouns and chat color here, too, but I will
								show where those can be changed in the second part of the tutorial as well.
							</p>
						</>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [
						{
							query: '.profileScreen .Button',
							filter: (e) => e.innerText.includes('Edit'),
						},
						{
							query: '.profileScreen .Button',
							filter: (e) => e.innerText.includes('Save'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								A Pandora account also has an account profile that you can switch to with the tab at the top.<br />
								If likes/dislikes/limits are not character specific, but apply to all of them, you may want to
								note them down in your account profile instead.
							</p>
							<p>
								In that sense, the character profile is "IC" information, while the account profile is about "OOC" information
								that is not character specific or applies to all of them.<br />
								Please be mindful to not disclose personal or private information about yourself here. Especially if it could
								be used to identify you.
							</p>
						</>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [{
						query: '.profileScreen .tab',
						filter: (e) => e.innerText.includes('Account'),
						inset: true,
					}],
				},
				{
					text: <>Let's proceed to the second part of this tutorial now.<br />Please switch to the settings screen.</>,
					conditions: [{ type: 'never' }],
					highlight: [{ query: '.Header .rightHeader > button[title="Settings"]', inset: true }],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/permissions',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Permissions" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/permissions',
					}],
					highlight: [{ query: '.Header .rightHeader > button[title="Settings"]', inset: true }],
				},
				{
					text: (
						<>
							<p>
								You should already know about the purpose of the "Permissions" tab from the
								tutorial on permissions.
							</p>
							<p>
								So let's instead proceed to the next tab: "Character".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Character') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/character',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Character" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/character',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Character') },
					],
				},
				{
					text: (
						<>
							<p>
								The character tab lets you most notably set the color that your character's name will use
								in the chat, e.g. for emotes.
								You can also delete your character here or set pronouns.
							</p>
							<p>
								Let's proceed to the next tab: "Account".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Account') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/account',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Account" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/account',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Account') },
					],
				},
				{
					text: (
						<>
							<p>
								The account tab lets you set the color that your account's name will use,
								e.g. in DM chats.<br />
								You can also set or change your account's display name here.
								Per default, your display name is set to your account's login username.

							</p>
							<p>
								Let's proceed to the next tab: "Notifications".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Notifications') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/notifications',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Notifications" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/notifications',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Notifications') },
					],
				},
				{
					text: (
						<>
							<p>
								The notification tab lets you customize in great detail if and how you want to be
								notified about certain events in Pandora happening.<br />
								The most basic way is a red dot next to the bell icon in the top bar, which opens
								the notification center for more details. Other options include a popup/toast within
								Pandora, or even a system popup of your operating system (if permitted by you).
								Lastly, playing a configurable sound is also an option you can set.
							</p>
							<p>
								Let's proceed to the next tab: "Security".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Security') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/security',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Security" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/security',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Security') },
					],
				},
				{
					text: (
						<>
							<p>
								In the "Security" tab, you can manage your login tokens, especially when you use Pandora
								on different devices. Login tokens are automatically set in your browser cache when you log in.
								They are cleared when you explicitly log out with the "Logout" button here or at the top right
								or when they expire after 7 days.
								While you have a valid login token on the device, you can conveniently skip the need
								to log in when you open Pandora.<br />
								You can also change your account password here.
							</p>
							<p>
								Let's proceed to the next tab: "Interface".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Interface') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/interface',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Interface" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/interface',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Interface') },
					],
				},
				{
					text: (
						<>
							<p>
								In this tab you can customize an accent color that is reused all over Pandora's UI to make it more personal.<br />
								Aside from that, you can configure many things here about the UI of the room view, including the chat, the room
								graphics, where the characters are drawn on, and the wardrobe UI.
							</p>
							<p>
								It is very recommend that you experiment with the first 4 settings of the "Chatroom UI", as especially the
								chat ratio may need to be adjusted depending on your device's screen ratio to find a good balance between the space
								that chat and room canvas take up.
								At the very end, there is an option to reset the completion status of all tutorials, if you would want to
								go through them once more.
							</p>
							<p>
								Let's proceed to the next tab: "Graphics".
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Graphics') },
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: '/settings/graphics',
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the "Graphics" tab of the settings screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/settings/graphics',
					}],
					highlight: [
						{ query: '.Header .rightHeader > button[title="Settings"]', inset: true },
						{ query: '.tab-container .tab', filter: (e) => e.innerText.includes('Graphics') },
					],
				},
				{
					text: (
						<>
							<p>
								The "Graphics" tab lets you adjust the quality of Pandora to what your device is capable of.<br />
								If you experience performance issues or crashes, the first setting to reduce should typically be the
								"Texture resolution", especially on devices with lower (graphics) RAM, as Pandora uses mostly very high
								resolution textures.
							</p>
							<p>
								It is also recommended to keep alpha masks switched off.<br />
								Other settings that can boost performance are to disable antialiasing, eye blinking, and smooth movement.
								Decreasing the render resolution may also have a small effect, but will have a noticeably negative effect
								on visual quality.
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
						<p>
							This concludes the tutorial on profiles and settings.<br />
							Pandora's staff wishes you a wonderful day!
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
