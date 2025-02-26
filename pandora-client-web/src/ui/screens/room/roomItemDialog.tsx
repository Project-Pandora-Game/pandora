import { SplitContainerPath } from 'pandora-common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed';
import { useCallback, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import deleteIcon from '../../../assets/icons/delete.svg';
import shirtIcon from '../../../assets/icons/shirt.svg';
import type { ChildrenProps } from '../../../common/reactTypes';
import { Button, IconButton } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { DraggableDialog } from '../../../components/dialog/dialog';
import { useGameState, useGlobalState, useStateFindItemById, type FindItemResultEntry } from '../../../components/gameContext/gameStateContextProvider';
import { WardrobeModuleConfig } from '../../../components/wardrobe/modules/_wardrobeModules';
import { ActionTargetToWardrobeUrl, type WardrobeLocationState } from '../../../components/wardrobe/wardrobe';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents';
import { WardrobeExternalContextProvider } from '../../../components/wardrobe/wardrobeContext';
import { useWardrobeTargetItem } from '../../../components/wardrobe/wardrobeUtils';
import { useObservable } from '../../../observable';
import './roomItemDialog.scss';
import { RoomItemDialogs, type RoomItemDialogDefinition } from './roomItemDialogList';

export function RoomItemDialogsProvider(): ReactElement {
	const roomItemDialogs = useObservable(RoomItemDialogs);

	return (
		<>
			{ roomItemDialogs.map((d) => <RoomItemDialog { ...d } key={ d.itemId } />) }
		</>
	);
}

function RoomItemDialog({ itemId }: RoomItemDialogDefinition): ReactElement {
	const globalState = useGlobalState(useGameState());

	const matchingItems = useStateFindItemById(globalState, itemId);
	const findResult = matchingItems.length === 1 ? matchingItems[0] : null;

	const close = useCallback(() => {
		const index = RoomItemDialogs.value.findIndex((d) => d.itemId === itemId);
		if (index >= 0) {
			RoomItemDialogs.produceImmer((d) => {
				d.splice(index, 1);
			});
		}
	}, [itemId]);

	return (
		<DraggableDialog
			key={ itemId }
			close={ close }
			title={ (findResult?.item.name || findResult?.item.asset.definition.name) ?? '[ERROR: Unknown item]' }
			className='roomItemDialog'
			initialHeight={ Math.min(400 * window.devicePixelRatio, Math.floor(80 * window.innerHeight)) }
			initialWidth={ Math.min(300 * window.devicePixelRatio, Math.floor(80 * window.innerWidth)) }
			rawContent
			allowShade
		>
			{
				findResult != null ? (
					<WardrobeExternalContextProvider target={ findResult.target }>
						<RoomItemDialogContent { ...findResult } close={ close } />
					</WardrobeExternalContextProvider>
				) : (
					<div className='dialog-content'>
						<strong>Item not found</strong>
						<span>The item was most likely deleted while this menu was open or the character wearing it left the space.</span>
					</div>
				)
			}
		</DraggableDialog>
	);
}

type RoomItemDialogContentProps = FindItemResultEntry & {
	close: () => void;
};

type RoomItemDialogContentSectionType = 'info' | 'quickActions' | 'modules';
function RoomItemDialogContent(props: RoomItemDialogContentProps): ReactElement {
	const [openSection, setOpenSection] = useState<RoomItemDialogContentSectionType | null>('info');

	return (
		<Column className='contentContainer' gap='none'>
			<Column gap='none' className='contentContainerInner'>
				<RoomItemDialogContentSection
					open={ openSection === 'info' }
					onHeaderClick={ () => setOpenSection((s) => s !== 'info' ? 'info' : null) }
					name='Info'
				>
					<RoomItemDialogContentInfo { ...props } />
				</RoomItemDialogContentSection>
				<RoomItemDialogContentSection
					open={ openSection === 'quickActions' }
					onHeaderClick={ () => setOpenSection((s) => s !== 'quickActions' ? 'quickActions' : null) }
					name='Actions'
				>
					<RoomItemDialogContentQuickActions { ...props } />
				</RoomItemDialogContentSection>
				<RoomItemDialogContentSection
					open={ openSection === 'modules' }
					onHeaderClick={ () => setOpenSection((s) => s !== 'modules' ? 'modules' : null) }
					name='Modules'
				>
					<RoomItemDialogContentModules { ...props } />
				</RoomItemDialogContentSection>
			</Column>
		</Column>
	);
}

function RoomItemDialogContentSection({ name, open, onHeaderClick, children }: ChildrenProps & {
	open: boolean;
	onHeaderClick: () => void;
	name: string;
}): ReactElement {
	return (
		<>
			<Button
				className='sectionButton'
				onClick={ onHeaderClick }
				slim
			>
				{ open ? '\u25BC' : '\u25B6' } { name }
			</Button>
			<Column
				className={ open ? 'sectionContent open' : 'sectionContent closed' }
			>
				<Column padding='medium'>
					{ children }
				</Column>
			</Column>
		</>
	);
}

function RoomItemDialogContentInfo({ item, path, target, close }: RoomItemDialogContentProps): ReactElement {
	const navigate = useNavigate();

	return (
		<>
			<Row alignX='space-between'>
				<span>Asset:<br />{ item.asset.definition.name }</span>
				<IconButton
					alt='Open this item in wardrobe'
					src={ shirtIcon }
					className='wardrobeLinkButton'
					onClick={ () => {
						close();
						navigate(
							ActionTargetToWardrobeUrl(target),
							{ state: { initialFocus: path } satisfies WardrobeLocationState },
						);
					} }
				/>
			</Row>
			<span>Description:<br />{ item.description || (<em>None</em>) }</span>
		</>
	);
}

function RoomItemDialogContentQuickActions({ path, target, close }: RoomItemDialogContentProps): ReactElement {
	const isRoomInventory = target.type === 'roomInventory' && path.container.length === 0;

	const containerPath = SplitContainerPath(path.container);
	const containerItem = useWardrobeTargetItem(target, containerPath?.itemPath);
	const containerModule = containerPath != null ? containerItem?.getModules().get(containerPath.module) : undefined;
	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	const allowReorder = target.type === 'character' &&
		!singleItemContainer &&
		(containerModule == null || containerModule.contentsPhysicallyEquipped);

	return (
		<>
			{
				allowReorder ? (
					<>
						<GameLogicActionButton action={ {
							type: 'move',
							target,
							item: path,
							shift: 1,
						} }>
							▲ Wear on top
						</GameLogicActionButton>
						<GameLogicActionButton action={ {
							type: 'move',
							target,
							item: path,
							shift: -1,
						} }>
							▼ Wear under
						</GameLogicActionButton>
					</>
				) : null
			}
			{
				!isRoomInventory ? (
					<GameLogicActionButton
						action={ {
							type: 'transfer',
							source: target,
							item: path,
							target: { type: 'roomInventory' },
							container: [],
						} }
					>
						<span>
							<u>▽</u> Store in room
						</span>
					</GameLogicActionButton>
				) : null
			}
			<GameLogicActionButton
				action={ {
					type: 'delete',
					target,
					item: path,
				} }
				onExecute={ close }
			>
				<img src={ deleteIcon } alt='Delete action' /> Remove and delete
			</GameLogicActionButton>
		</>
	);
}

function RoomItemDialogContentModules({ target, item, path }: RoomItemDialogContentProps): ReactElement {
	return (
		<>
			{
				Array.from(item.getModules().entries())
					.filter(([,m]) => m instanceof ItemModuleTyped) // Only show typed modules for now
					.map(([moduleName, m]) => (
						<FieldsetToggle legend={ `Module: ${m.config.name}` } key={ moduleName }>
							<WardrobeModuleConfig target={ target } item={ path } moduleName={ moduleName } m={ m } />
						</FieldsetToggle>
					))
			}
		</>
	);
}
