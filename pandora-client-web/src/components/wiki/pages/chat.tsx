import { ReactElement } from 'react';
import { Link } from 'react-router';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/gameStateContextProvider.tsx';

export function WikiChat(): ReactElement {
	return (
		<>
			<h2>Chat</h2>

			<h3>Introduction</h3>

			<p>
				As a roleplaying platform, Pandora naturally comes with powerful chat features that will be described in this section of the wiki.
				There two types of chat you will encounter:
			</p>
			<ul>
				<li>the main chat for interaction with other characters inside the same space.</li>
				<li>the direct messaging (DM) feature that comes with its own chat field to write another user, even while they are offline.</li>
			</ul>

			<h3>Chat-specific features</h3>
			<ul>
				<li><Link to='#CHA_User_availability'>User availability</Link></li>
				<li><Link to='#CHA_Chat_visibility'>Chat visibility</Link></li>
				<li><Link to='#CHA_Chat_commands'>Chat commands</Link></li>
				<li><Link to='#CHA_Chat_modes'>Chat modes</Link></li>
				<li><Link to='#CHA_Editing_text'>Editing text</Link></li>
				<li><Link to='#CHA_Whispering_someone'>Whispering someone</Link></li>
				<li><Link to='#CHA_Text_formatting'>Text formatting</Link></li>
				<li><Link to='#CHA_Chat_history'>Chat history</Link></li>
			</ul>

			<h4 id='CHA_User_availability'>User availability</h4>
			<p>
				You can change your availability inside Pandora by clicking on your account name on the right side of the navigation bar at the top.
				This is an account-wide setting and affects all your connected characters. Your status is openly shared with all of your contacts and all users in the same space.<br />
				The following availability states exist:
			</p>
			<ul>
				<li><strong>Online</strong>: The default state when your account is logged in.</li>
				<li><strong>Looking to play</strong>: Shows that you are looking for a roleplay/scene, leaving your desired role open. You may want describe what your interests and limits are in your profile.</li>
				<li><strong>Looking to dom</strong>: Shows that you are looking for a play/scene in a dominant role.</li>
				<li><strong>Looking to sub</strong>: Shows that you are looking for a play/scene in a submissive role.</li>
				<li><strong>Away</strong>: Shows that you are currently busy outside of Pandora. There is no timer-based away state; you have to manage it manually. This state is also shown next to character names inside a room. This can be toggled off in the interface settings.</li>
				<li><strong>Do Not Disturb</strong>: Shows that you are in the middle of an activity, such as roleplaying with someone, where you do not want to be interrupted. This mode suppresses all set notifications temporarily (e.g. new DM).</li>
				<li><strong>Invisible</strong>: Shows you as "Offline" to all other users.</li>
				<li><strong>Offline</strong>: Shown when your account is offline or invisible or for all characters that are not selected/connected presently, while they are in a public/private space.</li>
			</ul>

			<h4 id='CHA_Chat_visibility'>Chat visibility</h4>
			<p>
				By default, the main chat is only shown in the dedicated chat tab of the main view inside a space.
				You can optionally set that the chat also stays visible in the other room tabs.
				For that, there are two "Always show chat in ..." drop-down boxes in "Settings { '>' } Interface { '>' } Chatroom UI".
				One for when you use Pandora in landscape orientation and one for a portrait orientation of your device or window. You can set both at the same time.<br />
				If you see no change from this setting, your device display or window size is likely too small to show the chosen option in a meaningful way.
			</p>

			<h4 id='CHA_Chat_commands'>Chat commands</h4>
			<p>
				There are chat commands that either act as shortcuts to certain features or offer new functionality, such as playing games in the chat.
				Type "/" into the chat field to see a list of all chat commands.
			</p>
			<ul>
				<li>The "tab"-key can be used to cycle through the list of shown commands</li>
				<li>The "tab"-key will try to autocomplete commands you started typing or cycle through the possible matches shown</li>
				<li>The "tab"-key can also be used to autocomplete command arguments such as target characters or cycle through all of them</li>
				<li>Using "shift+tab" keys at the same time will cycle through the list in reverse order.</li>
			</ul>

			<h4 id='CHA_Chat_modes'>Chat modes</h4>
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
			<p>
				Additionally, there are two special modes that you can put the chat into in parallel to the normal chat modes:
				<ul>
					<li>Focus mode: While this mode is on, it lets you only see chat messages originating from your current room. So this hides all,
						slightly greyed, messages from other rooms for yourself, for more immersion or to focus on the conversation in your current room. You can see
						a small eye icon on the bar with the cog to indicate when this mode is active. There also is a character modifier to enforce this mode, if desired.
					</li>
					<li>
						<Link to='/wiki/safety#SA_Action_log'>Action log</Link>: This mode shows the history of actions interleaved between the regular chat messages by time stamp.
						The action log lists all the actions that were taken by any character in the current space and should be seen as OOC knowledge.
					</li>
				</ul>
			</p>

			<h4 id='CHA_Editing_text'>Editing text</h4>
			<p>
				Pandora allows you to edit or even delete text you sent in the chat during the first { MESSAGE_EDIT_TIMEOUT / 1000 / 60 } minutes after posting it.<br />
				This works by right-clicking on any past text of yours or using the "Arrow-up" key to edit the last message specifically.
			</p>
			<ul>
				<li>You can edit and delete whispers, emotes and general chat messages like that.</li>
				<li>After several minutes have passed, the menu no longer shows the option to edit or delete the text.</li>
				<li>The message is tagged with a small "[edited]" on the right, next to the updated time stamp.</li>
			</ul>

			<h4 id='CHA_Whispering_someone'>Whispering someone</h4>
			<p>
				There are several ways to whisper to one or multiple characters in the same room.<br />
				Any of them puts you into a whisper mode that you need to explicitly leave by using the "Cancel"-button above the chat input.
			</p>
			<ul>
				<li>You can click on a character's name in the chat itself.</li>
				<li>You can whisper to multiple people at the same time, by holding <kbd>Ctrl</kbd> while clicking names in the chat.</li>
				<li>You can click on a character's name under the character on the room graphics to open a context menu and select "Whisper" or afterwards "Add to whisper group" there.</li>
				<li>You can click on the "Whisper"-button or successively "Add to / Remove from whisper group" buttons next to a character name in the "Room"-tab.</li>
				<li>You can click the arrow symbol ({ '->' }) of any whisper message to start whispering to everyone involved in said whisper.</li>
				<li>You can use the chat command "/w [target]" using either the character name or the character ID as whisper target argument.</li>
				<li>Chat-related commands while in whisper mode (e.g., "/me") will be executed normally and not be whispered.</li>
				<li>You can whisper an OOC message though, if you start a whispered message with "((".</li>
				<li>You can use the chat command "/whisper" (or "/w") without anything afterwards to cancel the state of whispering someone.</li>
				<li>If one of your whisper targets leaves the room or space, your whisper message cannot be sent.</li>
				<li>If one of your whisper targets goes offline, your whisper message will still be sent, but currently it will not be delivered.</li>
			</ul>

			<h4 id='CHA_Text_formatting'>Text formatting</h4>
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

			<h4 id='CHA_Chat_history'>Chat history</h4>
			<p>
				The chat history is kept through page reloads and disconnects, as long as the browser tab is not closed. Additionally,
				if a user only disconnects for a few seconds and no "character disconnected" message was yet shown to other users in the chat,
				all chat messages sent during the disconnect will still be shown after reconnecting. Essentially, users with a bad Internet
				connection will not miss any new messages sent while they are offline for a few seconds.
			</p>

		</>
	);
}
