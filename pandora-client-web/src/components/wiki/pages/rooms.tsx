import React, { ReactElement } from 'react';

export function WikiRooms(): ReactElement {
	return (
		<>
			<h2>Rooms</h2>

			<h3>Introduction</h3>

			<p>
				A room in Pandora always exists in the state it was set up, even when it was empty for a long time.
				You can decorate a room with room items/furniture and it can theoretically be joined by up to 100 characters at the same time.<br />
				The "Chat"-tab next to the room view can also be switched to:
			</p>
			<ul>
				<li>the "Room"-tab that lets you configure the room and shows a list of all characters currently inside the room</li>
				<li>the "Pose"-tab that lets you change your character's pose</li>
				<li>the "Expressions"-tab that lets you change your character's facial expressions and body states</li>
			</ul>

			<h3>Room-specific features</h3>
			<ul>
				<li><a href='#RO_Room_layout'>Room layout</a></li>
				<li><a href='#RO_Room_ownership'>Room ownership</a></li>
				<li><a href='#RO_Room_deletion'>Room deletion</a></li>
				<li><a href='#RO_Room_persistence'>Room persistence</a></li>
				<li><a href='#RO_Room_visibility'>Room visibility</a></li>
				<li><a href='#RO_Room_access'>Room access</a></li>
				<li><a href='#RO_Room_administration'>Room administration</a></li>
				<li><a href='#RO_Leaving_a_room'>Leaving a room</a></li>
				<li><a href='#RO_Personal_room'>Personal room</a></li>
				<li><a href='#RO_Room_inventory'>Room inventory</a></li>
				<li><a href='#RO_Room_chat_Chat_commands'>Room chat: Chat commands</a></li>
				<li><a href='#RO_Room_chat_Chat_modes'>Room chat: Chat modes</a></li>
				<li><a href='#RO_Room_chat_Editing_text'>Room chat: Editing text</a></li>
				<li><a href='#RO_Room_chat_Whispering_someone'>Room chat: Whispering someone</a></li>
				<li><a href='#RO_Room_chat_Text_formatting'>Room chat: Text formatting</a></li>
			</ul>

			<h4 id='RO_Room_layout'>Room layout</h4>
			<p>
				The room view in Pandora consists of the room canvas and the four tabs that show the chat per default.<br />
				In a landscape view the tab is on the right side and it is on the bottom in a portrait view.
				In the Pandora settings (cog-button on the top bar) under the "Interface"-tab and inside the "Chatroom UI" box,
				you can customize the ratio between the space that the room and the tabs area use for both landscape or portrait views.
			</p>
			<ul>
				<li>You can zoom the room canvas with the mouse wheel or a pinch-to-zoom gesture.</li>
				<li>You can drag the canvas freely to see a different part of it while zoomed in.</li>
				<li>If you experience performance issues, you can lower/disable graphics related features in Pandora's settings.</li>
			</ul>

			<h4 id='RO_Room_ownership'>Room ownership</h4>
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

			<h4 id='RO_Room_deletion'>Room deletion</h4>
			<p>
				To permanently delete a room, you have to give up ownership over it. The room is automatically deleted if it has no other owners.
				Removal of ownership can be done in the chat room list when clicking on the room or in the room administration screen when inside the room.
			</p>

			<h4 id='RO_Room_persistence'>Room persistence</h4>
			<p>
				Rooms in Pandora are not lost when they are empty. Every room will stay as it was when it was left, including characters that are offline inside it.
			</p>
			<ul>
				<li>All room settings such as name, description, admin and ban lists will be persistent.</li>
				<li>All items in the room will stay as and where they are.</li>
				<li>If characters will disconnect or log off inside a room, they will stay in it, until they are removed from the room manually or automatically.</li>
			</ul>

			<h4 id='RO_Room_visibility'>Room visibility</h4>
			<p>
				Rooms in Pandora can be public or private, which affects who can see them.
			</p>
			<ul>
				<li>The default when creating a new room is private.</li>
				<li>Public room are only visible for other players when there is an admin online inside the room.</li>
				<li>Private rooms are currently only visible in the room search for admins and owners of that room and cannot be found otherwise.</li>
				<li>Accounts can still see rooms they are banned from</li>
				<li>Certain information about a room normally visible from the outside, such as who is inside, is not shown when the room is password protected or the viewing account is on the room's ban list.</li>
			</ul>

			<h4 id='RO_Room_access'>Room access</h4>
			<p>
				Rooms in Pandora that are visible can be joined unless they are password protected.
			</p>
			<ul>
				<li>Both public and private rooms can be password protected.</li>
				<li>Admins do not need to know and enter the password to join a password protected room.</li>
				<li>When an account is banned from a room, it cannot join it.</li>
				<li>No one can join a room if it is full, not even owners or admins of it.</li>
			</ul>

			<h4 id='RO_Room_administration'>Room administration</h4>
			<p>
				You can find the button to administrate the current room in the Room-tab.
			</p>
			<ul>
				<li>You can set the room name and a long room description that both are visible from the outside, to accounts that can see the room.</li>
				<li>The default number of characters that can join a room is 10, but the possible upper limit is 100.</li>
				<li>You can set if the room should be public and visible to everyone, as long as there is an admin online inside. The default is "no", which means the room is private.</li>
				<li>You can give up room ownership, which deletes the room permanently, if you are the only owner.</li>
				<li>The admin and ban lists are comma separated and require the player account id.<br />
					The player account id number can be looked up in the account profile of the player.<br />
					<strong>Careful:</strong> Do not mix it up with the character id which starts with "c" followed by a number.<br />
					Alternatively, you can look up the player account id of a character inside the room up in the "Room"-Tab. It is the last number behind the name.<br />
					The easiest way is to simply click on the name below a character and select "Admin" in the context menu.
				</li>
				<li>When creating a room for the first time, you can select if characters can change their body items or gender pronouns when inside this room. This currently cannot be changed later on.</li>
			</ul>

			<h4 id='RO_Leaving_a_room'>Leaving a room</h4>
			<p>
				You leave a chat room with the top-right-most button that. Restraints or other effects may prevent you from being able to do that.
			</p>
			<ul>
				<li>Closing the browser, disconnecting, changing your character, or logging off, will all leave your character in the current chat room by default.</li>
				<li>Being inside a <a href='/wiki/items/#IT_Room-level_items'>room device</a> slot will make you unable to leave a chat room</li>
				<li>Most regular restraints will not be able to prevent you from leaving a room.</li>
			</ul>

			<h4 id='RO_Personal_room'>Personal room</h4>
			<p>
				Every character has their own personal room that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal room when your selected character is not in any chat room. Restraining effects (also from <a href='/wiki/items/#IT_Room-level_items'>room devices</a>)
				will not prevent you from leaving the personal room.
			</p>

			<h4 id='RO_Room_inventory'>Room inventory</h4>
			<p>
				The room inventory shows all items that are inside the current room and can be picked up or used by other characters, if permitted.<br />
				From this screen, you can also create new items inside the room inventory, edit them, or delete them.
				Clicking on an item in the list opens its edit-view on the right side.
				<a href='/wiki/items/#IT_Room-level_items'>Room devices</a> can be deployed to the room background in the edit-view by permitted parties.
			</p>

			<h4 id='RO_Room_chat_Chat_commands'>Room chat: Chat commands</h4>
			<p>
				There are also chat commands that either act as shortcuts to certain features or offer new functionality, such as playing games in the chat.
				Type "/" into the chat field to see a list of all chat commands.
			</p>
			<ul>
				<li>The "tab"-key will try to autocomplete commands you started typing or cycle through the possible matches shown</li>
				<li>The "tab"-key can also be used to autocomplete command arguments such as target characters or cycle through all of them</li>
			</ul>

			<h4 id='RO_Room_chat_Chat_modes'>Room chat: Chat modes</h4>
			<p>
				The chat is always in a specific chat mode, such as emote mode or OOC mode.
				The default mode is writing normal text to the whole room that can be formatted.<br />
				You can write in another chat mode by either using a chat command or by pressing the bar with the white cog above the input field.
				This toggles a dropdown menu that lets you switch to a different chat mode.<br />
			</p>
			<ul>
				<li>Chat modes are persisting over several messages.</li>
				<li>You can either switch to another chat mode or cancel it, which implicitly switches to the default chat mode</li>
				<li>If you use a chat command for sending a message in a certain chat mode (e.g. "/me") you will stay in your previous chat mode.</li>
				<li>If you want to permanently switch to another chat mode via a chat command, send the command without a text message behind the command.</li>
				<li>Certain chat modes can be combined with the whisper mode.</li>
				<li>All chat modes have a variant to send text without any formatting, which are the "raw" variants of the according chat commands.</li>
			</ul>

			<h4 id='RO_Room_chat_Editing_text'>Room chat: Editing text</h4>
			<p>
				Pandora allows you to edit or even delete text you sent in the chat during the first minutes after posting it.<br />
				This works by right-clicking on any past text of yours or using the "Arrow-up" key to edit the last message specifically.
			</p>
			<ul>
				<li>You can edit and delete whispers, emotes and general chat messages like that.</li>
				<li>After several minutes have passed, the menu no longer shows the option to edit or delete the text.</li>
				<li>The message is tagged with a small "[edited]" on the right, next to the updated time stamp.</li>
			</ul>

			<h4 id='RO_Room_chat_Whispering_someone'>Room chat: Whispering someone</h4>
			<p>
				There are several ways to whisper someone in the same chat room.<br />
				Any of them puts you into a whisper mode that you need to explicitly leave by using the "Cancel"-button above the chat input.
			</p>
			<ul>
				<li>You can click on a character name in the chat itself.</li>
				<li>You can click on a character name under a character in the room and select "Whisper".</li>
				<li>You can click on the "Whisper"-button next to a character name in the "Room"-tab.</li>
				<li>You can use the chat command "/w [target]" using either the character name or the character ID as whisper target argument.</li>
				<li>Chat-related commands while in whisper mode (e.g., "/me") will be executed normally and not be whispered.</li>
				<li>If your whisper target leaves the room, your whisper message cannot be sent.</li>
				<li>If your whisper target goes offline, your whisper message will still be sent, but currently it will not be delivered.</li>
			</ul>

			<h4 id='RO_Room_chat_Text_formatting'>Room chat: Text formatting</h4>
			<p>
				Pandora supports a part of the markdown syntax to write text italic or bold: "__bold text__" or "_italicized  text_"<br />
				While the chat room input field is focused, you can also use keyboard shortcuts to get the supported markdown syntax:
			</p>
			<ul>
				<li>Use "ctrl+b" to style the next new characters in bold or mark text and then use the shortcut.</li>
				<li>Use "ctrl+i" to style the next new characters in italic or mark text and then use the shortcut.</li>
				<li>No other markdown syntax is currently supported</li>
			</ul>

		</>
	);
}
