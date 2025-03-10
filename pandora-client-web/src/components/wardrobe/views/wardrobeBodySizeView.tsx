import classNames from 'classnames';
import { throttle } from 'lodash-es';
import {
	AppearanceActionProcessingContext,
	AssetFrameworkCharacterState,
	BoneName,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { ICharacter } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment.ts';
import { Column } from '../../common/container/container.tsx';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider.tsx';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobePermissionRequestCallback } from '../wardrobeActionContext.tsx';
import { ActionWarning, ActionWarningContent, CheckResultToClassName } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { BoneRowElement } from './wardrobePoseView.tsx';

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

	const setBody = useMemo(() => throttle(setBodyDirect, LIVE_UPDATE_THROTTLE), [setBodyDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<WardrobeBodySizeGate>
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
				</WardrobeBodySizeGate>
			</div>
		</div>
	);
}

export function WardrobeBodySizeGate({ children }: ChildrenProps): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector } = useWardrobeContext();
	const [requestPermission, processing] = useWardrobePermissionRequestCallback();
	const [ref, setRef] = useState<HTMLElement | null>(null);

	const checkResultInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null || actionTarget.type !== 'character')
			return processingContext.invalid();

		processingContext.addInteraction(actionTarget.character, 'modifyBody');
		processingContext.checkInteractWithTarget(actionTarget);
		return processingContext.finalize();
	}, [actions, globalState, targetSelector]);
	const checkResult = useCheckAddPermissions(checkResultInitial);

	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.stopPropagation();
		if (!checkResult.valid) {
			if (checkResult.prompt != null) {
				requestPermission(checkResult.prompt, Array.from(checkResult.requiredPermissions).map((p) => [p.group, p.id]));
			}
			return;
		}
	}, [requestPermission, checkResult]);

	if (checkResult != null && !checkResult.valid) {
		return (
			<Column padding='medium'>
				<span>You cannot change this character's body.</span>
				<ActionWarningContent problems={ checkResult.problems } prompt={ false } />
				<button
					ref={ setRef }
					className={ classNames(
						'wardrobeActionButton',
						CheckResultToClassName(checkResult, false),
					) }
					onClick={ onClick }
					disabled={ processing }
				>
					<ActionWarning checkResult={ checkResult } actionInProgress={ false } parent={ ref } />
					Request access
				</button>
			</Column>
		);
	}

	return (
		<>{ children }</>
	);
}
