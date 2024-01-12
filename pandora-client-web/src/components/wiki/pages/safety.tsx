import React, { ReactElement } from 'react';

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
				<li><a href='#SA_Out-of-character_communication'>Out-of-character communication</a></li>
				<li><a href='#SA_Timeout_mode'>Timeout mode</a></li>
				<li><a href='#SA_Safemode'>Safemode</a></li>
				<li><a href='#SA_Display_name'>Display name</a></li>
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
				The timeout mode can be used as an escalating mechanism in the unlikely case that
				<a href='/wiki/items/#SA_Out-of-character_communication'>OOC</a> communication is not immediately
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
				Additionally, it allows you to remove items freely from yourself, ignoring
				<a href='/wiki/items/#IT_Lock_module'>locks</a>, doors, or restricting <a href='/wiki/items/#IT_Room-level_items'>room devices</a>.
				Nothing can hold or limit you in this mode.<br />
				Safemode should be seen as a last resort that you will hopefully never need to use in the case when your
				<a href='/wiki/items/#SA_Out-of-character_communication'>OOC</a>-wishes were maliciously ignored or you were irresponsibly abandoned.
			</p>
			<ul>
				<li>You can enter safemode at any time by clicking the "Enter safemode"-button next to your character under the "Rooms"-tab.</li>
				<li>After you entered safemode, you will be unable to leave the mode for a certain time, which simulates a period of time to recover from a bad play.</li>
				<li>The cooldown period is there to prevent misuse and should not matter, as it is only a backup user safety feature that would almost never be needed.</li>
				<li>As we add further features that support user safety, we will likely increase the safemode cooldown time.</li>
			</ul>

			<h4 id='SA_Display_name'>Display name</h4>
			<p>
				Pandora also gives you the ability to change the display name for your user account that is used in your account's profile or in the contacts list, as well
				as for chatting via direct messages. The default display name is your login username.<br />
				If you do not want your username to be publicly visible to others, for safety or security reasons, you can change the display name under Settings
				at the top and then "Account"-tab. The display name can be changed once every 7 days.
			</p>

		</>
	);
}
