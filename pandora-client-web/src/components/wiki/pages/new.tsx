import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function WikiNew(): ReactElement {
	return (
		<>
			<h2>New user guide</h2>

			<h3>First steps when starting</h3>

			<p>
				This guide is targeting brand new users in Pandora and will help to take the first steps in the club.
			</p>
			<p>
				Your account can have several characters, but initially you start with one character with a randomized appearance.
				You find yourself in your personal space, which is like a safe sandbox to try things out alone.
				From there you can for instance open the wardrobe where you can change your body
				and looks as well as your clothes. By default you own all items existing in Pandora from the start.
			</p>
			<p>
				From your personal room you can also switch to a list of online spaces where you can meet other users of the platform.
				By default, Pandora is a safe space where no one can do anything to you. When someone else wants to do anything
				to your character, a permission popup will open asking you if you consent to this action.
			</p>
			<p>
				It may be wise to first talk to other users a bit and get to know them and look if they have a profile that tells you
				something about them, before you give any permissions to them.
			</p>

			<h3>Main chat message types</h3>

			<p>
				There are several types of messages that you can use in a space's chat. Feel free to experiment with them, as your personal
				space also has a chat tab.
			</p>

			<h4>Chat commands</h4>

			<p>
				Every message starting with a "/" character is a command. There is no "/help" command, but you rather get a full list of commands
				and what they do when you simply start typing a "/" into the chat input field. Command messages cannot be seen by other users in the room.
			</p>

			<h4>Normal talking</h4>

			<p>
				When you type something into the chat input field your character says this to everyone in the room. It is also called
				in-character or standard message, and the message is printed in the chat with your character's name in front of it.
				While it is usually not needed, you can also use the "/say" command to send a normal message.
			</p>

			<h4>Out-of-character talking / OOC</h4>

			<p>
				The next type are out-of-character or short "OOC" messages. Those are written by putting a "((" in front of your message.
				Alternatively you can also use the "/ooc" command to send such a message.
				The [OOC] tag in front of a message signals everyone that this text was not spoken by your character but comes from the real human
				user behind the screen. It can for example be used to convey limits or talk about not being comfortable with how the scene goes
				or to indicate that you have to leave the club soon. It is especially used to ask
				to be let go or to stop the play, representing a kind of "safeword" usage. It is frowned upon if it is used to circumvent the effects
				of a gag to keep talking as the character to
				other characters, as it is confusing for others to differentiate if the message came from the character or the human user.<br />
				Please respect the responsible use of OOC and take the content seriously. It is no longer fun and games if someone asks
				to be freed in an OOC message!
			</p>

			<h4>Emotes</h4>

			<p>
				Emote type messages are actions by your character or world-building text descriptions that enhance the roleplaying experience.
				Character emotes are written by a leading "*" symbol (or with a "/me" command) and describe the state or action of
				your character, such as: <i>Yourcharactername is petting Eve's head.</i>
			</p>

			<p>
				On the other hand, starting the message with  double "**" characters (or with an "/emote" command) writes a general, nameless
				emote that lets you describe the
				environment, other events happening in the room, or something other users can see or notice. It is the most important tool
				for immersive roleplaying.
			</p>

			<h4>Whispers</h4>

			<p>
				There are several ways to whisper someone in the same room, but the main ones are listed in the following.<br />
				Any of them puts you into a whisper mode that you need to explicitly leave by using the "Cancel"-button above the chat input.
				Whispered messages can only be seen by the target and not by anyone else. Note that you can also send an OOC message as a
				whisper by starting message with "((".
			</p>
			<ul>
				<li>You can click on a character's name in the chat itself.</li>
				<li>You can click on a character's name under the character on the room background to open a context menu and select "Whisper" there.</li>
				<li>You can click on the "Whisper"-button next to a character name in the "Room"-tab.</li>
				<li>You can use the chat command "/w [target]" using either the character name or the character ID as whisper target argument.</li>
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
				However, there are a few items that cannot be removed by other users, but these items are disabled on a new account to protect
				new users. Be wary if someone instructs you to enable some "fun locks they want to use for a play" in your account, as they can get
				you really stuck. If you ever find yourself in such a case, you can still use the last resort, which is "safemode" (more on that later).
			</p>
			<p>
				Another way that can get you stuck is if you permit someone to put you into a room furniture/device that restraints you, as you
				then can no longer leave the room and disconnecting or closing Pandora will not make you leave your current room either.
				Again, if you get into such a situation where you no longer feel in a consensual situation and in case communicating with OOC messages
				would not help, using the "safemode" is the only way out.
			</p>
			<p>
				You can enter "safemode" via the button under your character in the "Room"-tab, in the same row where the wardrobe and profile buttons are.
				It should be seen as a last resort tool and you should try to resolve a situation if possible by communicating OOC first before using it,
				as it can potentially hurt the other user if you use "safemode" for seemingly no reason.
			</p>

			<p>
				This was just a brief overview of this topic. There is a whole <Link to='/wiki/safety'>wiki-tab</Link> dedicated to it
				that we recommend to read at your own leisure. It for instance describes how to set
				a <Link to='/wiki/safety#SA_Display_name'>custom display name</Link>.
			</p>

			<h3>Decorating your room</h3>

			<p>
				You can decorate your personal space with <Link to='/wiki/items#IT_Room-level_items'>room-level items</Link>, such as
				picture frames, chairs, or kinky furniture. To do that you can click the button "Room inventory" in your personal space,
				which leads you to the inventory of your personal space. This basically represents the items standing around or being stored
				inside the room, except the items worn or held by your own character.
			</p>

			<p>
				To for instance place a "Heart Throne" in the room, you either filter the right side of the inventory by typing in the name of the item
				or you press the bed-icon to filter the list of items you can create in the room inventory to only show furniture.
				Click the Heart Throne and create it in the room inventory on the left side. Before it appears in the room, you need to deploy it first.
				Press on the Heart Throne on the left side and press the "Deploy the device" button on the right side.<br />
				Afterwards, the left area shows you a preview of the furniture inside your personal space and you can use the "Back"-button in the top
				right to go back to the room view.
			</p>

			<p>
				To move the throne, you need to enter "room construction mode" with the according button under the "personal space"-tab. This turns
				the blue button under the throne into a red action button. Clicking it lets you select "Move" in the context menu.
				Now you can move the item around on the background by dragging the left icon to the desired position. Not important now,
				but in case you were wondering, the right button is used to move the device up or down vertically, so along the z-axis.
				After you are done positioning the throne, you can exit move-mode by clicking the left button again. Afterwards, you can disable
				room construction mode again.
			</p>

			<p>
				Maybe you now want to sit on your newly added throne? Drag the name under your character towards the throne to move next to it.
				Then click on the blue action button under it, select "Slots" in the context menu,
				and then "Sitting on the throne", which is the name of the character slot that this item has. Finally, select your character name
				to sit on it.
			</p>

			<p>
				Again a reminder that some of the more kinky furniture can tie your character to the room device, which makes you unable to leave the
				space and can trap the character in it, if you are in a private space with no one there to help.
				Therefore it is advised to be mindful of that when giving someone the permission to make you enter a character slot of a
				room-level item. Kinky furniture is therefore maybe not the best tool to use in a first roleplaying scene at a "first date".
				If you find yourself stuck in an empty public space, you can ask a friend for help with a direct message
				by <Link to='/wiki/spaces#SP_Space_invites'>inviting them</Link> to the space.
				Entering "safemode" can still free you of course as well, so the worst-case consequences are not necessarily severe.
			</p>

			<h3>Creating your own chatroom space</h3>

			<p>
				Trying out things in your personal space is nice and cozy, but eventually you may want to either join a space with other users or
				even host your own space. You can do that by clicking the "List of spaces" button, and then press the last row
				"Create a new space". This brings you to a screen where you can enter the properties of your new space, such as name, description,
				and background image.<br />
				The default setting of a new space is private, so if you want it to be public, you need to switch this default setting
				to "Yes".
			</p>
			<p>
				Spaces in Pandora are persistent. This means that all settings, the items in the room inventory, and all deployed furniture
				stays like it was, after you left the space. So the next time you log in you will still see your space in the list of spaces
				and everything will be like you set it up before.<br />
				You can find out more about how spaces work under the <Link to='/wiki/spaces'>spaces-tab</Link> in the wiki. For now we recommend you
				to continue reading about the <Link to='/wiki/introduction'>core features of Pandora</Link> to get an impression of what you can expect,
				in case reading about this interests you.
			</p>
		</>
	);
}
