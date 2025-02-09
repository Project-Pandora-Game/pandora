import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

export const TUTORIAL_SAFEMODE: TutorialConfig = {
	id: 'safemode',
	name: `Safemode and Timeout mode`,
	description: (
		<p>
			This tutorial will teach you about getting out of bad situations.
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
								Hello again! In this tutorial, we will talk about something very important: Safemode and timeout mode.
							</p>
							<p>
								These features are designed as a last resort &ndash; for situations where you no longer feel comfortable or you get your character
								stuck and cannot find any other way out.
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
								Most of Pandora's features are very secure and some can even get a character truly struck with no one else being able to help.
								Please be mindful of that when you open up critical permissions to other users (permissions will be the topic of a future tutorial).
								As always, communication with others is the most important tool in our community, but Pandora also offers mechanisms to keep you safe.
							</p>
							<p>
								The mechanisms that will be discussed in this tutorial are for when you would encounter a situation where communication with another party failed or someone is not
								respecting your OOC communication about limits / your safeword. For such a case, there are two modes: Timeout and safemode.<br />
								Both modes prevent interactions between the character and others characters in either direction while active.
								Safemode also allows you to bypass all restricting features, for instance allowing you to remove any items on your character &ndash; even locked ones.
							</p>
							<p>
								The next step will show where you can find these modes.
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
						<p>
							Find your character in the current tab at the top of the space's character list.<br />
							Note: In other spaces you can find this list under the "Room" tab.<br />
							<br />
							Click the "Enter safemode" button under your character's name.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content.overflow-auto .Button',
						filter: (e) => e.innerText.includes('Enter timeout mode'),
					}],
					highlight: [
						{
							query: '.character-info fieldset:has(legend.player)',
						},
						{
							query: '.character-info fieldset:has(legend.player) .Button',
							filter: (e) => e.innerText.includes('Enter safemode'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								In the dialog that now opened, both modes are explained in detail. Please move or minimize the tutorial window as necessary,
								in case you cannot read the text.
							</p>
							<p>
								Essentially, both modes keep a character safe from further interactions, but only safemode lets you remove restrictions.<br />
								While timeout mode can be toggled on and off freely, safemode cannot be left for a while after it has been entered.
								This simulates stopping the play after a safeword usage to recover safely and to promote healthier roleplaying practices, since it is a tool
								that should ideally never be needed. A last-resort option for true emergencies.
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
						<p>
							Please enter timeout mode now by pressing the according button in the middle.
						</p>
					),
					highlight: [
						{
							query: '.dialog-content.overflow-auto .Button',
							filter: (e) => e.innerText.includes('Enter timeout mode'),
						},
					],
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content.overflow-auto .Button',
						filter: (e) => e.innerText.includes('Leave timeout mode'),
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
						<p>
							Now press the "Cancel" button to close the dialog.
						</p>
					),
					highlight: [
						{
							query: '.dialog-content.overflow-auto .Button',
							filter: (e) => e.innerText.includes('Cancel'),
						},
					],
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content.overflow-auto .Button',
						filter: (e) => /(Enter|Leave) timeout mode/.test(e.innerText),
						expectNoMatch: true,
					}],
				},
				{
					text: (
						<p>
							You can now see a notice that timeout mode is active next to your character's name in the space's character list.
							The same banner is also shown in the wardrobe.
							These notifications are visible to other users as well. It is a clear indication that something is not okay and it gives users time to
							start communicating that while being able to feel safe.
						</p>
					),
					highlight: [
						{
							query: '.character-info fieldset:has(legend.player)',
						},
					],
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
						<p>
							For exiting timeout mode or safemode (after the cooldown period) the same dialog is used.<br />
							<br />
							Press the "Exit timeout mode" button.
						</p>
					),
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Exit timeout mode'),
						},
					],
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content.overflow-auto .Button',
						filter: (e) => /(Enter|Leave) timeout mode/.test(e.innerText),
					}],
				},
				{
					text: (
						<p>
							Press the "Leave timeout mode" button to cancel the effects of the mode.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content.overflow-auto .Button',
						filter: (e) => e.innerText.includes('Enter timeout mode'),
					}],
					highlight: [
						{
							query: '.dialog-content.overflow-auto .Button',
							filter: (e) => e.innerText.includes('Leave timeout mode'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes the tutorial on this topic.<br />
							Please interact responsibly and respectfully so these features do not need to be used.<br />
							Thank you!~
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
