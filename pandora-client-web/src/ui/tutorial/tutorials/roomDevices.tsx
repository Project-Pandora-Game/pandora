import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

// TODO: Room devices
// (spawn room device, deploy it, move it, entering, leaving, storing; final note on permissions)
export const TUTORIAL_ROOM_DEVICES: TutorialConfig = {
	id: 'roomDevices',
	name: `Room devices`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you the most important bits about Room Devices (furniture).<br />
			This includes spawning a new room device, deploying it where you want it and storing it again, as well as entering and leaving deployed devices.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<>
							[ WORK IN PROGRESS ]
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
