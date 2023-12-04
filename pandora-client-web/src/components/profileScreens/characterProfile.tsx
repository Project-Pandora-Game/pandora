import React, { ReactElement } from 'react';
import { CharacterId, ICharacterRoomData, PRONOUNS } from 'pandora-common';
import { Column, Row } from '../common/container/container';
import { ChatRoom, useCharacterState, useChatRoomCharacters, useChatroom } from '../gameContext/chatRoomContextProvider';
import { Character, useCharacterData } from '../../character/character';
import { useIsNarrowScreen } from '../../styles/mediaQueries';
import { CharacterPreview } from '../wardrobe/wardrobeGraphics';

export function CharacterProfile({ characterId }: { characterId: CharacterId; }): ReactElement {
	const chatroomCharacters = useChatRoomCharacters();
	const character = chatroomCharacters?.find((c) => c.id === characterId);
	const chatroom = useChatroom();

	if (character == null || chatroom == null) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				Failed to load character data.
			</Column>
		);
	}

	return <CharacterProfileContent character={ character } chatroom={ chatroom } />;
}

function CharacterProfileContent({ character, chatroom }: { character: Character<ICharacterRoomData>; chatroom: ChatRoom; }): ReactElement {
	const characterData = useCharacterData(character);
	const characterState = useCharacterState(chatroom, character.id);
	const isNarrowScreen = useIsNarrowScreen();

	const pronouns = PRONOUNS[characterData.settings.pronoun];

	return (
		<Row className='profileView flex-1' padding='medium' gap='large' overflowY='hidden'>
			{
				characterState != null && !isNarrowScreen ? (
					<CharacterPreview character={ character } characterState={ characterState } />
				) : null
			}
			<Column className='flex-1' overflowY='auto'>
				<span className='profileHeader'>
					Profile of character&nbsp;
					<strong
						className='selectable'
						style={ {
							textShadow: `${characterData.settings.labelColor} 1px 2px`,
						} }
					>
						{ characterData.name }
					</strong>
					<hr />
				</span>
				<span>Character id: <span className='selectable-all'>{ characterData.id }</span></span>
				<span>Pronouns: { pronouns.subjective }/{ pronouns.objective }</span>
				<Row alignY='center'>
					<span>Label color:</span>
					<div className='labelColorMark' style={ { backgroundColor: characterData.settings.labelColor } } />
					<span className='selectable'>{ characterData.settings.labelColor.toUpperCase() }</span>
				</Row>
			</Column>
		</Row>
	);
}
