import React, { ReactElement } from 'react';
import { AccountId, CharacterId, CharacterIdSchema } from 'pandora-common';
import { useParams } from 'react-router';
import { Column } from '../common/container/container';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { CharacterProfile } from './characterProfile';
import { AccountProfile } from './accountProfile';
import { useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import './profileScreens.scss';
import { BackLink, useNavigateBack } from '../common/link/back';

function CharacterProfileScreen({ characterId }: { characterId: CharacterId; }): ReactElement {
	const navigateBack = useNavigateBack();

	const chatroomCharacters = useChatRoomCharacters();
	const character = chatroomCharacters?.find((c) => c.id === characterId);

	if (character == null) {
		return (
			<Column alignX='center' alignY='center'>
				<Column>
					<BackLink>◄ Back</BackLink>
					<span>
						Character not found (character must be in the same room to view the profile).
					</span>
				</Column>
			</Column>
		);
	}

	return (
		<div className='profileScreen'>
			<TabContainer className='flex-1'>
				<Tab name='Character'>
					<CharacterProfile characterId={ character.id } />
				</Tab>
				<Tab name='Account'>
					<AccountProfile accountId={ character.data.accountId } />
				</Tab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ navigateBack } />
			</TabContainer>
		</div>
	);
}

function AccountProfileScreen({ accountId }: { accountId: AccountId; }): ReactElement {
	const navigateBack = useNavigateBack();

	return (
		<div className='profileScreen'>
			<TabContainer className='flex-1'>
				<Tab name='Account'>
					<AccountProfile accountId={ accountId } />
				</Tab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ navigateBack } />
			</TabContainer>
		</div>
	);
}

export function CharacterProfileScreenRouter(): ReactElement {
	const { characterId } = useParams();

	const parsedCharacterId = CharacterIdSchema.safeParse(characterId);

	if (!parsedCharacterId.success) {
		return (
			<Column alignX='center' alignY='center'>
				<Column>
					<BackLink>◄ Back</BackLink>
					<span>
						Invalid character id.
					</span>
				</Column>
			</Column>
		);
	}

	return <CharacterProfileScreen characterId={ parsedCharacterId.data } />;
}

export function AccountProfileScreenRouter(): ReactElement {
	const { accountId } = useParams();

	let parsedAccountId: AccountId | undefined;

	if (accountId != null && /^[0-9]$/.test(accountId)) {
		parsedAccountId = Number.parseInt(accountId);
	}

	if (parsedAccountId == null) {
		return (
			<Column alignX='center' alignY='center'>
				<Column>
					<BackLink>◄ Back</BackLink>
					<span>
						Invalid account id.
					</span>
				</Column>
			</Column>
		);
	}

	return <AccountProfileScreen accountId={ parsedAccountId } />;
}
