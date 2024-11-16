import React from 'react';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig';

// TODO: Pose and Expressions tutorial
/*
- Open pose tab
	- Explain there are several premade presets, divided into categories
	- One category is "View" - this allows you to turn your character around
	- Next are "Arm" categories (arms can move in shoulder and elbow; each arm can be in the front of behind the body; they can be controlled individually - more on that later)
	- Then there are "Leg" categories (currently with your legs you can be standing, kneeling, or sitting)
	- Finally there are categories "Toes" for tiptoeing and "Character rotation" for turning your character around
	- "Stored poses" allows you to save any custom poses you create yourself
	- "Character Y offset" is for "levitating" your character above the floor (or below it)
	- Finally the "Manual pose" are allows you to see all the aspects of a pose and control them individually. Feel free to explore!
- As the manual posing sliders can be a bit hard to get how you want them, we also offer posing UI on the character yourself
	- Click your character's name either in the graphics on the left, or in the "Personal room" character list
	- Click the "Pose" button to open the posing menu
	- In this view you can see circles you can drag to rotate various "bones" of your body. You can see that each matches some slider in the "Manual pose" menu
	- The left-right arrow at the bottom allows you to turn your character around
	- The four-way arrow allows you to switch to a character move mode. Note, that this might not always be available.
	- Finally, you can exit the pose mode by clicking the red "X" in the middle of your character
- Next are "expressions"
	- Open the "Expressions" tab
	- Explain that these depend purely on the worn bodyparts. The "Expressions" tab is excerpt from individual bodypart menus
	(note to self: Those were already mostly covered, in wardrobe body tutorial)
- You might have noticed these tabs only show your own character. If you wanted to change these for some other character?
	- You can find the same two "pose" and "expressions" tabs in the Wardrobe of any character!
*/
export const TUTORIAL_WARDROBE_POSING_EXPRESSIONS: TutorialConfig = {
	id: 'wardrobePoseExpressions',
	name: `Character interactions: Poses and Expressions`,
	disabled: 'workInProgress',
	description: (
		<p>
			This tutorial will teach you posing your character and changing its expression.
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
