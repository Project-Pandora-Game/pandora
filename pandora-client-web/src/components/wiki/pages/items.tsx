import { ReactElement } from 'react';
import { Link } from 'react-router';

export function WikiItems(): ReactElement {
	return (
		<>
			<h2>Items</h2>

			<h3>Introduction</h3>

			<p>
				Items in Pandora are created from assets, which are added to Pandora by artists and asset makers from the community.
				All assets are available from the start to all users, who can freely create customized items based on an asset.<br />
				Almost all items have a customizable color. Some items also have one or more item modules. Aside from general modules, there can
				be a <Link to='#IT_Storage_modules'>storage module</Link> or <Link to='#IT_Lock_module'>lock modules</Link> on
				an item, depending on what it is. These features can be accessed in the <Link to='/wiki/characters#CH_Character_wardrobe'>character wardrobe</Link> by clicking
				on items.<br />
				You can also open a popup with basic info about an item while in the room & chat view, by either clicking on the item name in any server messages in the chat,
				by using the "/inspect" <Link to='/wiki/chat#CHA_Chat_commands'>command</Link>, or by clicking the "pin"-button in the detailed view of an item in the wardrobe at the top.
			</p>
			<p>
				Aside from regular items that can be worn and used by characters, there are also locks, body parts, and room-level items that can freely be placed on a
				room background. Body parts can only exist on a character's body, but except those, items can generally also be inside the storage module of some
				other item or in a <Link to='/wiki/spaces#SP_Room_inventory'>room's inventory</Link>, which could be considered the room's floor.<br />
				Lastly, items can be part of a collection, which is a set of items that can be stored in Pandora or exported in form of a longer code that can be stored
				outside of Pandora and later be imported again. You can add the same item several times.
			</p>

			<h3>Item-specific features</h3>
			<ul>
				<li><Link to='#IT_Body_parts'>Body parts</Link></li>
				<li><Link to='#IT_Room-level_items'>Room-level items</Link></li>
				<li><Link to='#IT_Bound_usage'>Bound usage</Link></li>
				<li><Link to='#IT_Storage_modules'>Storage modules</Link></li>
				<li><Link to='#IT_Lock_module'>Lock module</Link></li>
				<li><Link to='#IT_Item_preferences_and_limits'>Item preferences and limits</Link></li>
				<li><Link to='#IT_Saving_collections'>Saving collections</Link></li>
				<li><Link to='#IT_Item_layering_order'>Item layering order</Link></li>
				<li><Link to='#IT_Layer_transparency'>Layer transparency</Link></li>
				<li><Link to='#IT_Alpha_masks'>Alpha masks</Link></li>
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
				They first need to be created in the <Link to='/wiki/spaces#SP_Room_inventory'>room inventory</Link> and then deployed into the room with the according button,
				after clicking on them in the inventory list.
			</p>
			<p>
				To move a deployed item on the room background, you need to enable the room construction mode with the according button in the "Room"-tab.
				While you are in this mode, every room-level item has a red icon below it. Clicking it and selecting "move" will turn the item into a move mode.
				While in move mode, there are two icons under the item. You can drag the left one to move the item in all directions over the floor.
				The right blue icon is used to lift the item up or down (alongside the z-axis) by dragging up or down. The set value can be reset by
				shortly pressing on the icon again. You can leave the move mode by pressing the red/green button shortly.
			</p>
			<ul>
				<li>Only space admins can color, place, move, and undeploy room device per default.</li>
				<li>Currently, modules of room devices can be changed by anybody. This will be changed in the future.</li>
				<li>Room items with a blue icon below them have character slots. These icons can optionally be hidden under the "Room"-tab.</li>
				<li>All users can interact with the character slots of room devices and use them if not occupied.</li>
				<li>Currently, everyone can put someone else into a room device if they are <Link to='/wiki/characters#CH_Character_permissions'>permitted</Link> to.</li>
				<li>Some room devices have <Link to='#IT_Lock_module'>lock modules</Link> that can for instance prevent a character from getting out of a room device slot.</li>
				<li>You are unable to leave the room or the space while your character occupies a character slot of a room device.</li>
				<li>Room devices can also be stored in a <Link to='#IT_Saving_collections'>saved items collection</Link>, like regular items.</li>
				<li>While a character is inside a slot of a room device, you can see all the item's relevant config options also on the worn part of the device in their wardrobe - so no need to go to the room inventory for that.</li>
				<li>
					Warning: Room devices can get someone stuck in an empty private space, which would make
					using <Link to='/wiki/characters#SA_Safemode'>safemode</Link> the only way out, unless the affected user is permitted to invite someone else to the space.
				</li>
			</ul>

			<h4 id='IT_Bound_usage'>Bound usage</h4>
			<p>
				"Bound usage" is a setting that all wearable items and room-level items have. It can be found near the top of an item's detailed view.
				The setting defines whether the item can be used with restrained/blocked hands or not.
				This allows for a wider variety of roleplaying scenarios more conveniently, such as safe (self-)bondage, switch plays, and escape attempts.
			</p>
			<ul>
				<li>Every item comes with a default that can be changed at item creation time or by anyone with permission afterwards.</li>
				<li>In Pandora's global settings, you can override the default setting for all newly created items to your desired behavior.</li>
				<li>
					When a character with blocked hands tries to use an action on an item that is only possible due to the bound usage setting on that item,
					they will enter an "attempted usage" state that can be seen in the wardrobe and chat by everyone in the room.
					This states lasts indefinitely until the bound user decides to stop the attempt, finishes the action, or someone else interrupts it.
				</li>
				<li>
					When someone else interrupts an attempt, it has no consequence, other than clearing the original message in the chat.
					It is simply a convenient and quick way for someone to show the desire to not allow this attempted action.
				</li>
				<li>Creating or deleting items, and changing this setting on existing items always requires free hands.</li>
				<li>Attempting an action has a (small) delay, before the user can decide to finish it.</li>
			</ul>
			<strong>Important:</strong> This initial delay is not the time it takes to
			succeed with this attempt, as the system cannot know how long it would take to succeed with the action you are attempting in the current scene!
			This fully depends on the style and type of role play and everyone's perception of how long a bound action might take.<br />
			For example, you could roll a dice (with "/dice") to decide if you are successful, you could decide for
			yourself on a time you think might be realistic, or, what might be the most common approach, you simply give your play partner enough time to type out a reaction.

			<h4 id='IT_Storage_modules'>Storage modules</h4>
			<p>
				After clicking on an item with a storage module in the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link>, the inventory view of the
				storage module can be opened there.
				You can create and delete items inside a storage module inventory, but you can also transfer it:
			</p>
			<ul>
				<li>Items inside storage modules count towards the maximum allowed items limit on a character or the limit of a room inventory.</li>
				<li>After opening the storage module, you can transfer items from and to the room inventory with the arrow button.</li>
				<li>
					It is possible to add an item from a worn storage container directly onto your own character by going into move-mode with
					the multi-arrow button on the item you want to add, while having the storage module open in
					the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link>. You then close
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
					even while it was stored somewhere else, e.g. in a <Link to='/wiki/spaces#SP_Room_inventory'>room's inventory</Link>, in the meantime.
				</li>
			</ul>

			<h4 id='IT_Item_preferences_and_limits'>Item preferences and limits</h4>
			<p>
				With the "Item Limits"-tab in the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link>, you can set preferences for individual
				items or groups of similar items, such as limiting them.
				The possible preferences are "Favorite", "Normal", and "Maybe". The possible limits are "Prevent", and "Do not render".
			</p>
			<ul>
				<li>
					Other users can see those preferences in the form of icon-based highlighting when they open
					your <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link> to add some items.
				</li>
				<li>"Prevent" blocks anybody other than yourself to use this item on you.</li>
				<li>"Do not render" will not show you this item on yourself or on other characters, item previews will be blurred in all wardrobes.</li>
				<li>Note that some assets have default limits set to protect new users from more extreme items, such as password locks or heavy ear plugs. You can change this as you see fit.</li>
				<li>The attribute tab is used to set states for every item who has this attribute itself or potentially through some of its possible module states.</li>
				<li>Using attributes to limit groups of items has the benefit of automatically applying to all items with those attributes added in the future of Pandora.</li>
				<li>Setting a limit to an individual item overrides the global state based on attribute-based settings, but this can be reverted in the item-specific dropdown menu.</li>
				<li>Item preferences and limits are not account-wide, so you have to set them for each of your characters individually.</li>
			</ul>

			<h4 id='IT_Saving_collections'>Saving collections</h4>
			<p>
				The "Items" and "Body"-tabs in the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link> as
				well as the <Link to='/wiki/spaces#SP_Room_inventory'>room inventory</Link> screen can open the "Saved items" view on the right pane which lets you access and manage all
				your custom item collections stored on the Pandora server. A collection template can contain normal
				items, <Link to='#IT_Room-level_items'>room-level items</Link>, body parts, and even storage items with items stored inside.
			</p>
			<ul>
				<li>
					Creating a collection: After you clicked the button to create a new collection, you need to start moving the items that you want to be part of the collection one-by-one
					from the left side (your worn items or the room's inventory) to the right side (the temporary collection you just created).<br />
					<Link to='#IT_Item_layering_order'>Item order</Link> is important here. You want to add them to a collection in the same order you would want to put
					them on when dressing - as if you are dressing a mannequin.
					You want to add them to a collection top-down, starting with the bottommost item.
					The following article explains this aspect in more detail.
				</li>
				<li>
					Storing a collection: After you have completed your temporary collection and given it a name, you can either save it on Pandora's server, if you have storage space left
					for your account, or you can export it in the form of a longer code, that can either be copied or downloaded, depending on what your device allows.
				</li>
				<li>Exported collections can be stored on your device and later on be imported again or you can share the exported code with other users.</li>
				<li>
					Collections stored inside Pandora show a small live preview. You can increase the size of the previews in the "Interface"-tab of Pandora's settings page
					or even switch them off altogether, if your computer / mobile device and connection cannot handle loading many previews at once.
				</li>
				<li>
					Note on locks in use: Items with attached locks can be stored in a collection and reapplied with these locks, but the lock state and the lock configuration are intentionally not saved.
				</li>
			</ul>

			<h4 id='IT_Item_layering_order'>Item layering order</h4>
			<p>
				Items in Pandora can be ordered (almost) freely: As long as the item's requirements are satisfied, you can combine items in whatever order you want,
				but naturally not every combination will work out and will look good.
			</p>
			<p>
				Note on correct item layering order:<br />
				The layering order of items is that the higher an item is in the <Link to='/wiki/characters#CH_Character_wardrobe'>character wardrobe</Link> list,
				the further outwards on the body it is worn.
				So the topmost item is usually something like a jacket or dress, whereas underwear is further down in the list.
			</p>
			<p>
				You add and remove items worn by the character from top to bottom, so from the outermost worn item (e.g. a jacket or dress)
				towards the inner pieces, like how you would undress in reality, too.<br />
				In case you dropped items in that manner to the <Link to='/wiki/spaces#SP_Room_inventory'>room inventory</Link> or a storage module, you can again add them to the body
				from the top to bottom, so from the item worn the closest to the body, like you would start dressing in reality, too.
			</p>
			<p>
				Now when you make a saved item collection from something you wear, you need to start from the bottom, not from the top,
				because you are not undressing your character, but you are "dressing" a mannequin template doll by means of copying your outfit.
				So you need to start from the item worn closest to the body, therefore bottom-up.<br />
				When you want to use a saved item collection to dress your character, you again need to start from the bottom, as you need to start with the item
				worn closest to the body, like you would start dressing in reality, too.
			</p>
			<p>
				In summary, the general dressing and undressing direction is top-down, but saved item collection related directions are the opposite:<br />
				🧑 → 🏠&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				🏠 → 🧑&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				🧑 → 💾&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				💾 → 🧑&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				<i>Side note</i>: It also works if you always do it bottom-up, if that is easier to remember, as the order to remove items does not matter, as long as you add these items back in the same order as well.
			</p>

			<h4 id='IT_Layer_transparency'>Layer transparency</h4>
			<p>
				Every item consists of one or more image layers. Often, each layer can be colored differently. Some of them can also have their transparency (alpha value) changed.<br />
				Most asset layers are solid and offer no possibility to make them transparent. However, asset makers can allow transparency for specific layers of their asset. As a
				user you can notice this by the color picker having a fourth slider, the bottom transparency slider.
			</p>
			<ul>
				<li>If there is no transparency slider, the asset maker did likely not intend for this layer to be made transparent.</li>
				<li>If you cannot move the slider all the way to the full transparency side, the asset maker likely defined a minimum alpha value to prevent the layer from becoming fully invisible.</li>
				<li>The reason this is not universally allowed for every layer is that too many transparency filtered layers onscreen at once hurt the performance for everyone in the room.</li>
			</ul>

			<h4 id='IT_Alpha_masks'>Alpha masks</h4>
			<p>
				Alpha masks are created by asset makers alongside the asset and are more of a hidden feature in the background to make item combinations look nicer and hide for instance
				overlapping edges when two items do not perfectly align. An alpha mask is an invisible shape that hides parts of other items that are below the item with the alpha mask
				in the <Link to='/wiki/characters#CH_Character_wardrobe'>character wardrobe</Link> wear order. Currently, not many assets use alpha masks, as the performance impact is too
				high to use them more widely. In case you experience performance issues, especially in rooms with many characters,
				you could try to go the "Graphics"-tab in Pandora's settings and change or disable the alphamasking engine.
			</p>

		</>
	);
}
