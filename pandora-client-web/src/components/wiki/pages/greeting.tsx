import React, { ReactElement } from 'react';
import { Row } from '../../common/container/container';
import { WikiContent } from '../wiki';
import maid from '../../../assets/maid.png';
import wikiIcon from '../../../assets/icons/wiki.svg';
import { useHelpUserName } from '../../help/helpUtils';
import { ExternalLink } from '../../common/link/externalLink';
import { Button } from '../../common/button/button';
import { usePlayer } from '../../gameContext/playerContextProvider';
import { useNavigate } from 'react-router';

export function WikiGreeting(): ReactElement {
	const characterSelected = usePlayer() != null;
	const navigate = useNavigate();

	return (
		<Row className='fill-y'>
			<WikiContent>
				<p>
					“ Dear { useHelpUserName() },<br />
					<br />
					a warm welcome to Club Pandora!<br />
					<br />
					Let me give you some important hints and tips about your stay in the club and its rules.<br />
					<br />
					Pandora is a <ExternalLink href='https://wikipedia.org/wiki/BDSM'>BDSM</ExternalLink> club.<br />
					We want Pandora to be a safe and welcoming place, but that also requires your help!
					Please be aware that different people have different preferences and limits.<br />
					It is also important to be aware of what a <ExternalLink href='https://en.wikipedia.org/wiki/Safeword'><b>Safeword</b></ExternalLink> is and respect it when others use it.<br />
					<br />
					During your stay you will often encounter various restraining items.
					Restraints in Pandora are very secure and can really get you stuck with no one else being able to help so please be mindful of that.
					As always, communication with others is the most important tool in our club community, but Pandora also offers several emergency mechanisms to keep you safe.<br />
					First of those is the ability to enforce your own limits through <i>permissions</i> - allowing you to prevent others from doing certain things to your character.
					Right now, the club is a totally safe space. You have to permit other visitors to be able to do actions individually or
					generally, before anything can happen to you. Moreover, due to the security of restraints in Pandora, stricter ones such as
					password locks are set to be unavailable to other characters until you change these default item limits.<br />
					<br />
					Second important mechanism is for when communication should fail or someone not respecting your safeword. For such a case there are two safe modes,
					which you can enter under the "Room"-tab via a button next to your character name: Timeout and safemode.
					Both modes prevent interactions in both ways while active. Do note, however, that we consider safemode a last-resort option for emergencies.
					It comes with a cooldown period that simulates stopping the play after a safeword usage to recover and be safe.<br />
					<br />
					You can find more guidance by pressing the "<img src={ wikiIcon } width='14' height='13' alt='Wiki' />"-button on the top bar.<br />
					<br />
					The club is still being renovated so you can expect many new things over time or even help us with building it up! Please be aware that the Pandora team
					has a firm vision of how the club shall work, so it is best to familiarize yourself with the club and the plenty available information first
					(such as the <ExternalLink href='https://github.com/Project-Pandora-Game/pandora/blob/master/CONTRIBUTING.md'>contributing guideline</ExternalLink>).
					You can consider the current limited selection of items a demonstration of the vast asset creation possibilities in Pandora with the community's help.<br />
					<br />
					Please have a joyful stay~ ”
				</p>

				{
					characterSelected ? null : (
						<Row alignX='center'>
							<Button onClick={ () => navigate('/') }>Get started</Button>
						</Row>
					)
				}
			</WikiContent>
			<Row alignX='center' className='maid-container'>
				<img src={ maid } />
			</Row>
		</Row>
	);
}
