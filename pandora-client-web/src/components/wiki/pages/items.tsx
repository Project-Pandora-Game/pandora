import React, { ReactElement } from 'react';

export function WikiItems(): ReactElement {
	return (
		<>
			<h2>Items</h2>

			<h3>Introduction</h3>

			<p>
				Items in Pandora are created from asset templates. Every character has access to all assets from the start and can freely create
				customized copies in the form of items.<br />
				Almost all items have a customizable color. Some items also have one or more item modules. Aside from general modules, there can
				be a storage module or lock modules on an item, depending on what it is. These features can be accessed in the wardrobe by clicking
				on items.
			</p>
			<p>
				Aside from regular items that can be worn and used by characters, there are also locks, body items, and room-level items that can freely be placed on a
				room background. Body items can only be worn on a character's body and some cannot be removed, only replaced.
				A few types of body items (e.g. hair) can also be worn multiple times at the same time.
				Aside from body items, items can generally also exist inside the storage module of some other item or in a room's inventory, which could
				for instance be considered the room's floor.<br />
				Lastly, items can be part of an outfit, which is a collection of items that can be stored, or exported.
			</p>

			<h3>Item-specific features</h3>
			<ul>
				{
					// <li><a href='#IT_'></a></li>
				}
				<li><a href='#IT_Storage_modules'>Storage modules</a></li>
				<li><a href='#IT_Lock_module'>Lock module</a></li>
				<li><a href='#IT_Room-level_items'>Room-level items</a></li>
				<li><a href='#IT_Item_preferences_and_limits'>Item preferences and limits</a></li>
			</ul>

			<h4 id='IT_'>Feature name</h4>
			<p>
				Text block 1<br />
				Text block 2
			</p>
			<ul>
				<li>Subfeature 1</li>
				<li>Subfeature 2</li>
				<li>Subfeature 3</li>
			</ul>

			<h4 id='IT_Storage_modules'>Storage modules</h4>
			<p>
				After clicking on an item with a storage module in the wardrobe, the inventory view of the storage module can be opened there.
				You can create and delete items inside a storage module inventory, but you can also transfer it:
			</p>
			<ul>
				<li>Items inside storage modules count towards the maximum allowed items limit on a character or for a room inventory.</li>
				<li>After opening the storage module, you can transfer items from and to the room inventory with the arrow button.</li>
				<li>
					It is possible to add an item from a worn storage container directly onto your own character by going into move-mode with
					the multi-arrow button on the item you want to add, while having the storage module open in the wardrobe. You then close
					the storage view while in move-mode and add the moved item onto your character.
				</li>
				<li>
					It is also possible to store an item worn on your character directly in a storage item by selecting the item with the storage
					module asset, but not yet opening it, then putting the item on your character you want to store into move-mode with the multi
					arrow and then opening the storage module's inventory and then dropping the currently moving item there.
				</li>
			</ul>

			<h4 id='IT_Lock_module'>Lock module</h4>
			<p>
				Many restraining and some clothing type of items show one or even several lock modules in the item's edit view, after clicking on it.<br />
				These modules typically either prevent the item from being removed or prevent some module of the item from being used or changed.
				The module can store a single lock-type item inside it, that is unlocked when you add the lock initially.
			</p>
			<ul>
				<li>A lock must be locked explicitly for the effect of the lock slot to take effect.</li>
				<li>Dummy locks can always be unlocked by anybody.</li>
				<li>Exclusive locks can be unlocked by anybody but the wearer of the locked item.</li>
				<li>
					Combination and password locks store the last used input value which can be knowingly or blindly used to lock the lock again later,
					even while it was stored somewhere else, e.g. in a room's inventory, in the meantime.
				</li>
			</ul>

			<h4 id='IT_Item_preferences_and_limits'>Item preferences and limits</h4>
			<p>
				With the "Item Limits"-tab in the wardrobe, you can set preferences for individual items or groups of similar items, such as limiting them.
				The possible preferences are "Favorite", "Normal", and "Maybe". The possible limits are "Prevent", and "Do not render".
			</p>
			<ul>
				<li>Other users can see those preferences in the form of icon-based highlighting when they open your wardrobe to add some items.</li>
				<li>"Prevent" blocks anybody other than yourself to use this item on you.</li>
				<li>"Do not render" will not show you this item on yourself or on other characters, item previews will be blurred in all wardrobes.</li>
				<li>The attribute tab is used to set states for every item who has this attribute itself or potentially through some of its possible module states.</li>
				<li>Using attributes to limit groups of items has the benefit of automatically applying to all items with those attributes added in the future of Pandora.</li>
				<li>Setting a limit to an individual item overrides the global state based on attribute-based settings, but this can be reverted in the item-specific dropdown menu.</li>
			</ul>

			<h4 id='IT_Room-level_items'>Room-level items</h4>
			<p>
				Room-level items, also called room devices, are items that can be freely placed onto the room background and can be customized similar to regular items.<br />
				They first need to be created in the room inventory and then deployed into the room with the according button, after clicking on them in the inventory list.
				Room devices persist with the room and some of them can also hold one or more player characters or regular items inside.
			</p>
			<ul>
				<li>Only space admins can color, place, move, and undeploy room device per default.</li>
				<li>Currently, modules of room devices can be changed by anybody. This will be changed in the future.</li>
				<li>Room items with a blue icon below them have character slots. These icons can optionally be hidden under the "Room"-tab.</li>
				<li>All users can interact with the character slots of room devices and use them if not occupied.</li>
				<li>Currently, everyone can put someone else into a room device if they are permitted to.</li>
				<li>Some room devices have lock modules that can for instance prevent a character from getting out of a room device slot.</li>
				<li>You are unable to leave the room while your character occupies a character slot of a room device.</li>
				<li>Room devices can also be stored in an outfit template, like regular items.</li>
			</ul>

		</>
	);
}
