import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_CHARACTER_MODIFIERS: TutorialConfig = {
	id: 'characterModifiers',
	name: `Character Modifiers`,
	description: (
		<>
			<p>
				This tutorial will teach you about character modifiers that can customize how Pandora works.
			</p>
			<p>
				Note: It is strongly recommended to have completed the previous tutorial on "Permissions" before
				starting this one!
			</p>
		</>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<p>
							In this tutorial, we will talk about Pandora's character modifiers feature.
							Modifiers are deeply configurable special rules and effects that conditionally apply to your
							character when added and enabled by you or others.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
					conditions: [{
						type: 'elementQuery',
						query: '.roomScreen .tab.active',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
					highlight: [{
						query: '.roomScreen .tab',
						filter: (e) => e.innerText.includes('Personal space'),
					}],
				},
				{
					text: (
						<p>
							To proceed, use the shortcut to quickly go to your wardrobe.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.Header .leftHeader > button[title="Go to wardrobe"]',
							inset: true,
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'url',
					url: /^\/wardrobe($|\/character\/c)/,
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Effects & Modifiers" tab.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							The character modifiers view of the wardrobe consists of a character preview and two panes.
							All currently active effects from worn items as well as character modifiers are overlaid
							over the character preview and can always be seen by you and other users. It should be seen as OOC knowledge.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.characterPreview',
							inset: true,
						},
					],
				},
				{
					text: (
						<>
							<p>
								The left pane has three tabs:
							</p>
							<ul>
								<li>
									<strong>Active modifiers</strong>: This shows to everyone which modifier types are enabled
									and at the same time in effect right now on this character.
								</li>
								<li>
									<strong>Current modifiers</strong>: This is the list of all added modifiers on the character, independent
									on whether they are disabled, enabled, or enabled plus currently active based on the set activation conditions.
									Other users can only see this list when their characters have the according permission that is set to "prompt"
									by default for privacy reasons, as all entries there can be opened to see all settings in detail.
								</li>
								<li>
									<strong>Possible modifiers</strong>: This tab is like a "create new modifier" screen and lists all character
									modifiers that are existing in Pandora. More on this tab in the following.
								</li>
							</ul>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.tab-container .tab',
							filter: (e) => e.innerText.includes('modifiers'),
							inset: true,
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Effects & Modifiers" tab.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							Please switch to the "Possible modifiers" tab in the character modifiers view.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.tab-container .tab.active',
						filter: (e) => e.innerText.includes('Possible'),
					}],
					highlight: [{
						query: '.tab-container .tab',
						filter: (e) => e.innerText.includes('Possible'),
					}],
				},
				{
					text: (
						<>
							<p>
								You can now see a list of all character modifiers in Pandora.
								While the ability for others to add a new modifier on a character is gated by another general permission
								set to "prompt" by default, each modifier type here comes with its own individual permission on top.
							</p>
							<p>
								You can see the defaults of these permissions for each modifier type by the icon next to each list entry.
								Some of them are disabled (set to "no") by default, as they are considered modifiers with a harsh impact.
								The permission is needed to add, remove, configure or otherwise alter modifiers of the according type.
							</p>
							<p>
								There are broadly three groups of character modifier types available presently:<br />
								Modifiers that restrict certain features of Pandora, modifiers that add effects to the character,
								and speech altering/controlling ones.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Effects & Modifiers" tab.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Possible modifiers" tab in the character modifiers view.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.tab-container .tab.active',
						filter: (e) => e.innerText.includes('Possible'),
					}],
					highlight: [{
						query: '.tab-container .tab',
						filter: (e) => e.innerText.includes('Possible'),
					}],
				},
				{
					text: (
						<p>
							For the sake of this tutorial, search for the character modifier "Prevent own changes to own following states" in the
							list or filter for it.<br />
							Click on it to open its details screen on the right.
						</p>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('unable to alter following states on'),
					}],
					highlight: [{
						query: '.tab-container .inventoryViewItem',
						filter: (e) => e.innerText.includes('Prevent own changes to own'),
					}],
				},
				{
					text: (
						<>
							<p>
								The detailed view of this character modifier type shows you a description of what it does on the top and a button to add it.
							</p>
							<p>
								Every modifier also has a "Permission"-section that lets you edit the permission default and any character
								specific overrides.
							</p>
							<p>
								Lastly, some character modifier types come with one or more preconfigured templates that already add some
								activation conditions when you add the modifier via the template button. In the case of this modifier type, the template
								would add an activation condition that the character only cannot stop following while a leash-type item is equipped on them.<br />
								More on activation conditions later.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('unable to alter following states on'),
					}],
				},
				{
					text: (
						<>
							<p>
								Note that the same modifier type can be added multiple times to a single character.
								Conflicts between character modifiers are resolved by the order of the added modifiers in the list
								(e.g. the first entry has the highest priority and applies its effect first).
							</p>
							<p>
								For the sake of this tutorial, please add this modifier without using a preconfigured template.
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [{
						query: '.inventoryView .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Add this modifier'),
					}],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.inventoryView',
					filter: (e) => e.innerText.includes('Increase priority') && e.innerText.includes('Prevent own changes to own'),
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Effects & Modifiers" tab.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Current modifiers" tab in the character modifiers view.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.tab-container .tab.active',
						filter: (e) => e.innerText.includes('Current'),
					}],
					highlight: [{
						query: '.tab-container .tab',
						filter: (e) => e.innerText.includes('Current'),
					}],
				},
				{
					text: (
						<p>
							Open the detailed view of the added character modifier "Block: Prevent own changes to own following states".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Increase priority') && e.innerText.includes('Prevent own changes to own'),
					}],
					highlight: [{
						query: '.tab-container .inventoryViewItem',
						filter: (e) => e.innerText.includes('Prevent own changes to own'),
					}],
				},
				{
					text: (
						<>
							<p>
								Adding the modifier switched you automatically to the "Current modifiers"-tab and opened the detailed view of this new modifier.
							</p>
							<p>
								In the top left of the view, you can find the most important button: The on/off toggle to enable or disable the modifier.
								When doing this, you can see that the modifier entry in the left list is now showing a green indicator. This tells that the
								modifier is currently active since it is enabled and there are no activation conditions added that would only put it active
								while those conditions are fulfilled.
							</p>
							<p>
								Feel free to try enabling and disabling the modifier again to see the difference, before proceeding.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.inventoryView .react-switch-handle',
					}],
				},
				{
					text: (
						<>
							<p>
								Below the toggle, you can find wardrobe typical buttons to change the order of the added modifier in the list
								(the first entry has the highest priority and applies first), to remove it, or to export it as a template.
							</p>
							<p>
								An exported character modifier template can either be imported completely with the button in the left pane, or you can
								also just reuse a template's included activation conditions in a new modifier, even of a different type,
								with the button in the according section on the right. More on activation conditions later.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.inventoryView .div-container.direction-row.justify-center.padding-medium.gap-medium',
						},
						{
							query: '.wardrobe-pane .Button',
							filter: (e) => e.innerText.includes('Import'),
						},
					],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Effects & Modifiers" tab.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Current modifiers" tab in the character modifiers view.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.tab-container .tab.active',
						filter: (e) => e.innerText.includes('Current'),
					}],
					highlight: [{
						query: '.tab-container .tab',
						filter: (e) => e.innerText.includes('Current'),
					}],
				},
				{
					text: (
						<p>
							Open the detailed view of the added character modifier "Block: Prevent own changes to own following states".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Increase priority') && e.innerText.includes('Prevent own changes to own'),
					}],
					highlight: [{
						query: '.tab-container .inventoryViewItem',
						filter: (e) => e.innerText.includes('Prevent own changes to own'),
					}],
				},
				{
					text: (
						<>
							<p>
								Every added character modifier can also be locked down. If not already open, expand the "Lock" fieldset by pressing on it.
							</p>
							<p>
								For ease of use, this uses the same lock concepts as items do. While these lock mechanisms are clearly not physical locks,
								they still behave the same and also use the same item limits/preferences as their counterparts. For example, if you have
								the password lock item set to "prevent", it is also blocked for locking character modifiers.<br />
								In addition, you can define several characters who can still edit this modifier, even while it is locked.
							</p>
							<p>
								The separate global permission for others to lock any of your character's permissions is set to "deny" by
								default, as the impact of character modifiers can possibly be quite harsh, although safemode
								still lets you remove them as a last resort.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.fieldset-toggle',
						filter: (e) => e.innerText.includes('Lock'),
					}],
				},
				{
					text: (
						<>
							<p>
								The following fieldset is one that allows you to change the name of the modifier in the list to better identify it.
							</p>
							<p>
								Below that, depending on the character modifier type, there are a number of modules and toggles to customize
								how the character modifier behaves.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
		{
			steps: [
				{
					text: <p>Please switch back to the wardrobe screen for your character.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: /^\/wardrobe($|\/character\/c)/,
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Effects & Modifiers" tab.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.wardrobe .tab.active',
						filter: (e) => e.innerText.includes('Effects'),
					}],
					highlight: [{
						query: '.wardrobe .tab',
						filter: (e) => e.innerText.includes('Effects'),
					}],
				},
				{
					text: (
						<p>
							Please switch back to the "Current modifiers" tab in the character modifiers view.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.tab-container .tab.active',
						filter: (e) => e.innerText.includes('Current'),
					}],
					highlight: [{
						query: '.tab-container .tab',
						filter: (e) => e.innerText.includes('Current'),
					}],
				},
				{
					text: (
						<p>
							Open the detailed view of the added character modifier "Block: Prevent own changes to own following states".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.inventoryView',
						filter: (e) => e.innerText.includes('Increase priority') && e.innerText.includes('Prevent own changes to own'),
					}],
					highlight: [{
						query: '.tab-container .inventoryViewItem',
						filter: (e) => e.innerText.includes('Prevent own changes to own'),
					}],
				},
				{
					text: (
						<p>
							Something every character modifier has is the "Activation conditions" fieldset.<br />
							By default, an enabled modifier is always active and affecting the character based on its type and configuration.
							If you, however, want the modifier to be active only in certain situations (such as when the character is in a
							specific space), you can add one or more "activation conditions" from the types in the drop-down menu.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.fieldset-toggle',
						filter: (e) => e.innerText.includes('Activation conditions'),
					}],
				},
				{
					text: (
						<p>
							An activation condition type can be added multiple times at once and comes with various buttons you can press to configure
							the condition sentence. For example, if you add the condition type "Has item of specific type": Its condition sentence has a
							button "Is", that can be toggled to "Is not". It also has a button "not set" that can be pressed to select a specific item,
							for instance a "Pet Leash", to make the character modifier only active when the character has at least one pet leash item
							equipped.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.fieldset-toggle',
						filter: (e) => e.innerText.includes('Activation conditions'),
					}],
				},
				{
					text: (
						<>
							<p>
								Multiple activation conditions can be added at the same time. If more than one condition is added, the connection between
								them is determined using the logical operators "AND" or "OR". You can toggle between the two by pressing on the
								"and"/"or" buttons. An "AND" chain will result active if all conditions are satisfied.
								Similarly an "OR" chain will result active if at least one condition is satisfied.<br />
								When mixing "AND" and "OR" operators, the conditions are grouped by the "OR" terms into groups. This should get more clear
								once you start experimenting with them.
							</p>
							<p>
								To finally determine overall, if the modifier should be active and in effect, each group checks if all its conditions
								(connected by "AND") are satisfied.
								An enabled modifier is active when at least one of the groups has all its conditions satisfied (indicated "green"),
								which is indicated by the modifier entry in the left list showing the previously mentioned green indicator as well.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.fieldset-toggle',
						filter: (e) => e.innerText.includes('Activation conditions'),
					}],
				},
			],
		},
		{
			steps: [
				{
					text: (
						<p>
							This concludes the tutorial on character modifiers.<br />
							They are a great way to control the rules and features of Pandora, to simulate a character having been trained to follow
							a specific behavior, or to give special items new effects.<br />
							Wishing you a fun time!
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
