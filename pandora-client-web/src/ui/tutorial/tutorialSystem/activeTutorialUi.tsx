import classNames from 'classnames';
import type { Immutable } from 'immer';
import { uniq } from 'lodash';
import { AssertNever, EMPTY_ARRAY, GetLogger, TutorialIdSchema, type TutorialId } from 'pandora-common';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../common/useEvent';
import { Button } from '../../../components/common/button/button';
import { Row } from '../../../components/common/container/container';
import { DialogInPortal, DraggableDialog, useConfirmDialog } from '../../../components/dialog/dialog';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider';
import { DEVELOPMENT } from '../../../config/Environment';
import { useNullableObservable, useObservable } from '../../../observable';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import type { TutorialCondition, TutorialHighlightSelector, TutorialStep } from './tutorialConfig';
import type { TutorialRunner, TutorialStageRunner } from './tutorialRunner';
import './tutorialUi.scss';

export function ActiveTutorialUi({ tutorial, stopTutorial }: {
	tutorial: TutorialRunner;
	stopTutorial: () => void;
}): ReactElement | null {
	const stage = useObservable(tutorial.currentStage);
	const confirm = useConfirmDialog();

	useEffect(() => {
		if (stage == null) {
			stopTutorial();
		}
	}, [stage, stopTutorial]);

	const stopTutorialConfirm = useCallback(() => {
		confirm('Cancel tutorial', <>Are you sure you want to cancel the tutorial?<br /><i>The tutorial will not be marked as completed.</i></>, undefined, 'aboveTutorial')
			.then((result) => {
				if (result) {
					stopTutorial();
				}
			}, (err) => {
				GetLogger('ActiveTutorialUi').error('Confirm errored:', err);
			});
	}, [stopTutorial, confirm]);

	const contentRef = useRef<HTMLDivElement>(null);

	const scrollToEnd = useCallback(() => {
		const target = contentRef.current?.parentElement;
		if (target != null) {
			target.scroll({
				top: target.scrollHeight,
				left: 0,
				behavior: 'smooth',
			});
		}
	}, []);

	const activeStepIndex = useNullableObservable((stage != null && stage !== 'complete') ? stage.activeStepIndex : null);
	const activeStageStep = (stage != null && stage !== 'complete' && activeStepIndex != null && activeStepIndex < stage.config.steps.length) ?
		stage.config.steps[activeStepIndex] : undefined;

	if (stage == null)
		return null;

	const headerBottom = document.getElementsByClassName('Header')[0]?.getBoundingClientRect().bottom ?? 26;
	const defaultShift = 26;

	return (
		<DraggableDialog
			title='Tutorial'
			className='tutorialDialogContainer'
			close={ stopTutorialConfirm }
			initialPosition={ { x: defaultShift, y: headerBottom + defaultShift } }
			modal={ typeof stage !== 'string' && stage.config.modal === true }
			highlightShaded={ activeStageStep?.conditions.some((c) => c.type === 'next') ?? false }
			allowShade
		>
			<div className='tutorialDialog div-container direction-column gap-medium' ref={ contentRef }>
				<strong>
					{ tutorial.config.name } (
					{
						stage === 'complete' ? (
							<>complete</>
						) : DEVELOPMENT ? (
							<a
								title='[DEBUG] Skip this tutorial stage'
								onClick={ (ev) => {
									ev.preventDefault();
									ev.stopPropagation();
									tutorial.advanceStage();
								} }
							>
								{ tutorial.stageIndex + 1 }/{ tutorial.config.stages.length }
							</a>
						) : (
							<>{ tutorial.stageIndex + 1 }/{ tutorial.config.stages.length }</>
						)
					}
					)
				</strong>
				{
					stage === 'complete' ? (
						<ActiveTutorialCompletionUi tutorial={ tutorial } />
					) : (
						<ActiveTutorialStageUi stage={ stage } scrollToEnd={ scrollToEnd } />
					)
				}
			</div>
		</DraggableDialog>
	);
}

function ActiveTutorialCompletionUi({ tutorial }: {
	tutorial: TutorialRunner;
}): ReactElement | null {
	const { tutorialCompleted } = useAccountSettings();
	const directory = useDirectoryConnector();

	const [didAutoFail, setDidAutoFail] = useState(false);

	const saveCompletion = useCallback(async () => {
		if (tutorialCompleted.includes(tutorial.config.id)) {
			tutorial.endTutorial();
			return;
		}

		const newCompletion: TutorialId[] = uniq([...tutorialCompleted, tutorial.config.id]);
		newCompletion.sort((a, b) => TutorialIdSchema.options.indexOf(a) - TutorialIdSchema.options.indexOf(b));

		const { result } = await directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: {
				tutorialCompleted: newCompletion,
			},
		});

		if (result === 'ok') {
			tutorial.endTutorial();
		} else {
			AssertNever(result);
		}
	}, [tutorial, tutorialCompleted, directory]);

	const [manuallySaveCompletion, processing] = useAsyncEvent(saveCompletion, null, {
		errorHandler: (err) => {
			toast('Failed to save your progress. Please try again.', TOAST_OPTIONS_ERROR);
			GetLogger('TutorialSaveCompletion').error('Failed to save tutorial completion:', err);
		},
	});

	useEffect(() => {
		if (didAutoFail)
			return;

		saveCompletion()
			.catch((err: unknown) => {
				GetLogger('TutorialSaveCompletion').error('Failed to save tutorial completion:', err);
				setDidAutoFail(true);
			});
	}, [didAutoFail, saveCompletion]);

	return (
		<>
			{
				didAutoFail ? (
					<>
						<span>Failed to save your progress!</span><br />
						<Button
							onClick={ manuallySaveCompletion }
							disabled={ processing }
						>
							Retry
						</Button>
					</>
				) : (
					<span>Saving your progress...</span>
				)
			}
		</>
	);
}

function ActiveTutorialStageUi({ stage, scrollToEnd }: {
	stage: TutorialStageRunner;
	scrollToEnd: () => void;
}): ReactElement | null {
	const activeStepIndex = useObservable(stage.activeStepIndex);

	useEffect(() => {
		if (activeStepIndex < 0) {
			stage.tutorial.advanceStage();
			return;
		}

		scrollToEnd();

		// If there is a step, trigger updates at regular intervals
		const interval = setInterval(() => {
			stage.update();
		}, 1_000);
		return () => {
			clearInterval(interval);
		};
	}, [stage, activeStepIndex, scrollToEnd]);

	if (activeStepIndex < 0)
		return null;

	return (
		<>
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
			<span className='finishedStep'>
				{
					typeof step.text === 'function' ? (
						<span><step.text /></span>
					) : <span>{ step.text }</span>
				}
			</span>
		);
	}

	return (
		<>
			{
				!step ? (
					null
				) : typeof step.text === 'function' ? (
					<span><step.text /></span>
				) : <span>{ step.text }</span>
			}
			{
				step.highlight?.map((highlight, index) => (
					<ActiveTutorialHighlight key={ index }
						highlight={ highlight }
					/>
				))
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
					className='tutorialNextButton'
					onClick={ () => {
						stage.stepClickNext(stepIndex);
					} }
				>
					Next { '\u25b8' }
					<div className='tutorial-highlight-overlay' />
				</Button>
			</Row>
		);
	} else if (condition.type === 'url') {
		return null;
	} else if (condition.type === 'elementQuery') {
		return null;
	} else if (condition.type === 'flag') {
		return null;
	} else if (condition.type === 'never') {
		return null;
	}

	AssertNever(condition);
}

const HIGHLIGHT_QUERY_INTERVAL = 1_000;
const HIGHLIGHT_POSITION_INTERVAL = 200;
const HIGHLIGHT_PADDING = 8;
const HIGHLIGHT_INSET = 2;

function ActiveTutorialHighlight({ highlight }: {
	highlight: TutorialHighlightSelector;
}): ReactElement {
	const [elements, setElements] = useState<readonly HTMLElement[]>(EMPTY_ARRAY);

	const update = useCallback(() => {
		const newElements = Array.from(document.querySelectorAll(highlight.query))
			.filter((e): e is HTMLElement => e instanceof HTMLElement)
			.filter((e) => {
				if (highlight.filter == null)
					return true;

				return highlight.filter(e);
			});

		setElements(newElements);
	}, [highlight]);

	useEffect(() => {
		const interval = setInterval(update, HIGHLIGHT_QUERY_INTERVAL);
		update();

		return () => {
			clearInterval(interval);
		};
	}, [update]);

	return (
		<>
			{
				elements.map((el, i) => (
					<ActiveTutorialElementHighlight key={ el.id || i }
						target={ el }
						inset={ highlight.inset === true }
						zIndex={ highlight.zIndex }
					/>
				))
			}
		</>
	);
}

function ActiveTutorialElementHighlight({ target, inset, zIndex = 'normal' }: {
	target: HTMLElement;
	inset: boolean;
	zIndex: TutorialHighlightSelector['zIndex'];
}): ReactElement | null {
	const [area, setArea] = useState<[number, number, number, number]>([0, 0, 0, 0]);

	const update = useCallback(() => {
		if (target.offsetParent == null) {
			setArea([0, 0, 0, 0]);
			return;
		}

		const bounds = target.getBoundingClientRect();
		setArea([bounds.left, bounds.top, bounds.width, bounds.height]);
	}, [target]);

	useEffect(() => {
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(target);

		// Update on timer too, because resize observer doesn't catch moves
		const interval = setInterval(update, HIGHLIGHT_POSITION_INTERVAL);

		update();

		return () => {
			clearInterval(interval);
			resizeObserver.disconnect();
		};
	}, [target, update]);

	if (area[2] === 0 || area[3] === 0)
		return null;

	return (
		<DialogInPortal>
			<div
				className={ classNames(
					'tutorial-highlight-overlay base',
					zIndex === 'aboveTutorial' ? 'z-aboveTutorial' : null,
				) }
				style={ {
					left: inset ? (area[0] + HIGHLIGHT_INSET) : (area[0] - HIGHLIGHT_PADDING),
					top: inset ? (area[1] + HIGHLIGHT_INSET) : (area[1] - HIGHLIGHT_PADDING),
					width: inset ? (area[2] - 2 * HIGHLIGHT_INSET) : (area[2] + 2 * HIGHLIGHT_PADDING),
					height: inset ? (area[3] - 2 * HIGHLIGHT_INSET) : (area[3] + 2 * HIGHLIGHT_PADDING),
				} }
			/>
			<div
				className='tutorial-highlight-overlay top'
				style={ {
					left: inset ? (area[0] + HIGHLIGHT_INSET) : (area[0] - HIGHLIGHT_PADDING),
					top: inset ? (area[1] + HIGHLIGHT_INSET) : (area[1] - HIGHLIGHT_PADDING),
					width: inset ? (area[2] - 2 * HIGHLIGHT_INSET) : (area[2] + 2 * HIGHLIGHT_PADDING),
					height: inset ? (area[3] - 2 * HIGHLIGHT_INSET) : (area[3] + 2 * HIGHLIGHT_PADDING),
				} }
			/>
		</DialogInPortal>
	);
}
