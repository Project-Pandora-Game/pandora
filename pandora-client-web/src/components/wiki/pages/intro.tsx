import React, { ReactElement } from 'react';

export function WikiIntroduction(): ReactElement {
	return (
		<>
			<p>
				<h3>Introduction to Pandora with some quick hints to get you started</h3>
			</p>

			<p>
				Pandora's vision is to be a strict & secure, consensual roleplay platform that focuses on text-heavy interactions.
			</p>

			To that end the following will list some of the existing core features of Pandora.
			Some of these features are explained in greater detail further below.
			<ul>
				<li>Dynamically scaling body model with many poses and free arm movement</li>
				<li>Front and back character view</li>
				<li>A feature-rich room chat (e.g. message editing; advanced text styling)</li>
				<li>Free character placement and movement inside rooms</li>
				<li>Room-level furniture and devices that can be placed freely and that persist with the life-time of the room</li>
				<li>An already very stable code base (goal: no void memes here)</li>
				<li>Actually "secure" gag talk & locks - development aims to make it impossible to cheat</li>
				<li>A direct messaging system which supports offline messages and a persistent message history</li>
				<li>Ability to use the browser's back/forward buttons to navigate in Pandora</li>
				<li>No safeword feature, but a safemode that makes it harder to be misused to constantly free characters</li>
			</ul>

			<p>
				Some further details on these features and how to use them:
			</p>

			<h4>Dynamically generated body model with many poses and free arm movement</h4>
			<p>
				In the pose tab the ability to freely move arms and legs is hidden away under a dev-section at the bottom of the screen.
				You can expand it to show the according sliders.
			</p>

			<h4>Front and back character view</h4>
			<p>
				Can be toggled in the pose menu and is seen that way for everyone in the room.
			</p>

			<h4>A feature-rich room chat</h4>
			<ul>
				<li>Click a name in the chat to start whispering to that person</li>
				<li>Right-clicking your own message enables you to edit or delete it for 10 mins after posting it</li>
				<li>To get help on chat commands, start the command by typing the "/" character which will start showing a list of available commands</li>
				<li>You can write Out-Of-Character (OOC) messages by prefixing them with "(("</li>
				<li>You can enclose text with underscores to style it, such as _<i>italic</i>_ and __<b>bold</b>__</li>
			</ul>

			<h4>Free character placement and movement inside rooms</h4>
			<p>
				You can freely move your character inside a room by dragging them by the character name below.
				Room admins can also move other characters this way.
			</p>

			<h4>Room-level furniture and devices that can be placed freely and that persist with the life-time of the room</h4>
			<p>
				Room devices first have to be deployed from the room inventory to the room in the item menu.
				Then, the room devices can be freely moved/positioned in the room by dragging them by the icon below.
				The icons below room devices can be toggled to be hidden under the "Controls"-tab.
			</p>

			<h4>Stable code base</h4>
			<p>
				Pandora aims for a stable experience without random disconnects. But even if a short disconnect happens, the character will not be shown as disconnected for some time and you will still receive all the missed chat messages on reconnect, not loosing anything.
			</p>

			<h4>Actually "secure" gag talk & locks</h4>
			<p>
				Pandora validates and performs all character interactions on the server,
				preventing the creation of scripts/mods that do undesired actions, such as anti-garble or unauthorized removal of (locked) restraints.<br />
				This ensures that you can depend on what others see,
				resulting in everyone having the same experience.
			</p>

			<h4>No safeword feature, but a safemode that makes it harder to be misused</h4>
			<p>
				The safemode feature can be found by clicking on your character name in the top left of the screen and then entering safemode in the menu.
			</p>

			<hr />

			That is not all of course! There are many features planned for the future:
			<ul>
				<li>Item templates that store your favorite asset configurations per asset, including things like color, custom name,</li>
				description/lore about the item, etc.
				<li>Wardrobe outfit saving feature as well as import/export</li>
				<li>Relationship feature</li>
				<li>Character profile and biography</li>
				<li>Hearing impairment effect for assets</li>
				<li>Advanced permission feature</li>
				<li>Character rules</li>
				<li>Character contracts to temporarily or permanently agree on sets of rules and permissions between specific characters</li>
				<li>Improved new player experience & safety</li>
				... and many more that you can find by looking at Pandora's issue list on <a href='https://github.com/Project-Pandora-Game/pandora/issues' target='_blank' rel='external nofollow noopener noreferrer'>GitHub</a>
			</ul>
		</>
	);
}
