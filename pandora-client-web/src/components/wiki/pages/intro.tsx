import { ReactElement } from 'react';
import { Link } from 'react-router';
import { Row } from '../../common/container/container.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';
import { MESSAGE_EDIT_TIMEOUT } from '../../gameContext/gameStateContextProvider.tsx';

export function WikiIntroduction(): ReactElement {
	return (
		<>
			<Row alignX='end'>
				<a href='/wiki/' target='_blank' rel='noopener noreferrer'>⧉ Open wiki in a separate window</a>
			</Row>
			<h2>Wiki: Introduction to Pandora's features with further information</h2>

			<p>
				Pandora's vision is to establish a consensual BDSM roleplaying platform that focuses on text-heavy interactions with visual support
				and meaningfully secure restraining effects. The design focus is to encourage describing scenes textually, with other aspects
				enhancing the immersion. It is a social chat platform with a focus on kinky roleplaying, rather than a game.
			</p>

			<p>
				If you are new to Pandora, it is recommended to first click the following link that leads to the <Link to='/wiki/new'>new user guide</Link>, before proceeding.
			</p>

			The following will list some of the existing core features of Pandora.
			Some of these features are explained in greater detail further below and in other tabs of this wiki.
			<ol type='1'>
				<li>Dynamically generated body model with many poses and free arm movement</li>
				<li>Front and back character view</li>
				<li>Persistent chatroom spaces and a character-specific personal space</li>
				<li>A feature-rich room chat (e.g. message editing, advanced text styling)</li>
				<li>Free character placement and movement inside rooms</li>
				<li>Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</li>
				<li>An already very stable code base (goal: no void memes here)</li>
				<li>Reliable gag talk & locks - development aims to make it impossible to cheat</li>
				<li>Flexible item layering possibilities</li>
				<li>A direct messaging system that supports offline messages and a persistent message history</li>
				<li>Ability to use the browser's back/forward buttons to navigate in Pandora</li>
				<li>User safety features for emergencies</li>
				<li>A permission feature that allows the user to set who is allowed to do what</li>
				<li>Saving item collections in the wardrobe and supporting import/export</li>
			</ol>

			<p>
				Some further details on these features and how to use them:
			</p>

			<h4>1. Dynamically generated body model with many poses and free arm movement</h4>
			<p>
				By opening the character menu by clicking on your character name as well as under the "Poses"-tab, you will find the ability to freely move arms and legs.
				The "Body"-tab in the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link> lets you manage <Link to='/wiki/items#IT_Body_parts'>body parts</Link>.
			</p>

			<h4>2. Front and back character view</h4>
			<p>
				Your character's view can be toggled in the pose menu. The chosen position is seen by everyone in the room.
				Alternatively, you can simply use the "/turn" command in the chat.
			</p>

			<h4>3. Persistent rooms & personal room</h4>
			<p>
				In Pandora, a user created space can consist of one or (in the future) several rooms and everything is persistent
				(settings, <Link to='/wiki/spaces#SP_Room_inventory'>inventory</Link>,
				and <Link to='/wiki/items#IT_Room-level_items'>room devices</Link> remain even after everyone has left). Every account can own a
				limited amount of spaces. A space only gets deleted when it no longer has any owners.<br />
				Spaces set to public are visible if the configured condition is met (either someone is online inside or an admin is online inside).
				You can always see spaces where you are either owner, admin, or on the allow list (even if they are private or empty).
			</p>
			<p>
				When a character goes offline inside a room, they will stay in the space the room is a part of and are shown as not connected.
				By default, this is shown by the character having a ghost-like effect. This effect can be changed in the settings.
			</p>
			<p>
				Every character also has their own <Link to='/wiki/spaces#SP_Personal_space'>personal space</Link> that cannot be deleted
				and also not entered by any other character.<br />
				You can find more information about spaces and rooms under the <Link to='/wiki/spaces/'>"spaces"-tab</Link>.
			</p>

			<h4>4. A feature-rich room chat</h4>
			You can find more information about all chat related features under the <Link to='/wiki/spaces/'>"spaces"-tab</Link>.
			<ul>
				<li>Click a name in the chat to start whispering to that person</li>
				<li>Right-clicking your own message enables you to edit or delete it for { MESSAGE_EDIT_TIMEOUT / 1000 / 60 } mins after posting it</li>
				<li>To get help on chat commands, start the command by typing the "/" character, which will then show the list of available commands</li>
				<li>You can write Out-Of-Character (<Link to='/wiki/safety#SA_Out-of-character_communication'>OOC</Link>) messages by prefixing them with "(("</li>
			</ul>

			<h4>5. Free character placement and movement inside rooms</h4>
			<p>
				You can freely move your character inside a room by dragging them by the name below the character.
				Space admins can also move other characters this way. <Link to='/wiki/characters#CH_Character_movement'>More information here</Link>.
			</p>

			<h4>6. Room-level furniture and devices that can be placed freely and that persist with the lifetime of the room</h4>
			<p>
				Room-level items can only be set up, moved, and removed by permitted characters, for instance space admins.
				Some special ones can be used/entered by everyone. <Link to='/wiki/items#IT_Room-level_items'>More information here</Link>.
			</p>

			<h4>7. Stable code base</h4>
			<p>
				Pandora aims for a stable experience without random disconnects. That said, in case a brief disconnect of several seconds would happen,
				new chat messages in that time frame will be shown to the user on reconnect. They will only start missing messages after they
				are mentioned in the chat as disconnected after that short grace period.<br />
				Additionally, Pandora's server architecture is scalable to support future growth of its user base without compromising stability.
			</p>

			<h4>8. Reliable gag talk & locks</h4>
			<p>
				Pandora validates and performs all character interactions on the server,
				preventing the creation of scripts/mods that do undesired actions, such as anti-garble or unauthorized removal
				of (<Link to='/wiki/items#IT_Lock_module'>locked</Link>) restraints.<br />
				This ensures consistency in what others see, resulting in everyone having the same experience.
			</p>

			<h4>9. Flexible item layering possibilities</h4>
			<p>
				The items from the constantly growing number of assets in Pandora, available to everyone from the start,
				can be ordered (almost) freely: As long as the item's requirements are satisfied, you can combine items in whatever order you want.
				Right now, you can only add each asset once, but in the future you will be able to add countless layers of rope, if that is what you want.<br />
				<Link to='/wiki/items#IT_Item_layering_order'>More information here</Link>.
			</p>

			<h4>10. A direct messaging system</h4>
			<p>
				To write someone a DM, <Link to='/wiki/characters#CH_Character_context_menu'>click their name</Link> below their character, or click
				the contacts icon at the top and then under the "DMs"-tab
				you have to either look for the account name of the user you want to exchange messages with on the left, or
				you have to search for them via the bottom left input field using their <b>account ID</b>. You can find the account
				ID either under the "Contacts"-tab or in the "Room"-tab while with a character in the same space/room. The account ID is
				the rightmost number behind the character name.<br />
				Direct messages are end-to-end encrypted. Messages and contacts are shared between all characters of one account.
			</p>

			<h4>11. Using back/forward buttons/keys</h4>
			<p>
				Pandora has the ability to use the browser's back/forward buttons to navigate in Pandora and URLs can be copied, linked, and used.
				You can even have certain account-level views open in a parallel window, such as the chatroom and the wiki, contacts, or direct messages
				screen side by side.
			</p>

			<h4>12. User safety features for emergencies</h4>
			<p>
				Beyond <Link to='/wiki/safety#SA_Out-of-character_communication'>OOC-communication</Link>, there are two user safety features for
				emergencies: <Link to='/wiki/safety#SA_Safemode'>Safemode</Link> and <Link to='/wiki/safety#SA_Timeout_mode'>timeout mode</Link>. You
				can find those features via a button next to your own name in the "Room"-tab. Both modes are designed to make it harder
				to misuse safety features outside of their intended usage.
			</p>

			<h4>13. A permission feature that allows the user to set who is allowed to do what</h4>
			<p>
				You can see and change the current permissions in the Pandora settings. Permissions are character-specific and not
				account-wide. <Link to='/wiki/characters#CH_Character_permissions'>More information here</Link>.
			</p>

			<h4>14. Saving item collections in the wardrobe and supporting import/export</h4>
			<p>
				The "Items" and "Body"-tabs in the <Link to='/wiki/characters#CH_Character_wardrobe'>wardrobe</Link> as well as
				the <Link to='/wiki/spaces#SP_Room_inventory'>room inventory</Link> screen have an "Saved items"-tab
				that lets you access and manage all your custom item collections stored on the Pandora server.<br />
				It also allows you to export and import collections to save them locally if you run out of storage space or
				to share them with others. A collection can contain any type of item,
				even <Link to='/wiki/items#IT_Room-level_items'>room devices</Link>.<br />
				<Link to='/wiki/items#IT_Saving_collections'>More information here</Link>.
			</p>

			<hr />

			That's not all of course! We have many exciting features planned for the future. In no particular order:
			<ul>
				<li>Character modifiers - putting effects and rules on characters with deeply customizable activation conditions and lock support</li>
				<li>Expanding the notification options</li>
				<li>More customization options for items, for instance creating items with their configuration permanently frozen</li>
				<li>Further improved UI with focus on better usability and potentially more design themes</li>
				<li>Spectator mode for spaces that will help to not disrupt the chat during plays and that can be managed by space admins</li>
				<li>More space features that allow space admins to modify the space-wide rules to customize the experience for everyone inside</li>
				<li>Room templates</li>
				<li>Allowing spaces to contain several connected rooms with a user-defined layout and ways to move from room to room</li>
				<li>Key system for locks and more lock types in general</li>
				<li>Visible locks on worn items with different lock designs</li>
				<li>Showing and managing relationships between characters</li>
				<li>More supporting features for roleplaying, for instance a new space role "storyteller" that can orchestrate a prepared roleplay without a physical presence in any room of the space</li>
				... and many more, which can be found by looking at Pandora's issue list on <ExternalLink href='https://github.com/Project-Pandora-Game/pandora/issues'>GitHub</ExternalLink>
			</ul>
		</>
	);
}
