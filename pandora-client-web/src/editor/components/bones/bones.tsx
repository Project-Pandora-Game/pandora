import { AppearanceArmPose, AssetFrameworkCharacterState, CharacterArmsPose, PartialAppearancePose } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { ModalDialog } from '../../../components/dialog/dialog';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { BoneRowElement, WardrobeArmPoses, WardrobeLegsPose, WardrobePoseCategories } from '../../../components/wardrobe/views/wardrobePoseView';
import { WardrobeExpressionGui } from '../../../components/wardrobe/views/wardrobeExpressionsView';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { EditorCharacter, useEditorCharacterState } from '../../graphics/character/appearanceEditor';

export function BoneUI(): ReactElement {
	const editor = useEditor();
	const characterState = useEditorCharacterState();
	const character = editor.character;

	const assetManager = characterState.assetManager;
	const allBones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const showBones = useObservable(editor.showBones);

	const setPose = useCallback((pose: PartialAppearancePose) => {
		character.getAppearance().produceState((state) => state.produceWithPose(pose, 'pose'));
	}, [character]);

	return (
		<Scrollbar color='lighter' className='bone-ui slim'>
			<div>
				<label htmlFor='show-bones-toggle'>Show bone points</label>
				<input
					id='show-bones-toggle'
					type='checkbox'
					checked={ showBones }
					onChange={ (e) => {
						editor.showBones.value = e.target.checked;
					} }
				/>
			</div>
			<WardrobeArmPoses armsPose={ characterState.requestedPose } setPose={ setPose } />
			<WardrobeLegsPose legs={ characterState.requestedPose.legs } setPose={ setPose } />
			<div>
				<label htmlFor='back-view-toggle'>Show back view</label>
				<input
					id='back-view-toggle'
					type='checkbox'
					checked={ characterState.requestedPose.view === 'back' }
					onChange={ (e) => {
						character.getAppearance().setView(e.target.checked ? 'back' : 'front');
					} }
				/>
			</div>
			<FieldsetToggle legend='Pose presets' persistent={ 'bone-ui-poses' } className='slim-padding' open={ false }>
				<WardrobePoseCategories characterState={ characterState } setPose={ setPose } />
			</FieldsetToggle>
			<FieldsetToggle legend='Expressions' persistent={ 'expressions' } className='no-padding' open={ false }>
				<WardrobeExpressionGui character={ character } characterState={ characterState } />
			</FieldsetToggle>
			<hr />
			<PoseExportGui character={ character } characterState={ characterState } />
			<h4>
				Pose bones
				<ContextHelpButton>
					<p>
						The "Poses"-tab enables you to manipulate the bones/poses of the editor character, visible in the "Preview"-tab.<br />
						You can manipulate each bone in two directions via either the slider for a quick and rough movement,<br />
						or the number field for a more fine-grained setting.<br />
						The middle position, or number 0, is the neutral position for each slider - the position in which<br />
						images are not modified from the source image (in most cases).
					</p>
					<p>
						You can experiment with them to see if your asset transforms correctly with the various possible<br />
						bone movements that are allowed for the asset or to decide which poses should the asset require/forbid<br />
						when you will be implementing the rest of the asset logic later.
					</p>
					On the top of the tab, there are four toggles:
					<ul>
						<li>
							a toggle to show the positions of bone points on the body, allowing you to see the exact<br />
							bone position and to drag the bone directly on the "Preview"-tab's character model
						</li>
						<li>
							a toggle to move the arms in front of or behind the body
						</li>
						<li>
							a toggle to display the character from behind instead of from the front
						</li>
						<li>
							a toggle that lets you set the bone to an arbitrary position, ignoring potential<br />
							in-game range limits of this bone
						</li>
					</ul>
				</ContextHelpButton>
			</h4>
			{
				allBones
					.filter((bone) => bone.type === 'pose')
					.map((bone) => <BoneRowElement key={ bone.name } definition={ bone } rotation={ characterState.getRequestedPoseBoneValue(bone.name) } onChange={ (value) => character.getAppearance().setPose(bone.name, value) } />)
			}
			<hr />
			<h4>Body bones</h4>
			{
				allBones
					.filter((bone) => bone.type === 'body')
					.map((bone) => <BoneRowElement key={ bone.name } definition={ bone } rotation={ characterState.getRequestedPoseBoneValue(bone.name) } onChange={ (value) => character.getAppearance().setPose(bone.name, value) } />)
			}
		</Scrollbar>
	);
}

function PoseExportGui({ characterState }: { character: EditorCharacter; characterState: AssetFrameworkCharacterState; }) {
	const assetManager = characterState.assetManager;
	const [open, setOpen] = useState(false);

	const bonesText = useMemo(() => {
		let result = '';
		for (const bone of assetManager.getAllBones()) {
			if (bone.type !== 'pose')
				continue;
			const value = characterState.requestedPose.bones[bone.name];
			if (value == null || value === 0)
				continue;
			result += `\n\t\t${bone.name}: ${value},`;
		}
		return result;
	}, [assetManager, characterState.requestedPose]);

	const typeScriptValue = useMemo(() => {
		return `{
	name: '[Pose Preset Name]',
	bones: {${bonesText}
	},
	${CharacterArmsPoseToString(characterState.requestedPose)}
},`;
	}, [bonesText, characterState]);

	if (!open) {
		return <Button onClick={ () => setOpen(true) }>Show pose export</Button>;
	}

	return (
		<ModalDialog>
			<Column padding='medium'>
				<h2>Pose export</h2>
				<p>
					You can use the following TypeScript code and insert into&nbsp;
					<a href='https://github.com/Project-Pandora-Game/pandora-assets/blob/master/src/posePresets.ts' target='_blank' rel='noreferrer'>
						<code>'src/posePresets.ts'</code>
					</a>
					&nbsp;in pandora-assets repository.
				</p>
				<textarea value={ typeScriptValue } readOnly rows={ typeScriptValue.split('\n').length } />
				<Row padding='medium'>
					<Button onClick={ () => void navigator.clipboard.writeText(typeScriptValue).catch(() => { /** ignore */ }) }>Copy to clipboard</Button>
					<Button onClick={ () => setOpen(false) }>Close</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function AppearanceArmPoseToString({ position }: Readonly<AppearanceArmPose>): string {
	return `{ position: '${position}' }`;
}

function CharacterArmsPoseToString({ leftArm, rightArm }: CharacterArmsPose): string {
	if (leftArm.position === rightArm.position)
		return `arms: ${AppearanceArmPoseToString(leftArm)},`;

	return `leftArm: ${AppearanceArmPoseToString(leftArm)},`
		+ '\n\t' + `rightArm: ${AppearanceArmPoseToString(rightArm)},`;
}
