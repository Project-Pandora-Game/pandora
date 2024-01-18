import React, { ReactElement, ReactNode } from 'react';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs';
import { ChildrenProps } from '../../common/reactTypes';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { PrivacyPolicyContent } from '../Eula/privacyPolicy';
import { useNavigate } from 'react-router';
import './wiki.scss';
import { WikiIntroduction } from './pages/intro';
import { WikiGreeting } from './pages/greeting';
import { WikiContact } from './pages/contact';
import { WikiHistory } from './pages/history';
import { WikiSpaces } from './pages/spaces';
import { WikiItems } from './pages/items';
import { WikiCharacters } from './pages/characters';
import { WikiSafety } from './pages/safety';

export default function Wiki(): ReactElement {
	const navigate = useNavigate();

	return (
		<UrlTabContainer className='wiki' tabsPosition='left'>
			<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
			<UrlTab name='Introduction' default urlChunk='introduction'>
				<WikiContent>
					<WikiIntroduction />
				</WikiContent>
			</UrlTab>
			<WikiContentTab name='Spaces' urlChunk='spaces'>
				<WikiSpaces />
			</WikiContentTab>
			<WikiContentTab name='Items' urlChunk='items'>
				<WikiItems />
			</WikiContentTab>
			<WikiContentTab name='Characters' urlChunk='characters'>
				<WikiCharacters />
			</WikiContentTab>
			<WikiContentTab name='Safety' urlChunk='safety'>
				<WikiSafety />
			</WikiContentTab>
			<WikiContentTab name='Pandora History' urlChunk='history'>
				<WikiHistory />
			</WikiContentTab>
			<WikiContentTab name='Greeting' urlChunk='greeting'>
				<WikiGreeting />
			</WikiContentTab>
			<WikiContentTab name='Contact' urlChunk='contact'>
				<WikiContact />
			</WikiContentTab>
			<WikiContentTab name='Privacy Policy' urlChunk='privacy_policy'>
				<PrivacyPolicyContent />
			</WikiContentTab>
		</UrlTabContainer>
	);
}

function WikiContentTab({ name, urlChunk = name.toLowerCase(), children }: { name: string; urlChunk?: string; children: ReactNode; }): ReactNode {
	return (
		<UrlTab name={ name } urlChunk={ urlChunk }>
			<WikiContent>
				{ children }
			</WikiContent>
		</UrlTab>
	);
}

export function WikiContent({ children }: ChildrenProps): ReactElement {
	return <Scrollable color='dark' className='wiki-content'>{ children }</Scrollable>;
}
