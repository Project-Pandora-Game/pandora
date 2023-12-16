import {
	AssertNever,
	ICharacterRoomData,
	IsCharacterId,
	IsObject,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Character, IChatroomCharacter } from '../../character/character';
import { IChatRoomContext, useChatroom, useChatRoomCharacters, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { CharacterSafemodeWarningContent } from '../characterSafemode/characterSafemode';
import { WardrobeTarget } from './wardrobeTypes';
import { WardrobeContextProvider, useWardrobeContext } from './wardrobeContext';
import { WardrobeCharacterPreview, WardrobeRoomPreview } from './wardrobeGraphics';
import { WardrobeBodyManipulation } from './wardrobeBody';
import { WardrobePoseGui } from './views/wardrobePoseView';
import { WardrobeRandomizationGui } from './views/wardrobeRandomizationView';
import { WardrobeExpressionGui } from './views/wardrobeExpressionsView';
import { WardrobeItemManipulation } from './wardrobeItems';
import './wardrobe.scss';
import { useObservable } from '../../observable';

export function WardrobeScreen(): ReactElement | null {
	const locationState = useLocation().state as unknown;
	const player = usePlayer();
	const chatRoom = useChatroom();
	const isInRoom = useChatRoomInfo() != null;
	const chatRoomCharacters = useChatRoomCharacters();

	const characterId = IsObject(locationState) && IsCharacterId(locationState.character) ? locationState.character : null;
	const targetIsRoomInventory = IsObject(locationState) && locationState.target === 'room';

	const character = useMemo((): Character<ICharacterRoomData> | null => {
		if (characterId == null || characterId === player?.data.id) {
			return player;
		}
		return chatRoomCharacters?.find((c) => c.data.id === characterId) ?? null;
	}, [characterId, player, chatRoomCharacters]);

	const target: WardrobeTarget | null =
		targetIsRoomInventory ? (
			isInRoom ? chatRoom : null
		) : (
			character?.data ? character : null
		);

	if (!player || !target)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	return (
		<WardrobeContextProvider target={ target } player={ player }>
			<Wardrobe />
		</WardrobeContextProvider>
	);
}

function Wardrobe(): ReactElement | null {
	const { target } = useWardrobeContext();

	if (target.type === 'room') {
		return <WardrobeRoom room={ target } />;
	} else if (target.type === 'character') {
		return <WardrobeCharacter character={ target } />;
	}
	AssertNever(target);
}

function WardrobeRoom({ room }: {
	room: IChatRoomContext;
}): ReactElement {
	const navigate = useNavigate();
	const characters = useChatRoomCharacters();
	const roomInfo = useObservable(room.info);
	const { globalState, actionPreviewState } = useWardrobeContext();
	const globalPreviewState = useObservable(actionPreviewState);

	return (
		<div className='wardrobe'>
			<div className='wardrobeMain'>
				{
					(roomInfo != null && characters != null) ? (
						<WardrobeRoomPreview
							characters={ characters }
							globalState={ globalPreviewState ?? globalState }
							info={ roomInfo }
							isPreview={ globalPreviewState != null }
						/>
					) : null
				}
				<TabContainer className='flex-1'>
					<Tab name='Room inventory'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/pandora_lobby') } />
				</TabContainer>
			</div>
		</div>
	);
}

function WardrobeCharacter({ character }: {
	character: IChatroomCharacter;
}): ReactElement {
	const navigate = useNavigate();
	const { globalState, actionPreviewState } = useWardrobeContext();
	const characterState = globalState.characters.get(character.id);
	const characterPreviewState = useObservable(actionPreviewState)?.characters.get(character.id);

	if (characterState == null)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	const inSafemode = characterState.safemode != null;

	return (
		<div className='wardrobe'>
			{
				!inSafemode ? null : (
					<div className='safemode'>
						<CharacterSafemodeWarningContent />
					</div>
				)
			}
			<div className='wardrobeMain'>
				<WardrobeCharacterPreview
					character={ character }
					characterState={ characterPreviewState ?? characterState }
					isPreview={ characterPreviewState != null }
				/>
				<TabContainer className='flex-1'>
					<Tab name='Items'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='Body'>
						<div className='wardrobe-pane'>
							<WardrobeBodyManipulation character={ character } characterState={ characterState } />
						</div>
					</Tab>
					<Tab name='Poses & Expressions'>
						<div className='wardrobe-pane'>
							<div className='wardrobe-ui'>
								<WardrobePoseGui character={ character } characterState={ characterState } />
								<WardrobeExpressionGui character={ character } characterState={ characterState } />
							</div>
						</div>
					</Tab>
					<Tab name='Randomization'>
						<div className='wardrobe-pane'>
							<WardrobeRandomizationGui character={ character } />
						</div>
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/pandora_lobby') } />
				</TabContainer>
			</div>
		</div>
	);
}
