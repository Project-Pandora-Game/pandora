import { uniq } from 'lodash-es';
import {
	AppearanceActionProblem,
	AppearanceActionProcessingResult,
	FormatTimeInterval,
	type GameLogicActionSlowdownReason,
} from 'pandora-common';
import { ReactElement, useMemo } from 'react';
import { RenderAppearanceActionProblem, RenderAppearanceActionSlowdown } from '../../assets/appearanceValidation.tsx';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { Column } from '../common/container/container.tsx';
import { HoverElement } from '../hoverElement/hoverElement.tsx';

export function ActionSlowdownContent({ slowdownReasons, slowdownTime }: { slowdownReasons: ReadonlySet<GameLogicActionSlowdownReason>; slowdownTime: number; }): ReactElement {
	const reasons = useMemo(() => (
		uniq(
			Array.from(slowdownReasons)
				.map((reason) => RenderAppearanceActionSlowdown(reason))
				.filter(Boolean),
		)
	), [slowdownReasons]);

	return (
		<>
			This action will start a usage attempt that will take at least { FormatTimeInterval(slowdownTime, 'two-most-significant') } before
			you can decide when it is successful or stopped.
			{
				reasons.length > 0 ? (
					<>
						<br />
						This will happen because:
						<ul>
							{
								reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
							}
						</ul>
					</>
				) : null
			}
		</>
	);
}

export function ActionProblemsContent({ problems, prompt, customText }: { problems: readonly AppearanceActionProblem[]; prompt: boolean; customText?: string; }): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const assetManager = useAssetManager();
	const reasons = useMemo(() => (
		uniq(
			problems
				.map((problem) => RenderAppearanceActionProblem(assetManager, problem, wardrobeItemDisplayNameType))
				.filter(Boolean),
		)
	), [assetManager, problems, wardrobeItemDisplayNameType]);

	if (reasons.length === 0) {
		return (
			<>
				This action isn't possible.
			</>
		);
	}

	let text: string;
	if (customText != null) {
		text = customText;
	} else if (prompt) {
		text = 'Executing the action will prompt for the following permissions:';
	} else {
		text = "This action isn't possible, because:";
	}

	return (
		<>
			{ text }
			<ul>
				{
					reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
				}
			</ul>
		</>
	);
}

export function ActionButtonHoverInfo({ checkResult, parent, actionInProgress }: {
	checkResult: AppearanceActionProcessingResult;
	actionInProgress: boolean;
	parent: HTMLElement | null;
}) {
	const slowdown = checkResult.getActionSlowdownTime();
	if (checkResult.valid && slowdown === 0 && !actionInProgress) {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning display-linebreak'>
			<Column>
				{
					actionInProgress ? (
						<strong>You are currently attempting this action.</strong>
					) : null
				}
				{
					!checkResult.valid ? (
						<div>
							<ActionProblemsContent problems={ checkResult.problems } prompt={ checkResult.prompt != null } />
						</div>
					) : null
				}
				{ // Show slowdown only if the result is valid to make things less complicated
					(checkResult.valid && slowdown > 0) ? (
						<div>
							<ActionSlowdownContent slowdownReasons={ checkResult.actionSlowdownReasons } slowdownTime={ slowdown } />
						</div>
					) : null
				}
			</Column>
		</HoverElement>
	);
}
