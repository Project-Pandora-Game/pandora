import React, { ReactElement } from 'react';

export function WikiContact(): ReactElement {
	return (
		<>
			<h2>Contact Us</h2>
			<p>
				You can contact us by any of the following methods.
			</p>
			<p>
				Using our Discord server:<br />
				<a href='https://discord.gg/EnaPvuQf8d' target='_blank' rel='external nofollow noopener noreferrer'>
					<img src='https://discord.com/api/guilds/872284471611760720/widget.png?style=banner2' alt='Discord invite' />
				</a>
			</p>

			<p>
				If you don't own a Discord account and don't want to create one,
				you can also alternatively use the email address: <a href='mailto:support@project-pandora.com'>support@project-pandora.com</a><br />
				Do note, however, that our response times are much better on Discord
				as only a limited number of developers have access to the email box.
			</p>

			<h2>Reporting problems, bugs and suggestions</h2>
			<p>
				If you encounter any problem or bug inside the game or have any suggestion on what to add or improve,
				please report it on our Discord.
			</p>

			<h2>Contributing</h2>
			<p>
				The game is open source, you can find all related sources on our <a href='https://github.com/Project-Pandora-Game' target='_blank' rel='external nofollow noopener noreferrer'>GitHub</a><br />
				If you want to contribute something (either feature or asset), please contact us first on our Discord,
				so we can synchronize the efforts to make that happen.
			</p>
		</>
	);
}
