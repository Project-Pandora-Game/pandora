import React, { ReactElement } from 'react';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/gameStateContextProvider';

export function WikiSpaces(): ReactElement {
	return (
		<>
			<h2>Spaces</h2>

			<h3>Introduction</h3>

			<p>
				A space in Pandora always exists in the state it was set up, even when it was empty for a long time.
				You can decorate every room inside a space with room items/furniture and it can theoretically be joined by up to 100 characters at the same time.<br />
				The "Chat"-tab next to the room view can also be switched to:
			</p>
			<ul>
				<li>the "Room"-tab that gives you interaction and configuration possibilities for the room your are currently in, as well as the space the room is a part of</li>
				<li>the "Pose"-tab that lets you change your character's pose</li>
				<li>the "Expressions"-tab that lets you change your character's facial expressions and body states</li>
			</ul>

			<h3>Space-specific features</h3>
			<ul>
				<li><a href='#SP_Room_layout'>Room layout</a></li>
				<li><a href='#SP_Space_ownership'>Space ownership</a></li>
				<li><a href='#SP_Space_deletion'>Space deletion</a></li>
				<li><a href='#SP_Space_persistence'>Space persistence</a></li>
				<li><a href='#SP_Space_visibility'>Space visibility</a></li>
				<li><a href='#SP_Space_access'>Space access</a></li>
				<li><a href='#SP_Space_administration'>Space administration</a></li>
				<li><a href='#SP_Leaving_a_space'>Leaving a space</a></li>
				<li><a href='#SP_Personal_space'>Personal space</a></li>
				<li><a href='#SP_Room_inventory'>Room inventory</a></li>
				<li><a href='#SP_Room_chat_Chat_commands'>Room chat: Chat commands</a></li>
				<li><a href='#SP_Room_chat_Chat_modes'>Room chat: Chat modes</a></li>
				<li><a href='#SP_Room_chat_Editing_text'>Room chat: Editing text</a></li>
				<li><a href='#SP_Room_chat_Whispering_someone'>Room chat: Whispering someone</a></li>
				<li><a href='#SP_Room_chat_Text_formatting'>Room chat: Text formatting</a></li>
				<li><a href='#SP_Room_chat_Chat_history'>Room chat: Chat history</a></li>
			</ul>

			<h4 id='SP_Room_layout'>Room layout</h4>
			<p>
				The room view in Pandora consists of the room canvas and the four tabs that show the chat per default.<br />
				In a landscape view the tab is on the right side and it is on the bottom in a portrait view.
				In the Pandora settings (cog-button on the top bar) under the "Interface"-tab and inside the "Room UI" box,
				you can customize the ratio between the space that the room and the tabs area use for both landscape or portrait views.
			</p>
			<ul>
				<li>You can zoom the room canvas with the mouse wheel or a pinch-to-zoom gesture.</li>
				<li>You can drag the canvas freely to see a different part of it while zoomed in.</li>
				<li>If you experience performance issues, you can lower/disable graphics related features in Pandora's settings.</li>
			</ul>

			<h4 id='SP_Space_ownership'>Space ownership</h4>
			<p>
				Spaces in Pandora are owned by one or more persons.
			</p>
			<ul>
				<li>Every owner is automatically admin in the space.</li>
				<li>Player accounts that are not owner can still be admin of a space.</li>
				<li>Creating a new space makes you automatically owner of it.</li>
				<li>You currently cannot add other owners to your space. This is planned.</li>
				<li>There is a limit to how many spaces you can own. You can see your ownership limit in the space search behind the heading "My spaces".</li>
				<li>
					If you want to create another space beyond your space ownership limit, you must select any of your owned spaces and either repurpose it or
					give up ownership of that space (resulting in the space being deleted if it has no other owners).
				</li>
			</ul>

			<h4 id='SP_Space_deletion'>Space deletion</h4>
			<p>
				To permanently delete a space, you have to give up ownership over it. The space is automatically deleted if it has no other owners.
				Removal of ownership can be done in the space search screen, when clicking on the space, or in the administration screen when inside the space.
			</p>

			<h4 id='SP_Space_persistence'>Space persistence</h4>
			<p>
				Spaces in Pandora are not lost when they are empty. Every room inside the space will stay as it was when it was left, including characters that are offline inside.
			</p>
			<ul>
				<li>All space settings such as name, description, admin and ban lists will be persistent.</li>
				<li>All items in the rooms of the space will stay as and where they are.</li>
				<li>If characters will disconnect or log off inside a space, they will stay inside the current room, until they are removed from it manually or automatically.</li>
			</ul>

			<h4 id='SP_Space_visibility'>Space visibility</h4>
			<p>
				Spaces in Pandora can be public or private, which affects who can see them.
			</p>
			<ul>
				<li>The default when creating a new space is private.</li>
				<li>Public space are only visible for other players when there is an admin online inside the space.</li>
				<li>Private spaces are currently only visible in the space search for admins and owners of that space and cannot be found otherwise.</li>
				<li>Accounts can still see spaces they are banned from</li>
				<li>
					Certain information about a space normally visible from the outside, such as who is inside, is not shown when the space is password protected or the viewing
					account is on the space's ban list.
				</li>
			</ul>

			<h4 id='SP_Space_access'>Space access</h4>
			<p>
				Spaces in Pandora that are visible can be joined unless they are password protected or a user is banned from it.
			</p>
			<ul>
				<li>Both public and private spaces can be password protected.</li>
				<li>Admins do not need to know and enter the password to join a password protected space.</li>
				<li>When a user's account is banned from a space, the user cannot join it.</li>
				<li>No one can join a space if it is full, not even owners or admins of it.</li>
			</ul>

			<h4 id='SP_Space_administration'>Space administration</h4>
			<p>
				You can find the button to administrate the current room and the space it is part of in the Room-tab.
			</p>
			<ul>
				<li>You can set the space name and a long space description that both are visible from the outside, to accounts that can see the space.</li>
				<li>The default number of characters that can join a space is 10, but the possible upper limit is 100.</li>
				<li>You can set if the space should be public and visible to everyone, as long as there is an admin online inside. The default is "no", which means the space is private.</li>
				<li>You can give up space ownership, which deletes the space permanently, if you are the only owner.</li>
				<li>The admin and ban lists are comma separated and require the player account id, as they are account-wide.<br />
					The player account id number can be looked up in the account profile of the player.<br />
					<strong>Careful:</strong> Do not mix it up with the character id which starts with "c" followed by a number.<br />
					Alternatively, you can look up the player account id of a character inside the space up in the "Room"-Tab. It is the last number behind the name.<br />
					The easiest way is to simply click on the name below a character and select "Admin" in the context menu.
				</li>
				<li>
					When creating a space for the first time, you can select if characters can change their <a href='/wiki/items/#IT_Body_parts'>body parts</a> or gender pronouns
					when inside this space. This currently cannot be changed later on.
				</li>
			</ul>

			<h4 id='SP_Leaving_a_space'>Leaving a space</h4>
			<p>
				You leave a chat space with the top-right-most button that. Restraints or other effects may prevent you from being able to do that.
			</p>
			<ul>
				<li>Closing the browser, disconnecting, changing your character, or logging off, will all leave your character in the current chat space by default.</li>
				<li>Being inside a <a href='/wiki/items/#IT_Room-level_items'>room device</a> slot will make you unable to leave a space</li>
				<li>Most regular restraints will not be able to prevent you from leaving a space.</li>
			</ul>

			<h4 id='SP_Personal_space'>Personal space</h4>
			<p>
				Every character has their own personal space that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal space when your selected character is not in any other space. Restraining
				effects (also from <a href='/wiki/items/#IT_Room-level_items'>room devices</a>)
				will not prevent you from leaving the personal space.
			</p>

			<h4 id='SP_Room_inventory'>Room inventory</h4>
			<p>
				The room inventory shows all items that are inside the current room and can be picked up or used by other characters, if permitted
				by the space configuration, or the <a href='/wiki/characters/#CH_Character_permissions'>character permissions</a> of the targeted character.<br />
				From this screen, you can also create new items inside the room inventory, edit them, or delete them. Items stay in the inventory indefinitely
				as long as they are not moved somewhere else, are deleted, or the room and/or space are deleted, e.g. by giving
				up <a href='#SP_Space_ownership'>ownership</a> of a space.
				Clicking on an item in the list opens its edit-view on the right
				side. <a href='/wiki/items/#IT_Room-level_items'>Room devices</a> can be deployed to the room background in the edit-view by permitted parties.
			</p>

			<h4 id='SP_Room_chat_Chat_commands'>Room chat: Chat commands</h4>
			<p>
				There are also chat commands that either act as shortcuts to certain features or offer new functionality, such as playing games in the chat.
				Type "/" into the chat field to see a list of all chat commands.
			</p>
			<ul>
				<li>The "tab"-key can be used to cycle through the list of shown commands</li>
				<li>The "tab"-key will try to autocomplete commands you started typing or cycle through the possible matches shown</li>
				<li>The "tab"-key can also be used to autocomplete command arguments such as target characters or cycle through all of them</li>
				<li>Using "shift+tab" keys at the same time will cycle through the list in reverse order.</li>
			</ul>

			<h4 id='SP_Room_chat_Chat_modes'>Room chat: Chat modes</h4>
			<p>
				The chat is always in a specific chat mode, such as emote mode or <a href='/wiki/safety/#SA_Out-of-character_communication'>OOC</a> mode.
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
				<li>
					There are also shortcuts to write one-off messages while in the default, normal chat mode.<br />
					These shortcuts are<br />
					"((" - double round brackets - usage: (( ooc message )) <br />
					"*"  - single asterisk/star - usage: *me-emote that gets prefixed with your character's name*<br />
					"**" - double asterisk/star - usage: **generic emote that doesn't get prefixed**<br />
					<i>Note</i>: A single message can have multiple different syntax parts, so the above shortcut types can be mixed in a single message if
					each different one is in a new line.
					That said, if you intend to format the rest of the message in the same way, you do not need to close a shortcut syntax at the end.
				</li>
			</ul>

			<h4 id='SP_Room_chat_Editing_text'>Room chat: Editing text</h4>
			<p>
				Pandora allows you to edit or even delete text you sent in the chat during the first { MESSAGE_EDIT_TIMEOUT / 1000 / 60 } minutes after posting it.<br />
				This works by right-clicking on any past text of yours or using the "Arrow-up" key to edit the last message specifically.
			</p>
			<ul>
				<li>You can edit and delete whispers, emotes and general chat messages like that.</li>
				<li>After several minutes have passed, the menu no longer shows the option to edit or delete the text.</li>
				<li>The message is tagged with a small "[edited]" on the right, next to the updated time stamp.</li>
			</ul>

			<h4 id='SP_Room_chat_Whispering_someone'>Room chat: Whispering someone</h4>
			<p>
				There are several ways to whisper someone in the same room.<br />
				Any of them puts you into a whisper mode that you need to explicitly leave by using the "Cancel"-button above the chat input.
			</p>
			<ul>
				<li>You can click on a character name in the chat itself.</li>
				<li>You can click on a character name under a character on the room background and select "Whisper".</li>
				<li>You can click on the "Whisper"-button next to a character name in the "Room"-tab.</li>
				<li>You can use the chat command "/w [target]" using either the character name or the character ID as whisper target argument.</li>
				<li>Chat-related commands while in whisper mode (e.g., "/me") will be executed normally and not be whispered.</li>
				<li>If your whisper target leaves the room or space, your whisper message cannot be sent.</li>
				<li>If your whisper target goes offline, your whisper message will still be sent, but currently it will not be delivered.</li>
			</ul>

			<h4 id='SP_Room_chat_Text_formatting'>Room chat: Text formatting</h4>
			<p>
				You can change the text size of the chat in the "Interface"-tab of Pandora's settings.<br />
				Starting a message with "https://" will turn it into an inline-link.
				Also, Pandora supports a part of the markdown syntax to write text italic or bold: "__bold text__" or "_italicized  text_"<br />
				Note: You do not need to close the syntax if you intend to format the rest of the message the same way.<br />
				While the chat input field is focused, you can also use keyboard shortcuts to get the supported markdown syntax:
			</p>
			<ul>
				<li>Use "ctrl+b" to style the next new characters in bold or mark text and then use the shortcut.</li>
				<li>Use "ctrl+i" to style the next new characters in italic or mark text and then use the shortcut.</li>
				<li>No other markdown syntax is currently supported</li>
			</ul>

			<h4 id='SP_Room_chat_Chat_history'>Room chat: Chat history</h4>
			<p>
				The chat history is kept through page reloads and disconnects, as long as the browser tab is not closed. Additionally,
				if a user only disconnects for a few seconds and no "character disconnected" message was yet shown to other users in the chat,
				all chat messages sent during the disconnect will still be shown after reconnecting. Essentially, users with a bad Internet
				connection will not miss any new messages sent while they are offline.
			</p>

		</>
	);
}
