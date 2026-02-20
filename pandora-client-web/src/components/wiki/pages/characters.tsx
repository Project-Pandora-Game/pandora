import { LIMIT_CHARACTER_COUNT } from 'pandora-common';
import { ReactElement } from 'react';
import { Link } from 'react-router';
import { ExternalLink } from '../../common/link/externalLink.tsx';

export function WikiCharacters(): ReactElement {
	return (
		<>
			<h2>Characters</h2>

			<h3>Introduction</h3>

			<p>
				An account in Pandora allows you to create a limited amount of characters (currently { LIMIT_CHARACTER_COUNT }).
				You cannot rename a character or give it a nickname currently.<br />
				Characters can assume a large number of different poses and can turn around. You can expand the manual pose section of
				the "Pose"-tab to assume custom poses.
			</p>
			<p>
				Every character has their
				own <Link to='/wiki/spaces#SP_Personal_space'>personal space</Link>, <Link to='/wiki/items#IT_Item_preferences_and_limits'>item preferences and limits</Link>,
				and they can have items and different <Link to='/wiki/items#IT_Body_parts'>body parts</Link> added onto the character.
			</p>

			<h3>Character-specific features</h3>
			<ul>
				<li><Link to='#CH_Character_immersion'>Character immersion effects</Link></li>
				<li><Link to='#CH_Character_movement'>Character movement</Link></li>
				<li><Link to='#CH_Character_posing'>Character posing</Link></li>
				<li><Link to='#CH_Character_context_menu'>Character context menu</Link></li>
				<li><Link to='#CH_Character_wardrobe'>Character wardrobe</Link></li>
				<li><Link to='#CH_Character_permissions'>Character permissions</Link></li>
				<li><Link to='#CH_Character_modifiers'>Character modifiers</Link></li>
				<li><Link to='#CH_Character_deletion'>Character deletion</Link></li>
			</ul>

			<h4 id='CH_Character_immersion'>Character immersion effects</h4>
			<p>
				Items in Pandora can put certain immersion enhancing effects on a character. Restraints...
			</p>
			<ul>
				<li>can prevent you from interacting with items, by blocking your hand usage.</li>
				<li>can prevent you from moving around and/or leaving the current room (for example <Link to='/wiki/items#IT_Room-level_items'>room devices</Link>).</li>
				<li>with a seeing impairment effect will darken your view of the room partially or completely.</li>
				<li>with a speech impairment effect will muffle your normal and whisper messages so that others have a hard time making sense out of them.</li>
				<li>with a hearing impairment will muffle the messages you receive so that you have a hard time making sense out of them.</li>
			</ul>
			<p>
				Items with such effects cannot just be used as a cosmetic to make your character look nice. They come with consistent experiences
				and affect characters in predictable ways - the effects on them cannot be altered, ignored or bypassed.
				That way everyone can easily predict what effects items have on the person wearing them.
				If you dislike any of these effects, such as seeing a fully black room view with certain heavy blindfolds, you
				can simply <Link to='/wiki/items#IT_Item_preferences_and_limits'>block according items.</Link> Note
				that items come with different strength levels of such effects.
				For example items with a weaker speech impairment effect might still allow the wearer to be mostly understandable.
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
				form of <Link to='/wiki/chat#CHA_Chat_modes'>emotes</Link>.
				This can be describing things the play partner could notice, such as discomfort, the state of the own body, or a hint towards
				what the muffled sentence likely meant from the tone and strength of the voice. A good roleplaying scene relies on all parties
				to describe the scene in detail.
			</p>

			<h4 id='CH_Character_movement'>Character movement</h4>
			<p>
				You can move your character inside a room by dragging the name under it. Alternatively, you can activate a dedicated move mode
				in a character's menu that you can open by clicking on the character name in the room itself or in the character list in the "Room"-tab.<br />
				In this menu, you can also select "Lead / Follow" on other characters, if you have the according <Link to='#CH_Character_permissions'>permission</Link>.
				This activates a special move mode where one character moves with the other one: Either as if they were glued together
				(keep relative position) or by following as if on a leash (keep distance). The distance can be configured in the menu.
				The default values are set based on the current distance between you and the character you want to follow or lead around.
				The character being lead or following can no longer move or be moved (except inside the leashing radius of the according mode) until anyone stops this movement mode.
			</p>
			<ul>
				<li>You can lead several characters at the same time, but you cannot chain following characters.</li>
				<li>A character can follow another character within the rooms of the same space</li>
				<li>A character that has access to a role-restricted pathway can lead another character into the linked room that they would not have been able to move to on their own.</li>
				<li>When trying to switch spaces from within a space, you can initiate a joint space switch with all characters following you.</li>
				<li>Other characters following you into another space need to confirm this switch, unless they use a character modifier that makes them automatically accept the request.</li>
				<li>While having the according <Link to='#CH_Character_permissions'>permission</Link>, other characters are also able to move your character.</li>
				<li>Space admins are always permitted to move other characters inside their rooms.</li>
				<li>
					When you move next to a <Link to='/wiki/items#IT_Room-level_items'>room device</Link> and interact with the blue icon under it, you can enter
					a character slot of the device, if it has one.
				</li>
				<li>If you have problems dragging the name because it is too small, you can zoom in with mouse wheel or pinch-to-zoom gesture.</li>
				<li>Items can prevent character movement.</li>
				<li>Characters can also be rotated by up to 360 degrees in the "Pose"-tab.</li>
				<li>
					The "Character Y Offset" value inside the "Pose"-tab can shift your character upwards and downwards alongside the z-axis
					without changing your character's relative size in an unrealistic way.
				</li>
			</ul>

			<h4 id='CH_Character_posing'>Character posing</h4>
			<p>
				There are several ways to change the poses of your or other characters (if permitted). You can use the "Pose"-tab in the main room view or wardrobe.
				There, you can select pre-existing pose templates or create and save your own ones. You can also configure all details of a pose manually.<br />
				That said, the likely quicker way to do manual posing is using the "Pose"-mode that you can find in a character's context menu, by clicking on the character name.
			</p>
			<p>
				In this mode you can see buttons over the character's body that you can interact with to change the pose of
				the body.<br />
				You can drag the hand icons on top of both wrists to change lower and upper arms as you desire. The connected circles
				next to hand buttons can be clicked or dragged to change the hands. Note that those additional UI elements can be toggled to be hidden by
				clicking on the hand buttons.<br />
				Similarly, you can drag the ankle buttons to change the leg angles. Dragging the left-right button over the stomach rotates the
				whole character. Simply clicking it resets the rotation to the default.
			</p>
			<ul>
				<li>Clicking the left-right arrow at the bottom allows you to turn the character around.</li>
				<li>The four-way arrow in the center allows you to switch to the character move mode. Please note that this button might not always be available.</li>
				<li>You can exit the manual posing mode by clicking the red "X" below the character.</li>
				<li>The two squares left and right of the red "X" change each arm's position to be in oneof the four states behind or in front of the body.</li>
			</ul>
			<p>
				Note that you can configure the UI style of the "Pose"-mode in the room graphics interface settings.<br />
				There, you can switch to or additionally add forward posing buttons that allow more direct control over the angles of the limbs.
				With the forward posing interface you can see circles over the joints of a character's body that you can drag to rotate the various joints/bones of
				the character body.
				Each one matches a slider from the "Manual pose" section in the "Pose" tab.<br />
				Hint: To achieve the most accurate rotation control, hold a circle and drag in the direction of the arrow on it and only then drag
				in a circle around the bone with some distance to it for a better control of the angle of the desired rotation.
			</p>

			<h4 id='CH_Character_context_menu'>Character context menu</h4>
			<p>
				You can open a context-specific character menu by clicking on the name below a character inside the room.
				While characters are inside a <Link to='/wiki/items#IT_Room-level_items'>room-level item</Link>, you can alternatively open the context menu
				by opening the room item's context menu, opening the slot the character is inside, and then clicking on the character name.
				Finally, you can open the context menu by pressing on a character's name in the "Room" tab. This is useful if the name in the room scene is covered by something.<br />
				The character context menu has different features depending on whom it is opened on. When an option on another character is crossed out,
				it is not possible to do right now, for instance because you are lacking a permission. Clicking such option will display the reason.
			</p>
			<ul>
				<li>You can use it to quickly open your or another character's profile or wardrobe.</li>
				<li>You can use it to enter move or pose mode on your or another character.</li>
				<li>You can select "Lead / Follow" on other characters to activate a special <Link to='#CH_Character_movement'>move mode</Link> where one character moves with the other one.</li>
				<li>There is an "Admin" sub-menu when you are an owner or admin in a space.</li>
				<li>
					The "Relationship" sub-menu lets you block another account or request adding the account to your contact list to see their online status and to
					see what characters another account is currently using. The other user is notified of your request to add them and can accept or decline.<br />
					This menu also contains a quick link to start writing the user behind another character a direct message, even while the character is offline.<br />
					Lastly, it allows you to temporarily hide another character for yourself only, for instance if they are obstructing your view (you can also hide your own characters for yourself).
				</li>
			</ul>

			<h4 id='CH_Character_wardrobe'>Character wardrobe</h4>
			<p>
				You can enter the wardrobe under the "Room"-tab or by opening the character context menu.
				There also is a button in the <Link to='/wiki/spaces#SP_Room_inventory'>room inventory</Link>.
			</p>
			<ul>
				<li>The "Item Limits" tab lets you configure <Link to='/wiki/items#IT_Item_preferences_and_limits'>limits and preferences</Link> of items for your character.</li>
				<li>The "Randomization"-tab lets you change to a randomized appearance (this tab is only available in your Personal Space).</li>
				<li>The effects & modifiers tab lists all effect currently applied to this character and allows management of <Link to='#CH_Character_modifiers'>character modifiers</Link>.</li>
				<li>The "Body"-tab allows you to change your character's body parts and body shape, but only if the space you are in allows that.</li>
				<li>
					The "Items"-tab lists all items held or worn by your character on the left side and shows
					various options how to add or move items on the right side.
				</li>
				<li>
					There is a maximum amount of items your character can wear or hold. This number is the sum
					of all <Link to='/wiki/items#IT_Body_parts'>body parts</Link>, all items worn on the body, special
					items, e.g. locks, and all
					items inside worn items with <Link to='/wiki/items#IT_Storage_modules'>storage modules</Link>, e.g. a bag.
				</li>
			</ul>

			<h4 id='CH_Character_permissions'>Character permissions</h4>
			<p>
				The settings on what other characters are allowed to do to your character can be found in the
				"Permissions"-tab of the Pandora settings. Permissions are character-specific and not
				account-wide. Each permission has a different default setting,
				so it is recommended to familiarize yourself with those and to adjust those settings to how you want them.<br />
				The global setting of a permission can possibly be set to "yes", "no", and "prompt".
				"Prompt" will show you a confirmation popup when someone tries to interact with you, but is missing one or more
				permissions that are set to "prompt". You can then decide to use ...
			</p>
			<ul>
				<li>
					... "deny always" to block the requesting character from asking for this specific permission from now on
					(unless you manually remove the character from this permission's settings again).
				</li>
				<li>... "allow always", which adds an exception for the requesting character to be able to use this specific permission from now on.</li>
				<li>... "Close with no further decisions" to dismiss the popup, which ignores the remainder of the request, only saving any individual
					permission-specific "allow" or "deny" actions already taken by you in this prompt, but still allowing future requests for the involved permissions.
				</li>
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
				once during the first interaction. Pandora does not allow to change it universally to "yes".
				This is intentional to make Pandora a safer and healthier platform, as it limits the potential for trolling severely
				for the prize of a quick button press, as you typically decide this only once per new character you interact with.
			</p>
			<p>
				The "item limits" group of permissions relate to items you flagged with a star or question mark under
				the <Link to='/wiki/items#IT_Item_preferences_and_limits'>"item limits"</Link>-tab
				of your wardrobe. These permissions are layered and depend upon each other:
				To use items flagged as "maybe", the other character needs to also be permitted to use "favorite" and "normal" items.
			</p>

			<h4 id='CH_Character_modifiers'>Character modifiers</h4>
			<p>
				Character modifiers alter how Pandora's features work for the character to which modifiers have been added and while those are in effect.
				This feature can be found in each character's wardrobe under the "Effects & Modifiers" tab.<br />
				As character modifiers can have quite intense and strict results, the global permission for others to lock them
				is set to "deny" by default. If you want others to use this feature securely on your character, you need to change the permission default or add those
				characters manually.
				Besides these general modifier related permissions, each character modifier type comes with its own individual permission so that you can configure
				which modifiers you want others to be able to use on your character.
			</p>
			<p>
				Character modifiers and their settings can be secured with locks - similar to items. While these lock mechanisms are not physical lock items, they still
				behave the same and also use the same item limits/preferences as their counterparts. For example, if you have the password lock item set to "prevent", it is
				also blocked for locking character modifiers.<br />
				In addition, you can define several characters who can still edit the modifier, even while it is locked.
			</p>
			<ul>
				<li>An added modifier can be set to "enabled" or "disabled" with the toggle on the top left. Disabled modifiers have no effect and their activation conditions are ignored.</li>
				<li>The same modifier type can be added multiple times to a single character. These instances of the modifier are additive to one another.</li>
				<li>Conflicts between character modifiers are resolved by the order of the added modifier list (e.g. the first entry has the highest priority and applies its effect first).</li>
				<li>You can only change the order of a modifier in the current modifiers list when permitted to edit all the modifiers between the current and desired position.</li>
				<li>Modifier configurations can be exported in form of a longer text code that can be stored outside of Pandora and later be imported again for reuse.</li>
				<li>Some modifier types come with pre-configured templates showcasing how they can be used.</li>
			</ul>
			<p />
			<p>
				By default, an enabled modifier is always active and affecting the character based on its type and configuration.
				If you, however, want the modifier to be active only in certain situations (such as when the target character is in a specific space), you can give it
				"activation conditions".<br />
				Multiple activation conditions can be added at the same time. If more than one condition is added, the connection between them is determined using the
				logical operators "AND" or "OR".
				An "AND" chain will result active if all conditions are satisfied. Similarly an "OR" chain will result active if at least one condition is satisfied.<br />
				When mixing "AND" and "OR" operators, the conditions are grouped by the "OR" terms into groups. When determining if the modifier should be active, each group
				checks if all its conditions (connected by "AND") are satisfied. The modifier is then active when at least one of the groups has all its conditions satisfied.<br />
				<i>Geek trivia: The condition logic is based on <ExternalLink href='https://en.wikipedia.org/wiki/Disjunctive_normal_form'>Disjunctive normal form</ExternalLink>, where each condition takes the place of a literal.</i>
			</p>
			<p>
				With the above knowledge you can create many interesting combinations of modifier types, their settings and activation conditions.<br />
				Here are a few ideas to get you started:
			</p>
			<ul>
				<li>A modifier that adds a hearing impairment effect when a certain named item is worn.</li>
				<li>A modifier that enforces certain speaking patterns, such as animal sounds, when in public spaces and not with a special person.</li>
				<li>A modifier that blurs the whole room canvas unless the character with it wears glasses.</li>
			</ul>
			<p />
			<p>
				<strong>Careful</strong>: Certain combinations of different speech-limiting character modifiers can (accidentally) lead to a character no longer
				being able to say or whisper anything at all, if every possible message is blocked by a combination of the set up speech modifiers.
				If that is something you do not want, you might want to be mindful of which combinations of speech-limiting modifiers you permit other users to use in parallel.
				Out-of-character (OOC) messages or emotes can never be affected by any character modifiers, though.
			</p>

			<h4 id='CH_Character_deletion'>Character deletion</h4>
			<p>
				You can delete a character in the settings screen under the "Character"-tab.
				In the confirmation pop-up, you need to type in the character's name and your account password to confirm the deletion.
			</p>

		</>
	);
}
