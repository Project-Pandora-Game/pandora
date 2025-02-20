import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Space management
// (create, delete, leave, enter, manage; while inside also note the difference between "Personal Space" tab and "Room" tab)
export const TUTORIAL_SPACE_MANAGEMENT: TutorialConfig = {
	id: 'spaceManagement',
	name: `Spaces`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you the basics of Pandora's Spaces.<br />
			It will talk about entering and leaving spaces and about creating and managing your own space.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<>
							Hi and welcome to the tutorial on switching and Leaving Spaces! <br />
							In this tutorial you will learn how to find, join, and leave or switch spaces/rooms<br />
							or Pandora itself.
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
							Let's start by opening the multipurpose exit-menu. <br />
							Click the button on the top right.
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.LeaveDialog',
					}],
					highlight: [{
						query: '.rightHeader .HeaderButton',
						filter: (e) => e.title.includes('Leave'),
					}],
				},
				{
					text: <>TODO</>,
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
