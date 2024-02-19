import React, { ReactElement } from 'react';

export function WikiCharacters(): ReactElement {
	return (
		<>
			<h2>Characters</h2>

			<h3>Introduction</h3>

			<p>
				An account in Pandora allows you to create a limited amount of characters (typically 5). You cannot rename or delete a character.
				Deleting a character of yours will be added in the future.<br />
				Characters can assume a large number of different poses and can turn around. You can expand the manual pose section of
				the "Poses"-tab to assume custom poses.
			</p>
			<p>
				Every character has their
				own <a href='/wiki/spaces/#SP_Personal_space'>personal space</a>, <a href='/wiki/items/#IT_Item_preferences_and_limits'>item preferences and limits</a>,
				and they can have items and different <a href='/wiki/items/#IT_Body_parts'>body parts</a> added onto the character.
			</p>

			<h3>Character-specific features</h3>
			<ul>
				<li><a href='#CH_Character_immersion'>Character immersion effects</a></li>
				<li><a href='#CH_Character_movement'>Character movement</a></li>
				<li><a href='#CH_Character_context_menu'>Character context menu</a></li>
				<li><a href='#CH_Character_wardrobe'>Character wardrobe</a></li>
				<li><a href='#CH_Character_permissions'>Character permissions</a></li>
			</ul>

			<h4 id='CH_Character_immersion'>Character immersion effects</h4>
			<p>
				Items in Pandora can put certain immersion enhancing effects on a character. Restraints...
			</p>
			<ul>
				<li>can prevent you from interacting with items, by blocking your hand usage.</li>
				<li>can prevent you from moving around and/or leaving the current room (for example <a href='/wiki/items/#IT_Room-level_items'>room devices</a>).</li>
				<li>with a seeing impairment effect will darken your view of the room partially or completely.</li>
				<li>with a speech impairment effect will muffle your normal and whisper messages so that others have a hard time making sense out of them.</li>
				<li>with a hearing impairment will muffle the messages you receive so that you have a hard time making sense out of them.</li>
			</ul>
			<p>
				Items with such effects cannot just be used as a cosmetic to make your character look nice. They come with consistent experiences
				and affect characters in predictable ways - the effects on them cannot be altered, ignored or bypassed.
				That way everyone can easily predict what effects items have on the person wearing them.
				If you dislike any of these effects, such as seeing a fully black room view with certain heavy blindfolds, you
				can simply <a href='/wiki/items/#IT_Item_preferences_and_limits'>block according items.</a>
				Note that items come with different strength levels of such effects. For example items with lighter levels of
				speech impairments might still be mostly understandable.
			</p>
			<p>
				Note on roleplaying with communication impairments:<br />
				While in a scene, someone may be of the view that not being able to understand speech is a problem in terms of making
				decisions on how to follow-up with the current play. They may want a way to understand "gag-talk" to feel more safe and confident.
				It is however the purpose of a gag to prevent exactly that.
				All users can expect that in Pandora muffled speech cannot be assumed as understandable. It is a consistent experience for all users.
				If you want someone to be understandable despite a gag, using gags with a light effect can be an option, too.<br />
				Moreover, when the play partner supports the scene well, it is also not necessary to understand "gag-talk" to feel on top of things.
				Users with gag effects on their character may want to
				describe and convey important non-verbal communication towards the play partner in the
				form of <a href='/wiki/items/#SP_Room_chat_Chat_modes'>emotes</a>.
				This can be describing things the play partner could notice, such as discomfort, the state of the own body, or a hint towards
				what the muffled sentence likely meant from the tone and strength of the voice. A good roleplaying scene relies on all parties
				to describe the scene in detail.
			</p>

			<h4 id='CH_Character_movement'>Character movement</h4>
			<p>
				You can move your character over the canvas by dragging the name under it. Space admins can also move other characters inside their rooms.
				When you move next to a <a href='/wiki/items/#IT_Room-level_items'>room device</a> and interact with the blue icon under it, you can enter
				a character slot of the device, if it has one.
			</p>
			<ul>
				<li>If you have problems dragging the name because it is too small, you can zoom in with mouse wheel or pinch-to-zoom gesture.</li>
				<li>Items can prevent character movement.</li>
				<li>
					The "Character Y Offset" value inside the "Pose"-tab can shift your character upwards and downwards alongside the z-axis
					without changing your character's relative size in an unrealistic way.
				</li>
				<li>Characters can also rotate by up to 360 degrees under the "Pose"-tab.</li>
			</ul>

			<h4 id='CH_Character_context_menu'>Character context menu</h4>
			<p>
				You can open a context-specific character menu by clicking on the name below a character inside the room.
				While characters are inside a <a href='/wiki/items/#IT_Room-level_items'>room-level item</a>, their name
				is not visible currently. You can still open the context menu by opening the room item's context
				menu, opening the slot the character is inside, and then clicking on the character name.<br />
				The character context menu has different features depending on whom it is opened on.
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
				There also is a button in the <a href='/wiki/spaces/#SP_Room_inventory'>room inventory</a>.
			</p>
			<ul>
				<li>The "Randomization"-tab lets you change to a randomized appearance</li>
				<li>The "Body"-tab allows you to change your character's body, but only if the space you are in allows that.</li>
				<li>
					The "Items"-tab shows has the section with the item on your body on the left and shows
					what is inside the <a href='/wiki/spaces/#SP_Room_inventory'>room inventory</a> on the right.
					You can create and wear a new item under the "create new item"-tab there.
				</li>
				<li>There is a maximum amount of items your character can wear or hold (also counting all items inside worn storage items)</li>
			</ul>

			<h4 id='CH_Character_permissions'>Character permissions</h4>
			<p>
				The settings on what other characters are allowed to do to your character can be found in the
				"Permissions"-tab of the Pandora settings. Permissions are character-specific and not
				account-wide. Each permission has a different default setting,
				so it is recommended to familiarize yourself with those and to adjust those settings to how you want them.<br />
				The general settings a permission can possibly be set to are "yes", "no", and "prompt".
				"Prompt" will show you a confirmation popup when someone tries to interact with you, but is missing one or more
				permissions that are set to "prompt". You can then decide to ...
			</p>
			<ul>
				<li>
					... add permanent exceptions for the requesting character for every permission individually in the popup, either
					allowing and denying that character all further uses of each permission from now on
				</li>
				<li>... allow all, which sets all mentioned permissions with no exceptions defined for the requesting character to "yes" just for the requester</li>
				<li>... dismiss the popup, which is akin to not taking any decision at this point in time and leave things as they are.</li>
			</ul>
			<p>
				Note that the interaction that was leading to the prompt has to be repeated again after permission was granted. The server
				currently does not queue them as a part of this feature.<br />
				You can edit each permission in the "Permissions"-tab and also manually add and remove character ids from the lists of exceptions.
				There is a limit for the amount of character-specific permission exceptions a user can add and an according indicator in the user interface.
			</p>
			<p>
				The basic group of permissions are the "interaction permissions". The very first permission to interact
				with your character is the "master-permission" gating all other permissions. If someone does not have that permission, they
				can do nothing, even if they have another permission for the specific interaction they want to do.<br />
				Please be aware that this central permission to interact with your character at all has a default value of "prompt",
				making new, unknown characters unable to add/remove restraints or do other things to the own character without asking
				once during the first interaction. It is not possible to change it universally to "yes" for various reasons.
			</p>
			<p>
				The "item limits" group of permissions relate to items you flagged with a star or question mark under
				the <a href='/wiki/items/#IT_Item_preferences_and_limits'>"item limits"</a>-tab
				of your wardrobe. These permissions are layered and depend upon each other:
				To use items flagged as "maybe", the other character needs to also be permitted to use "favorite" and "normal" items.
			</p>

		</>
	);
}
