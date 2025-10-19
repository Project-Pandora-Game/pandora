import { ReactElement } from 'react';
import { Link } from 'react-router';

export function WikiSafety(): ReactElement {
	return (
		<>
			<h2>User safety</h2>

			<h3>Introduction</h3>

			<p>
				User safety is an essential part of Pandora, like it is in reality while practising BDSM.<br />
				The three cornerstones of safety in Pandora are out-of-character communication, timeout mode, and safemode in the unlikely case everything else fails.
			</p>
			<p>
				<strong>Important:</strong> Never share private details about yourself to others that could enable someone to locate or identify you!
			</p>

			<h3>Safety-specific features</h3>
			<ul>
				<li><Link to='#SA_Out-of-character_communication'>Out-of-character communication</Link></li>
				<li><Link to='#SA_Timeout_mode'>Timeout mode</Link></li>
				<li><Link to='#SA_Safemode'>Safemode</Link></li>
				<li><Link to='#SA_Action_log'>Action log</Link></li>
				<li><Link to='#SA_Display_name'>Display name</Link></li>
			</ul>

			<h4 id='SA_Out-of-character_communication'>Out-of-character communication</h4>
			<p>
				Out-of-character, short "OOC", communication is the first and most important user safety feature.<br />
				It means that messages tagged with "[OOC]" in front shall not be treated as messages by the character you
				are interacting with, but as messages by the human user in front of the keyboard or mobile device.<br />
				Therefore, messages about limits, discomfort or a wish to be let go / freed have to be viewed as
				someone using a BDSM safeword that immediately ends the play and is not negotiable.
			</p>
			<ul>
				<li>You can write OOC messages by using the chat command "/ooc" in front of your sentence.</li>
				<li>You can also write an OOC message by starting your text with two round brackets "((".</li>
				<li>
					If you see someone misusing the OOC feature to talk in-character ("IC") while gagged, it might be helpful to point out to them
					that they are irresponsibly watering down the significance of an out-of-character message classification that is of key
					importance to keep users safe in emergencies.
				</li>
			</ul>

			<h4 id='SA_Timeout_mode'>Timeout mode</h4>
			<p>
				Timeout mode is a state you can enter at any point in time for an unlimited amount of time. It makes other users
				unable to modify anything about your character, but you also cannot interact with other characters in turn.<br />
				The timeout mode can be used as an escalating mechanism in the unlikely case
				that OOC-communication is not immediately
				working or it can be used for you to feel more safe while discussing the situation in OOC messages.
			</p>
			<ul>
				<li>You can enter timeout mode at any time by clicking the "Enter safemode"-button next to your character under the "Rooms"-tab.</li>
				<li>You can freely enter and leave this mode without timing limitations.</li>
			</ul>

			<h4 id='SA_Safemode'>Safemode</h4>
			<p>
				Safemode is a mode that immediately disables all restricting effect that were applied to your character. It also prevents everyone
				else from modifying anything about your character or interact with you while you are in this mode, similar to timeout mode.
				You also cannot interact with other characters during it, but we are considering removing this limitation in the future.
				Additionally, the mode allows you to remove items freely from yourself, ignoring <Link to='/wiki/items#IT_Lock_module'>locks</Link>,
				doors, or restricting <Link to='/wiki/items#IT_Room-level_items'>room devices</Link>.
				Nothing can hold or limit you in this mode.
			</p>
			<p>
				Safemode should be seen as a last resort that you will hopefully never need to use in the case when
				your <Link to='#SA_Out-of-character_communication'>OOC</Link>-wishes were maliciously ignored or you were irresponsibly abandoned.
				The intended way to get out of restraints is to ask other characters for help with removing them.
			</p>
			<p>
				Some items might not be removable by everyone (for example several lock types). By default these items require additional permissions
				to be used. The decision whether to allow someone to use them or not is left to users, letting everyone choose if they are
				comfortable with such items being used and trust the person using them.
				If you don't feel comfortable with these items being used on you, simply deny the request.
			</p>
			<ul>
				<li>You can enter safemode at any time by clicking the "Enter safemode"-button next to your character under the "Rooms"-tab.</li>
				<li>After you entered safemode, you will be unable to leave the mode for a certain time, which simulates a period of time to recover from a bad play.</li>
				<li>
					The cooldown period is there to make restraints feel impactful.
					Safemode was not added to be used outside of emergencies.
					It is a backup user safety feature that will not be needed in consensual, trusted power exchanges.
				</li>
				<li>As we add further features that support user safety, we will likely increase the safemode cooldown time.</li>
			</ul>

			<h4 id='SA_Action_log'>Action log</h4>
			<p>
				The action log is a special chat state that you can enable by pressing the bar with the white cog above the chat input field and then toggling
				"Show action log".<br />
				This mode shows the history of actions interleaved between the regular chat messages by time stamp. The action log lists
				all the actions that were taken by any character in the current space in great detail and should be seen as OOC knowledge. You can temporarily show
				the log if you require clarity on what happened or who did something. The log is constantly created next to the normal chat message history, even while
				you do not have it enabled, and cleared alongside it (e.g. when leaving the space or closing the browser).
			</p>

			<h4 id='SA_Display_name'>Display name</h4>
			<p>
				Pandora also gives you the ability to change the display name for your user account that is used in your account's profile or in the contacts list, as well
				as for chatting via direct messages. The default display name is the one you registered your account with.<br />
				You can change the display name under Settings
				at the top and then "Account"-tab. The account display name can be changed once every 7 days.
			</p>

		</>
	);
}
