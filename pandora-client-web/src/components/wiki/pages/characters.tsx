import React, { ReactElement } from 'react';

export function WikiCharacters(): ReactElement {
	return (
		<>
			<h2>Characters</h2>

			<h3>Introduction</h3>

			<p>
				An account in Pandora allows you to create a limited amount of characters (currently 5). You cannot rename or delete a character.
				Deleting a character of yours will be added in the future.<br />
				Characters can assume a large number of different poses and can turn around. You can expand the manual pose section of
				the "Poses"-tab to assume custom poses.
			</p>
			<p>
				Every character has their own
				<a href='/wiki/items/#RO_Personal_space'>personal space</a>, <a href='/wiki/items/#IT_Item_preferences_and_limits'>item preferences and limits</a>,
				and they can have items and different <a href='/wiki/items/#IT_Body_parts'>body parts</a> added onto the character.
			</p>

			<h3>Character-specific features</h3>
			<ul>
				<li><a href='#CH_Character_movement'>Character movement</a></li>
				<li><a href='#CH_Character_context_menu'>Character context menu</a></li>
				<li><a href='#CH_Character_wardrobe'>Character wardrobe</a></li>
				<li><a href='#CH_Character_permissions'>Character permissions</a></li>
			</ul>

			<h4 id='CH_Character_movement'>Character movement</h4>
			<p>
				You can move your character over the canvas by dragging the name under it. Space admins can also move other characters inside their rooms.
				When you move next to a <a href='/wiki/items/#IT_Room-level_items'>room device</a> and interact with the blue icon under it, you can enter
				a character slot of the device, if it has one.
			</p>
			<ul>
				<li>If you have problems dragging the name because it is too small, you can zoom in with mouse wheel or pinch-to-zoom gesture.</li>
				<li>Items can prevent or slow down character movement.</li>
				<li>
					The "Character Y Offset" value inside the "Pose"-tab can shift your character upwards and downwards alongside the z-axis
					without changing your character's relative size in an unrealistic way.
				</li>
				<li>Characters can also rotate by up to 360 degrees under the "Pose"-tab.</li>
			</ul>

			<h4 id='CH_Character_context_menu'>Character context menu</h4>
			<p>
				You can open a context-specific character menu by clicking on the name below a character inside the room.<br />
				This menu has different features depending on whom it is opened on.
			</p>
			<ul>
				<li>You can use it to quickly open your or another character's profile or wardrobe.</li>
				<li>You can directly write the user behind another character a direct message, even while the character is offline.</li>
				<li>There is an "Admin" sub-menu when you are an owner or admin in a space.</li>
				<li>
					The "Contacts" sub-menu lets you block another account or request adding the account to your contact list to see their online status and to
					see what characters another account is currently using. The other user is notified of your request to add them and can accept or decline.
				</li>
			</ul>

			<h4 id='CH_Character_wardrobe'>Character wardrobe</h4>
			<p>
				You can enter the wardrobe under the "Room"-tab or by opening the character context menu.
				There also is a button in the <a href='/wiki/items/#RO_Room_inventory'>room inventory</a>.
			</p>
			<ul>
				<li>The "Randomization"-tab lets you change to a randomized appearance</li>
				<li>The "Body"-tab allows you to change your character's body, but only if the space you are in allows that.</li>
				<li>
					The "Items"-tab shows has the section with the item on your body on the left and shows
					what is inside the <a href='/wiki/items/#RO_Room_inventory'>room inventory</a> on the right.
					You can create and wear a new item under the "create new item"-tab there.
				</li>
			</ul>

			<h4 id='CH_Character_permissions'>Character permissions</h4>
			<p>
				Permissions towards what other characters are allowed to do to your character are character-specific and can be found in the
				"Permissions"-tab of the Pandora settings. Each permission has a different default setting,
				so it is recommended to familiarize yourself with those and to adjust those settings to how you want them.
			</p>

		</>
	);
}
