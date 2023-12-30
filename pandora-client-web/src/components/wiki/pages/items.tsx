import React, { ReactElement } from 'react';

export function WikiItems(): ReactElement {
	return (
		<>
			<h2>Items</h2>

			<h3>Introduction</h3>

			<p>
				Text block 1<br />
				Text block 2
			</p>

			<h3>Item-specific features</h3>
			<ul>
				{
					// <li><a href='#IT_'></a></li>
				}
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

			<h4 id='IT_Item_preferences_and_limits'>Item preferences and limits</h4>
			<p>
				You can set set preferences for individual items or groups of similar items or limit them with the "Item Limits"-tab in the wardrobe.
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
				They first need to be created in the room inventory and then deployed into the room with the according button.
				Room devices persist with the room and some of them can also hold one or more characters and regular items inside.
			</p>
			<ul>
				<li>Only room admins can place, move, and undeploy room device per default.</li>
				<li>Currently, most other properties of a room device can be changed by anybody. This will be changed in the future.</li>
				<li>Room items with a blue icon below them have character slots. These icons can be hidden under the "Room"-tab.</li>
				<li>Everyone can interact with the character slots of room devices and use them if not occupied.</li>
				<li>Currently, everyone can put someone else into a room device if they are permitted to.</li>
				<li>Some room devices have lock modules that can for instance prevent a character from getting out of a room device slot.</li>
				<li>You are unable to leave the room while your character occupies a character slot of a room device.</li>
				<li>Room devices can also be stored in an outfit template, like regular items.</li>
			</ul>

		</>
	);
}
