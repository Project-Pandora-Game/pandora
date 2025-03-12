import { LIMIT_CHARACTER_COUNT } from 'pandora-common';
import { ReactElement } from 'react';
import { Link } from 'react-router';

export function WikiNew(): ReactElement {
	return (
		<>
			<h2>New user guide</h2>

			<h3>First steps when starting</h3>

			<p>
				This guide is targeting brand new users of Pandora and will help with taking the first steps in the club.
			</p>
			<p>
				Your account can currently have up to { LIMIT_CHARACTER_COUNT } characters, but initially you start with one character
				with a randomized appearance.
				You find yourself in your personal space, which can be used as a (mostly safe) sandbox to try things out alone.
				From there you can, for instance, open the wardrobe where you can change your body
				and looks as well as your clothes.
				You always own all items that exist in Pandora - there is no need to buy them or get them anywhere.
			</p>
			<p>
				From your personal room you can also switch to a list of online spaces where you can meet other users of the platform.
				Pandora is a safe space by default - no one can do anything to you. When someone else wants to do anything
				to your character, a permission popup will open asking you if you consent to their action.
			</p>
			<p>
				It is advised to first talk to other users a bit, get to know them, and look if they have a profile that tells you
				something about them before you give any permissions to them.
			</p>

			<h3>Main chat message types</h3>

			<p>
				There are several types of messages that you can use in a space's chat. Feel free to experiment with them, as your personal
				space also has a chat tab that is only visible to you.
			</p>

			<h4>Chat commands</h4>

			<p>
				Any message starting with a "/" is a command. There is no "/help" command, but you rather get a full list of commands
				and what they do when you simply start typing a "/" into the chat input field. Command messages cannot be seen by other users in the room (but their results might be, for example a command to roll a dice ("/dice") will show the result to everyone in the space by default).
			</p>

			<h4>Normal/In-character talking (IC)</h4>

			<p>
				When you type something into the chat input field it is understood as your character saying this out loud to everyone in the space. It is also called
				in-character (IC) or standard message, and the message is printed in the chat with your character's name in front of it.
				While it is usually not needed, you can also use the "/say" command to send an in-character message.
			</p>

			<h4>Out-of-character talking (OOC)</h4>

			<p>
				The next type is an out-of-character (or short "OOC") message. Those are written by putting a "((" in front of your message.
				Alternatively you can also use the "/ooc" command to send such a message.
				The [OOC] tag in front of a message signals everyone that this text was not spoken by your character but comes from the human
				user behind the screen. It can be, for example, used to convey limits, talk about not being comfortable with how the scene is going,
				or to indicate that you have to leave the club soon. It is especially used to ask
				to be let go or to stop the play, representing a kind of "safeword" usage.<br />
				It is generally frowned upon using this to talk as your character in this way (IC-in-OOC),
				especially if done to circumvent some in-character restrictions,
				such as the character being gagged.
				It also makes it confusing for others to differentiate if the message is meant to be understood as from the character or the user behind it.<br />
				Please respect the responsible use of OOC and take the content seriously. It is no longer fun and games if someone asks
				to be freed in an OOC message!
			</p>

			<h4>Emotes</h4>

			<p>
				Emote type messages are actions by your character or world-building text descriptions that enhance the roleplaying experience.
				Character emotes are written using a leading "*" symbol (or with a "/me" command) and describe the state or action of
				your character, such as: <i>Character is petting Eve's head.</i>
			</p>

			<p>
				On the other hand, starting the message with double "**" (or with an "/emote" command) writes a general, nameless
				emote that lets you describe the
				environment, other events happening in the room, or something other users can see or notice. It is the most important tool
				for immersive roleplaying.
			</p>

			<h4>Whispers</h4>

			<p>
				There are several ways to whisper someone in the same room, but the main ones are listed here.<br />
				Any of them puts you into a whisper mode that you need to explicitly leave by using the "Cancel"-button above the chat input.
				Whispered messages can only be seen by the target and not by anyone else. Note, that you can also send an OOC message as a
				whisper by starting the message with "((" while whispering.
			</p>
			<ul>
				<li>You can click on a character's name in the chat itself.</li>
				<li>You can click on a character's name under the character on the room graphics to open a context menu and select "Whisper" there.</li>
				<li>You can click on the "Whisper"-button next to a character name in the "Room"-tab.</li>
				<li>You can use the chat command "/whisper target" (or "/w target") using either the character's name or the character's ID as the whisper target argument.</li>
				<li>You can use the chat command "/whisper" (or "/w") without anything afterwards to cancel the state of whispering someone.</li>
			</ul>

			<p>
				There are further advanced, chat-related topics that you can read about in the other tabs of this wiki, such
				as switching <Link to='/wiki/spaces#SP_Room_chat_Chat_modes'>"chat modes"</Link> or <Link to='/wiki/spaces#SP_Room_chat_Editing_text'>"text editing"</Link>.
			</p>

			<h3>User safety</h3>

			<p>
				While Pandora is a completely safe space as long as you do not give any permissions to other users, the consequences of trusting
				someone with certain permissions is not particularly problematic as the restraints and locks that are allowed to be used by other
				users by default can all be removed by other users, too, when you ask for help.
			</p>
			<p>
				However, there are a few items that cannot be removed by other users. These items are disabled on a new account to protect
				new users. Be wary if someone instructs you to enable some "fun locks they want to use for a play" in your account, as they can get
				you truly stuck. If you ever find yourself stuck, you can still use the last resort, which is "safemode" (more on that later).
			</p>
			<p>
				Another way that can get you stuck is if you permit someone to put you into a room furniture/device that restraints you. Then you may no
				longer be able to leave the room/space and disconnecting or closing Pandora will not make you leave your current room/space either.<br />
				Again, if you get into a situation which no longer feels consensual or safe and in case communicating with OOC messages
				would not help, using "safemode" is the only way out.
			</p>
			<p>
				You can enter "safemode" via the button under your character in the "Room"-tab, in the same row where the wardrobe and profile buttons are.
				It should be seen as a last resort tool and you should try to resolve a situation if possible by communicating OOC first before using it,
				as it can potentially hurt the other user if you use "safemode" for seemingly no reason.
			</p>

			<p>
				This was just a brief overview of this topic. There is a whole <Link to='/wiki/safety'>wiki-tab dedicated to safety</Link> that
				we recommend to read at your own leisure.
			</p>

			<h3>Decorating your room</h3>

			<p>
				You can decorate your personal space with <Link to='/wiki/items#IT_Room-level_items'>room-level items</Link>, such as
				picture frames, chairs, or kinky furniture. To do that you can click the button "Room inventory" in your personal space,
				which leads you to the inventory of your personal space. This basically represents the items standing around or being stored
				inside the room.
			</p>

			<p>
				To, for instance, place a "Heart Throne" in the room, you either filter the right side of the inventory by typing the name of the item
				or you press the bed-icon to filter the list of items you can create in the room inventory to only show furniture.
				Click the Heart Throne and create it in the room inventory on the left side. Before it appears in the room, you need to deploy it first.
				Press on the Heart Throne on the left side and press the "Deploy the device" button in the menu that appears on the right side.<br />
				Afterwards, you should see the preview focus on the furniture. You can then use the "Back"-button in the top
				right to go back to the room view.
			</p>

			<p>
				To move the throne, you need to "Enable room construction mode" with the according button under the "personal space"-tab (or "Room" tab if you are in a public space). This turns
				the blue button under the throne into a red action button. Clicking it lets you select "Move" in the context menu.<br />
				Now you can move the item around on the background by dragging the left icon to the desired position. Not important now,
				but in case you were wondering, the right button is used to move the device up or down vertically, so along the z-axis.<br />
				After you are done positioning the throne, you can exit move-mode by clicking the left button again. Afterwards, you can disable
				room construction mode again.
				Disabling the construction mode also leaves the move-mode if you don't leave it first.
			</p>

			<p>
				Maybe you now want to sit on your newly added throne? Drag the name under your character towards the throne to move next to it.
				(This is technically not needed, but this is a roleplay platform, so do play the part! When you want to sit on a chair you don't just teleport to it - you walk to it first!)
				Then click on the blue action button under it, select "Slots" in the context menu,
				and then "Sitting on the throne", which is the name of the character slot that this item has. Finally, select your character name
				to sit on it.
			</p>

			<p>
				Again a reminder that some of the more kinky furniture can tie your character to the room device. This makes you unable to leave the
				space and can trap the character in it, if you are in a private space with no one there to help.
				Therefore it is advised to be mindful of that when giving someone the permission to make you enter a character slot of a
				room-level item. Kinky furniture is therefore maybe not the best tool to use in a first roleplaying scene at a "first date".
				If you find yourself stuck then entering "safemode" can still free you, so the worst-case consequences are not necessarily severe.
			</p>

			<h3>Creating your own chatroom space</h3>

			<p>
				Trying out things in your personal space is nice and cozy, but eventually you may want to either join a space with other users or
				even host your own space. You can do that by clicking the "List of spaces" button, and then pressing the last row
				"Create a new space". This brings you to a screen where you can enter the properties of your new space, such as name, description,
				and background image.<br />
				The default setting of a new space is private, so if you want it to be public, you need to switch the space visibility to one of the two public settings.
			</p>
			<p>
				Spaces in Pandora are persistent. This means that all settings, items in the room inventory, and all deployed furniture
				stays like it is, even after everyone leaves the space. So the next time you log in you will still see your space in the list of spaces
				and everything inside will be like you set it up before (unless, of course, someone else changes it).<br />
				You can find out more about how spaces work under the <Link to='/wiki/spaces'>spaces-tab</Link> in the wiki. For now we recommend you
				to continue reading about the <Link to='/wiki/introduction'>core features of Pandora</Link> to get an impression of what you can expect,
				in case reading about this interests you.
			</p>
		</>
	);
}
