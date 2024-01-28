import React, { ReactElement } from 'react';

export function WikiItems(): ReactElement {
	return (
		<>
			<h2>Items</h2>

			<h3>Introduction</h3>

			<p>
				Items in Pandora are created from assets, which are added to Pandora by artists and asset makers from the community.
				All assets are available from the start to all users, who can freely create customized items based on an asset.<br />
				Almost all items have a customizable color. Some items also have one or more item modules. Aside from general modules, there can
				be a <a href='#IT_Storage_modules'>storage module</a> or <a href='#IT_Lock_module'>lock modules</a> on
				an item, depending on what it is. These features can be accessed in the <a href='/wiki/characters/#CH_Character_wardrobe'>character wardrobe</a> by clicking
				on items.
			</p>
			<p>
				Aside from regular items that can be worn and used by characters, there are also locks, body parts, and room-level items that can freely be placed on a
				room background. Body parts can only exist on a character's body, but except those, items can generally also be inside the storage module of some
				other item or in a <a href='/wiki/spaces/#SP_Room_inventory'>room's inventory</a>, which could be considered the room's floor.<br />
				Lastly, items can be part of an outfit, which is a collection of items that can be stored in Pandora or exported in form of a longer code that can be stored
				outside of Pandora and later be imported again. You can add the same item several times.
			</p>

			<h3>Item-specific features</h3>
			<ul>
				<li><a href='#IT_Body_parts'>Body parts</a></li>
				<li><a href='#IT_Room-level_items'>Room-level items</a></li>
				<li><a href='#IT_Storage_modules'>Storage modules</a></li>
				<li><a href='#IT_Lock_module'>Lock module</a></li>
				<li><a href='#IT_Item_preferences_and_limits'>Item preferences and limits</a></li>
				<li><a href='#IT_Saving_outfits'>Saving outfits</a></li>
				<li><a href='#IT_Item_layering_order'>Item layering order</a></li>
				<li><a href='#IT_Layer_transparency'>Layer transparency</a></li>
				<li><a href='#IT_Alpha_masks'>Alpha masks</a></li>
			</ul>

			<h4 id='IT_Body_parts'>Body parts</h4>
			<p>
				Body parts can only exist on a character's body. Body part types are things like eyes, hair, mouth, or ears.
				Every body part, even the base body itself, is just a texture and there can be different ones made and selected in the future.
				Only the base shape of the body needs to remain the same due to the pose transformations.
			</p>
			<p>
				Some body parts have modules that add expressions under the "Expressions"-tabs. Different items can have different expressions,
				even when they are of the same body part type, e.g. eyes.
			</p>
			<ul>
				<li>Many body part types cannot be removed, only replaced, such as eyes, mouth, or nose.</li>
				<li>Some body parts are optional, such as additional textures like the body marks.</li>
				<li>A few types of body parts (e.g. each hair type) can also be worn multiple times at the same time.</li>
				<li>Some body types can group their color, such as hair or base body, head, and ears, to change them all at once.</li>
				<li>The order of body parts is predetermined and can only be changed in very specific cases, such as different hair styles on top of each other.</li>
			</ul>

			<h4 id='IT_Room-level_items'>Room-level items</h4>
			<p>
				Room-level items, also called room devices, are items that can be freely placed onto the room background and can be customized similar to regular items.
				Room devices persist with the room and some of them can also hold one or more player characters or regular items inside.
				They first need to be created in the <a href='/wiki/spaces/#SP_Room_inventory'>room inventory</a> and then deployed into the room with the according button,
				after clicking on them in the inventory list.
			</p>
			<p>
				To move a deployed item on the room background, you need to enable the room construction mode with the according button in the "Room"-tab.
				While you are in this mode, every room-level item has a red icon below it. Clicking it and selecting "move" will turn the item into a move mode.
				While in move mode, there are here are two icons under the item. You can drag the left one to move the item in all directions over the floor.
				The right icon is used to lift the item up or down (alongside the z-axis) by dragging up or down. Leave the move mode by pressing the red/green button shortly.
			</p>
			<ul>
				<li>Only space admins can color, place, move, and undeploy room device per default.</li>
				<li>Currently, modules of room devices can be changed by anybody. This will be changed in the future.</li>
				<li>Room items with a blue icon below them have character slots. These icons can optionally be hidden under the "Room"-tab.</li>
				<li>All users can interact with the character slots of room devices and use them if not occupied.</li>
				<li>Currently, everyone can put someone else into a room device if they are <a href='/wiki/characters/#CH_Character_permissions'>permitted</a> to.</li>
				<li>Some room devices have <a href='#IT_Lock_module'>lock modules</a> that can for instance prevent a character from getting out of a room device slot.</li>
				<li>You are unable to leave the room while your character occupies a character slot of a room device.</li>
				<li>Room devices can also be stored in an <a href='#IT_Saving_outfits'>outfit template</a>, like regular items.</li>
			</ul>

			<h4 id='IT_Storage_modules'>Storage modules</h4>
			<p>
				After clicking on an item with a storage module in the <a href='/wiki/characters/#CH_Character_wardrobe'>wardrobe</a>, the inventory view of the
				storage module can be opened there.
				You can create and delete items inside a storage module inventory, but you can also transfer it:
			</p>
			<ul>
				<li>Items inside storage modules count towards the maximum allowed items limit on a character or the limit of a room inventory.</li>
				<li>After opening the storage module, you can transfer items from and to the room inventory with the arrow button.</li>
				<li>
					It is possible to add an item from a worn storage container directly onto your own character by going into move-mode with
					the multi-arrow button on the item you want to add, while having the storage module open in
					the <a href='/wiki/characters/#CH_Character_wardrobe'>wardrobe</a>. You then close
					the storage view while in move-mode and add the moved item onto your character.
				</li>
				<li>
					It is also possible to store an item worn on your character directly in a storage item by selecting the item with the storage
					module, but not yet opening it, then putting the item on your character you want to store into move-mode with the multi
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
					even while it was stored somewhere else, e.g. in a <a href='/wiki/spaces/#SP_Room_inventory'>room's inventory</a>, in the meantime.
				</li>
			</ul>

			<h4 id='IT_Item_preferences_and_limits'>Item preferences and limits</h4>
			<p>
				With the "Item Limits"-tab in the <a href='/wiki/characters/#CH_Character_wardrobe'>wardrobe</a>, you can set preferences for individual
				items or groups of similar items, such as limiting them.
				The possible preferences are "Favorite", "Normal", and "Maybe". The possible limits are "Prevent", and "Do not render".
			</p>
			<ul>
				<li>
					Other users can see those preferences in the form of icon-based highlighting when they open
					your <a href='/wiki/characters/#CH_Character_wardrobe'>wardrobe</a> to add some items.
				</li>
				<li>"Prevent" blocks anybody other than yourself to use this item on you.</li>
				<li>"Do not render" will not show you this item on yourself or on other characters, item previews will be blurred in all wardrobes.</li>
				<li>Note that some assets have default limits set to protect new users from more extreme items, such as password locks or heavy ear plugs. You can change this as you see fit.</li>
				<li>The attribute tab is used to set states for every item who has this attribute itself or potentially through some of its possible module states.</li>
				<li>Using attributes to limit groups of items has the benefit of automatically applying to all items with those attributes added in the future of Pandora.</li>
				<li>Setting a limit to an individual item overrides the global state based on attribute-based settings, but this can be reverted in the item-specific dropdown menu.</li>
			</ul>

			<h4 id='IT_Saving_outfits'>Saving outfits</h4>
			<p>
				The "Items" and "Body"-tabs in the <a href='/wiki/characters/#CH_Character_wardrobe'>wardrobe</a> as
				well as the <a href='/wiki/spaces/#SP_Room_inventory'>room inventory</a> screen have an "Outfits"-tab that lets you access and manage all your custom outfits
				stored on the Pandora server. An outfit template can contain normal
				items, <a href='#IT_Room-level_items'>room-level items</a>, body modifications, and even storage items. Therefore,
				an outfit is not related only to clothing, but is basically an item collection.
			</p>
			<ul>
				<li>
					Creating an outfit: After you clicked the button to create a new outfit, you need to start moving the items that you want to be part of the outfit one-by-one
					from the left side (your worn items or the room's inventory) to the right side (the temporary outfit template you just created).<br />
					<a href='#IT_Item_layering_order'>Item order</a> is important and the following article gives tips on that aspect.
				</li>
				<li>
					Storing an outfit: After you have completed your temporary outfit and given it a name, you can either save it on Pandora's server, if you have storage space left
					for your account, or you can export it in the form of a longer code, that can either be copied or downloaded, depending on what your device allows.
				</li>
				<li>Exported outfits can be stored on your device and later on be imported again or you can share the exported code with other users.</li>
				<li>
					Your outfit templates stored inside Pandora show a small live preview. You can increase the size of the previews in the "Interface"-tab of Pandora's settings page
					or even switch them off altogether, if your computer / mobile device and connection cannot handle loading many previews at once.
				</li>
			</ul>

			<h4 id='IT_Item_layering_order'>Item layering order</h4>
			<p>
				Items in Pandora can be ordered (almost) freely: As long as the item's requirements are satisfied, you can combine items in whatever order you want,
				but naturally not every combination will work out and will look good.
			</p>
			<p>
				Note on correct item layering order:<br />
				The layering order of items is that the higher an item is in the <a href='/wiki/characters/#CH_Character_wardrobe'>character wardrobe</a> list,
				the further outwards on the body it is worn.
				So the first item is usually something like a jacket or dress, whereas underwear is further down in the list.
			</p>
			<p>
				You add and remove outfits worn by the character from top to bottom, so from the outermost worn item (e.g. a jacket or dress)
				towards the inner pieces, like how you would undress in reality, too.<br />
				In case you dropped items in that manner to the <a href='/wiki/spaces/#SP_Room_inventory'>room inventory</a>, you can again add them to the body from the top to bottom,
				so from the item worn the closest to the body, like you would start dressing in reality, too.
			</p>
			<p>
				Now when you make an outfit template from something you wear, you need to start from the bottom, not from the top,
				because you are not undressing your character, but you are "dressing" a mannequin template doll by means of copying your outfit.
				So you need to start from the item worn closest to the body, therefore bottom-up.<br />
				When you want to use an outfit template to dress your character, you again need to start from the bottom, as you need to start with the item
				worn closest to the body, like you would start dressing in reality, too.
			</p>
			<p>
				In summary, the general dressing and undressing direction is top-down, but outfit template related directions are the opposite:<br />
				👸🏽 → 🏠&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				🏠 → 👸🏽&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				👸🏽 → 💾&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				💾 → 👸🏽&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				<i>Side note</i>: It also works if you always do it top-down, if that is easier to remember, but then the mannequin template doll shows a preview image with
				reversed item order, which looks weirdly funny.
			</p>

			<h4 id='IT_Layer_transparency'>Layer transparency</h4>
			<p>
				Every item consists of one or more image layers. Often, each layer can be colored differently. Some of them can also have their transparency (alpha value) changed.<br />
				Most asset layers are solid and offer no possibility to make them transparent. However, asset makers can allow transparency for specific layers of their asset. As a
				user you can notice this by the color picker having a fourth slider, the bottom transparency slider.
			</p>
			<ul>
				<li>If there is no transparency slider, the asset maker did likely not intend for this layer to be made transparent.</li>
				<li>If you cannot move the slider all the way to the full transparency side, the asset maker likely defined a minimum alpha value to allow the layer to be invisible.</li>
				<li>The reason this is not universally allowed for every layer is that too many transparency filtered layers onscreen at once hurt the performance for everyone in the room.</li>
			</ul>

			<h4 id='IT_Alpha_masks'>Alpha masks</h4>
			<p>
				Alpha masks are created by asset makers alongside the asset and are more of a hidden feature in the background to make item combinations look nicer and hide for instance
				overlapping edges when two items do not perfectly align. An alpha mask is an invisible shape that hides parts of other items that are below the item with the alpha mask
				in the <a href='/wiki/characters/#CH_Character_wardrobe'>character wardrobe</a> wear order. Currently, not many assets use alpha masks, as the performance impact is too
				high to use them more widely. In case you experience performance issues, especially in rooms with many characters,
				you could try to go the "Graphics"-tab in Pandora's settings and change or disable the alphamasking engine.
			</p>

		</>
	);
}
