import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_PERMISSIONS: TutorialConfig = {
	id: 'permissions',
	name: `Permissions`,
	description: (
		<p>
			This tutorial will teach you about the permissions your character grants others.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<>
							<p>
								In this tutorial, we will briefly talk about an important safety topic: Permissions.
							</p>
							<p>
								Permissions in Pandora follow a safe default approach, but can be individually customized in great detail.
								Set for each character individually, they determine how other characters can interact with yours.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <>Please switch to the settings screen, where you can configure your character's permissions.</>,
					conditions: [{
						type: 'url',
						url: '/settings/permissions',
					}],
					highlight: [{ query: '.Header .rightHeader > button[title="Settings"]', inset: true }],
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
								You are now on the "Permissions"-tab of Pandora's settings. With only few exceptions (e.g. individual character
								modifier permissions), all of Pandora's permissions can be found here. Pandora comes with default settings out
								of the box that were seen as reasonable and safe.
							</p>
							<p>
								Let's take a closer look.
							</p>
							<p>
								Note: Please be reminded that you can freely drag the tutorial popup around and
								can even temporarily minimize it with the button at the top if it is in the way of seeing parts of the screen.
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
								The most important permission in Pandora is the general interaction permission to
								"Interact and to use other allowed permissions". It is the one permission to literally rule them all!
								Only when a character gets this master-permission, they can use all other permissions granted to them.
							</p>
							<p>
								Every permission has a global setting. The global setting of a permission can possibly be set to
								"yes", "no", and "prompt". "Prompt" will show you a popup when someone tries to interact with you,
								but is missing one or more permissions that are set to "prompt".
							</p>
							<p>
								The master-permission is set to "prompt" by default, which is indicated by the icon of the figure with the
								speech bubble on the right.<br />
								It cannot be set to "yes" for everyone globally, only for individual characters. This is intentional
								to make Pandora a safer and healthier platform, as it limits the potential for trolling severely
								for the prize of a quick button press, as you typically decide this only once per
								new character you interact with.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.settings-tab > .settings-tab-contents .flex-1',
						filter: (e) => e.innerText.includes('Interact and to use other allowed permissions'),
					}],
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
								Let's look at another permission: "Modify this character's body".
								It is set to "no" by default, which is indicated by the icon with the
								the crossed-out circle. This means that by default, no one has this permission and can
								also not ask for it, e.g. to change the hairstyle or body proportions.
							</p>
							<p>
								Press the "Edit" button to the right of the highlighted line to open the settings dialog
								of this permission.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content ',
						filter: (e) => e.innerText.includes('Editing permission') && e.innerText.includes('Modify this character'),
					}],
					highlight: [{
						query: '.settings-tab > .settings-tab-contents .flex-1',
						filter: (e) => e.innerText.includes('Modify this character'),
					}],
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
						<p>
							Press the "Edit" button to the right of the permission: "Modify this character's body".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content ',
						filter: (e) => e.innerText.includes('Editing permission') && e.innerText.includes('Modify this character'),
					}],
					highlight: [{
						query: '.settings-tab > .settings-tab-contents .flex-1',
						filter: (e) => e.innerText.includes('Modify this character'),
					}],
				},
				{
					text: (
						<>
							<p>
								At the top of this dialog, you could change the global setting of this permission from "no"
								to "prompt" or even grant it to everyone by changing it to "yes", in case you desire that
								anyone with the master-permission can modify your character's body and body parts however they desire.
							</p>
							<p>
								The bottom sections are for character-individual exceptions. They override the global setting,
								making it more or less permissive for that character.
								When you allow or deny a prompt, an entry is automatically added in the according section of that
								permission in the background and you can manually adjust that here at any time.
							</p>
							<p>
								Please close the button again.
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.dialog-content ',
					filter: (e) => e.innerText.includes('Editing permission') && e.innerText.includes('Modify this character'),
					expectNoMatch: true,
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
						<p>
							Most permissions are set to "yes" by default, indicated by the icon with the public crowd of people.
						</p>
					),
					conditions: [{ type: 'next' }],
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
						<p>
							A final note on permissions prompts:<br />
							When someone tries an action that leads to a prompt, indicated by a different button color (yellow),
							they are not directly informed about your decision.
							After you have granted the permission, the action is not automatically executed, as the server does not queue this.
							Therefore, the interaction that was leading to the prompt has to be repeated again by the requesting character, after
							they see the button color either changing from "yellow" to the normal color, or to "red", if the permissions was denied.
						</p>
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
							This concludes the tutorial on character permissions.<br />
							Pandora's staff wishes you a great day!
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
