import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_WARDROBE_ITEM_COLLECTIONS: TutorialConfig = {
	id: 'wardrobeItemCollections',
	name: `Item collections`,
	description: (
		<p>
			This tutorial explains how you can save any kind of items together in an item collection to save inside Pandora or for exporting as a template.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Welcome to this short tutorial on item collections and saved items!<br />
							This tutorial explores what item collections are, how to create them, and how to save or export them.
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
							Items collections are an ordered selection of item templates, preserving most of the item's configuration, such as colors or custom names and item descriptions.
							Items inside storage modules, and even added locks (in their default configuration) will be included, too. You can add a mix of wearable items, body parts,
							and even room-level items to an item collection from a character's wardrobe or a room inventory.
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
							Find your character in the current tab by its name and click the
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
							You can find the item collections feature behind the button "Saved items" on the right side.<br />
							Press it to proceed.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView .toolbar',
						filter: (e) => e.innerText.includes('Saved items'),
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .div-container .div-container .div-container .Button',
							filter: (e) => e.innerText.includes('Saved items'),
						},
					],
				},
				{
					text: (
						<p>
							This view shows you all item collections stored on your Pandora account. There also is a button at the top to import
							a previously exported item collection template. Let's proceed without doing this now, though.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.inventoryView .Button',
							filter: (e) => e.innerText.includes('Import'),
						},
					],
				},
				{
					text: (
						<p>
							The following steps assume you are wearing some items on your character. Press "Create a new collection".
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.inventoryView .outfitMainButton',
							filter: (e) => e.innerText.includes('Create a new collection'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.inventoryView .toolbar',
					filter: (e) => e.innerText.includes('Temporary collection'),
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
							Switch the temporary collection into edit mode.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView .toolbar',
						filter: (e) => e.innerText.includes('Editing:'),
					}],
					highlight: [
						{
							query: '.inventoryView .wardrobeActionButton',
							filter: (e) => e.innerText.includes('Edit'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								On the right side, you can now see a temporary item collection in edit-mode.
								Like this, you can copy items from your character to the temporary collection by using the new button that appeared on each item.
							</p>
							<p>
								Note that preserving the order is important here if you want to preserve a layered outfit.
								In that case, you want to add items bottom-up, so starting with the lower
								layers first, such as when you would dress a mannequin, starting with the innermost clothes, like the underwear.
							</p>
							<p>
								Feel free to try doing so now.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .wardrobeActionButton[title="Add to collection"]',
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
						<>
							<p>
								After you are done adding items to create an outfit or general collection, you can give the collection a more descriptive name in the
								according text field. Note that you must save the temporary collection or it will be lost when you close Pandora.
								You can either save a limited number of collections directly in your Pandora account to make them available
								to all your characters, or you can export the collection as a template with the according button while it is in edit-mode, like it is right now.
							</p>
							<p>
								Exporting lets you either copy the collection to your clipboard as a code string, or you can save it as a text file alongside a preview image
								of your character wearing the items in the collection. Feel free to share your exported outfits in the #pandora&#8209;templates channel
								on Pandora's Discord with other users.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								<strong>Hint</strong>: A temporary collection is also very useful if you quickly want to duplicate items in a room inventory, such
								as furniture. Just add any item to it and then leave edit mode. Afterwards, simply add the item as many times as you want back
								to the room inventory and discard the collection again - no need to save anything.
							</p>
							<p>
								Moving on, if you do not want to save anything right now, simply go back with the "Back"-Button to the right of the
								"Save collection"-button and the press the "Discard collection" button to go back to the main item collection list afterwards.
							</p>
							<p>
								That said, I recommend that you add a few items right now as a test and then save the collection inside Pandora. Press "Next" when you are done.
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
								In general, to add items from a saved or imported item collection on any character's body or to a room's inventory, open
								the character or inventory on the left pane and go to the "Saved items" view on the right side, as shown before.
							</p>
							<p>
								Then press the desired item collection to expand it (such as then one you created in the previous step),
								so that it shows the ordered list of items in it.
								The order of applying items is important here as well. You want to add the items in the same direction that they
								were copied to the collection, so typically bottom-up.
							</p>
							<p>
								<i>
									Note: If the item collection previews are too small for you or cause lag, you can make them bigger or switch
									them off completely in the interface settings.
									You can also hover the preview image with your mouse to display it in the preview pane of the wardrobe.
								</i>
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
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<>
							<p>
								Saved items work exactly the same way in a room inventory view and allow you to add not only personal items,
								but also room devices to an item collection.
								Storing body parts as part of an item collection also works very similar.
							</p>
							<p>
								Please switch to the "Body" tab.
							</p>
						</>
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
						<>
							<p>
								You can find the familiar item collections user interface behind the tab "Saved items" on the right side.
								Everything else works the same. Body parts can be mixed with other items in a collection or be part of a standalone one.
							</p>
							<p>
								Click the tab to proceed.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Saved items'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Saved items'),
					}],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes the tutorial on saved and exported item templates in the form of item collections.<br />
							To complete this tutorial, exit the wardrobe by clicking the "Back" button in the top-right corner of the screen.
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
