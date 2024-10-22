import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';
import { BONE_MAX, BONE_MIN } from 'pandora-common';
import { ExternalLink } from '../../../components/common/link/externalLink';

// TODO: Randomizing + Changing body
/*
- We make user open wardrobe
- Talk about wardrobe being complex and then make user open Randomization
- Show them how to randomize character
- Make them switch to "Body" tab
- Show them how to hide clothes temporarily
- Show them how to change body size
- Have them select some bodypart and show them how to color it and interact with its typed modules
- Show them how to add new bodyparts
- Show them how to reorder and then remove bodyparts (e.g. on hairs - making them add multiple hairs first)
- Have them leave the wardrobe
*/
export const TUTORIAL_WARDROBE_BODY: TutorialConfig = {
	id: 'wardrobeBody',
	name: `Character interactions: Body`,
	description: (
		<p>
			This tutorial will teach you about character bodies in Pandora and guide you through the process of creating your own, unique character.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Hi and welcome to the tutorial on creating a custom character!<br />
							In this tutorial you will learn how to enter your character's wardrobe and create<br />
							a unique look for your character through, at first, randomization, and then editing the details.
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
						<p>
							Let's start by opening your character's wardrobe.<br />
							That is a place where you can freely edit your character's appearance.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
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
							Now find your character in the current tab by its name, as was shown in the last tutorial.<br />
							For now click the "Wardrobe" button to go to your character's wardrobe.
						</p>
					),
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
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							You are now successfully in your character's wardrobe!<br />
							In Pandora, the wardrobe is a powerful tool, so don't be scared about it looking so complex -<br />
							more of it will be covered in later tutorials.<br />
							<br />
							Our next step is going to the randomization menu, which will allow you to create a new, random appearance for your character.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <p>First switch to the "Randomization" tab.</p>,
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
						<p>
							Expand the "Character randomization" section by clicking on it.<br />
							It is collapsed by default, because the buttons inside are dangerous - they delete all items you are currently wearing.
						</p>
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
						<p>
							Great! Now you can click the buttons "Randomize clothes" or even "Randomize everything" to randomize your character's look.<br />
							Once you are happy with your character's look, click the "Next" button to continue.<br />
							<br />
							Note:&#32;
							<i>
								If you are happy with your character's current look, you can skip this step.
							</i><br />
							Note:&#32;
							<i>In some cases (such as when you are restrained) the buttons might be red.<br />
								This indicates, that you cannot currently randomize your character's appearance,<br />
								as you are not allowed to do actions needed for that (such as being able to remove all items).
							</i>
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView .fieldset-toggle .div-container.direction-row > .wardrobeActionButton',
					}],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Our next step is further customizing your character's look.<br />
							The "Body" tab can be used to do that.<br />
							<br />
							Please switch to it now.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Body'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Body'),
					}],
				},
				{
					text: (
						<p>
							As you can see, the "Body" tab of the wardrobe has two main areas.<br />
							<br />
							The left pane shows the current status - what bodyparts make up your character.<br />
							Here you can edit details of the bodyparts (more on that later), delete them, or even reorder them in some cases.<br />
							Do note, that order of bodyparts does matter. While Pandora enforces a specific order most of the time,<br />
							identical bodypart types (e.g. multiple "hair" bodyparts) can be reordered freely.<br />
							<br />
							The right pane shows several ways you can add or swap different bodyparts for other available bodyparts.<br />
							<br />
							Note:&#32;
							<i>
								Some bodyparts are required and cannot be removed (only swapped for a different one of the same type), while others are optional.
							</i><br />
							Note:&#32;
							<i>
								Some bodyparts allow you to add multiple of them (for example hairs), allowing for greater customization through their layering.
							</i><br />
							Note:&#32;
							<i>While you can freely change your body in your personal room,<br />
								some public spaces might not allow you to change your body while inside them.
							</i>
						</p>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [{
						query: '.wardrobe-pane > .wardrobe-ui > *',
					}],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: <p>Please switch back to the "Body" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Body'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Body'),
					}],
				},
				{
					text: (
						<p>
							As it might be hard to edit your character's body while the clothes are in the way,<br />
							you can temporarily hide all worn clothing (or other items) by enabling the "Hide worn items" checkbox.<br />
							Please do so now.<br />
							<br />
							Note:&#32;
							<i>
								The clothes are only hidden for you - anyone else in the same room will continue to see your character normally.
							</i>
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.characterPreview .overlay .option:has(input:checked)',
						filter: (e) => e.innerText.includes('Hide worn items'),
					}],
					highlight: [{
						query: '.characterPreview .overlay .option',
						filter: (e) => e.innerText.includes('Hide worn items'),
					}],
				},
				{
					text: (
						<p>
							Before we start completely swapping bodyparts, please note that some parts of the body can have their size adjusted.<br />
							You can find the currently available adjustments in the "Change body size" tab.<br />
							Please switch to it now.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Change body size'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Change body size'),
					}],
				},
				{
					text: (
						<p>
							Here you can find sliders for adjusting sizes of your character's body.<br />
							Feel free to move the sliders and experiment with them to your satisfaction before pressing "Next".<br />
							<br />
							Note:&#32;
							<i>
								Most sliders allow you to freely choose any value between { BONE_MIN } and { BONE_MAX } with the default being 0.<br />
								Some bodyparts might, however, limit available values. Example of this are breasts, which only have several valid positions you can choose from.<br />
								While you can freely move the slider, Pandora will actually choose the closest valid value at all times.<br />
								You can see what value is in effect by watching the small "nub" under the slider.
							</i>
						</p>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [{
						query: '.wardrobe .bone-ui',
					}],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: <p>Please switch back to the "Body" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Body'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Body'),
					}],
				},
				{
					text: (
						<p>
							Next we will look at modifying a specific bodypart.<br />
							Find the "Base body" bodypart at the very bottom of the items list, then click on its name to select it.<br />
							This will open up its details, where you will be able to see all the options this bodypart offers.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected',
						filter: (e) => e.innerText.includes('Base body'),
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Base body'),
						},
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView',
						},
					],
				},
				{
					text: (
						<p>
							The menu that appeared on the right shows all the options this specific bodypart has.<br />
							Note, that the options depend not only on the bodypart type, but on the actual, specific bodypart.<br />
							For example, different eyes might have different options.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView.itemEdit',
					}],
				},
				{
					text: (
						<p>
							At the top of the bodypart's details you will find several actions you might be able to do with it.<br />
							For base body it is likely, that all of them will not be possible.<br />
							You can hover over the action (or hold down on it, if using touchscreen) to see why it isn't possible.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView.itemEdit .itemActions',
					}],
				},
				{
					text: (
						<p>
							The first configuration section, shared practically by all items, is the ability to change its color.<br />
							In this section you can see all the coloring options this bodypart or item has.<br />
							You can enter any color in a <ExternalLink href='https://en.wikipedia.org/wiki/Web_colors'>hex triplet</ExternalLink> format, or press the colored square to open a color picker.<br />
							The last button allows you to reset the color to the item's default one.<br />
							Feel free to try that now and press "Next" when you are happy with the body's color.<br />
							<br />
							Note:&#32;
							<i>
								Some items might also contain colors with 4th component - "alpha" (or commonly called "opacity" or "transparency").<br />
								This means that part of the item controlled by that color can be made partially or fully transparent.
							</i><br />
							Note:&#32;
							<i>
								The text input field can handle many color formats by pasting them inside with Ctrl+V, including but not limited to:<br />
								basic colors by name (red, blue, white, ...) and CSS color-space based color definitions (such as rgb(...) or hsl(...) ).
							</i>
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView.itemEdit .fieldset-toggle.coloring',
					}],
				},
				{
					text: (
						<p>
							Further configuration sections are called "Modules".<br />
							There are many kinds of modules, but the most common one allows you to choose one option out of several.<br />
							The currently selected variant is highlighted, but you can switch to other variants by clicking on them.<br />
							Hovering over the variant with your mouse will allow you to preview what it would look like.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView.itemEdit .fieldset-toggle',
						filter: (e) => e.innerText.includes('Module:'),
					}],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: <p>Please switch back to the "Body" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Body'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Body'),
					}],
				},
				{
					text: (
						<p>
							Finally we will look at using different bodyparts altogether.<br />
							Please close the current bodypart's details by clicking on it again, or by clicking on the cross in the top-right corner.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe-pane > .wardrobe-ui > .tab-container:not(.hidden)',
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected',
						},
						{
							query: '.inventoryView.itemEdit .toolbar .modeButton',
						},
					],
				},
				// TODO: Continue here
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							Now you can exit the wardrobe by clicking the "Back" button in the top-right corner of the screen.<br />
							This will take you back to the most-relevant view for your current situation (in most cases that is the room view).
						</p>
					),
					conditions: [{
						type: 'url',
						url: '/room',
					}],
					highlight: [{
						query: '.tab-container > .header .tab',
						filter: (e) => e.innerText.includes('Back'),
					}],
				},
			],
		},
	],
};
