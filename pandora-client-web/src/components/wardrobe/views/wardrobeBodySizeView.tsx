import {
	AssetFrameworkCharacterState,
	BoneName,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { ICharacter } from '../../../character/character';
import _ from 'lodash';
import { useWardrobeExecuteCallback } from '../wardrobeContext';
import { BoneRowElement } from './wardrobePoseView';

export function WardrobeBodySizeEditor({ character, characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });
	const assetManager = characterState.assetManager;
	const allBones = useMemo(() => assetManager.getAllBones(), [assetManager]);

	const setBodyDirect = useCallback(({ bones }: { bones: Record<BoneName, number>; }) => {
		execute({
			type: 'body',
			target: character.id,
			bones,
		});
	}, [execute, character]);

	const setBody = useMemo(() => _.throttle(setBodyDirect, 100), [setBodyDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				{
					allBones
						.filter((bone) => bone.type === 'body')
						.map((bone) => (
							<BoneRowElement key={ bone.name } definition={ bone } characterState={ characterState } onChange={ (value) => {
								setBody({
									bones: {
										[bone.name]: value,
									},
								});
							} } />
						))
				}
			</div>
		</div>
	);
}
