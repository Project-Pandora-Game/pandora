import { LIMIT_CHARACTER_COUNT } from 'pandora-common';
import maid from '../../../assets/maid.png';
import { Column, Row } from '../../../components/common/container/container';
import { ExternalLink } from '../../../components/common/link/externalLink';
import { useHelpUserName } from '../../../components/help/helpUtils';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

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
			modal: true,
			steps: [
				{
					text: function Text() {
						return (
							<Row>
								<Column>
									<p>
										“ Dear { useHelpUserName() },<br />
										<br />
										a warm welcome to the <ExternalLink href='https://wikipedia.org/wiki/BDSM'>BDSM</ExternalLink> club Pandora!<br />
										<br />
										I am Mona and I am here to show you everything important to make your stay in the club a pleasant experience.<br />
										<br />
										Let's start with some basic information and tips.<br />
										<br />
										Pandora strives to be a safe and welcoming place, but that also requires your help!<br />
										Please be aware that different people have different preferences and limits and respect their <ExternalLink href='https://en.wikipedia.org/wiki/Safeword'><b>Safeword</b></ExternalLink>. ”
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
			modal: true,
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
							zIndex: 'aboveTutorial',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			modal: true,
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
							query: '.tutorialDialogContainer > .resize-handle-wrapper > div',
							inset: true,
							zIndex: 'aboveTutorial',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			modal: true,
			steps: [
				{
					text: (
						<Row>
							<Column>
								<p>
									Finally, you can temporarily minimize the tutorial dialog<br />
									by clicking on the '▲' button at the top.
								</p>
							</Column>
							<Row alignX='center' className='maid-container'>
								<img src={ maid } />
							</Row>
						</Row>
					),
					highlight: [
						{
							query: '.tutorialDialogContainer > .dialog-header .dialog-shade',
							zIndex: 'aboveTutorial',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			modal: true,
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
							zIndex: 'aboveTutorial',
						},
					],
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			modal: true,
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
										From the next step onwards I will also get out of your way,
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
		// This part is skipped when you already have a character.
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
								You can have multiple, mostly independent characters in Pandora.<br />
								While some settings are shared across all characters, most parts are specific to each character,
								such as their worn items, permissions they give to others, item limits, profile, and more...<br />
								You could even use more than one of your characters at the same time!
							</p>
							<p>
								By default you can have at most { LIMIT_CHARACTER_COUNT } characters.<br />
								Click on the blank character card to create a new one.
							</p>
							<p>
								<i>Note: If you are a returning user, you can instead select one of your existing characters for the next steps of this tutorial.</i>
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
							The first character creation step is giving your new character a name.<br />
							Currently, the given name cannot be changed later (but we are considering adding that feature in the future).<br />
							Most people use only a first name, starting with a capital letter.<br />
							Please name your character to proceed.
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
		// End of skipped part
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
						<p>
							I would also like to mention, that Project Pandora has a rather comprehensive Wiki!<br />
							You can find it using the highlighted button near the top of the screen.
						</p>
					),
					highlight: [{
						query: '.HeaderButton[title="Wiki"]',
						inset: true,
					}],
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
								Please be aware that the club is still being renovated.<br />
								You can expect many new things over time or even help us with building it up further!<br />
								If you want to help, it is best to familiarize yourself with the club first,
								and then get in touch using the information found in the "Contact"-tab of the Wiki.
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
