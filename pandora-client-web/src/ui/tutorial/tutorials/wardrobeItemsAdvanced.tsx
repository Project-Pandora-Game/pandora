import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_WARDROBE_ITEMS_ADVANCED: TutorialConfig = {
	id: 'wardrobeItemsAdvanced',
	name: `Advanced Item Topics`,
	description: (
		<p>
			This tutorial will teach you about further item-related topics, such as the room inventory, storage items,
			locks, and item preferences.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Welcome to the tutorial on advanced topics related to items!<br />
							In this tutorial you will learn what storage items are and how to move other items inside.
							You will learn about items that can be locked, the locks themselves, and where to configure your item preferences and limits.
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
								Items can exist in two places in Pandora. As part of what a character carries around / wears or as part of a
								room's inventory.<br />
								Every room in a space has its own separate room inventory with its own limit of how many items it can contain.
								The room inventory can be considered the floor of the room, including any furniture of the room itself and all
								storage possibilities the room offers, such as furniture that can store items (more on items with storage modules later).
							</p>
							<p>
								Items in Room inventories can be accessed from every room in a space by admins of the space, but normal users can only
								access the inventory of the room current inside and of any directly neighboring room with a path to it.
							</p>
						</>
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
							To proceed, use the shortcut to quickly go to your wardrobe.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.Header .leftHeader > button[title="Go to wardrobe"]',
							inset: true,
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
					text: <p>Please switch back to your wardrobe.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Next, use the shortcut to switch from the wardrobe to the room inventory, which opens it in the left pane.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Switch to current room'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: /^\/wardrobe\/room\//,
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<>
							<p>
								The left side of your room inventory looks and works quite similar to a character wardrobe. The right pane also has the same familiar buttons.
								Let's use this opportunity to talk about items with storage modules, meaning items that can contain a certain number of smaller items.
							</p>
							<p>
								To proceed, select "Create new item" on the right.
							</p>
						</>
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
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<p>
							For the current tutorial, we are interested in creating a storage item.<br />
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
						<>
							<p>
								In this view on the right, you can search for specific items to add or swap for.
								You can filter for any items either with the text field at the top or any of the buttons below. Feel free to hover over
								the buttons (or hold down on it, if using a touchscreen) to see more info.
							</p>
							<p>
								For the sake of this tutorial, please search for a "Shoulder Bag" by either using the "View all assets" button
								or by searching for the item directly by typing in a part of the item's name into the text field at the top.
							</p>
							<p>
								To proceed to the next step, select the Shoulder Bag by clicking on its name in the list.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Creating item: Shoulder Bag'),
					}],
					highlight: [
						{
							query: '.inventoryView.wardrobeAssetList .toolbar .filter',
						},
						{
							query: '.inventoryView.wardrobeAssetList button',
							filter: (e) => e.innerText.includes('View all assets'),
						},
						{
							query: '.wardrobeAssetList .inventoryViewItem',
							filter: (e) => e.innerText.includes('Shoulder Bag'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<p>
							Please find and select a new "Shoulder Bag" item to create.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Creating item: Shoulder Bag'),
					}],
					highlight: [{
						query: '.wardrobeAssetList .inventoryViewItem',
						filter: (e) => e.innerText.includes('Shoulder Bag'),
					}],
				},
				{
					text: (
						<>
							<p>
								The right pane now changed to the already familiar item creation view, where you can configure various aspects of the item before creating it.
								Different items have widely different modules displayed here, though.
							</p>
							<p>
								For instance, as this an item that can store other items, you can see a module that not all items have. It is the storage module
								that lets you open the item's contents with a button after you created it. Let's do that now.<br />
								Click on the position where you want to create the item in the room inventory list to finalize creating the item.
							</p>
						</>
					),
					conditions: [
						{
							type: 'elementQuery',
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Shoulder Bag'),
						},
						{
							type: 'elementQuery',
							query: '.inventoryView',
							filter: (e) => e.innerText.includes('Creating item: Shoulder Bag'),
							expectNoMatch: true,
						},
					],
					highlight: [
						{
							query: '.wardrobeActionButton',
							filter: (e) => e.innerText.includes('Create item here'),
						},
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes(' contents'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
					filter: (e) => e.innerText.includes('Shoulder Bag'),
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<>
							<p>
								There is a second, more convenient option to access the contents of a storage item, besides the button on the module itself in the item's details when clicking on it.
								It is the highlighted storage button in the left pane. Please click it to expand the item's storage directly in the list.
							</p>
							<p>
								Opened like this, you can now create other items directly in the expanded section of the shoulder bag, which stores them inside.
								You can also move other items from the left or right pane like this into the storage section of the bag with the 4 directional movement button to the right of any item.
								Of course back out again the same way.
								Note that the item must be smaller in size to fit into a storage item. So if you cannot move an item inside, it is likely too large to fit, or
								the storage item might be too full, as there only is a limited amount of space.
							</p>
							<p>
								Room level-items can also have storage modules, for instance chests, or even cages, where the storage module represents the floor inside the cage.
								Naturally, you can also storage smaller storage items in larger ones.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem .wardrobeActionButton[title="View contents"]',
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<p>
							To proceed, please click on the Shoulder Bag you created in the room inventory.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem.selected',
						filter: (e) => e.innerText.includes('Shoulder Bag'),
					}],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView .inventoryViewItem',
							filter: (e) => e.innerText.includes('Shoulder Bag'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<p>
							The menu that appeared on the right shows all the configuration options of this item.
							Many items have one or more modules with a lock slot. This shoulder bag also has such a lock module to secure its contents.
							Press on the lock slot button inside the highlighted module to proceed.
						</p>
					),
					conditions: [
						{
							type: 'elementQuery',
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView > .toolbar',
							filter: (e) => e.innerText.includes('Viewing contents of:'),
						},
					],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes(' lock'),
						},
					],
				},
				{
					text: (
						<p>
							Now press "Create new item" to show all available types of locks that can be inserted into the lock slot.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobeAssetList .toolbar',
						filter: (e) => e.innerText.includes('Create and use a new item'),
					}],
					highlight: [{
						query: '.wardrobe-pane > .wardrobe-ui > .div-container .div-container .div-container .Button',
						filter: (e) => e.innerText.includes('Create new'),
					}],
				},
				{
					text: (
						<>
							<p>
								The right side now shows all lock types in Pandora. You likely see small colored icons on the right of a lock entry.
								These indicate your set item preferences and limits to other users.
							</p>
							<p>
								A yellow star would mean it is a favorite item of yours, no icon means the item preference is "Normal", and the
								orange question mark that you can likely see as as a default for some of the locks represents the item preference "Maybe".
								It tells other users that you are not sure about this item and that they should be careful or ask.
							</p>
							<p>
								All three item preferences have an individually configurable permission setting and the one for the item preference "Maybe" is
								by default set to prompt a permission request dialog when the item/lock is attempted to be used.
							</p>
							<p>
								The red cross icon represents the item limit "Prevent". It means that no one other than you can add this item on your character.
								Some locks have this by default as they have a big impact as other characters cannot typically help removing them.
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
					text: <p>Please switch back to the room inventory screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe\/room\//,
					}],
				},
				{
					text: (
						<>
							<p>
								Let's go over some of the lock types available:
							</p>
							<ul>
								<li>
									The <strong>dummy lock</strong> is a lock that can be opened by anyone with free hands or through a bound usage attempt, if possible and permitted.
								</li>
								<li>
									The <strong>exclusive lock</strong> can be removed by all permitted characters, except the character it is used on.
								</li>
								<li>
									<strong>Timer locks</strong> come with different maximum settable times and they can only be unlocked earlier by the character locking it.
									There is an option, though, that no one can unlock the lock before the timer runs down, which makes the lock type quite strict.
									Therefore, lower maximum timer locks have the default item preference "Maybe" to ensure there is an extra prompt for consent,
									while the long timers are not enabled by default.
								</li>
								<li>
									<strong>Combination locks</strong> and <strong>password locks</strong> are very similar. Combination locks only allow entering numbers, the normal one four digits and
									the easy one three. Password locks allow setting a password with up to 8 letters or numbers.<br />
									You do not need to remember what you entered, as the character locking the lock with a new code/password can view it again at any time.
									There is also an option to blindly reuse the last set code/password without being able to see what it was. But then you cannot
									use the "Show" button to see the code/password as you did not enter it yourself, before locking.
								</li>
								<li>
									Lastly, a <strong>fingerprint lock</strong> can only be locked after registering one or more characters that can open it.
								</li>
							</ul>
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								Let's proceed to the last part of this tutorial, which is about configuring your character's item preferences and limits.
							</p>
							<p>
								Close the lock slot or add a lock to it to proceed.
							</p>
						</>
					),
					conditions: [
						{
							type: 'elementQuery',
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView > .toolbar',
							filter: (e) => e.innerText.includes('Viewing contents of:'),
							expectNoMatch: true,
						},
					],
					highlight: [
						{
							query: '.wardrobe-pane > .wardrobe-ui > .inventoryView > .toolbar .Button',
							filter: (e) => e.innerText.includes('Close'),
						},
					],
				},
				{
					text: (
						<p>
							Next, use the shortcut to switch from the room inventory to your character's wardrobe.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Switch to your wardrobe'),
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
					text: <p>Please switch to the "Item Limits" tab at the top.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Item Limits'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Item Limits'),
					}],
				},
				{
					text: (
						<>
							<p>
								This is the screen where you can change your item preferences and limits.
								They are not account-wide to have more flexibility, so you can set them for each of your characters individually.
							</p>
							<p>
								There are two tabs on top of the left pane: Attributes and Items.<br />
								While the former lets you set preferences or limits for all items with a specific attribute at once, the latter tab
								lets you set it for specific items individually, which overrules any attribute based settings.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.wardrobe-pane .tab',
							filter: (e) => e.innerText.includes('Attributes'),
							inset: true,
						},
						{
							query: '.wardrobe-pane .tab',
							filter: (e) => e.innerText.includes('Items'),
							inset: true,
						},
					],
				},
				{
					text: (
						<>
							<p>
								For the sake of this tutorial, please search for a "Hearing restraint" attribute by either searching for the entry in the left list
								or by typing the in a part of this attribute into the text field at the top.
							</p>
							<p>
								To proceed to the next step, select the "Hearing restraint" attribute.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.toolbar',
						filter: (e) => e.innerText.includes('Hearing restraint'),
					}],
					highlight: [
						{
							query: '.tab-container .toolbar .filter',
						},
						{
							query: '.tab-container .inventoryViewItem',
							filter: (e) => e.innerText.includes('Hearing restraint'),
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
					text: <p>Please switch back to the "Item Limits" tab</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Item Limits'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Item Limits'),
					}],
				},
				{
					text: (
						<p>
							Please find and select the "Hearing restraint" attribute.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Hearing restraint'),
					}],
					highlight: [{
						query: '.wardrobeAssetList .inventoryViewItem',
						filter: (e) => e.innerText.includes('Hearing restraint'),
					}],
				},
				{
					text: (
						<>
							<p>
								The view on the right now shows a list of all items that have this attribute and you can see their
								current configuration based on the icon on the right.
							</p>
							<ul>
								<li>
									Yellow star icon for item preference "Favorite" - no items are in this preference category by default
								</li>
								<li>
									No icon for item preference "Normal" - almost all items are in this preference category by default
								</li>
								<li>
									Orange question mark for item preference "Maybe" - the default permission for this category leads to a popup for consent when others try to use the item on you
								</li>
								<li>
									Red cross for item limit "Prevent" - only you can add items in this preference category on yourself
								</li>
								<li>
									Black cross on a red circle for item limit "Do not render" - this setting does not show you the item when it is worn on yourself or others, nor the wardrobe preview/icon
								</li>
							</ul>
						</>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<>
							<p>
								You can change the default setting for an attribute or item with the drop-down selector on the top as desired.
								For individual items, the default is in almost all cases set to "Based on attributes". In case changing an attribute did not have the desired
								effect on all the items with the attribute, consider selecting a specific item and changing it for that item individually.
							</p>
							<p>
								The benefit of setting preferences or limits via attributes is that when new assets with these attributes are released, they will be
								categorized as you desire it automatically, unless they are considered strict and have a more careful default setting.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView .div-container',
						filter: (e) => e.innerText.includes('Attribute preference:'),
						inset: true,
					}],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes the tutorial on storage modules, lock modules, lock types, and item preferences & limits.<br />
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
