import React, { ReactElement } from 'react';
import { CharacterId, ICharacterPublicData, PRONOUNS } from 'pandora-common';
import { Column } from '../common/container/container';
import { useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { useCharacterDataOptional } from '../../character/character';
import { GAME_NAME } from '../../config/Environment';

export function CharacterProfile({ characterId }: { characterId: CharacterId; }): ReactElement {
	const characterData = useCharacterProfileData(characterId);

	if (characterData === undefined) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				Loading...
			</Column>
		);
	}

	if (characterData == null) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				Failed to load character data.
			</Column>
		);
	}

	return <CharacterProfileContent characterData={ characterData } />;
}

function CharacterProfileContent({ characterData }: { characterData: ICharacterPublicData; }): ReactElement {
	const pronouns = PRONOUNS[characterData.settings.pronoun];

	return (
		<Column className='profileView flex-1' padding='medium' overflowY='auto'>
			<span className='profileHeader'>
				Profile of { characterData.name }
				<hr style={ {
					background: characterData.settings.labelColor,
					color: characterData.settings.labelColor,
				} } />
			</span>
			<span>Character name: { characterData.name }</span>
			<span>Character id: { characterData.id }</span>
			<span>Pronouns: { pronouns.subjective }/{ pronouns.objective }</span>
			<span>In { GAME_NAME } since { 'how many?' } days.</span>
		</Column>
	);
}

/**
 * Queries data about a character.
 * @param characterId - The character to query for
 * @returns The character data, `null` if unable to get, `undefined` if in progress
 */
function useCharacterProfileData(characterId: CharacterId): ICharacterPublicData | null | undefined {
	const chatroomCharacters = useChatRoomCharacters();
	const character = chatroomCharacters?.find((c) => c.id === characterId);

	return useCharacterDataOptional(character ?? null);
}
