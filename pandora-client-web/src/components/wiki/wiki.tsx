import React, { ReactElement } from 'react';
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

export function Wiki(): ReactElement {
	const navigate = useNavigate();

	return (
		<UrlTabContainer className='wiki' tabsPosition='left'>
			<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
			<UrlTab name='Introduction' default urlChunk='introduction'>
				<WikiContent>
					<WikiIntroduction />
				</WikiContent>
			</UrlTab>
			<UrlTab name='Pandora History' urlChunk='history'>
				<WikiContent>
					<WikiHistory />
				</WikiContent>
			</UrlTab>
			<UrlTab name='Greeting' urlChunk='greeting'>
				<WikiGreeting />
			</UrlTab>
			<UrlTab name='Contact' urlChunk='contact'>
				<WikiContent>
					<WikiContact />
				</WikiContent>
			</UrlTab>
			<UrlTab name='Privacy Policy' urlChunk='privacy_policy'>
				<WikiContent>
					<PrivacyPolicyContent />
				</WikiContent>
			</UrlTab>
		</UrlTabContainer>
	);
}

export function WikiContent({ children }: ChildrenProps): ReactElement {
	return <Scrollable color='dark' className='wiki-content'>{ children }</Scrollable>;
}
