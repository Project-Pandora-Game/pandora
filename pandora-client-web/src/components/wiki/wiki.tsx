import { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs.tsx';
import { PrivacyPolicyContent } from '../Eula/privacyPolicy.tsx';
import { WikiSearch } from './pages/search.tsx';
import { WIKI_PAGES } from './wikiPageRegistry.ts';
import './wiki.scss';

export default function Wiki(): ReactElement {
	const navigate = useNavigatePandora();

	return (
		<UrlTabContainer className='wiki' tabsPosition='left'>
			{ [
				<Tab key='back' name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />,
				<UrlTab key='search' name='Search' default urlChunk='search'>
					<WikiContent>
						<WikiSearch />
					</WikiContent>
				</UrlTab>,
				...WIKI_PAGES.map(({ pageName, urlChunk, Component }) => (
					<UrlTab key={ urlChunk } name={ pageName } urlChunk={ urlChunk }>
						<WikiContent>
							<Component />
						</WikiContent>
					</UrlTab>
				)),
				<UrlTab key='privacy_policy' name='Privacy Policy' urlChunk='privacy_policy'>
					<WikiContent>
						<PrivacyPolicyContent />
					</WikiContent>
				</UrlTab>,
			] }
		</UrlTabContainer>
	);
}

function WikiContent({ children }: ChildrenProps): ReactElement {
	return <Scrollable className='wiki-content'>{ children }</Scrollable>;
}
