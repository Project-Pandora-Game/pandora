import type { Immutable } from 'immer';
import {
	AssertNotNullable,
	CharacterIdSchema,
	ICharacterRoomData,
	type ActionTargetSelector,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Character, IChatroomCharacter } from '../../character/character';
import { useObservable } from '../../observable';
import { CharacterRestrictionOverrideWarningContent } from '../characterRestrictionOverride/characterRestrictionOverride';
import { Tab, TabContainer, type TabConfig } from '../common/tabs/tabs';
import { useGameState, useSpaceCharacters } from '../gameContext/gameStateContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import { WardrobeExpressionGui } from './views/wardrobeExpressionsView';
import { WardrobePoseGui } from './views/wardrobePoseView';
import { WardrobeRandomizationGui } from './views/wardrobeRandomizationView';
import './wardrobe.scss';
import { useWardrobeActionContext, WardrobeActionContextProvider } from './wardrobeActionContext';
import { WardrobeBodyManipulation } from './wardrobeBody';
import { useWardrobeContext, WardrobeContextProvider } from './wardrobeContext';
import { WardrobeCharacterPreview, WardrobeRoomPreview } from './wardrobeGraphics';
import { WardrobeItemPreferences } from './wardrobeItemPreferences';
import { WardrobeItemManipulation } from './wardrobeItems';

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

	if (!character)
		return <Link to='/'>◄ Back</Link>;

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ character.actionSelector }>
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

	return (
		<WardrobeActionContextProvider player={ player }>
			<WardrobeContextProvider target={ roomTarget }>
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
	const characterPreviewState = useObservable(actionPreviewState)?.characters.get(character.id);

	const [allowHideItems, setAllowHideItems] = useState(false);

	const onTabOpen = useCallback((tab: Immutable<TabConfig>): void => {
		setAllowHideItems(tab.name === 'Body');
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
					allowHideItems={ allowHideItems }
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
