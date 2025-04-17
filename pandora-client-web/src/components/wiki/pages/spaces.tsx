import { LIMIT_SPACE_BOUND_INVITES, LIMIT_SPACE_MAX_CHARACTER_NUMBER } from 'pandora-common';
import { ReactElement } from 'react';
import { Link } from 'react-router';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/gameStateContextProvider.tsx';

export function WikiSpaces(): ReactElement {
	return (
		<>
			<h2>Spaces</h2>

			<h3>Introduction</h3>

			<p>
				A space in Pandora always exists in the state it was set up, even when it was empty for a long time.
				You can decorate every room inside a space with room items/furniture and it can theoretically be joined by up
				to { LIMIT_SPACE_MAX_CHARACTER_NUMBER } characters at the same time.<br />
				The "Chat"-tab next to the room view can also be switched to:
			</p>
			<ul>
				<li>the "Room"-tab that gives you interaction and configuration possibilities for the room your are currently in, as well as the space the room is a part of</li>
				<li>the "Pose"-tab that lets you change your character's pose</li>
				<li>the "Expressions"-tab that lets you change your character's facial expressions and body states</li>
			</ul>

			<h3>Space-specific features</h3>
			<ul>
				<li><Link to='#SP_Room_layout'>Room layout</Link></li>
				<li><Link to='#SP_Space_ownership'>Space ownership</Link></li>
				<li><Link to='#SP_Space_deletion'>Space deletion</Link></li>
				<li><Link to='#SP_Space_persistence'>Space persistence</Link></li>
				<li><Link to='#SP_Space_visibility'>Space visibility</Link></li>
				<li><Link to='#SP_Space_access'>Space access</Link></li>
				<li><Link to='#SP_Space_invites'>Space invites</Link></li>
				<li><Link to='#SP_Space_features'>Space features</Link></li>
				<li><Link to='#SP_Space_administration'>Space administration</Link></li>
				<li><Link to='#SP_Leaving_a_space'>Leaving a space</Link></li>
				<li><Link to='#SP_Personal_space'>Personal space</Link></li>
				<li><Link to='#SP_Room_inventory'>Room inventory</Link></li>
				<li><Link to='#SP_Room_chat_Chat_commands'>Room chat: Chat commands</Link></li>
				<li><Link to='#SP_Room_chat_Chat_modes'>Room chat: Chat modes</Link></li>
				<li><Link to='#SP_Room_chat_Editing_text'>Room chat: Editing text</Link></li>
				<li><Link to='#SP_Room_chat_Whispering_someone'>Room chat: Whispering someone</Link></li>
				<li><Link to='#SP_Room_chat_Text_formatting'>Room chat: Text formatting</Link></li>
				<li><Link to='#SP_Room_chat_Chat_history'>Room chat: Chat history</Link></li>
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
				There are two different public space visibility settings: "Public while an admin is inside" and simply "Public".
				Note, that the "Public" setting still requires anyone online to be currently inside the space.
				If the public condition is no longer fulfilled, the space is temporarily no longer publicly listed in the list of spaces.
				Despite that, everyone inside can still directly invite other users from their contacts list to the unlisted public space (see <Link to='#SP_Space_invites'>"Space invites"</Link> section).<br />
				The "Public while an admin is inside" setting is useful for making sure your space does not diverge from its intended purpose while there is no owner/admin inside.<br />
				<br />
				Spaces can also be locked, which behaves similar to a private space, but prevents anyone except owners and admins from entering the space (leaving the space isn't limited). This also asks owners and admins for confirmation before entering.
				Allow-listed users can still see locked spaces, but not who is inside them and cannot enter them.
				"Join-me" invitations work the same as for private spaces, but "Space-bound" invitations are blocked.
			</p>
			<ul>
				<li>The default when creating a new space is private.</li>
				<li>Private spaces only show in the list of spaces for owners and admins of that space as well as users whose account is on the "allowed users" list of the space.</li>
				<li>Accounts can still see spaces they are banned from</li>
				<li>
					Certain information about a space can be seen in the space preview popup by anyone able to enter the space even without actually entering it.
					This includes, for example, the list of characters currently inside the space.
				</li>
			</ul>

			<h4 id='SP_Space_access'>Space access</h4>
			<p>
				Spaces in Pandora that are publicly listed can be joined unless a user is banned from it or the space is full.
				A private space can only be seen and joined by owners, admins and people on the allow list of said space. To invite other users to a private space,
				they have to either be added to one of these lists or be invited by an admin in order to join.
				The admin and "allowed users" lists can be found in the "visitor management"-tab of the space configuration view. Note that these lists
				work with user account IDs and not with character IDs.
			</p>
			<ul>
				<li>To invite other users to a space, you can send them a direct message with a "join-me" type invite via the "/invite" command.</li>
				<li>
					As a space admin you can also create more powerful and configurable "space-bound" type invite links in the "visitor management"-tab of the
					space configuration view that you can share with others. More details about invite links in the <Link to='#SP_Space_invites'>"Space invites"</Link> section.
				</li>
				<li>When a user's account is banned from a space, the user cannot join it.</li>
				<li>Owners of a space can even join a space when it is already full. When they join they fill one of five temporary overshoot slots above the set maximum.</li>
			</ul>
			<p>
				Let's summarize how to best manage access to private spaces:<br />
			</p>
			<ul>
				<li>If you want a user and all their characters to have permanent access to your space, add them to the list of allowed users.</li>
				<li>If you want to create a link that your friends can share with their friends, create a "space-bound" invite not tied to any account or character.</li>
				<li>If you want to invite another character for one time, send a direct message to them using the "/invite" command.</li>
			</ul>

			<h4 id='SP_Space_invites'>Space invites</h4>
			<p>
				Pandora also has two different types of space invites: "space-bound" and "join-me" invite links.<br />
				"Space-bound" invite links can only be created by space owners and admins in the "visitor management"-tab of the
				space configuration view. They are highly configurable.
			</p>
			<ul>
				<li>These invites can have an infinite or set number of uses, can be permanent or expire after some time.</li>
				<li>"Space-bound" invites can be account-specific, character specific, or can be used by anyone.</li>
				<li>They can be used to join private spaces, empty and unlisted spaces, but not full spaces. Banned accounts also can't use them.</li>
				<li>Space owners and admins can delete these invites at any point in time, after which they can no longer be used.</li>
				<li>You can only create a maximum of { LIMIT_SPACE_BOUND_INVITES } "space-bound" invites per space.</li>
			</ul>
			<p>
				The second type - "join-me" invites - can be created by anyone inside a space by using an "/invite" command in a direct message (DM) chat.
				They are essentially a quick way to tell someone where you are and invite them to join you.<br />
				Note: While a "join-me" invite allows to join an unlisted public room, it does not allow to join a private room, unless the recipient
				is able to join the space even without the invite (e.g. being an admin or on the space's allow list) or the creator of the "join-me" invite is an admin.
			</p>
			<ul>
				<li>You can send a "join-me" invite by using the "/invite" command in the direct message input field.</li>
				<li>These invites can be used only once and expire 120 minutes after they were created and sent.</li>
				<li>"Join-me" invites are bound to the user account they are sent to and cannot be used by someone else.</li>
				<li>The invite link only works while the character that created it is still online and inside the space the invite is for.</li>
				<li>The invite details cannot be edited by the one creating it. The purpose of "join-me" invites is to be simple and quick to use.</li>
				<li>Banned accounts cannot be invited this way.</li>
				<li>Space owners, admins and the invite's author can delete these invites at any point in time, after which they can no longer be used.</li>
			</ul>

			<h4 id='SP_Space_features'>Space features</h4>
			<p>
				While creating a room, you can set several space feature check boxes at the bottom of the space creation screen. These cannot be changed after the space creation.
			</p>
			<ul>
				<li>
					Allow changes to character bodies: Determines if any character inside the space can change their body, for example changing the shape/size of their body,
					or swapping to different eyes, nose, genitals.
				</li>
				<li>
					Allow changes to character pronouns: Determines if any character inside the space can change their pronouns, so with which gender they are mentioned,
					while inside the space.
				</li>
				<li>
					Development mode: On a development server, spaces can be created in development mode. This enables use of many development tools, such as
					room background calibration tool. Those can however break things when used incorrectly. Because of
					that <strong>this option is not available on the public server for non-developers</strong>.
				</li>
			</ul>

			<h4 id='SP_Space_administration'>Space administration</h4>
			<p>
				You can find the button to administrate the current room and the space it is part of in the Room-tab.
			</p>
			<ul>
				<li>You can set the space name and a long space description that both are visible from the outside, to accounts that can see the space.</li>
				<li>The default number of characters that can join a space is 10, but the possible upper limit is 100.</li>
				<li>You can set the space's visibility. The default is that the space is private.</li>
				<li>You can give up space ownership, which deletes the space permanently, if you are the only owner.</li>
				<li>The admin, ban, and allowed users lists are comma separated and require the player account id, as they are account-wide.<br />
					The player account id number can be looked up in the account profile of the player.<br />
					<strong>Careful:</strong> Do not mix it up with the character id which starts with "c" followed by a number.<br />
					Alternatively, you can look up the player account id of a character inside the space up in the "Room"-Tab. It is the last number behind the name.<br />
					The easiest way is to simply click on the name below a character and select "Admin" in the context menu.
				</li>
				<li>
					When creating a space for the first time, you can select if characters can change their <Link to='/wiki/items#IT_Body_parts'>body parts</Link> or gender pronouns
					when inside this space. This currently cannot be changed later on.
				</li>
			</ul>

			<h4 id='SP_Leaving_a_space'>Leaving a space</h4>
			<p>
				You leave a chat space with the top-right-most button that. Restraints or other effects may prevent you from being able to do that.
			</p>
			<ul>
				<li>Closing the browser, disconnecting, changing your character, or logging off, will all leave your character in the current chat space by default.</li>
				<li>Being inside a <Link to='/wiki/items#IT_Room-level_items'>room device</Link> slot will make you unable to leave a space</li>
				<li>Most regular restraints will not be able to prevent you from leaving a space.</li>
			</ul>

			<h4 id='SP_Personal_space'>Personal space</h4>
			<p>
				Every character has their own personal space that does not count towards this limit and that cannot be entered by any
				other character. It functions as a singleplayer lobby and cannot be deleted or given up.<br />
				You will automatically end up in the personal space when your selected character is not in any other space. Restraining
				effects (also from <Link to='/wiki/items#IT_Room-level_items'>room devices</Link>)
				will not prevent you from leaving the personal space.<br />
				There are a few actions that you cannot do in other spaces, only in your personal one:
			</p>
			<ul>
				<li>Seeing a list of other spaces.</li>
				<li>Setting a character preview as an icon for the character selection screen.</li>
				<li>Starting one of Pandora's tutorials.</li>
			</ul>

			<h4 id='SP_Room_inventory'>Room inventory</h4>
			<p>
				The room inventory shows all items that are inside the current room and can be picked up or used by other characters, if permitted
				by the space configuration, or the <Link to='/wiki/characters#CH_Character_permissions'>character permissions</Link> of the targeted character.<br />
				From this screen, you can also create new items inside the room inventory, edit them, or delete them. Items stay in the inventory indefinitely
				as long as they are not moved somewhere else, are deleted, or the room and/or space are deleted, e.g. by giving
				up <Link to='#SP_Space_ownership'>ownership</Link> of a space.
				Clicking on an item in the list opens its edit-view on the right
				side. <Link to='/wiki/items#IT_Room-level_items'>Room devices</Link> can be deployed to the room background in the edit-view by permitted parties.
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
				The chat is always in a specific chat mode, such as emote mode or <Link to='/wiki/safety#SA_Out-of-character_communication'>OOC</Link> mode.
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
					"((" - double round brackets - usage: (( OOC message )) <br />
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
				<li>You can whisper an OOC message though, if you start a whispered message with "((".</li>
				<li>You can use the chat command "/whisper" (or "/w") without anything afterwards to cancel the state of whispering someone.</li>
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
