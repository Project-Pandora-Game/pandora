import {
	AssertNever,
	IsCharacterId,
	IsObject,
} from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppearanceContainer, Character } from '../../character/character';
import { IChatRoomContext, useChatroom, useChatRoomCharacters, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { CharacterSafemodeWarningContent } from '../characterSafemode/characterSafemode';
import { WardrobeTarget } from './wardrobeTypes';
import { WardrobeContextProvider, useWardrobeContext } from './wardrobeContext';
import { WardrobeCharacterPreview } from './wardrobeGraphics';
import { WardrobeBodyManipulation } from './wardrobeBody';
import { WardrobePoseGui } from './views/wardrobePoseView';
import { WardrobeOutfitGui } from './views/wardrobeOutfitsView';
import { WardrobeExpressionGui } from './views/wardrobeExpressionsView';
import { WardrobeItemManipulation } from './wardrobeItems';
import './wardrobe.scss';

export function WardrobeScreen(): ReactElement | null {
	const locationState = useLocation().state as unknown;
	const player = usePlayer();
	const chatRoom = useChatroom();
	const isInRoom = useChatRoomInfo() != null;
	const chatRoomCharacters = useChatRoomCharacters();

	const characterId = IsObject(locationState) && IsCharacterId(locationState.character) ? locationState.character : null;
	const targetIsRoomInventory = IsObject(locationState) && locationState.target === 'room';

	const [character, setCharacter] = useState<Character | null>(null);

	useEffect(() => {
		if (characterId == null || characterId === player?.data.id) {
			setCharacter(player);
			return;
		}
		const get = () => chatRoomCharacters?.find((c) => c.data.id === characterId) ?? null;
		setCharacter(get());
	}, [setCharacter, characterId, player, chatRoomCharacters]);

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

function WardrobeRoom({ room: _room }: {
	room: IChatRoomContext;
}): ReactElement {
	const navigate = useNavigate();

	return (
		<div className='wardrobe'>
			<div className='wardrobeMain'>
				<TabContainer className='flex-1'>
					<Tab name='Room inventory'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate(-1) } />
				</TabContainer>
			</div>
		</div>
	);
}

function WardrobeCharacter({ character }: {
	character: AppearanceContainer;
}): ReactElement {
	const navigate = useNavigate();
	const { globalState } = useWardrobeContext();
	const characterState = globalState.characters.get(character.id);

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
				<WardrobeCharacterPreview character={ character } characterState={ characterState } />
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
					<Tab name='Outfits'>
						<div className='wardrobe-pane'>
							<WardrobeOutfitGui character={ character } />
						</div>
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate(-1) } />
				</TabContainer>
			</div>
		</div>
	);
}
