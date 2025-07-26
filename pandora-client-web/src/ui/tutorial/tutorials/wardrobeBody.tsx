import { BONE_MAX, BONE_MIN } from 'pandora-common';
import { ExternalLink } from '../../../components/common/link/externalLink.tsx';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

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
							In this tutorial you will learn how to enter your character's wardrobe and create
							a unique look for your character through randomization and then editing the details.
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
							That is the place where you can freely edit your character's appearance.
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
							query: '.character-info fieldset.character:has(legend.player)',
						},
						{
							query: '.character-info fieldset.character:has(legend.player) .Button',
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
							In Pandora, the wardrobe is a powerful tool, so it may look overwhelming at first sight.
							But no worries - we will cover all its details in later tutorials.<br />
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
							The "Body" tab allows you to do that.<br />
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
							The left pane shows all current body parts of your character.<br />
							Here you can edit details of the body parts (more on that later), delete them, or even reorder them in some cases.<br />
							Do note, that the order of body parts does matter.
							While Pandora enforces a specific order most of the time,
							identical body part types (e.g. multiple "hair" body parts) can be reordered freely.<br />
							<br />
							The right pane shows several ways how you can add or swap different body parts for other available body parts.<br />
							<br />
							Note:&#32;
							<i>
								Some body parts are required and cannot be removed (only swapped for a different one of the same type), while others are optional.
							</i><br />
							Note:&#32;
							<i>
								Some body parts allow you to add multiple of them (for example hairs), allowing for greater customization through their layering.
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
							As it might be hard to edit your character's body while the clothes are in the way,
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
							Before we start completely swapping body parts, please note that some parts of the body can have their size adjusted.
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
								Most sliders allow you to freely choose any value between { BONE_MIN } and { BONE_MAX } with the default being 0.
								Some body parts might, however, limit available values. Example of this are breasts, which only have several valid positions you can choose from.
								While you can freely move the slider, Pandora will actually choose the closest valid value at all times.
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
							Next we will look at modifying a specific body part.<br />
							Find the "Base body" body part at the very bottom of the items list, then click on its name to select it.
							This will open up its details, where you will be able to see all the options this body part offers.
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
							The menu that appeared on the right shows all the options this specific body part has.<br />
							Note, that the options depend not only on the body part type, but on the actual, specific body part.
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
							At the top of the body part's details you will find several actions you might be able to do with it.
							For base body it is likely, that all of them will not be possible.
							You can hover over the action (or hold down on it, if using a touchscreen) to see why it isn't possible.
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
							In this section you can see all the coloring options this body part or item has.
							You can enter any color in a <ExternalLink href='https://en.wikipedia.org/wiki/Web_colors'>hex triplet</ExternalLink> format, or press the colored square to open a color picker.
							The last button allows you to reset the color to the item's default one.
							Feel free to try that now and press "Next" when you are happy with the body's color.<br />
							<br />
							Note:&#32;
							<i>
								Some items might also contain colors with a 4th component - "alpha" (commonly also called "opacity" or "transparency").
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
							There are many kinds of modules, but the most common one allows you to choose one option out of several.
							The currently selected variant is highlighted, but you can switch to other variants by clicking on them.
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
							Finally we will look at using different body parts altogether.<br />
							Please close the current body part's details by clicking on it again,
							or by clicking on the cross in the top-right corner.
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
							query: '.inventoryView.itemEdit .toolbar .Button',
						},
					],
				},
				{
					text: (
						<p>
							Body parts can be added or swapped using the "Change body parts" tab.<br />
							Please switch to it now.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
				},
				{
					text: (
						<p>
							On the right side, all existing body parts in Pandora are listed per default.
							You can filter the selection with the item row at the top. Feel free to hover over
							any of the icons (or hold down on it, if using a touchscreen) to see what type of
							body part the filter will show.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.toolbar.attributeFilter',
					}],
				},
				{
					text: (
						<p>
							For the sake of this tutorial, please filter for front hairs now with the according button.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.toolbar.attributeFilter button[data-attribute="Hair_front"].defaultActive',
					}],
					highlight: [{
						query: '.toolbar.attributeFilter button[data-attribute="Hair_front"]',
					}],
				},
				{
					text: (
						<p>
							Now you can see that only front hairs are listed.<br />
							By clicking any entry, you can add the body part to your body. Only hovering over it, will preview the change.
							Note that hair is a body part type where multiples can be added at the same time. That said, for some other body part types
							this action would swap the existing body part of that type for the new one.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.wardrobeAssetList .listContainer',
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
					text: <p>Please switch back to the "Change body parts" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
				},
				{
					text: (
						<p>
							For demo purposes, please add several front hairs to your character at the same time to proceed.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .quickActions .wardrobeActionButton.allowed',
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						filter: (e) => (JSON.parse(e.dataset.action ?? 'null')?.type === 'move'),
					}],
					highlight: [{
						query: '.wardrobeAssetList .listContainer',
					}],
				},
				{
					text: (
						<p>
							Some body parts can be reordered with the up/down buttons in the left list, which
							contains the current body parts of your character.
							As usual, only hovering the button previews the change. Feel free to experiment before proceeding.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .quickActions .wardrobeActionButton:not(.invisible)',
						inset: true,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						filter: (e) => (JSON.parse(e.dataset.action ?? 'null')?.type === 'move'),
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
					text: <p>Please switch back to the "Change body parts" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Change body parts'),
					}],
				},
				{
					text: (
						<p>
							You can delete some body parts with the trashcan icon.<br />
							Note that certain body part types can only be swapped, but not removed.<br />
							Please feel free to remove the front hair you do not want to keep before proceeding.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .quickActions .wardrobeActionButton',
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						filter: (e) => (JSON.parse(e.dataset.action ?? 'null')?.type === 'delete'),
					}],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes this tutorial about the character body.<br />
							Now you can exit the wardrobe by clicking the "Back" button in the top-right corner of the screen.
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
