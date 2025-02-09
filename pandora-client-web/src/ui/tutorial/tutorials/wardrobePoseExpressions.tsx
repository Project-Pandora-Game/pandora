import { MakeTutorialConditionFlag, type TutorialConfig } from '../tutorialSystem/tutorialConfig';

export const TUTORIAL_WARDROBE_POSING_EXPRESSIONS: TutorialConfig = {
	id: 'wardrobePoseExpressions',
	name: `Character interactions: Poses and Expressions`,
	description: (
		<p>
			This tutorial will teach you about posing your character and changing its expression.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							Hello and welcome to the tutorial on character poses and expressions!<br />
							In this tutorial you will learn how to move the body of a character<br />
							and how to change its various aspects, such as facial expressions.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								Let's start by switching to your character's Pose tab.<br />
								This is where you can find pre-defined pose templates, your own custom pose templates, and manual posing controls.
							</p>
							<p>To proceed with the tutorial, open the "Pose" tab.</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							The tab shows a large selection of default presets, divided into different categories.<br />
							The first one is "View" - it allows you to turn your character by spinning it around by 180 degrees.<br />
							<br />
							Note: The same can also be achieved by using the '/turn' command in the chat (or the short variant '/t').
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('View'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							When you scroll down a bit, the three arm posing presets sections are next.<br />
							Arms can be moved at their shoulder and elbow joints.
							Each arm can also either be in the front or behind the body.
							This can be controlled individually, including each hand.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Arms ('),
						},
					],
				},
				{
					text: (
						<p>
							If you scroll further down, you can see the next four sections. These are leg posing presets, grouped into standing, kneeling, and sitting poses.
							Legs can be moved at their hip joints.
							Each leg can be controlled individually.<br />
							Characters can also stand on their toes.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Legs ('),
						},
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Toes'),
						},
					],
				},
				{
					text: (
						<p>
							Next, there is the presets section that lets you quickly rotate your character in the 4 main directions, such as sideways and upside down.<br />
							The center of rotation is where character's feet usually touch the floor.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Character rotation'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							The 'Stored poses' category lets you create and manage your own pose presets.<br />
							<br />
							After posing your character manually as desired (more on how to do manual posing in a later part of this tutorial)
							you can use this section to save the current pose to your Pandora account or export it as a file or text string.
							You can select which joints/bones of the body will be included in the preset. Not including something means the preset will not change the according current value.<br />
							<br />
							A button for any saved custom pose preset will be listed in this section afterwards. You can manage all stored poses with the edit button in the middle.
							Any exported pose can be imported again, as long as you still have a free pose preset slot, as storing custom poses on the account has a limit.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Stored poses'),
						},
					],
				},
				{
					text: (
						<p>
							The 'Character Y Offset' input field lets you enter a positive or negative number that will "levitate" your character above the floor (or below it).<br />
							<br />
							This feature can be useful in certain situations, for example to show a character on top of objects in a perspectively correct way,
							to simulate hanging from the ceiling, or to slowly appear behind an object by slowly increasing the value.<br />
							You can use the button next to the input field to reset the value back to zero quickly.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.div-container.direction-row.padding-small.gap-medium',
							filter: (e) => e.innerText.includes('Offset'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Please switch back to the "Pose" tab.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Pose'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Pose'),
					}],
				},
				{
					text: (
						<p>
							At the bottom of the tab are the manual posing controls. Using these, you can manipulate every joint and bone and adjust
							each hand configuration.<br />
							There also exists an alternative interface for manual posing. More on that later.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
							filter: (e) => e.innerText.includes('Manual pose'),
						},
					],
				},
				{
					text: (
						<>
							Please open the "Manual pose" section by clicking on it.
						</>
					),
					hideWhenCompleted: true,
					highlight: [{
						query: '.fieldset-toggle-legend',
						filter: (e) => e.innerText.includes('Manual pose'),
					}],
					conditions: [{
						type: 'elementQuery',
						query: '.fieldset-toggle-legend.open',
						filter: (e) => e.innerText.includes('Manual pose'),
					}],
				},
				{
					text: (
						<p>
							With the first checkbox, you can toggle between either showing manual arm and hand controls that control both sides at once
							or showing controls for the left and right arm separately.<br />
							<br />
							These controls let you adjust the position of the arms in front or behind the body, the fingers, the hand rotation, and which
							arm covers the other one when a pose would overlap them.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.div-container.direction-row.gap-medium',
							filter: (e) => e.innerText.includes('Control arms'),
						},
						{
							query: '.armPositioningTable',
							filter: (e) => e.innerText.includes('Fingers'),
						},
					],
				},
				{
					text: (
						<p>
							The following legs state selector lets you switch the legs between the standing, sitting, and kneeling state while keeping
							the current leg rotations applied.<br />
							<br />
							Note: The same can also be achieved by using the chat commands '/stand', '/sit', or '/kneel'.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.armPositioningTable',
							filter: (e) => e.innerText.includes('State'),
						},
					],
				},
				{
					text: (
						<p>
							The last section lets you manually set the rotation for every available body joint/bone, as well as the character rotation itself,
							from minus 180 to plus 180 degrees.
							This can be useful for fine-tuning a pose.<br />
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle:has(> .bone-rotation)',
						},
					],
				},
				{
					text: (
						<p>
							Feel free to experiment with the features in this tab before continuing.<br />
							In the next step, the alternative user interface for manual posing will be explained.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							As the manual posing sliders can be a bit hard to use for quickly adjusting a pose, we also allow posing by dragging the joints of a character directly.<br />
							<br />
							In the room scene, find your character and click on your character's name to open its context menu or alternatively open it via the space's character list.
						</p>
					),
					// TODO: Graphics highlight - player character's label.
					conditions: [{
						type: 'elementQuery',
						query: '.context-menu',
					}],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							In the context menu, select "Pose" to enter the posing mode that allows you to make changes to the current pose.
						</p>
					),
					highlight: [{
						query: '.context-menu button',
						filter: (element) => element.innerText.includes('Pose'),
					}],
					conditions: [
						MakeTutorialConditionFlag('roomSceneMode', (value) => value.mode === 'poseCharacter'),
					],
				},
			],
		},
		{
			steps: [
				{
					text: <>Please switch back to the room screen.</>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<>
							<p>
								In this mode you can see circles over the character's body that you can drag to rotate the various joints/bones of
								the character body (move or minimize this popup if needed).
								Each one matches a slider from the "Manual pose" section in the "Pose" tab.<br />
								Hint: To achieve the most accurate rotation control, hold a circle and drag in the direction of the arrow on it and only then drag
								in a circle around the bone with some distance to it for a better control of the angle of the desired rotation.
							</p>
							<ul>
								<li>Clicking the left-right arrow at the bottom allows you to turn the character around.</li>
								<li>The four-way arrow in the center allows you to switch to the character move mode. Please note that this button might not always be available.</li>
								<li>You can exit the manual posing mode by clicking the red "X" in the middle of the character.</li>
							</ul>
							<p>
								<br />
								Feel free to try posing your character in this mode before continuing.<br />
								When you are done, exit the posing interface to proceed with the last part of this tutorial.
							</p>
						</>
					),
					conditions: [
						MakeTutorialConditionFlag('roomSceneMode', (value) => value.mode === 'normal'),
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: (
						<p>
							Lastly, we will learn about character expressions and body states.<br />
							Open the "Expressions" tab.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Expressions'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Expressions'),
					}],
				},
				{
					text: (
						<p>
							This tab shows a number of expression modules you can interact with.<br />
							If you played around with your character's body parts in the wardrobe,
							you might notice that these options exactly match the options on your current body parts.
							This is because the purpose of this menu is to offer a quick way to interact with a few select modules from the parts of your body.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.fieldset-toggle',
						},
					],
				},
				{
					text: (
						<p>
							It is important to note, that the "Pose" and "Expression" tabs only allow you to alter your own character.
							If you want to make such changes to another character in the same room, you can find the same two tabs in the wardrobe of any character.
							That said, changes to another character might require the other party's permission first.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes this tutorial on character poses and expressions.<br />
							Have fun with the powerful posing possibilities in Pandora, but please do not feel pressured into believing that you have to use it extensively
							or stressed in case you feel that you are not good or quick enough at it. It is not necessary to constantly switch poses alongside an ongoing role play in real-time.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
