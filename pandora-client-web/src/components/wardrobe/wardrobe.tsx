import type { Immutable } from 'immer';
import {
	AssertNever,
	AssertNotNullable,
	CharacterIdSchema,
	ICharacterRoomData,
	type ActionTargetSelector,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { Character, IChatroomCharacter } from '../../character/character.ts';
import { useObservable } from '../../observable.ts';
import { CharacterRestrictionOverrideWarningContent } from '../characterRestrictionOverride/characterRestrictionOverride.tsx';
import { Tab, TabContainer, type TabConfig } from '../common/tabs/tabs.tsx';
import { useGameState, useSpaceCharacters, useSpaceInfo } from '../gameContext/gameStateContextProvider.tsx';
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
import { WardrobeFocusSchema } from './wardrobeTypes.ts';

export const WardrobeLocationStateSchema = z.object({
	initialFocus: WardrobeFocusSchema.optional(),
}).passthrough();
export type WardrobeLocationState = z.infer<typeof WardrobeLocationStateSchema>;

export function ActionTargetToWardrobeUrl(target: ActionTargetSelector): string {
	if (target.type === 'character') {
		return `/wardrobe/character/${target.characterId}`;
	} else if (target.type === 'roomInventory') {
		return '/wardrobe/room-inventory';
	}
	AssertNever(target);
}

export function WardrobeRouter(): ReactElement | null {
	return (
		<Routes>
			<Route index element={ <WardrobeRouterPlayer /> } />
			<Route path='character/:characterId' element={ <WardrobeRouterCharacter /> } />
			<Route path='room-inventory' element={ <WardrobeRouterRoomInventory /> } />

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

	const { characterId } = useParams();
	const parsedCharacterId = CharacterIdSchema.safeParse(characterId);

	const character = useMemo((): Character<ICharacterRoomData> | null => {
		if (!parsedCharacterId.success)
			return null;
		return characters?.find((c) => c.data.id === parsedCharacterId.data) ?? null;
	}, [characters, parsedCharacterId]);

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

	const roomTarget = useMemo((): ActionTargetSelector => ({
		type: 'roomInventory',
	}), []);

	const location = useLocation();
	const initialFocus = useMemo((): WardrobeLocationState['initialFocus'] => {
		const locationState = WardrobeLocationStateSchema.safeParse(location.state);
		if (locationState.success) {
			return locationState.data.initialFocus;
		}
		return undefined;
	}, [location]);

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ roomTarget } initialFocus={ initialFocus }>
				<WardrobeRoom />
			</WardrobeContextProvider>
		</WardrobeActionContextProvider>
	);
}

function WardrobeRoom(): ReactElement {
	const navigate = useNavigate();
	const gameState = useGameState();
	const characters = useSpaceCharacters();
	const roomInfo = useObservable(gameState.currentSpace).config;
	const { globalState } = useWardrobeActionContext();
	const { actionPreviewState } = useWardrobeContext();
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
	const { globalState } = useWardrobeActionContext();
	const { actionPreviewState } = useWardrobeContext();
	const characterState = globalState.characters.get(character.id);
	const globalPreviewState = useObservable(actionPreviewState);
	const characterPreviewState = globalPreviewState?.characters.get(character.id);
	const currentSpaceInfo = useSpaceInfo();
	const inPersonalSpace = currentSpaceInfo.id == null;

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
					<Tab name='Poses & Expressions'>
						<div className='wardrobe-pane'>
							<div className='wardrobe-ui'>
								<WardrobePoseGui character={ character } characterState={ characterState } />
								<WardrobeExpressionGui character={ character } characterState={ characterState } />
							</div>
						</div>
					</Tab>
					<Tab name='Effects & Modifiers'>
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
