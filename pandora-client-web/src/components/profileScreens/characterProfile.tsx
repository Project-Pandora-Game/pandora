import { AssertNever, CharacterId, GetLogger, ICharacterRoomData, LIMIT_CHARACTER_PROFILE_LENGTH, PRONOUNS } from 'pandora-common';
import { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Character, useCharacterData } from '../../character/character.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useIsNarrowScreen } from '../../styles/mediaQueries.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { GameState, useCharacterState, useGameStateOptional, useGlobalState, useSpaceCharacters } from '../gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';
import { CharacterPreview } from '../wardrobe/wardrobeGraphics.tsx';
import { ProfileDescription } from './profileDescription.tsx';

export function CharacterProfile({ characterId }: { characterId: CharacterId; }): ReactElement {
	const characters = useSpaceCharacters();
	const character = characters?.find((c) => c.id === characterId);
	const gameState = useGameStateOptional();

	if (character == null || gameState == null) {
		return (
			<Column className='profileView flex-1' alignX='center' alignY='center'>
				Failed to load character data.
			</Column>
		);
	}

	return <CharacterProfileContent character={ character } gameState={ gameState } />;
}

function CharacterProfileContent({ character, gameState }: { character: Character<ICharacterRoomData>; gameState: GameState; }): ReactElement {
	const isPlayer = usePlayer()?.id === character.id;
	const characterData = useCharacterData(character);
	const globalState = useGlobalState(gameState);
	const characterState = useCharacterState(globalState, character.id);
	const isNarrowScreen = useIsNarrowScreen();

	const pronouns = PRONOUNS[characterData.settings.pronoun];

	return (
		<Row className='profileView flex-1' gap='none' overflowY='hidden'>
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
				</span>
				<Scrollable className='flex-1'>
					<Column className='profileContent' padding='medium'>
						<span>Character id: <span className='selectable-all'>{ characterData.id }</span></span>
						<Row alignY='center'>
							<span>Pronouns: </span>
							{
								isPlayer ? (
									<Link to='/settings/character' className='center-flex'>
										<span>{ pronouns.subjective }/{ pronouns.objective }</span>
									</Link>
								) : (
									<span>{ pronouns.subjective }/{ pronouns.objective }</span>
								)
							}
						</Row>
						<Row alignY='center'>
							<span>Label color:</span>
							{
								isPlayer ? (
									<Link to='/settings/character' className='center-flex'>
										<div className='labelColorMark' style={ { backgroundColor: characterData.settings.labelColor } } />
									</Link>
								) : (
									<div className='labelColorMark' style={ { backgroundColor: characterData.settings.labelColor } } />
								)
							}
							<span className='selectable'>{ characterData.settings.labelColor.toUpperCase() }</span>
						</Row>
						<CharacterProfileDescription profileDescription={ characterData.profileDescription } allowEdit={ isPlayer } />
					</Column>
				</Scrollable>
			</Column>
		</Row>
	);
}

function CharacterProfileDescription({ profileDescription, allowEdit }: { profileDescription: string; allowEdit: boolean; }): ReactElement {
	const [editedDescription, setEditedDescription] = useState<string | null>(null);
	const shardConnector = useShardConnector();

	if (editedDescription != null && allowEdit) {
		return (
			<Column className='flex-1'>
				<Row alignX='space-between' alignY='end'>
					<span>Editing the character description ({ editedDescription.trim().length } / { LIMIT_CHARACTER_PROFILE_LENGTH }):</span>
					<Button
						slim
						onClick={ () => {
							if (editedDescription.trim().length > LIMIT_CHARACTER_PROFILE_LENGTH) {
								toast(`The description is too long`, TOAST_OPTIONS_WARNING);
								return;
							}

							if (shardConnector == null) {
								toast(`Error saving description:\nNot connected`, TOAST_OPTIONS_ERROR);
								return;
							}

							shardConnector.awaitResponse('updateCharacterDescription', { profileDescription: editedDescription.trim() })
								.then((result) => {
									if (result.result === 'ok') {
										setEditedDescription(null);
										return;
									}
									AssertNever(result.result);
								})
								.catch((err) => {
									GetLogger('CharacterProfileDescription').error('Error saving description:', err);
									toast(`Error saving description`, TOAST_OPTIONS_ERROR);
								});
						} }
					>
						Save
					</Button>
				</Row>
				<textarea
					className='flex-1 profileDescriptionContent profileEdit'
					style={ { resize: 'none' } }
					value={ editedDescription }
					onChange={ (ev) => {
						setEditedDescription(ev.target.value);
					} }
				/>
			</Column>
		);
	}

	return (
		<Column className='flex-1'>
			<Row alignX='space-between' alignY='end'>
				<span>Character description:</span>
				{
					allowEdit ? (
						<Button slim onClick={ () => setEditedDescription(profileDescription) }>
							Edit
						</Button>
					) : <span />
				}
			</Row>
			<div className='flex-1 profileDescriptionContent'>
				<ProfileDescription contents={ profileDescription } />
			</div>
		</Column>
	);
}

