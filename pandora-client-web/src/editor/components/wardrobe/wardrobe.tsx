import { ActionRoomContext, AppearanceActionContext, ChatRoomFeatureSchema } from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { GetAssetManager } from '../../../assets/assetManager';
import { WardrobeContext, wardrobeContext } from '../../../components/wardrobe/wardrobe';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

const ROOM_CONTEXT = {
	features: ChatRoomFeatureSchema.options,
} as const satisfies ActionRoomContext;

export function EditorWardrobeContextProvider({ children }: { children: ReactNode }): ReactElement {
	const editor = useEditor();
	const character = editor.character;
	const assetList = useObservable(GetAssetManager().assetList);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: character.data.id,
		getCharacter: (id) => {
			if (id === character.data.id) {
				return character.appearance.getRestrictionManager(ROOM_CONTEXT);
			}
			return null;
		},
		getTarget:  (target) => {
			if (target.type === 'character' && target.characterId === character.data.id) {
				return character.appearance;
			}
			return null;
		},
	}), [character]);

	const context = useMemo<WardrobeContext>(() => ({
		character,
		target: {
			type: 'character',
			characterId: character.data.id,
		},
		assetList,
		actions,
		useShard: false,
	}), [character]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}
