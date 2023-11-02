import React, { ReactElement } from 'react';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/chatRoomContextProvider';

export function WikiIntroduction(): ReactElement {
	return (
		<>
			<h2>Introduction to Pandora with some quick hints to get you started</h2>

			<p>
				Pandora's vision is to establish a strict & secure, consensual roleplay platform that focuses on text-heavy interactions.
			</p>

			The following will list some of the existing core features of Pandora.
			Some of these features are explained in greater detail further below.
			<ul>
				<li>Dynamically generated body model with many poses and free arm movement</li>
				<li>Front and back character view</li>
				<li>Persistent rooms with long descriptions</li>
				<li>A feature-rich room chat (e.g. message editing, advanced text styling)</li>
				<li>Free character placement and movement inside rooms</li>
				<li>Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</li>
				<li>An already very stable code base (goal: no void memes here)</li>
				<li>Reliable gag talk & locks - development aims to make it impossible to cheat</li>
				<li>A direct messaging system that supports offline messages and a persistent message history</li>
				<li>Ability to use the browser's back/forward buttons to navigate in Pandora</li>
				<li>No safeword feature, but a safemode that makes it harder to be misused to constantly free characters</li>
				<li>A permission feature that allows the user to set who is allowed to do what</li>
			</ul>

			<p>
				Some further details on these features and how to use them:
			</p>

			<h4>Dynamically generated body model with many poses and free arm movement</h4>
			<p>
				In the "Pose"-tab, you will find the ability to freely move arms and legs under the "manual pose" section at the bottom of the screen.
				Expand this section to view the respective sliders.
			</p>

			<h4>Front and back character view</h4>
			<p>
				Your character's view can be toggled in the pose menu. The chosen position is seen by everyone in the room.
			</p>

			<h4>Persistent rooms</h4>
			<p>
				In Pandora, each room is persistent (settings, inventory, and room devices stay even after everyone has left) and has one or more owners.
				It only gets deleted when it no longer has any owners.<br />
				A room is visible to everyone (except accounts banned from the room), if it is marked as public and there is at least one admin inside the room.
				You can always see rooms you are either admin or owner of.<br />
				When a character goes offline inside a room, they will stay in the room and are shown as not connected.
				By default, this is shown by the character having a ghost-like effect; this effect can be changed in the settings.<br />
				Rooms can have a long description that can be read from the outside in the room preview popup.
			</p>
			<p>
				Each <strong>account</strong> has a maximum number of rooms it can own. You can view the rooms owned by your account
				as well as your ownership limit on the room search screen.
				If you want to create another room beyond your room ownership limit, you must select any of your owned rooms and either repurpose it or
				give up ownership of that room (resulting in the room being deleted if it has no other owners).
			</p>

			<h4>A feature-rich room chat</h4>
			<ul>
				<li>Click a name in the chat to start whispering to that person</li>
				<li>Right-clicking your own message enables you to edit or delete it for { MESSAGE_EDIT_TIMEOUT / 1000 / 60 } mins after posting it</li>
				<li>To get help on chat commands, start the command by typing the "/" character, which will then show the list of available commands</li>
				<li>You can write Out-Of-Character (OOC) messages by prefixing them with "(("</li>
				<li>You can enclose text with underscores to style it, such as _<i>italic</i>_ and __<b>bold</b>__</li>
			</ul>

			<h4>Free character placement and movement inside rooms</h4>
			<p>
				You can freely move your character inside a room by dragging them by the character name below.
				Room admins can also move other characters this way.
			</p>

			<h4>Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</h4>
			<p>
				Room devices must first be deployed from the room inventory to the room in the item menu.
				Then, you can freely move/position the item in the room by dragging it by the icon below it.
				The icons below room devices can be toggled to be hidden under the "Room"-tab.
			</p>

			<h4>Stable code base</h4>
			<p>
				Pandora aims for a stable experience without random disconnects. But even if a short disconnect happens, the character will not be shown as disconnected for some time, and you will still receive all the missed chat messages on reconnect, not losing anything.
				Additionally, Pandora's server architecture is scalable to support future growth of its user base without compromising stability.
			</p>

			<h4>Reliable gag talk & locks</h4>
			<p>
				Pandora validates and performs all character interactions on the server,
				preventing the creation of scripts/mods that do undesired actions, such as anti-garble or unauthorized removal of (locked) restraints.<br />
				This ensures consistency in what others see,
				resulting in everyone having the same experience.
			</p>

			<h4>A direct messaging system</h4>
			<p>
				To write someone a DM, you have to click the contacts icon at the top and then under the "DMs"-tab,
				you have to either look for the account name of the user you want to exchange messages with on the left, or
				you have to search for them via the bottom left input field using their <b>account ID</b>. You can find the account
				ID either under the "Contacts"-tab or in the "Room"-tab while with a character in the same room. The account ID is
				the rightmost number behind the character name. Direct messages are end-to-end encrypted.
			</p>

			<h4>No safeword feature, but a safemode that makes it harder to be misused</h4>
			<p>
				You can access the safemode feature by clicking on your character name in the top left of the screen and then entering safemode in the menu.
			</p>

			<h4>A permission feature that allows the user to set who is allowed to do what</h4>
			<p>
				You can find it in the Pandora settings. Currently, you can set if other character are allowed to interact with you and if you allow your body to be changed, too. This will be much more configurable in the future.
			</p>

			<hr />

			That's not all of course! We have many exciting features planned for the future:
			<ul>
				<li>
					Item templates for storing your favorite asset configurations per asset, including things like color, custom name,
					description/lore about the item, etc.
				</li>
				<li>Storing complete outfits in the wardrobe and supporting their import/export</li>
				<li>Character profile and biography</li>
				<li>Showing and managing relationships between characters</li>
				<li>Hearing impairment effect by assets</li>
				<li>Advanced permission feature</li>
				<li>Character rules</li>
				<li>Connecting rooms with each other into a small housing area with a customized layout and ways to move from room to room</li>
				<li>Creating character contracts to temporarily or permanently agree on sets of rules and permissions between specific characters</li>
				<li>Improvements to the new player experience & safety</li>
				... and many more, which can be found by looking at Pandora's issue list on <a href='https://github.com/Project-Pandora-Game/pandora/issues' target='_blank' rel='external nofollow noopener noreferrer'>GitHub</a>
			</ul>
		</>
	);
}
