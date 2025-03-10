import { ReactElement } from 'react';
import { ExternalLink } from '../../common/link/externalLink.tsx';

export function WikiHistory(): ReactElement {
	return (
		<>
			<h2>Pandora's history</h2>

			<h4>How it all started</h4>

			<p>
				Pandora was founded by many developers and contributors of a free and open-to-contribute project called "Bondage Club" (BC).
				In early 2021, most BC developers at that time concluded that they do not want to support BC anymore, as they see various issues with it that
				cannot realistically be solved.<br />
				It was an often voiced desire from parts of the community to have an alternative to BC and therefore talks about making a new platform started.
				In August 2021, "Project Pandora" officially started with the creation of the{ ' ' }
				<ExternalLink href='https://discord.gg/EnaPvuQf8d'>
					Pandora Discord
				</ExternalLink>
				.<br />
				<br />
				The first half year was focused on looking for suitable technologies, asset basis, and architecture planning.
				Progress was slow but steady, as making such a platform is a huge amount of work and requires careful planning and discussions.
				Moreover, it is merely a hobby for everyone, spending some free time here and there besides the actual day-time work, friends & family, etc.<br />
				Since April 2024, Pandora is in a closed beta phase and is available to an audience beyond the initial group of founders.
			</p>

			<h4>Does Pandora want to replace BC?</h4>

			<p>
				Not at all! It is even likely that our vision for Pandora is not attractive enough to a significant part of today's BC community.
				We want Pandora to be a secure, consensual roleplaying platform that focuses on text-heavy interactions.
				BC was a bit like that in its first year before more and more game-like features were added that changed the focus of public rooms and the
				interests of parts of the community slowly. Also the fact that console-usage/scripts/mods/extensions in BC are so all-powerful has certain
				drawbacks and is exploited quite often.<br />
				In a way, Pandora is offering an improved "classic" experience, focusing on roleplaying and clear house rules. We will actively remove/hinder
				ways with which users can cheat or gain unexpected feature advantages. Instead of embracing unofficial scripts/mods that can pose
				a security risk to Pandora's users and will lead to a fragmented user experience, we encourage developers with feature ideas to get in
				touch with us about contributing to Pandora directly.
			</p>

			<h4>What issues with BC were seen?</h4>

			<ul>
				<li>Technical quality of BC: The source code of BC was not of good quality and while it improved quite a bit over the years (to a large part
					thanks to the same people who founded Pandora), it is essentially still something held together by many band aids and compromises.
					Since there were unsolvable roadblocks on the way to change that, starting from scratch seemed like the better decision compared to
					trying to clean up constantly, especially as there are no suitable quality standards and checks for new contributions, making this topic
					an endless struggle.
				</li>
				<li>BC project management: The desire for a different project management approach and development process was strong.</li>
				<li>BC server architecture: It is singular and cannot scale beyond a certain number of users, where lag and disconnects slowly get worse.
					Starting from scratch with a modern and scalable approach seemed like the best option to give users a stable experience.
				</li>
				<li>Not Open-Source: While the source code of BC is public, it is not fully licensed under an open-source license. That means that most parts of BC
					are proprietary and owned by its authors and that would mean that one cannot legally use the BC code anywhere else or copy it and further
					develop it (e.g. if the project manager would disappear some day) without the explicit permission of almost every person who ever contributed
					to BC which makes a reuse/continuation almost impossible. The longevity of BC is therefore unpredictable and contributing to BC
					can be seen as a risk to invest time into a black hole.
				</li>
				<li>
					Lack of server validation: In many cases the server in BC does not validate what the client does, which makes it possible for everyone
					to alter things like locks, restraints, or messages. The overall lack of security was a concern often voiced.
				</li>
				<li>
					No tests: BC has no (automated) tests that notify a contributor accidentally breaking something. In a project like BC, which is built
					upon the code of more than hundred people with different experience levels, this regularly leads to significant quality issues and
					an unnecessarily high number of bugs, especially since BC has no suitable review process for adding new features.
					Looking into those reported bugs is a very time-intense and mostly not fun burden for voluntary developers investing their
					free time to keep things running.<br />
					Some bugs will even never be found, yet will contribute to problems such as instabilities or lag over time.
				</li>
				<li>
					Inflexible releases: Aside from the first days after a new release and severe, game-breaking issues,
					fixes in BC have to wait until the next release one month later, which can be inconvenient and annoying for the affected users.
				</li>
				<li>Asset creation: Asset creation in BC needs many variants of the same image and it is an extreme effort to add new poses.</li>
				<li>Legality of assets/images: In BC there is no process for vetoing assets. Most of them do not provide where they originate
					from or how the sources used for the assets were licensed. Proper licensing is the correct and safe way.
				</li>
			</ul>

			<h4>The people behind Pandora (Last updated: 1-11-2023)</h4>
			<br />
			<strong>Lead Developers</strong>
			<ul>
				<li>Ace</li>
				<li>Claudia</li>
				<li>Ellie</li>
				<li>Jomshir (Clare)</li>
				<li>Sekkmer</li>
			</ul>
			<strong>Developers</strong>
			<ul>
				<li>Kane (Hareo)</li>
				<li>Nina</li>
				<li>Nythaleath</li>
				<li>Sandrine</li>
				<li>TechTheAwesome</li>
				<li>Titania</li>
			</ul>
			<strong>Founders</strong>
			<ul>
				<li>Ace</li>
				<li>Ada</li>
				<li>Cecilia</li>
				<li>Claudia</li>
				<li>Ellie</li>
				<li>EmilyR</li>
				<li>Estsanatlehi</li>
				<li>Eve</li>
				<li>Jenn</li>
				<li>Jomshir (Clare)</li>
				<li>Kane (Hareo)</li>
				<li>Kimei Nishimura</li>
				<li>Natsuki</li>
				<li>Nina</li>
				<li>Nosey Gatey (Gatetrek)</li>
				<li>Nythaleath</li>
				<li>ruilove</li>
				<li>Sandrine</li>
				<li>Sekkmer</li>
				<li>Sidsel</li>
				<li>TechTheAwesome</li>
				<li>Titania</li>
				<li>Verity</li>
			</ul>

		</>
	);
}
