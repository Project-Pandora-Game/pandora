import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_WARDROBE_ITEMS: TutorialConfig = {
	id: 'wardrobeItems',
	name: `Basics on Wearable Items`,
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
							Now find your character in the current tab by its name and click the
							"Wardrobe" button to go to your character's wardrobe.
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
							The wardrobe typically opens on the "Items" tab, which is used to manage all items equipped on a character,
							except body parts.
							A character can only "wear" a limited amount of items. This limit is indicated by the bar in the middle.
							Locks, body parts, and items inside equipped storage items also count towards this limit - this limit is shared between
							the "Items" and the "Body" tabs.
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
							Do note that the order of items matters! Items worn closest to the body (e.g. underwear) are near the bottom, while
							items worn on top of those are higher up.
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
						<>
							<p>
								Here is an explanation of the buttons in the right pane:
							</p>
							<ol>
								<li>"Current room's inventory" lists all items that are currently inside the room your character is in. The room inventory will be the topic of another tutorial.</li>
								<li>"Create new item" lets you create a new item 'out of thin air', if you currently can.</li>
								<li>"Saved items" will allow you to add items from item collection templates. These are part of a feature to save whole outfits, including restraints, or even body parts. They also allow saving room items. This will also be the subject of another tutorial.</li>
								<li>"A character" lets you open the wardrobe of another character inside the same space in the right pane so you can swap items between your character and the other one, if it is possible/allowed.</li>
								<li>In spaces with multiple rooms, an additional button "Another room's inventory" is shown. It will allow you to access items in different rooms without switching rooms. Typically, this works only for neighboring rooms, unless you are an admin of the space.</li>
							</ol>
						</>
					),
					conditions: [{
						type: 'next',
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .div-container .div-container .div-container',
							filter: (e) => e.innerText.includes('Create new'),
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
							To proceed, select "Create new item".
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobeAssetList .toolbar',
						filter: (e) => e.innerText.includes('Create and use a new item'),
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .div-container .div-container .div-container .Button',
							filter: (e) => e.innerText.includes('Create new'),
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
							For the current tutorial, we are interested in creating a completely new item.<br />
							<br />
							Please switch to the "Create and use a new item" view.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobeAssetList .toolbar',
						filter: (e) => e.innerText.includes('Create and use a new item'),
					}],
					highlight: [{
						query: '.wardrobe-pane > .wardrobe-ui > .div-container .div-container .div-container',
						filter: (e) => e.innerText.includes('Create new'),
					}],
				},
				{
					text: (
						<p>
							In this view on the right, you can search for specific items to add or swap for.
							You can filter for any items either with the text field at the top or any of the buttons below. Feel free to hover over
							the buttons (or hold down on it, if using a touchscreen) to see more info.<br />
							<br />
							For the sake of this tutorial, please search for a "Top Hat" by either filtering for headgear items with the according button
							or by searching for the item directly by typing in a part of the item's name into the text field at the top.<br />
							<br />
							Note:&#32;
							<i>
								You can switch the presentation of the search results between the default list-based view and a grid view with larger previews of the items with the two buttons top right.
							</i><br />
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
							query: '.inventoryView.wardrobeAssetList .toolbar .filter',
						},
						{
							query: '.inventoryView.wardrobeAssetList button[data-attribute="Headgear"]',
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
							Please find and select a new "Top Hat" item to create.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Creating item: Top Hat'),
					}],
					highlight: [{
						query: '.wardrobeAssetList .inventoryViewItem',
						filter: (e) => e.innerText.includes('Top Hat'),
					}],
				},
				{
					text: (
						<p>
							The right pane now changed to the item creation view, where you can configure various aspects of the item before creating it.<br />
							Similar to body parts, which were covered in a previous tutorial, one configuration option is the ability to change all
							of the item's colors and sometimes the transparency of a color. Another one is to give the item a custom name and description
							to make it more unique by adding some background story or describing additional noticeable details or features.
							Depending on the item, you can also change the default state of various modules the item may or may not have.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Item'),
						},
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Coloring'),
						},
					],
				},
				{
					text: (
						<p>
							An important module that most items have is the "Bound usage" section. It allows you or other permitted characters to toggle between allowing
							or blocking interaction with the state of this item (e.g. changing module states, or adding/removing the item) while hand usage is restricted.
							Most items allow a bound usage by default, but some stricter items, such as armbinders, don't. However, you can change this at the time
							of creation or even later, while not bound. More on bound usage in a moment. Let's proceed for now.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Bound usage'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								After you are happy with your choices, click on the position where you want to create the item in the list of worn items (left pane)
								to finalize creating the item.
							</p>
							<p>
								As this item is a hat, the position you select likely doesn't matter, as you are unlikely to be wearing items that overlap with it.
								If you, however, were wearing for example a headband, it would matter whether you position the hat under it or above it.
							</p>
						</>
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
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
					filter: (e) => e.innerText.includes('Top Hat'),
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
							Let's delve into the topic of bound usage a bit more. You can easily spot when an interaction would be a bound usage attempt,
							as the button is then colored differently than normally.<br />
							Doing a bound usage action attempt triggers a notification in the chat and other users can decide to interrupt your attempt.
							There is currently no consequence for being interrupted, such as a cooldown period.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							The bound usage system was added for self-bondage and for roleplaying tightening restraints or struggling out of items. It comes with a delay of five
							seconds before you can choose to complete the attempt to actually do the bound action. However, this arbitrary delay does not mean that
							Pandora defines that it always takes five seconds to struggle out successfully, for instance. It is impossible to estimate well enough
							how long it should take, as many factors that are impossible to know affect this process.
							Therefore, this system lets you flexibly decide yourself how long it should realistically take before you can succeed.<br />
							That said, there is a character modifier "Delayed bound usage attempts" that allows you or others to configure this time, for instance for
							individual items or item groups. Character modifiers are topic of another tutorial, though.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							Let's continue with this tutorial. Your character is now wearing the hat you just created. To proceed, please select this item.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Top Hat'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected',
					filter: (e) => e.innerText.includes('Top Hat'),
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
							Please select the "Top Hat" item in your wardrobe.
						</p>
					),
					hideWhenCompleted: true,
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
						<>
							<p>
								The menu that appeared on the right shows all the configuration options of this item.<br />
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
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected .wardrobeActionButton',
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
							The topic of "bound usage" was also explained.
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
