import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Pose and Expressions tutorial
/*
- Open pose tab
	- Explain there are several premade presets, divided into categories
	- One category is "View" - this allows you to turn your character around
	- Next are "Arm" categories (arms can move in shoulder and elbow; each arm can be in the front of behind the body; they can be controlled individually - more on that later)
	- Then there are "Leg" categories (currently with your legs you can be standing, kneeling, or sitting)
	- Finally there are categories "Toes" for tiptoeing and "Character rotation" for turning your character around
	- "Stored poses" allows you to save any custom poses you create yourself
	- "Character Y offset" is for "levitating" your character above the floor (or below it)
	- Finally the "Manual pose" are allows you to see all the aspects of a pose and control them individually. Feel free to explore!
- As the manual posing sliders can be a bit hard to get how you want them, we also offer posing UI on the character yourself
	- Click your character's name either in the graphics on the left, or in the "Personal room" character list
	- Click the "Pose" button to open the posing menu
	- In this view you can see circles you can drag to rotate various "bones" of your body. You can see that each matches some slider in the "Manual pose" menu
	- The left-right arrow at the bottom allows you to turn your character around
	- The four-way arrow allows you to switch to a character move mode. Note, that this might not always be available.
	- Finally, you can exit the pose mode by clicking the red "X" in the middle of your character
- Next are "expressions"
	- Open the "Expressions" tab
	- Explain that these depend purely on the worn bodyparts. The "Expressions" tab is excerpt from individual bodypart menus
	(note to self: Those were already mostly covered, in wardrobe body tutorial)
- You might have noticed these tabs only show your own character. If you wanted to change these for some other character?
	- You can find the same two "pose" and "expressions" tabs in the Wardrobe of any character!
*/
export const TUTORIAL_WARDROBE_POSING_EXPRESSIONS: TutorialConfig = {
	id: 'wardrobePoseExpressions',
	name: `Character interactions: Poses and Expressions`,
	description: (
		<p>
			This tutorial will teach you about posing your character and changing its expression.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Hi and welcome to the tutorial on character poses and expressions!<br />
							In this tutorial you will learn how to move a character's body<br />
							as well as change various aspects of it, such as facial expressions.
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
					text: (
						<>
							<p>
								Let's start by switching your character's Pose tab.<br />
								This is where you can find pre-defined pose templates, your own custom pose templates, and manual posing controls.
							</p>
							<p>Open the "Pose" tab.</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							The tab shows a large selection of default presets, divided into different categories.<br />
							The first one is "View" - it allows you to turn your character by 180 degrees.<br />
							<br />
							Note: The same can also be achieved by using the '/turn' command in the chat (or the short variant '/t').
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('View'),
						},
					],
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
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							If you scroll down, the next three sections are arm posing presets.<br />
							Arms can be moved at their shoulder and elbow joints.
							Each arm can also either be in the front or behind the body and can be controlled individually.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Arms ('),
						},
					],
				},
				{
					text: (
						<p>
							If you scroll further down, the next four sections are leg posing presets, grouped into standing, kneeling, and sitting poses.<br />
							Legs can be moved at their hip joints.
							Each leg can be controlled individually and characters can stand on their toes.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Legs ('),
						},
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Toes'),
						},
					],
				},
				{
					text: (
						<p>
							Finally, there is the preset section that lets you quickly rotate your character in the 4 main directions, such as sideways and upside down.<br />
							The center of rotation is at the bottom end of an upright character.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Character rotation'),
						},
					],
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
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							The 'Stored poses' category lets you create and manage your own pose presets.<br />
							<br />
							First, you need to pose your character manually as desired - more on that in a later part of this tutorial.
							Then can save the current pose to your Pandora account (you can only store a limited amount of custom poses) or export it as a file or text string.
							Buttons for all stored custom pose presets will appear in this section afterwards and you can manage them with the edit button in the middle.
							Any exported pose can be imported again as long as you still have a free pose preset slot.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Stored poses'),
						},
					],
				},
				{
					text: (
						<p>
							The 'Character Y Offset' input field lets you enter a positive or negative number that will "levitate" your character above the floor (or below it).<br />
							<br />
							This feature can be useful in certain situations, for example showing a character on the top of objects in a perspectively correct way,
							to simulate hanging from the ceiling, or to slowly appear behind an object by slowly increasing the value.<br />
							You can use the button on the right to reset the value back to the default offset quickly.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.div-container.direction-row.padding-small.gap-medium',
							filter: (e) => e.innerText.includes('Offset'),
						},
					],
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
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							At the bottom of the tab are the manual posing controls. There you can manipulate every joint and bone, as well as adjust each hand configuration.<br />
							<br />
							This feature can be useful in certain situations, for example showing a character on the top of objects in a perspectively correct way,
							to simulate hanging from the ceiling, or to slowly appear behind an object by slowly increasing the value.<br />
							You can use the button on the right to reset the value back to the default offset quickly.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.div-container.direction-row.padding-small.gap-medium',
							filter: (e) => e.innerText.includes('Offset'),
						},
					],
				},
			],
		},
	],
};
