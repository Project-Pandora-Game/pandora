import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

export const TUTORIAL_RANDOMIZE_APPEARANCE: TutorialConfig = {
	id: 'randomizeAppearance',
	name: `Character appearance randomization`,
	stages: [
		{
			steps: [
				{
					text: (
						<>
							Hi and welcome to the tutorial on how to randomize your character's appearance! <br />
							In this tutorial you will learn how to enter your character's wardrobe and create <br />
							a new, random look for your character.
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
							Let's start by opening your character's wardrobe. <br />
							That is a place where you can freely edit your character's appearance.
						</>
					),
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
							Now find your character in the current tab by its name. Your character will always be shown as the top entry in the list. <br />
							Under your character's name there are various actions you can do with it. <br />
							For now click the "Wardrobe" button to go to your character's wardrobe.
						</>),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.character-info fieldset:has(legend.player)',
						},
						{
							query: '.character-info fieldset:has(legend.player) .Button',
							filter: (e) => e.innerText.includes('Wardrobe'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: /^\/wardrobe($|\/character\/c)/,
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the wardrobe screen for your character.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<>
							You are now successfully in your character's wardrobe! <br />
							In Pandora the wardrobe is a powerful tool, so don't be scared about it looking so complex - <br />
							more of it will be covered in later tutorials. <br />
							<br />
							Our next step is going to the randomization menu, which will allow you to create a new, random appearance for your character.
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <>First switch to the "Randomization" tab.</>,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Randomization'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Randomization'),
					}],
				},
				{
					text: (
						<>
							Expand the "Character randomization" section by clicking on it. <br />
							It is collapsed by default, because the buttons inside are dangerous - they delete all items you are currently wearing.
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView .open.fieldset-toggle-legend',
						filter: (e) => e.innerText.includes('Character randomization'),
					}],
					highlight: [{
						query: '.inventoryView .fieldset-toggle-legend',
						filter: (e) => e.innerText.includes('Character randomization'),
					}],
				},
				{
					text: (
						<>
							Great! Now you can click the buttons "Randomize clothes" or even "Randomize everything" to randomize your character's look.<br />
							Once you are happy with your character's look, click the "Next" button to continue.<br />
							<br />
							Note:&#32;
							<i>In some cases (such as when you are restrained) the buttons might be red.<br />
								This indicates, that you cannot currently randomize your character's appearance,<br />
								as you are not allowed to do actions needed for that (such as being able to remove all items).
							</i>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView .fieldset-toggle .div-container.direction-row > .wardrobeActionButton',
					}],
				},
			],
		},
		{
			steps: [{
				text: (
					<>
						Now you can exit the wardrobe by clicking the "Back" button in the top-right corner of the screen.<br />
						This will take you back to the most-relevant view for your current situation (in most cases that is the room view).
					</>
				),
				conditions: [{
					type: 'url',
					url: '/room',
				}],
				highlight: [{
					query: '.tab-container > .header .tab',
					filter: (e) => e.innerText.includes('Back'),
				}],
			}],
		},
	],
};
