import { ReactElement, ReactNode } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs.tsx';
import { PrivacyPolicyContent } from '../Eula/privacyPolicy.tsx';
import { WikiChat } from './pages/chat.tsx';
import { WikiCharacters } from './pages/characters.tsx';
import { WikiContact } from './pages/contact.tsx';
import { WikiHistory } from './pages/history.tsx';
import { WikiIntroduction } from './pages/intro.tsx';
import { WikiItems } from './pages/items.tsx';
import { WikiNew } from './pages/new.tsx';
import { WikiSafety } from './pages/safety.tsx';
import { WikiSpaces } from './pages/spaces.tsx';
import './wiki.scss';

export default function Wiki(): ReactElement {
	const navigate = useNavigatePandora();

	return (
		<UrlTabContainer className='wiki' tabsPosition='left'>
			<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
			<UrlTab name='Introduction' default urlChunk='introduction'>
				<WikiContent>
					<WikiIntroduction />
				</WikiContent>
			</UrlTab>
			<WikiContentTab name='New User Guide' urlChunk='new'>
				<WikiNew />
			</WikiContentTab>
			<WikiContentTab name='Chat' urlChunk='chat'>
				<WikiChat />
			</WikiContentTab>
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
	return <Scrollable className='wiki-content'>{ children }</Scrollable>;
}
