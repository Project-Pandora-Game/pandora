import React, { ReactElement } from 'react';
import { Row } from '../../common/container/container';
import { WikiContent } from '../wiki';
import maid from '../../../assets/maid.png';
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
			<Row alignX='center' className='maid-container'>
				<img src={ maid } />
			</Row>
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
					During your stay you will often encounter various restraints.
					Restraints in Pandora are very secure and can really get you stuck with no one else being able to help so please be mindful of that.<br />
					While communication with others is the most important tool, Pandora also offers several mechanisms to keep you safe.<br />
					First of those is the ability to enforce your own limits through <i>permissions</i> - allowing you to prevent others from doing some things to your character.
					Right now other visitors can interact with you as they wish, which you can change in the settings via the "cog" icon on the top right.<br />
					<br />
					Second important mechanism is for when communication fails or others don't respect your safeword - for such a case there is a safemode feature,
					which you can find in the top left by clicking the name of your character.
					Do note, however, that we consider safemode as a last-resort option for emergencies and there are small drawbacks to using it,
					most notably while other characters cannot interact with your character while in safemode, you also cannot interact with them.
					It also comes with a cooldown period that simulates stopping the play after a safeword usage to recover and be safe.
					This is explained further in the safemode menu.<br />
					{ /* Right now, the club is a totally safe space. You have to permit other visitors to be able to do things individually or
					generally, before anything can happen to you.
					Moreover, as restraints in Pandora are very secure, the stricter ones such as password locks have to be permitted by you
					individually. The reason is that such restraints can really get you stuck with no one else being able to help.
					To balance this strictness there is a safemode feature you can find top left by clicking on your name for emergency purposes.
					It comes with a cooldown period that simulates stopping the play after a safeword usage to recover and be safe. We hope you
					will never get into a situation where you will have to use this mode.<br /> */ }
					<br />
					You can find more guidance by pressing the (?) button on the top bar.<br />
					<br />
					The club is still being renovated so you can expect many new things over time or even help us. Please have a joyful stay~ ”
				</p>

				{
					characterSelected ? null : (
						<Row alignX='center'>
							<Button onClick={ () => navigate('/') }>Get started</Button>
						</Row>
					)
				}
			</WikiContent>
		</Row>
	);
}
