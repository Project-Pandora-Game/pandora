import { ReactElement, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChildrenProps } from '../../common/reactTypes';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs';
import { PrivacyPolicyContent } from '../Eula/privacyPolicy';
import { WikiCharacters } from './pages/characters';
import { WikiContact } from './pages/contact';
import { WikiHistory } from './pages/history';
import { WikiIntroduction } from './pages/intro';
import { WikiItems } from './pages/items';
import { WikiNew } from './pages/new';
import { WikiSafety } from './pages/safety';
import { WikiSpaces } from './pages/spaces';
import './wiki.scss';

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
			<WikiContentTab name='New User Guide' urlChunk='new'>
				<WikiNew />
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
