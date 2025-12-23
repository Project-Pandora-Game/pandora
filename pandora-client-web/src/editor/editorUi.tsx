import { Assert, ParseArrayNotEmpty } from 'pandora-common';
import { createContext, ReactElement, useContext, useMemo } from 'react';
import * as z from 'zod';
import { useBrowserStorage } from '../browserStorage.ts';
import { useEvent } from '../common/useEvent.ts';
import { Select } from '../common/userInteraction/select/select.tsx';
import { Button } from '../components/common/button/button.tsx';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { AssetUI } from './components/asset/asset.tsx';
import { AssetInfoUI } from './components/assetInfo/assetInfo.tsx';
import { AssetsUI } from './components/assets/assets.tsx';
import { BoneUI } from './components/bones/bones.tsx';
import { LayerUI } from './components/layer/layer.tsx';
import { PointsUI } from './components/points/points.tsx';
import { EditorWardrobeUI } from './components/wardrobe/wardrobe.tsx';
import './editor.scss';
import { EditorCurrentTabContext } from './editorUiContex.tsx';
import { EditorResultScene, EditorSetupScene } from './graphics/editorScene.tsx';
import { PandoraInnerInstanceDriver } from './innerInstance/pandoraEditorInstance.tsx';

const TABS = [
	['Wardrobe', 'editor-ui', EditorWardrobeUI],
	['Pose', 'editor-ui', BoneUI],
	['Items', 'editor-ui', AssetsUI],
	['Asset', 'editor-ui', AssetUI],
	['Layer', 'editor-ui', LayerUI],
	['Points', 'editor-ui', PointsUI],
	['Asset Info', 'editor-ui', AssetInfoUI],
	['Setup', 'editor-scene', EditorSetupScene],
	['Preview', 'editor-scene', EditorResultScene],
	['Pandora', 'editor-ui', PandoraInnerInstanceDriver],
] as const;

export type EditorTabName = (typeof TABS)[number][0];

const EditorActiveTabsContext = createContext({
	activeTabs: [] as readonly EditorTabName[],
	setActiveTabs: (_tabs: EditorTabName[]) => { /**/ },
});

function Tab({ tab, index }: { tab: EditorTabName; index: number; }): ReactElement {
	const { activeTabs, setActiveTabs } = useContext(EditorActiveTabsContext);
	const setTab = useEvent((newSelection: EditorTabName) => {
		const newTabs = activeTabs.slice();
		newTabs[index] = newSelection;
		setActiveTabs(newTabs);
	});
	const newTab = useEvent(() => {
		const newTabs = activeTabs.slice();
		newTabs.splice(index + 1, 0, tab);
		setActiveTabs(newTabs);
	});
	const closeTab = useEvent(() => {
		const newTabs = activeTabs.slice();
		newTabs.splice(index, 1);
		setActiveTabs(newTabs);
	});

	const currentTab = TABS.find((t) => t[0] === tab) ?? TABS[0];
	const CurrentTabComponent = currentTab[2];

	const context = useMemo((): EditorCurrentTabContext => ({
		activeTabs,
		setTab,
		closeTab,
	}), [activeTabs, setTab, closeTab]);

	return (
		<div className={ currentTab[1] }>
			<div className='ui-selector'>
				<div className='flex-1 center-flex'>
					<Select
						value={ currentTab[0] }
						onChange={ (ev) => {
							Assert(TABS.some((t) => t[0] === ev.target.value));
							setTab(ev.target.value as EditorTabName);
						} }
						scrollChange
					>
						{
							TABS.map((t) => (
								<option value={ t[0] } key={ t[0] }>{ t[0] }</option>
							))
						}
					</Select>
					{
						(activeTabs.length > 1) && (
							<Button
								title='Close this tab'
								className='slim icon'
								theme='default'
								onClick={ closeTab }
							>
								✗
							</Button>
						)
					}
				</div>
				<Button
					title='Create a new tab to the right of this one'
					className='slim icon'
					theme='default'
					onClick={ newTab }
				>
					+
				</Button>
			</div>
			<EditorCurrentTabContext.Provider value={ context }>
				<LocalErrorBoundary>
					<CurrentTabComponent />
				</LocalErrorBoundary>
			</EditorCurrentTabContext.Provider>
		</div>
	);
}

export function EditorView(): ReactElement {
	const [activeTabs, setActiveTabs] = useBrowserStorage<EditorTabName[]>('editor-tabs', ['Items', 'Layer', 'Preview'],
		z.array(z.enum(ParseArrayNotEmpty(TABS.map((t) => t[0])))),
	);
	const context = useMemo(() => ({ activeTabs, setActiveTabs }), [activeTabs, setActiveTabs]);

	return (
		<EditorActiveTabsContext.Provider value={ context }>
			<div className='editor'>
				{ activeTabs.map((tab, index) => <Tab tab={ tab } index={ index } key={ index } />) }
			</div>
		</EditorActiveTabsContext.Provider>
	);
}
