import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_WARDROBE_ITEMS: TutorialConfig = {
	id: 'wardrobeItems',
	name: `Character interactions: Items`,
	description: (
		<p>
			This tutorial will teach you the basics of how items work in Pandora.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Welcome to the tutorial on wearable items!<br />
							In this tutorial you will learn how to use the wardrobe to create,
							customize, and delete items from a character.
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
							In general, you can open any character's wardrobe to edit
							their appearance, if you have the correct permissions.
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
							Now find your character in the current tab by its name and click the
							"Wardrobe" button to go to your character's wardrobe.
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							The wardrobe typically opens on the "Items" tab, which is used to manage all items equipped on a character.
							A character can only "wear" a limited amount of items. This limit is indicated by the bar in the middle.
							Locks, body parts, and items inside equipped storage items also count towards this limit.
						</p>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [
						{
							query: '.wardrobe .tab',
							filter: (e) => e.innerText.includes('Items'),
						},
						{
							query: '.toolbar',
							filter: (e) => e.innerText.includes('Currently worn items'),
						},
					],
				},
				{
					text: (
						<p>
							Similar to the "Body" tab, the "Items" tab of the wardrobe also has two main areas.<br />
							<br />
							The left pane shows all items currently equipped on the character.<br />
							Here you can edit/configure these items, reorder them, delete them, or move them to the room inventory.<br />
							Do note that the order of items matters! Items worn closest to the body (e.g. underwear) are at the bottom, while
							items worn on top of those are at the top.
							This means that restraints should typically be near the top of the list, unless you want to hide them under clothing.<br />
							<br />
							The right pane shows several ways how you can add or swap items. We will look at these in the next step.
						</p>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [{ query: '.wardrobe-pane > .wardrobe-ui > *' }],
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							In the right pane, the left tab "Room inventory" (which is typically active when you open the wardrobe) lists all items that are
							currently inside the room your character is in. The room inventory will be the topic of another tutorial.<br />
							The right tab "Saved items" will allow you to add items from item collection templates. These are part of a feature to save whole
							outfits, including restraints. This will also be the subject of another tutorial.<br />
							<br />
							For the current tutorial, we are interested in creating a completely new item. Let's proceed to the next step.
						</p>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [
						{
							query: '.wardrobe .tab',
							filter: (e) => e.innerText.includes('Room inventory'),
						},
						{
							query: '.wardrobe .tab',
							filter: (e) => e.innerText.includes('Saved items'),
						},
					],
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Create new item" tab in the middle.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
				},
				{
					text: (
						<p>
							In this tab, all existing wearable items in Pandora can be found. You can filter the shown items with the section at the top.<br />
							<br />
							The top row contains a text field for searching items
							by name and two buttons to switch between the current list-based view and a grid view with larger previews of the items.
							The section below that contains several buttons to filter based on item's type.<br />
							Feel free to hover over any of these icons (or hold down on it, if using a touchscreen) to see the description of that type.<br />
							<br />
							Afterwards, please proceed to the next step.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.wardrobeAssetList .toolbar',
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Create new item" tab in the middle.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
				},
				{
					text: (
						<p>
							For the sake of this tutorial, please filter for a "Top Hat" by either filtering for head items with the according button
							or by searching for the item directly by typing in a part of the item's name.<br />
							<br />
							To proceed to the next step, select the Top Hat by clicking on its name in the list.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Creating item: Top Hat'),
					}],
					highlight: [
						{
							query: '.toolbar.attributeFilter button[data-attribute="Headgear"]',
						},
						{
							query: '.wardrobeAssetList .inventoryViewItem',
							filter: (e) => e.innerText.includes('Top Hat'),
						},
					],
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Create new item" tab in the middle.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
				},
				{
					text: (
						<p>
							The right pane changed now to the item creation view, where you can configure various aspects of the item before creating it.<br />
							Similar to body parts, which were covered in a previous tutorial, one configuration option is the ability to change all
							of the item's colors and sometimes the transparency of a color. Depending on the item, you can also change
							the default state of various modules the item may or may not have.<br />
							<br />
							After you are happy with your choices, click on the position where you want to create the item in the list of worn items (left pane)
							to finalize creating the item.
							<br />
							As this item is a hat, the position you select likely doesn't matter, as you are unlikely to be wearing items that overlap with it.
							If you, however, were wearing for example a headband, it would matter whether you position the hat under it or above it.
						</p>
					),
					conditions: [
						{
							type: 'elementQuery',
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Top Hat'),
						},
						{
							type: 'elementQuery',
							query: '.inventoryView',
							filter: (e) => e.innerText.includes('Creating item: Top Hat'),
							expectNoMatch: true,
						},
					],
					highlight: [
						{
							query: '.wardrobeActionButton',
							filter: (e) => e.innerText.includes('Create item here'),
						},
						{
							query: '.inventoryView',
							filter: (e) => e.innerText.includes('Creating item'),
						},
					],
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Create new item" tab in the middle.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
				},
				{
					text: (
						<p>
							Your character is now wearing the hat you just created. To proceed, please click on the item.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected',
						filter: (e) => e.innerText.includes('Top Hat'),
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Top Hat'),
						},
					],
				},
				{
					text: (
						<p>
							The menu that appeared on the right shows all the configuration options of this item.
							Possibly even more options than before, such as being able to give the item a custom name and description
							to make it more unique by giving it some background story or describing additional noticeable details or features.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView.itemEdit',
					}],
				},
				{
					text: (
						<>
							<p>
								At the top of the items's details you will find several actions you might be able to do with it.
								In the order from left to right:
							</p>
							<ul>
								<li>
									Moving the item one position higher in the worn items order, so the layering looks different.
								</li>
								<li>
									Moving the item one position lower in the worn items order, so the layering looks different.<br />
									Note that moving an item can also be achieved with the four-ways arrow button in the left pane. This
									select-and-drop feature also allows you to move an item directly into a storage container
									(e.g. a chest in the room inventory) or out of one.
								</li>
								<li>
									Removing the item from the character and deleting it.<br />
									Note that you can do this action also with the trash can
									button in the left pane, while the "Create new item" tab on the right pane is the active one.
								</li>
								<li>
									Removing the item from the character and moving it to the room inventory.<br />
									Note that you can do this action also with the
									triangle arrow button in the left pane (likely not currently visible), while the "Room inventory" tab on the right
									pane is the active one.
								</li>
							</ul>
							<p>
								If one of the buttons is red, you can hover over the action (or hold down on it, if using a touchscreen) to see why it isn't possible.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.inventoryView.itemEdit .itemActions',
						},
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .wardrobeActionButton',
							inset: true,
						},
					],
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
					text: <p>Please switch back to the "Items" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Items'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Create new item" tab in the middle.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Create new item'),
					}],
				},
				{
					text: (
						<p>
							[optional] Feel free to try removing the "Top Hat" from your character by either
							deleting it or moving it to the room inventory.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.wardrobeActionButton',
							filter: (e) => e.innerText.includes('Remove and delete'),
						},
						{
							query: '.wardrobeActionButton',
							filter: (e) => e.innerText.includes('Store in room'),
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
							This concludes the topic of wearable items.<br />
							We covered spawning an item from all the items available in Pandora, configuring it, reordering it, and removing it again.
							Now you can exit the wardrobe by clicking the "Back" button in the top-right corner of the screen to complete this tutorial.
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
