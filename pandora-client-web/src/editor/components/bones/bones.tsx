import { ArmsPose, CharacterView } from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { useCharacterAppearanceArmsPose, useCharacterAppearancePose, useCharacterAppearanceView } from '../../../character/character';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { BoneRowElement, WardrobePoseCategories } from '../../../components/wardrobe/wardrobe';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

export function BoneUI(): ReactElement {
	const editor = useEditor();
	const character = editor.character;

	const bones = useCharacterAppearancePose(character);
	const armsPose = useCharacterAppearanceArmsPose(character);
	const view = useCharacterAppearanceView(character);
	const showBones = useObservable(editor.showBones);
	const safemode = useObservable(character.appearance.safemode);

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
			<div>
				<label htmlFor='arms-front-toggle'>Arms are in front of the body</label>
				<input
					id='arms-front-toggle'
					type='checkbox'
					checked={ armsPose === ArmsPose.FRONT }
					onChange={ (e) => {
						character.appearance.setArmsPose(e.target.checked ? ArmsPose.FRONT : ArmsPose.BACK);
					} }
				/>
			</div>
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
			<div>
				<label htmlFor='unlocked-toggle'>Character Safemode</label>
				<input
					id='unlocked-toggle'
					type='checkbox'
					checked={ safemode }
					onChange={ (e) => {
						character.appearance.safemode.value = e.target.checked;
					} }
				/>
			</div>
			<FieldsetToggle legend='Pose presets' persistent={ 'bone-ui-poses' } open={ false }>
				<WardrobePoseCategories appearance={ character.appearance } bones={ bones } armsPose={ armsPose } setPose={ (pose) => {
					character.appearance.importPose(pose.pose, 'pose', false);
					if (pose.armsPose != null) {
						character.appearance.setArmsPose(pose.armsPose);
					}
				} } />
			</FieldsetToggle>
			<hr />
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
