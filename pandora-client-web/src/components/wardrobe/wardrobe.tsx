import {
	AssertNotNullable,
	CharacterIdSchema,
	ICharacterRoomData,
	RoomId,
	RoomIdSchema,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Character, IChatroomCharacter } from '../../character/character';
import { useObservable } from '../../observable';
import { CharacterRestrictionOverrideWarningContent } from '../characterRestrictionOverride/characterRestrictionOverride';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { useGameState, useSpaceCharacters } from '../gameContext/gameStateContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import { WardrobeExpressionGui } from './views/wardrobeExpressionsView';
import { WardrobePoseGui } from './views/wardrobePoseView';
import { WardrobeRandomizationGui } from './views/wardrobeRandomizationView';
import './wardrobe.scss';
import { WardrobeBodyManipulation } from './wardrobeBody';
import { WardrobeContextProvider, useWardrobeContext } from './wardrobeContext';
import { WardrobeCharacterPreview, WardrobeRoomPreview } from './wardrobeGraphics';
import { WardrobeItemPreferences } from './wardrobeItemPreferences';
import { WardrobeItemManipulation } from './wardrobeItems';
import type { WardrobeTarget } from './wardrobeTypes';

export function WardrobeRouter(): ReactElement | null {
	return (
		<Routes>
			<Route index element={ <WardrobeRouterPlayer /> } />
			<Route path='character/:characterId' element={ <WardrobeRouterCharacter /> } />
			<Route path='room/:roomId' element={ <WardrobeRouterRoom /> } />
			<Route path='space-inventory' element={ <WardrobeRouterSpaceInventory /> } />

			<Route path='*' element={ <Navigate to='/' replace /> } />
		</Routes>
	);
}

function WardrobeRouterPlayer(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);

	return (
		<WardrobeContextProvider target={ player } player={ player }>
			<WardrobeCharacter character={ player } />
		</WardrobeContextProvider>
	);
}

function WardrobeRouterCharacter(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);
	const characters = useSpaceCharacters();

	const { characterId } = useParams();

	const character = useMemo((): Character<ICharacterRoomData> | null => {
		const parsedCharacterId = CharacterIdSchema.safeParse(characterId);

		if (!parsedCharacterId.success)
			return null;
		return characters?.find((c) => c.data.id === parsedCharacterId.data) ?? null;
	}, [characters, characterId]);

	if (!character)
		return <Link to='/'>◄ Back</Link>;

	return (
		<WardrobeContextProvider target={ character } player={ player }>
			<WardrobeCharacter character={ character } />
		</WardrobeContextProvider>
	);
}

function WardrobeRouterRoom(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);
	const { roomId } = useParams();

	const target = useMemo((): (WardrobeTarget & { type: 'room'; }) | null => {
		const parsedRoomId = RoomIdSchema.safeParse(roomId);
		if (!parsedRoomId.success)
			return null;

		return { type: 'room', roomId: parsedRoomId.data };
	}, [roomId]);

	if (target == null)
		return <Link to='/'>◄ Back</Link>;

	return (
		<WardrobeContextProvider target={ target } player={ player }>
			<WardrobeRoom roomId={ target.roomId } />
		</WardrobeContextProvider>
	);
}

function WardrobeRouterSpaceInventory(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);

	const target = useMemo((): WardrobeTarget => ({ type: 'spaceInventory' }), []);

	return (
		<WardrobeContextProvider target={ target } player={ player }>
			<WardrobeSpaceInventory />
		</WardrobeContextProvider>
	);
}

function WardrobeSpaceInventory(): ReactElement {
	const navigate = useNavigate();

	return (
		<div className='wardrobe'>
			<div className='wardrobeMain'>
				<TabContainer className='flex-1'>
					<Tab name='Space inventory'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
				</TabContainer>
			</div>
		</div>
	);
}

function WardrobeRoom({ roomId }: {
	roomId: RoomId;
}): ReactElement {
	const navigate = useNavigate();
	const gameState = useGameState();
	const characters = useSpaceCharacters();
	const roomInfo = useObservable(gameState.currentSpace).config;
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
							roomId={ roomId }
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
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
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
		return <Link to='/'>◄ Back</Link>;

	return (
		<div className='wardrobe'>
			<CharacterRestrictionOverrideWarningContent mode={ characterState.restrictionOverride } />
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
					{
						character.isPlayer() ? (
							<Tab name='Item Limits'>
								<div className='wardrobe-pane'>
									<WardrobeItemPreferences />
								</div>
							</Tab>
						) : null
					}
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
				</TabContainer>
			</div>
		</div>
	);
}
