import { LIMIT_CHARACTER_COUNT } from 'pandora-common';
import React from 'react';
import maid from '../../../assets/maid.png';
import { Column, Row } from '../../../components/common/container/container';
import { ExternalLink } from '../../../components/common/link/externalLink';
import { useHelpUserName } from '../../../components/help/helpUtils';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

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
					text: function Text() {
						return (
							<Row>
								<Column>
									<p>
										“ Dear { useHelpUserName() },<br />
										<br />
										a warm welcome to Club Pandora!<br />
										<br />
										I am Mona and I am here to show you everything important to make your stay in the club a pleasant experience.<br />
										<br />
										Let's start with some basic hints and tips. ”
									</p>
								</Column>
								<Row alignX='center' className='maid-container'>
									<img src={ maid } />
								</Row>
							</Row>
						);
					},
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<Row>
							<Column>
								<p>
									As I am quite new to this job, I might sometimes get in the way.<br />
									If that happens please feel free to move me as it pleases you!<br />
									<br />
									You can move the tutorial screen by dragging the highlighted section.
								</p>
							</Column>
							<Row alignX='center' className='maid-container'>
								<img src={ maid } />
							</Row>
						</Row>
					),
					highlight: [
						{
							query: '.tutorialDialogContainer > .dialog-header .drag-handle',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<Row>
							<Column>
								<p>
									You can also resize the tutorials dialog by dragging any of its edges.
								</p>
							</Column>
							<Row alignX='center' className='maid-container'>
								<img src={ maid } />
							</Row>
						</Row>
					),
					highlight: [
						{
							query: '.tutorialDialogContainer > div:not(.dialog-content) > div',
							inset: true,
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<Row>
							<Column>
								<p>
									If you are already familiar with the club or if you prefer exploring it completely by yourself,
									you can quit a tutorial at any time by clicking the '×' in the corner.<br />
									<br />
									I recommend going through the tutorials at your own pace, as it will likely give you a smoother experience.
								</p>
							</Column>
							<Row alignX='center' className='maid-container'>
								<img src={ maid } />
							</Row>
						</Row>
					),
					highlight: [
						{
							query: '.tutorialDialogContainer > .dialog-header .dialog-close',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<Row>
							<Column>
								<p>
									Ah, you decided to stick with me. Thank you!<br />
									Let's move on by taking a look at the character selection screen.
								</p>
								<p>
									<i>
										From the next step onwards I will also get out of your way,<br />
										only explaining things instead of taking up most of your screen.
									</i>
								</p>
							</Column>
							<Row alignX='center' className='maid-container'>
								<img src={ maid } />
							</Row>
						</Row>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		// TODO: When this tutorial auto-starts, show tutorial regarding character creation here.
		// This part shouldn't happen when you already have a character.
		{
			advanceConditions: [
				{
					type: 'url',
					url: /^\/(room|character\/create)/,
				},
			],
			steps: [
				{
					text: (
						<>
							<p>
								[TODO]<br />
								You can have multiple characters in Pandora - they are mostly independent from each other.<br />
								By default you can have at most { LIMIT_CHARACTER_COUNT } characters.<br />
								Click on the blank character card to create a new one.
							</p>
							<p>
								<i>Note: If you already have a created character, alternatively click on it to use it for the next steps of this tutorial.</i>
							</p>
						</>
					),
					highlight: [
						{
							query: '.character-select .card',
						},
					],
					conditions: [
						{
							type: 'url',
							url: /^\/(room|character\/create)/,
						},
					],
				},
			],
		},
		{
			advanceConditions: [
				{
					type: 'url',
					url: '/room',
				},
			],
			steps: [
				{
					text: (
						<p>
							[TODO]<br />
							The first character creation step is giving your new character a name.<br />
							It cannot be changed later. (but we might add that in the future)<br />
							Most people use only a first name, starting with a capital letter.<br />
							Name your character to proceed.<br />
						</p>
					),
					conditions: [
						{
							type: 'url',
							url: '/room',
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<>
							<p>
								Congratulations on creating your new character!
							</p>
							<p>
								What you now see in front of you is this character's personal room,
								but all of that will be explained in the next tutorial.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <>Please open the "Personal Space" tab.</>,
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
							For now the most important bit is the section showing tutorials.<br />
							Here you can find the currently running tutorial, as well as all the tutorials you can start.
						</>
					),
					highlight: [{
						query: '.privateSpaceTutorialsUi',
					}],
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							Please open the "Tutorial catalogue" section by clicking on it.
						</>
					),
					highlight: [{
						query: '.fieldset-toggle-legend',
						filter: (e) => e.innerText.includes('Tutorial catalogue'),
					}],
					conditions: [{
						type: 'elementQuery',
						query: '.fieldset-toggle-legend.open',
						filter: (e) => e.innerText.includes('Tutorial catalogue'),
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
					text: <>Please open the "Personal Space" tab.</>,
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
							Please open the "Tutorial catalogue" section by clicking on it.
						</>
					),
					hideWhenCompleted: true,
					highlight: [{
						query: '.fieldset-toggle-legend',
						filter: (e) => e.innerText.includes('Tutorial catalogue'),
					}],
					conditions: [{
						type: 'elementQuery',
						query: '.fieldset-toggle-legend.open',
						filter: (e) => e.innerText.includes('Tutorial catalogue'),
					}],
				},
				{
					text: (
						<>
							These are all the tutorials we currently have.<br />
							After you finish this tutorial we strongly recommend following up with the next one: "Pandora Introduction".
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
								One last thing I would like to mention now is, that Project Pandora also has a rather comprehensive Wiki!<br />
								You can find it using the highlighted button near the top of the screen.
							</p>
							<p>
								And that is all from me for now!<br />
								<i>Please have a joyful stay~</i>
							</p>
						</>
					),
					highlight: [{
						query: '.HeaderButton[title="Wiki"]',
						inset: true,
					}],
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
