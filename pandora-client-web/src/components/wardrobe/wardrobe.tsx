import type { Immutable } from 'immer';
import {
	AssertNotNullable,
	CharacterIdSchema,
	GetLogger,
	ICharacterRoomData,
	RoomIdSchema,
	type ActionCharacterSelector,
	type ActionRoomSelector,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { Character, useCharacterRestrictionManager } from '../../character/character.ts';
import { useObservable } from '../../observable.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useGameState, useSpaceCharacters, useSpaceInfo } from '../../services/gameLogic/gameStateHooks.ts';
import { CharacterRestrictionOverrideWarningContent } from '../characterRestrictionOverride/characterRestrictionOverride.tsx';
import { Tab, TabContainer, type TabConfig } from '../common/tabs/tabs.tsx';
import { usePlayer } from '../gameContext/playerContextProvider.tsx';
import { WardrobeExpressionGui } from './views/wardrobeExpressionsView.tsx';
import { WardrobePoseGui } from './views/wardrobePoseView.tsx';
import { WardrobeRandomizationGui } from './views/wardrobeRandomizationView.tsx';
import './wardrobe.scss';
import { useWardrobeActionContext, WardrobeActionContextProvider } from './wardrobeActionContext.tsx';
import { WardrobeBodyManipulation } from './wardrobeBody.tsx';
import { useWardrobeContext, WardrobeContextProvider } from './wardrobeContext.tsx';
import { WardrobeEffectsModifiers } from './wardrobeEffectsModifiers.tsx';
import { WardrobeCharacterPreview, WardrobeRoomPreview } from './wardrobeGraphics.tsx';
import { WardrobeItemPreferences } from './wardrobeItemPreferences.tsx';
import { WardrobeItemManipulation } from './wardrobeItems.tsx';
import { WardrobeLocationStateSchema, type WardrobeLocationState } from './wardrobeNavigation.tsx';

export function WardrobeRouter(): ReactElement | null {
	return (
		<Routes>
			<Route index element={ <WardrobeRouterPlayer /> } />
			<Route path='character/:characterId' element={ <WardrobeRouterCharacter /> } />
			<Route path='room/:roomId' element={ <WardrobeRouterRoomInventory /> } />

			<Route path='*' element={ <Navigate to='/' replace /> } />
		</Routes>
	);
}

function WardrobeRouterPlayer(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ player.actionSelector }>
				<WardrobeCharacter character={ player } />
			</WardrobeContextProvider>
		</WardrobeActionContextProvider>
	);
}

function WardrobeRouterCharacter(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);
	const characters = useSpaceCharacters();

	const { characterId: characterIdParam } = useParams();
	const characterTarget = useMemo((): ActionCharacterSelector | null => {
		try {
			const parsedCharacterId = CharacterIdSchema.safeParse(characterIdParam ? decodeURIComponent(characterIdParam) : characterIdParam);
			if (parsedCharacterId.success) {
				return {
					type: 'character',
					characterId: parsedCharacterId.data,
				};
			}
		} catch (error) {
			GetLogger('WardrobeRouterCharacter').warning('Error decoding characterId', error);
		}
		return null;
	}, [characterIdParam]);

	const character = useMemo((): Character<ICharacterRoomData> | null => {
		if (characterTarget == null)
			return null;
		return characters?.find((c) => c.data.id === characterTarget.characterId) ?? null;
	}, [characters, characterTarget]);

	const location = useLocation();
	const initialFocus = useMemo((): WardrobeLocationState['initialFocus'] => {
		const locationState = WardrobeLocationStateSchema.safeParse(location.state);
		if (locationState.success) {
			return locationState.data.initialFocus;
		}
		return undefined;
	}, [location]);

	if (!character)
		return <Link to='/'>◄ Back</Link>;

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ character.actionSelector } initialFocus={ initialFocus }>
				<WardrobeCharacter character={ character } />
			</WardrobeContextProvider>
		</WardrobeActionContextProvider>
	);
}

function WardrobeRouterRoomInventory(): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);

	const { roomId: roomIdParam } = useParams();
	const roomTarget = useMemo((): ActionRoomSelector | null => {
		try {
			const parsedRoomId = RoomIdSchema.safeParse(roomIdParam ? decodeURIComponent(roomIdParam) : roomIdParam);
			if (parsedRoomId.success) {
				return {
					type: 'room',
					roomId: parsedRoomId.data,
				};
			}
		} catch (error) {
			GetLogger('WardrobeRouterRoomInventory').warning('Error decoding roomId', error);
		}
		return null;
	}, [roomIdParam]);

	const location = useLocation();
	const initialFocus = useMemo((): WardrobeLocationState['initialFocus'] => {
		const locationState = WardrobeLocationStateSchema.safeParse(location.state);
		if (locationState.success) {
			return locationState.data.initialFocus;
		}
		return undefined;
	}, [location]);

	if (roomTarget == null)
		return <Link to='/'>◄ Back</Link>;

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ roomTarget } initialFocus={ initialFocus }>
				<WardrobeRoom room={ roomTarget } />
			</WardrobeContextProvider>
		</WardrobeActionContextProvider>
	);
}

function WardrobeRoom({ room }: {
	room: Immutable<ActionRoomSelector>;
}): ReactElement {
	const navigate = useNavigatePandora();
	const gameState = useGameState();
	const characters = useSpaceCharacters();
	const spaceInfo = useObservable(gameState.currentSpace).config;
	const { globalState } = useWardrobeActionContext();
	const { actionPreviewState, currentRoomSelector } = useWardrobeContext();
	const globalPreviewState = useObservable(actionPreviewState);

	const roomState = (globalPreviewState ?? globalState).space.getRoom(room.roomId);

	return (
		<div className='wardrobe'>
			<div className='wardrobeMain'>
				{
					(spaceInfo != null && characters != null && roomState != null) ? (
						<WardrobeRoomPreview
							characters={ characters }
							globalState={ globalPreviewState ?? globalState }
							roomState={ roomState }
							info={ spaceInfo }
							isPreview={ globalPreviewState != null }
						/>
					) : null
				}
				<TabContainer className='flex-1'>
					<Tab name={ room.roomId === currentRoomSelector.roomId ? 'Current room\'s inventory' : `Room inventory (${ globalState.space.getRoom(room.roomId)?.displayName ?? '[unknown room]' })` }>
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
	character: Character;
}): ReactElement {
	const navigate = useNavigatePandora();
	const { globalState, actions: { spaceContext } } = useWardrobeActionContext();
	const { actionPreviewState } = useWardrobeContext();
	const characterState = globalState.characters.get(character.id);
	const globalPreviewState = useObservable(actionPreviewState);
	const characterPreviewState = globalPreviewState?.characters.get(character.id);
	const currentSpaceInfo = useSpaceInfo();
	const inPersonalSpace = currentSpaceInfo.id == null;

	const characterRestrictionManager = useCharacterRestrictionManager(character, globalState, spaceContext);
	const characterModifierEffects = useMemo(() => characterRestrictionManager.getModifierEffects(), [characterRestrictionManager]);

	const [allowHideItems, setAllowHideItems] = useState(false);
	const [showCharacterEffects, setShowCharacterEffects] = useState(false);

	const onTabOpen = useCallback((tab: Immutable<TabConfig>): void => {
		setAllowHideItems(tab.name === 'Body');
		setShowCharacterEffects(tab.name === 'Effects & Modifiers');
	}, []);

	if (characterState == null)
		return <Link to='/'>◄ Back</Link>;

	return (
		<div className='wardrobe'>
			<CharacterRestrictionOverrideWarningContent mode={ characterState.restrictionOverride } />
			<div className='wardrobeMain'>
				<WardrobeCharacterPreview
					character={ character }
					characterState={ characterPreviewState ?? characterState }
					globalState={ (characterPreviewState != null ? globalPreviewState : undefined) ?? globalState }
					allowHideItems={ allowHideItems }
					showCharacterEffects={ showCharacterEffects }
					isPreview={ characterPreviewState != null }
				/>
				<TabContainer className='flex-1' onTabOpen={ onTabOpen }>
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
					<Tab name='Pose & Expressions'>
						<div className='wardrobe-pane'>
							<div className='wardrobe-ui'>
								<WardrobePoseGui character={ character } characterState={ characterState } />
								<WardrobeExpressionGui character={ character } characterState={ characterState } />
							</div>
						</div>
					</Tab>
					<Tab
						name='Effects & Modifiers'
						badge={ characterModifierEffects.length > 0 ? `${characterModifierEffects.length}` : null }
						badgeType='passive'
					>
						<div className='wardrobe-pane'>
							<WardrobeEffectsModifiers character={ character } globalState={ globalState } />
						</div>
					</Tab>
					{
						inPersonalSpace ? (
							<Tab name='Randomization'>
								<div className='wardrobe-pane'>
									<WardrobeRandomizationGui character={ character } />
								</div>
							</Tab>
						) : null
					}
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
