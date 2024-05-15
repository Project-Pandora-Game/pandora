import type { Immutable } from 'immer';
import { AssertNever } from 'pandora-common';
import React, { useEffect, type ReactElement } from 'react';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { DraggableDialog } from '../../../components/dialog/dialog';
import { useObservable } from '../../../observable';
import type { TutorialCondition, TutorialStep } from './tutorialConfig';
import type { TutorialRunner, TutorialStageRunner } from './tutorialRunner';
import './tutorialUi.scss';

export function ActiveTutorialUi({ tutorial, stopTutorial }: {
	tutorial: TutorialRunner;
	stopTutorial: () => void;
}): ReactElement | null {
	const stage = useObservable(tutorial.currentStage);

	useEffect(() => {
		if (stage == null) {
			stopTutorial();
		}
	}, [stage, stopTutorial]);

	if (stage == null)
		return null;

	return (
		<DraggableDialog title='Tutorial' close={ stopTutorial }>
			<Column className='tutorialDialog'>
				<strong>{ tutorial.config.name } ({ tutorial.stageIndex + 1 }/{ tutorial.config.stages.length })</strong>
				<ActiveTutorialStageUi stage={ stage } />
			</Column>
		</DraggableDialog>
	);
}

function ActiveTutorialStageUi({ stage }: {
	stage: TutorialStageRunner;
}): ReactElement | null {
	const activeStepIndex = useObservable(stage.activeStepIndex);

	useEffect(() => {
		if (activeStepIndex < 0) {
			stage.tutorial.advanceStage();
			return;
		}

		// If there is a step, trigger updates at regular intervals
		const interval = setInterval(() => {
			stage.update();
		}, 1_000);
		return () => {
			clearInterval(interval);
		};
	}, [stage, activeStepIndex]);

	if (activeStepIndex < 0)
		return null;

	return (
		<>
			<span>{ stage.config.text }</span>
			<hr className='fill-x' />
			{
				stage.config.steps
					.slice(0, activeStepIndex + 1)
					.map((step, stepIndex) => (
						<ActiveTutorialStepUi key={ stepIndex }
							stage={ stage }
							stepIndex={ stepIndex }
							step={ step }
							active={ stepIndex === activeStepIndex }
						/>
					))
			}
		</>
	);
}

function ActiveTutorialStepUi({ stage, step, stepIndex, active }: {
	stage: TutorialStageRunner;
	stepIndex: number;
	step: Immutable<TutorialStep>;
	active: boolean;
}): ReactElement | null {
	if (!active) {
		if (!step.text || step.hideWhenCompleted)
			return null;

		return (
			<span className='finishedStep'>{ step.text }</span>
		);
	}

	return (
		<>
			{
				step.text ? (
					<span>{ step.text }</span>
				) : null
			}
			{
				step.conditions.map((condition, conditionIndex) => (
					<ActiveTutorialStepCondition key={ conditionIndex }
						stage={ stage }
						stepIndex={ stepIndex }
						step={ step }
						condition={ condition }
					/>
				))
			}
		</>
	);
}

function ActiveTutorialStepCondition({ condition, stage, stepIndex }: {
	stage: TutorialStageRunner;
	stepIndex: number;
	step: Immutable<TutorialStep>;
	condition: Immutable<TutorialCondition>;
}): ReactElement | null {
	if (condition.type === 'next') {

		return (
			<Row alignX='end'>
				<Button
					slim
					onClick={ () => {
						stage.stepClickNext(stepIndex);
					} }
				>
					Next { '\u25b8' }
				</Button>
			</Row>
		);
	} else if (condition.type === 'url') {
		return null;
	} else if (condition.type === 'elementQuery') {
		return null;
	} else if (condition.type === 'never') {
		return null;
	}

	AssertNever(condition);
}
