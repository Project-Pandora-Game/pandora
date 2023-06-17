import React, { ReactElement } from 'react';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { ChildrenProps } from '../../common/reactTypes';
import { Scrollable } from '../common/scrollbar/scrollbar';
import { PrivacyPolicyContent } from '../Eula/privacyPolicy';
import { useNavigate } from 'react-router';
import './wiki.scss';
import { WikiIntroduction } from './pages/intro';
import { WikiContact } from './pages/contact';

export function Wiki(): ReactElement {
	const navigate = useNavigate();

	return (
		<TabContainer className='wiki' tabsPosition='left'>
			<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/pandora_lobby') } />
			<Tab name='Introduction' default>
				<WikiContent>
					<WikiIntroduction />
				</WikiContent>
			</Tab>
			<Tab name='Contact'>
				<WikiContent>
					<WikiContact />
				</WikiContent>
			</Tab>
			<Tab name='Privacy Policy'>
				<WikiContent>
					<PrivacyPolicyContent />
				</WikiContent>
			</Tab>
		</TabContainer>
	);
}

function WikiContent({ children }: ChildrenProps): ReactElement {
	return <Scrollable color='dark' className='wiki-content'>{ children }</Scrollable>;
}
