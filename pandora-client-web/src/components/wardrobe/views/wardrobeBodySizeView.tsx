import {
	AssetFrameworkCharacterState,
	BoneName,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { ICharacter, useCharacterAppearancePose } from '../../../character/character';
import _ from 'lodash';
import { useWardrobeExecuteCallback } from '../wardrobeContext';
import { BoneRowElement } from './wardrobePoseView';

export function WardrobeBodySizeEditor({ character, characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const [execute] = useWardrobeExecuteCallback();
	const currentBones = useCharacterAppearancePose(characterState);

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
					currentBones
						.filter((bone) => bone.definition.type === 'body')
						.map((bone) => (
							<BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => {
								setBody({
									bones: {
										[bone.definition.name]: value,
									},
								});
							} } />
						))
				}
			</div>
		</div>
	);
}
