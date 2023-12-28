import React, { ReactElement } from 'react';

export function WikiRooms(): ReactElement {
	return (
		<>
			<h2>Rooms</h2>

			<h3>How do rooms in Pandora work?</h3>

			<p>
				REVISE THIS TEXT!
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
			<p>
				Every character has their own <strong>personal room</strong> that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal room when your selected character is not in any multiplayer room. Restraining effects will not
				prevent you from leaving the personal room.
			</p>

			<h3>What are all room-specific features?</h3>

			<h4>Room ownership</h4>
			<p>
				Rooms in Pandora are owned by one or more persons.
			</p>
			<ul>
				<li>Every owner is automatically admin in the room.</li>
				<li>Player accounts that are not owner can still be admin of a room.</li>
				<li>Creating a new room makes you automatically owner of it.</li>
				<li>There is a limit to how many rooms you can own. You can see your ownership limit in the room search behind the heading "My rooms".</li>
				<li>You currently cannot add other owners to your room. This is planned.</li>
			</ul>

			<h4>Room deletion</h4>
			<p>
				To permanently delete a room, you have to give up ownership over it. The room is automatically deleted if it has no other owners.
				Removal of ownership can be done in the chat room list when clicking on the room or in the room administration screen when inside the room.
			</p>

			<h4>Room persistence</h4>
			<p>
				Rooms in Pandora are not lost when they are empty. Every room will stay as it was when it was left, including characters that are offline inside it.
			</p>
			<ul>
				<li>All room settings such as name, description, admin and ban lists will be persistent.</li>
				<li>All items in the room will stay as and where they are.</li>
				<li>If charcters will disconnect or log off inside a room, they will stay in it, until they are removed from the room manually or automatically.</li>
			</ul>

			<h4>Room visibility</h4>
			<p>
				Rooms in Pandora can be public or private, which affects who can see them.
			</p>
			<ul>
				<li>The default when creating a new room is private.</li>
				<li>Public room are only visible for other players when there is an admin online inside the room.</li>
				<li>Private rooms are currently only visible in the room search for admins and owners of that room and cannot be found otherwise.</li>
				<li>Accounts can still see rooms they are banned from</li>
				<li>Certain information about a room normally visible from the outside, such as who is inside, is not shown when the room is password protected or the viewing account is on the room#s ban list.</li>
			</ul>

			<h4>Room access</h4>
			<p>
				Rooms in Pandora that are visible can be joined unless they are password protected.
			</p>
			<ul>
				<li>Both public and private rooms can be password protected.</li>
				<li>Admins do not need to know and enter the password to join a password protected room.</li>
				<li>When an account is banned from a room, it cannot join it.</li>
				<li>No one can join a room if it is full, not even owners or admins of it.</li>
			</ul>

			<h4>Room administration</h4>
			<p>
				You can find the button to administrate the current room in the Room-tab.
			</p>
			<ul>
				<li>You can set the room name and a long room description that both are visible from the outside, to accounts that can see the room.</li>
				<li>The default number of charcters that can join a room is 10, but the possible upper limit is 100.</li>
				<li>You can set if the room should be public and visible to everyone, as long as there is an admin online inside. The default is "no", which means the room is private.</li>
				<li>You can give up room ownership, which deletes the room permanently, if you are the only owner.</li>
				<li>The admin and ban lists are comma seperated and require the player account id.<br />
					The player account id number can be looked up in the account profile of the player.<br />
					<strong>Careful:</strong> Do not mix it up with the character id which starts with "c" followed by a number.<br />
					Alternatively, you can look up the player account id of a charcter inside the room up in the "Room"-Tab. It is the last number behind the name.<br />
					The easiest way is to simply click on the name below a charcter and select "Admin" in the context menu.
				</li>
				<li>When creating a room for the first time, you can select if characters can change their body items or gender pronouns when inside this room. This currently cannot be changed later on.</li>
			</ul>

			<h4>Leaving a room</h4>
			=
			TODO
			=

			<h4>Personal room</h4>
			<p>
				Every character has their own personal room that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal room when your selected character is not in any multiplayer room. Restraining effects will not
				prevent you from leaving the personal room.
			</p>

		</>
	);
}
