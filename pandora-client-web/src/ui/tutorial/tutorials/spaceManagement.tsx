import { Link } from 'react-router';
import type { TutorialConfig } from '../tutorialSystem/tutorialConfig.ts';

export const TUTORIAL_SPACE_MANAGEMENT: TutorialConfig = {
	id: 'spaceManagement',
	name: `Management of Spaces and Rooms`,
	description: (
		<p>
			This tutorial will focus on Pandora's spaces.<br />
			We will talk about managing your own space and about how multiple rooms work.
		</p>
	),
	stages: [
		{
			steps: [
				{
					text: (
						<>
							<p>
								Hi and welcome to the tutorial on managing spaces and the rooms in it! <br />
								In this tutorial you will primarily learn how to add and remove rooms to your spaces,
								how to set them up, including the usage of room templates.
							</p>
							<p>
								If you want to know more details about spaces themselves, such as space ownership and
								space deletion, the <Link to='/wiki/spaces'>"Spaces" tab</Link> in Pandora's wiki has
								short articles on those topics.
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
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
						<>
							<p>
								Your personal space works very similar to the online spaces for multiple characters that you can create.
								That means that you can decorate it with persistent room-level items and add more rooms to it, as
								every space comes with a single room from the start.
							</p>
							<p>
								You may already be familiar with how to create new spaces and how to manage and use room devices from
								the <Link title='New user guide in the wiki' to='/wiki/new'>new user guide</Link> in
								Pandora's wiki. If not, it is recommended to read it.
							</p>
							<p>
								To quickly recap: Only in a room's inventory, you can create room-level items. To make them show in the room,
								you need to select the item in the room inventory and then "Deploy the device". Afterwards,
								in the room view, you need to toggle on "Enable room construction mode", to be able to move
								deployed room-level items for arranging them on the background, by clicking on the red icons.<br />
								We will not dive deeper into this topic as part of this tutorial, though. Let's proceed instead.
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
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
						<>
							<p>
								Next, I am going to show you how to create and manage multiple rooms in a space.
							</p>
							<p>
								In a space for multiple characters, the button to do this is called "Space configuration".
								Aside from being able to manage the space's room layout, the space configuration screen also
								has tabs to change the general settings of such a space
								(like name, size, space description, and entry message) and to manage the
								space's rights (like who is admin, who are allowed users with special access rights,
								and if and when offline users are removed).
							</p>
							<p>
								In your personal space, though, you only have a button to change the space layout.<br />
								Please press it to proceed - you may need to scroll up to see it.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<>
							<p>
								You are now on the room management view. It consists of two sections:<br />
								The top section shows a map of all rooms on a grid on the left and on the
								right is an ordered list of all rooms in the space. The top entry in this
								list is the room characters always enter the space in.
							</p>
							<p>
								The bottom section lets you configure the selected room. We will go over these
								settings in the following.
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
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<>
							<p>
								The buttons of the top allow you to reorder the rooms inside the top right list.
								This order is also used for the list of rooms in the "Room" tab. As said, if you
								want to set a room to be the one characters appear in first when joining the space,
								you need to move it to the top of the list.
							</p>
							<p>
								Next to those buttons, there is one to delete a room from the space if there
								is no character inside.<br />
								The last button allows you to export the room with its settings and the complete room
								inventory as a template.
							</p>
							<p>
								Exporting lets you either copy the room template to your clipboard as a code string,
								or you can save it as a text file alongside a preview image of the room while hiding
								any characters inside.
								Feel free to share your exported room templates in the #pandora-templates channel
								on Pandora's Discord with other users.
							</p>
							<p>
								For now let's proceed.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.roomConfiguration .div-container.direction-row.wrap.padding-medium.gap-medium',
					}],
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<p>
							The next section allows you to give the room a name, which is highly recommended for every room.
						</p>
					),
					conditions: [{ type: 'next' }],
					highlight: [{
						query: '.roomConfiguration .div-container.direction-row.align-center.gap-medium',
						filter: (e) => e.innerText.includes('Room name'),
					}],
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<>
							<p>
								The "Select a background" button is the heart of this view, as it opens a new dialog
								where you can choose between different types of backgrounds for your room.
							</p>
							<p>
								The most important types are "Static image background", which allows you to select from
								a number of images that serve as the background of the room, and "Custom 3D box", which
								allows you to deeply customize your background and the room size.
							</p>
							<p>
								"Custom 3D box" backgrounds allow you to customize many parameters of your
								room, such as its width or height and the point of view. They also allow you to pick a texture
								and color tint for the back and side walls individually, as well as for the floor and the ceiling.
							</p>
							<p>
								Please feel free to open the background dialog with the button and play around, before
								proceeding with the tutorial.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Select a background'),
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<>
							<p>
								The next section lets you move the room on the space's grid. You can consider the
								space's grid a map with cardinal directions. So north is in the upward facing direction.
							</p>
							<p>
								The position of a room is determined by coordinates on the grid. The default room
								is typically in the middle of the space's grid in the 0/0 position. For moving the
								room to the east, you need to increase the first number by the amount of fields on
								the grid you want to move it. For moving it to the south, you increase the second
								coordinate. Use negative numbers for the other cardinal directions.
							</p>
							<p>
								As an advanced topic, you can also rotate your room with the "Far wall direction"
								drop-down menu.
								Typically, you would consider the far wall, so the wall at the back of the room to
								be facing north. That way, the room aligns with how it is shown on the grid map.<br />
								However, sometimes you may want your room to be facing differently, to
								better explain the room dimension, the paths between rooms on the background, or the door placement.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.roomConfiguration .div-container.direction-column.gap-medium.flex-1',
						},
					],
				},
				{
					text: (
						<>
							<p>
								<strong>Important</strong>: Room position and rotation changes need to be saved with the "Move" button.
							</p>
							<p>
								For now, let's proceed.
							</p>
						</>
					),
					conditions: [{ type: 'next' }],
					highlight: [
						{
							query: '.roomConfiguration .wardrobeActionButton',
							filter: (e) => e.innerText.includes('Move'),
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Select any room to show the room configuration section.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Reorder higher'),
					}],
				},
				{
					text: (
						<>
							<p>
								The last section "Position of links to other room" on the bottom lets you manage the
								room's path squares, which are small areas on the floor that let characters
								enter and leave a room towards a neighboring one.
							</p>
							<p>
								They have their position in the room changed or reset here and they can also be
								enabled/disabled. You can do the same actions in the room view while
								in room construction mode, which we will do later in this tutorial.
							</p>
							<p>
								These path squares have a letter N, S, W, E for the four cardinal
								directions (North, South, West, East) printed on them to identify in which direction a path
								is leading to. The letter is especially important for orientation if the room was rotated
								and the far side is not north as it is usually.
							</p>
							<p>
								Note: Sometimes, in very large rooms, the path squares can be hard to identify.
								As a reminder, users can also move by clicking on rooms directly in the map of
								the "Room" tab or by using the '/mt' command.
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
					text: <p>Please switch back to the room screen.</p>,
					hideWhenCompleted: true,
					conditions: [{
						type: 'url',
						url: '/room',
					}],
				},
				{
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								For the last part of this tutorial, let's create a new room in your personal space!
							</p>
							<p>
								Press on the "Create a new room" button to open the room creation dialog.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Create room'),
					}],
					highlight: [{
						query: '.dialog-content .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Create a new room'),
					}],
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Open the room creation dialog with the "Create a new room" button.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Create room'),
					}],
					highlight: [{
						query: '.roomConfiguration .wardrobeActionButton',
						filter: (e) => e.innerText.includes('Create a new room'),
					}],
				},
				{
					text: (
						<>
							<p>
								Now you can see the dialog where you can customize your new room by giving it a name and
								a background.
								An unoccupied position on the grid next to an existing room is automatically prefilled as
								a suggestion, but you can change the position as desired, either now or later.
							</p>
							<p>
								At the top of the dialog, you can find the "Import" button, if you rather want to import a room
								from a room template by you, or shared with you, for instance on Pandora Discord's template sharing channel.
							</p>
							<p>
								Please create a new room now to proceed with the tutorial, as your space needs to have more than
								one room to show something in the following steps.<br />
								You can simply delete it again after finishing the tutorial, if you want.
							</p>
						</>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.dialog-content .wardrobeActionButton',
							filter: (e) => e.innerText.includes('Create room'),
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.dialog-content .wardrobeActionButton',
					filter: (e) => e.innerText.includes('Create room'),
					expectNoMatch: true,
				},
				{
					type: 'elementQuery',
					query: '.RoomControlsRoomGrid',
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Please press the button "Change space layout".
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.dialog-content .Button[title="Close"]',
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('space layout'),
						},
					],
				},
				{
					text: (
						<p>
							Congratulations! You should now be able to see your new room on the space's grid
							top left and in the list to the right of it.<br />
							To proceed, close the space configuration view.
						</p>
					),
					conditions: [{ type: 'never' }],
					highlight: [
						{
							query: '.dialog-content .Button[title="Close"]',
						},
					],
				},
			],
			advanceConditions: [
				{
					type: 'elementQuery',
					query: '.dialog-content .Button[title="Close"]',
					expectNoMatch: true,
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
						<>
							<p>
								The tab now changed a bit compared to when there was only a single room. On the top right, you can
								now see a part of the space's map centered around your current room and the the ordered list of rooms
								below that now shows more rooms.
							</p>
							<p>
								To proceed to the final part of this tutorial, press the "Enable room construction mode" button.<br />
								You may need to scroll down to see it.
							</p>
						</>
					),
					conditions: [{
						type: 'elementQuery',
						query: '.Button',
						filter: (e) => e.innerText.includes('Disable room construction mode'),
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Enable room construction mode'),
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
					text: <p>Open the "Personal Space" tab.</p>,
					hideWhenCompleted: true,
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
							Press the "Enable room construction mode" button.
						</p>
					),
					hideWhenCompleted: true,
					conditions: [{
						type: 'elementQuery',
						query: '.Button',
						filter: (e) => e.innerText.includes('Disable room construction mode'),
					}],
					highlight: [
						{
							query: '.Button',
							filter: (e) => e.innerText.includes('Enable room construction mode'),
						},
					],
				},
				{
					text: (
						<>
							<p>
								While you are in room construction mode, you can see the four path squares highlighted
								in green (when enabled) or red (when disabled). Zoom in as needed.<br />
								Like this, you can drag them around
								with the directional icon as desired. The position of the square is the spot where
								characters appear when entering this room from that direction. The positions are also
								stored in exported room templates.
							</p>
							<p>
								Pressing on the square itself switches it between enabled and disabled.
								Disabling squares can make sense if you want normal users to be unable to move to
								a neighboring room in that direction. For example, because you consider a door or
								hatch to be locked or to simulate a wall with no path between two bordering rooms.
							</p>
							<p>
								Note that if you do not disable the path square in the neighboring as well, you
								create a one way path that cannot be used to go back to the previous room.
								You can also create trap rooms like this, but a character can leave a space from
								any room without having to go back to the starting room, unless there is an effect
								applied that prevents leaving the space generally or while in specific rooms, like
								through character modifiers.
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
					text: (
						<p>
							Note that if you make another user's account admin in your space, they can also manage
							the space in all the ways described in this tutorial, including adding more admins or
							deleting them. But they cannot remove you or any other owners, as space owners always
							have admin rights implicitly.
						</p>
					),
					conditions: [{ type: 'next' }],
				},
				{
					text: (
						<p>
							This concludes the tutorial on managing spaces and the rooms inside.<br />
							We hope to see many unique spaces inside Pandora. Have a fun time!
						</p>
					),
					conditions: [{ type: 'next' }],
				},
			],
		},
	],
};
