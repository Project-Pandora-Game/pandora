import React, { ReactElement } from 'react';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/gameStateContextProvider';

export function WikiIntroduction(): ReactElement {
	return (
		<>
			<h2>Introduction to Pandora with some quick hints to get you started</h2>

			<p>
				Pandora's vision is to establish a strict & secure, consensual roleplay platform that focuses on text-heavy interactions.
			</p>

			The following will list some of the existing core features of Pandora.
			Some of these features are explained in greater detail further below.
			<ol type='1'>
				<li>Dynamically generated body model with many poses and free arm movement</li>
				<li>Front and back character view</li>
				<li>Persistent multiplayer spaces and a character-specific personal space</li>
				<li>A feature-rich room chat (e.g. message editing, advanced text styling)</li>
				<li>Free character placement and movement inside rooms</li>
				<li>Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</li>
				<li>An already very stable code base (goal: no void memes here)</li>
				<li>Reliable gag talk & locks - development aims to make it impossible to cheat</li>
				<li>Flexible item layering possibilities</li>
				<li>A direct messaging system that supports offline messages and a persistent message history</li>
				<li>Ability to use the browser's back/forward buttons to navigate in Pandora</li>
				<li>User safety features for emergencies only</li>
				<li>A permission feature that allows the user to set who is allowed to do what</li>
				<li>Storing complete outfits in the wardrobe and supporting import/export</li>
			</ol>

			<p>
				Some further details on these features and how to use them:
			</p>

			<h4>1. Dynamically generated body model with many poses and free arm movement</h4>
			<p>
				In the "Pose"-tab, you will find the ability to freely move arms and legs under the "manual pose" section at the bottom of the screen.
				Expand this section to view the respective sliders.
			</p>

			<h4>2. Front and back character view</h4>
			<p>
				Your character's view can be toggled in the pose menu. The chosen position is seen by everyone in the room.
			</p>

			<h4>3. Persistent rooms & personal room</h4>
			<p>
				In Pandora, a user created space can consist if one or many rooms and everything is persistent (settings, inventory, and room devices stay even after everyone has left) and has one or more owners.
				It only gets deleted when it no longer has any owners.<br />
				A space is visible to everyone (except accounts banned from the space), if it is marked as public and there is at least one admin inside the room.
				You can always see spaces you are either admin or owner of.<br />
				When a character goes offline inside a room, they will stay in the space the room is a part of and are shown as not connected.
				By default, this is shown by the character having a ghost-like effect; this effect can be changed in the settings.<br />
				Spaces can have a long description that can be read from the outside in the space preview popup.
			</p>
			<p>
				Each <strong>account</strong> has a maximum number of spaces it can own. You can view the spaces owned by your account
				as well as your ownership limit on the space search screen.
				If you want to create another space beyond your space ownership limit, you must select any of your owned spaces and either repurpose it or
				give up ownership of that space (resulting in the space being deleted if it has no other owners).
			</p>
			<p>
				Every character has their own <strong>personal space</strong> that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal space when your selected character is not in any other space. Restraining effects will not
				prevent you from leaving the personal space.
			</p>

			<h4>4. A feature-rich room chat</h4>
			<ul>
				<li>Click a name in the chat to start whispering to that person</li>
				<li>Right-clicking your own message enables you to edit or delete it for { MESSAGE_EDIT_TIMEOUT / 1000 / 60 } mins after posting it</li>
				<li>To get help on chat commands, start the command by typing the "/" character, which will then show the list of available commands</li>
				<li>You can write Out-Of-Character (OOC) messages by prefixing them with "(("</li>
				<li>You can enclose text with underscores to style it, such as _<i>italic</i>_ and __<b>bold</b>__</li>
			</ul>

			<h4>5. Free character placement and movement inside rooms</h4>
			<p>
				You can freely move your character inside a room by dragging them by the character name below.
				Space admins can also move other characters this way.
			</p>

			<h4>6. Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</h4>
			<p>
				Room-level items can only be set up, moved, and removed by admins that have the handheld item "room construction tools" equipped.
				A room device must first be deployed from the room inventory to the room by selecting the according option in the item details.
				Then, you can move/position the item by clicking the according menu point in the item's context menu by clicking the icon below it.
				The red/green button lets you drag the device along the room floor and the blue button lets you drag the item higher or lower at the current spot (along the z-axis).
				Leave the move mode by pressing the red/green button shortly.
				The icons below room devices can be toggled to be shown or hidden under the "Room"-tab.
			</p>

			<h4>7. Stable code base</h4>
			<p>
				Pandora aims for a stable experience without random disconnects. But even if a short disconnect happens, the character will not be shown as disconnected for some time, and you will still receive all the missed chat messages on reconnect, not losing anything.
				Additionally, Pandora's server architecture is scalable to support future growth of its user base without compromising stability.
			</p>

			<h4>8. Reliable gag talk & locks</h4>
			<p>
				Pandora validates and performs all character interactions on the server,
				preventing the creation of scripts/mods that do undesired actions, such as anti-garble or unauthorized removal of (locked) restraints.<br />
				This ensures consistency in what others see,
				resulting in everyone having the same experience.
			</p>

			<h4>9. Flexible item layering possibilities</h4>
			<p>
				Items in Pandora can be ordered (almost) freely - as long as the item's requirements are satisfied, you can combine items in whatever order you want.
				Right now, you can only add each asset once, but in the future you will be able to add countless layers of rope, if that is what you want.
			</p>
			<p>
				Note on <strong>correct item layering order</strong>:<br />
				The layering order of items is that the higher an item is in the wardrobe character list, the further outwards on the body it is worn.
				So the first item is usually something like a jacket or dress, whereas underwear is further down in the list.<br />
				You add and remove outfits worn on the body from top to bottom, so from the outermost worn body item (e.g. a jacket or dress)
				towards the inner body pieces, like how you would undress in reality, too.<br />
				In case you dropped items in that manner to the room inventory, you can again add them to the body from the top to bottom,
				so from the item worn the closest to the body, like you would start dressing in reality, too.<br />
				Now, when you make an outfit template from something you wear you need to start from the bottom, not from the top,
				because you are not undressing your character, but you are "dressing" a mannequin template doll by means of copying your outfit.
				So you need to start from the item worn closest to the body, therefore bottom-up.
				When you want to use an outfit template to dress your character, you again need to start from the bottom, as you need to start with the item
				worn closest to the body, like you would start dressing in reality, too. So, outfit template related direction is bottom-up and otherwise, top-down.<br />
				👸🏽 → 🏠&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				🏠 → 👸🏽&nbsp;&nbsp;&nbsp;&nbsp;order:⬇️<br />
				👸🏽 → 💾&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				💾 → 👸🏽&nbsp;&nbsp;&nbsp;&nbsp;order:⬆️<br />
				<i>Side note</i>: It also works if you always do it top-down, if that is easier to remember, but then the mannequin template doll shows a preview image with reversed item order, which looks weirdly funny.
			</p>

			<h4>10. A direct messaging system</h4>
			<p>
				To write someone a DM, you have to click the contacts icon at the top and then under the "DMs"-tab,
				you have to either look for the account name of the user you want to exchange messages with on the left, or
				you have to search for them via the bottom left input field using their <b>account ID</b>. You can find the account
				ID either under the "Contacts"-tab or in the "Room"-tab while with a character in the same space/room. The account ID is
				the rightmost number behind the character name. Direct messages are end-to-end encrypted.
			</p>

			<h4>11. Using back/forward buttons/keys</h4>
			<p>
				Pandora has the ability to use the browser's back/forward buttons to navigate in Pandora.
			</p>

			<h4>12. User safety features for emergencies only</h4>
			<p>
				There are two user safety features for emergencies: Safemode and timeout mode. You can find those features via a button next to your own name in the "Room"-tab.
				Both modes are designed to make it harder to misuse safety features outside of their intended usage.
			</p>

			<h4>13. A permission feature that allows the user to set who is allowed to do what</h4>
			<p>
				You can find it in the Pandora settings. Currently, you can set if other character are allowed to interact with you and if you allow your body to be changed, too. This will be much more configurable in the future.
			</p>

			<h4>14. Storing complete outfits in the wardrobe and supporting import/export</h4>
			<p>
				The "Items" and "Body"-tabs in the wardrobe, as well as the room inventory screen, have an "Outfits"-tab that lets you access and manage all your custom outfits stored on the Pandora server.<br />
				It also allows you to export and import outfits to save even more externally or to share them with others. An outfit can contain normal items, room devices, body modifications, and even storage items.<br />
				Outfit entries show a small live preview. You can increase the size of the previews in the interface settings or even switch them off altogether, if your computer/phone and connection cannot handle loading many previews at once.
			</p>

			<hr />

			That's not all of course! We have many exciting features planned for the future:
			<ul>
				<li>Showing and managing relationships between characters</li>
				<li>Allowing every item to have a custom name and description and enabling item templates to store those, too</li>
				<li>Hearing impairment effect by assets</li>
				<li>Advanced permission feature</li>
				<li>Character rules</li>
				<li>Connecting rooms with each other into a small housing area "space" with a customized layout and ways to move from room to room</li>
				<li>Spectator mode for spaces that will help to not disrupt the chat during plays and that can be managed by space admins</li>
				<li>Creating character contracts to temporarily or permanently agree on sets of rules and permissions between specific characters</li>
				<li>Improvements to the new user experience & safety</li>
				<li>New space role "storyteller" that can orchestrate a prepared roleplay without a physical presence in any room of the space</li>
				... and many more, which can be found by looking at Pandora's issue list on <a href='https://github.com/Project-Pandora-Game/pandora/issues' target='_blank' rel='external nofollow noopener noreferrer'>GitHub</a>
			</ul>
		</>
	);
}
