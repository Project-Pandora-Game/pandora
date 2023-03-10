import { AppearanceArmPose, ArmsPose, CharacterArmsPose, CharacterView } from 'pandora-common';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { useCharacterAppearanceArmsPose, useCharacterAppearancePose, useCharacterAppearanceView } from '../../../character/character';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { ModalDialog } from '../../../components/dialog/dialog';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { BoneRowElement, WardrobeArmPoses, WardrobeExpressionGui, WardrobePoseCategories } from '../../../components/wardrobe/wardrobe';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { EditorCharacter } from '../../graphics/character/appearanceEditor';

export function BoneUI(): ReactElement {
	const editor = useEditor();
	const character = editor.character;

	const bones = useCharacterAppearancePose(character);
	const armsPose = useCharacterAppearanceArmsPose(character);
	const view = useCharacterAppearanceView(character);
	const showBones = useObservable(editor.showBones);

	const [unlocked, setUnlocked] = useState(!character.appearance.enforce);

	useEffect(() => {
		character.appearance.enforce = !unlocked;
	}, [character.appearance, unlocked]);

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
			<WardrobeArmPoses armsPose={ armsPose } setPose={ (pose) => {
				character.appearance.setArmsPose(pose);
			} } />
			<div>
				<label htmlFor='back-view-toggle'>Show back view</label>
				<input
					id='back-view-toggle'
					type='checkbox'
					checked={ view === CharacterView.BACK }
					onChange={ (e) => {
						character.appearance.setView(e.target.checked ? CharacterView.BACK : CharacterView.FRONT);
					} }
				/>
			</div>
			<div>
				<label htmlFor='unlocked-toggle'>Ignore bone limits from items</label>
				<input
					id='unlocked-toggle'
					type='checkbox'
					checked={ unlocked }
					onChange={ (e) => {
						setUnlocked(e.target.checked);
					} }
				/>
			</div>
			<FieldsetToggle legend='Pose presets' persistent={ 'bone-ui-poses' } className='slim-padding' open={ false }>
				<WardrobePoseCategories appearance={ character.appearance } bones={ bones } armsPose={ armsPose } setPose={ (pose) => {
					character.appearance.importBones(pose.bones, 'pose', false);
					character.appearance.setArmsPose(pose);
				} } />
			</FieldsetToggle>
			<FieldsetToggle legend='Expressions' persistent={ 'expressions' } className='no-padding' open={ false }>
				<WardrobeExpressionGui />
			</FieldsetToggle>
			<hr />
			<PoseExportGui character={ character } />
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
				bones
					.filter((bone) => bone.definition.type === 'pose')
					.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } unlocked={ unlocked } />)
			}
			<hr />
			<h4>Body bones</h4>
			{
				bones
					.filter((bone) => bone.definition.type === 'body')
					.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } unlocked={ unlocked } />)
			}
		</Scrollbar>
	);
}

function PoseExportGui({ character }: { character: EditorCharacter; }) {
	const [open, setOpen] = useState(false);

	const pose = useCharacterAppearancePose(character);
	const arms = useCharacterAppearanceArmsPose(character);

	const typeScriptValue = useMemo(() => {
		return `{
	name: '[Pose Preset Name]',
	bones: {${pose.reduce((acc, value) => (value.rotation === 0 || value.definition.type !== 'pose')
			? acc
			: acc + `\n\t\t${value.definition.name}: ${value.rotation},`, '')}
	},
	${CharacterArmsPoseToString(arms)}
},`;
	}, [pose, arms]);

	if (!open) {
		return <Button onClick={ () => setOpen(true) }>Show pose export</Button>;
	}

	return (
		<ModalDialog>
			<Column>
				<h2>Pose export</h2>
				<p>
					You can use the following TypeScript code and insert into&nbsp;
					<a href='https://github.com/Project-Pandora-Game/pandora-assets/blob/master/src/posePresets.ts' target='_blank' rel='noreferrer'>
						<code>'src/posePresets.ts'</code>
					</a>
					&nbsp;in pandora-assets repository.
				</p>
				<textarea value={ typeScriptValue } readOnly rows={ typeScriptValue.split('\n').length } />
				<Row>
					<Button onClick={ () => void navigator.clipboard.writeText(typeScriptValue).catch(() => { /** ignore */ }) }>Copy to clipboard</Button>
					<Button onClick={ () => setOpen(false) }>Close</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function AppearanceArmPoseToString({ position }: Readonly<AppearanceArmPose>): string {
	return `{ position: ArmsPose.${ArmsPose[position]} }`;
}

function CharacterArmsPoseToString({ leftArm, rightArm }: CharacterArmsPose): string {
	if (leftArm.position === rightArm.position)
		return `arms: ${AppearanceArmPoseToString(leftArm)},`;

	return `leftArm: ${AppearanceArmPoseToString(leftArm)},`
		+ '\n\t' + `rightArm: ${AppearanceArmPoseToString(rightArm)},`;
}
