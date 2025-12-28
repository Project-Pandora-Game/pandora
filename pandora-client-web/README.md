# Pandora Web Client

## Outline
- [Outline](#outline)
- [Development](#development)
	- [Quick start](#quick-start)
		- [Requirements](#requirements)
		- [Install dependencies](#install-dependencies)
		- [Running client](#running-client)
		- [Building](#building)
	- [File extensions and imports](#file-extensions-and-imports)
	- [Testing](#testing)
	- [Linting & typechecking](#linting-typechecking)

## Development
### Quick start
#### Requirements

See main readme for more info.

#### Install dependencies
Install dependencies using `pnpm` (should only be needed once after cloning):

```
pnpm i
```

#### Building
To build the application to the `/dist` directory:

```
pnpm build
```

### File extensions and imports

JSON files can be imported into any TypeScript file (and TypeScript will ensure the types are properly interpreted):
```ts
// Import a JSON file
import foo from './package.json';
// Access properties on the JSON file
console.log(foo.name);
```

Webpack is also currently configured to allow most static images, as well as stylesheets, to be included into the
application via TS imports:
```tsx
// Import a .png (or .jpg, .gif, .svg) - the resolved file will be built into the /dist directory, and renamed according
// to its hash, and the myIcon import will reference that file (e.g. 'c627a862d41d9026b5ade2a0fda5b886.png')
import myIcon from './myIcon.png';
// Import a Sass (.scss) stylesheet. In development mode, the compiled CSS will be loaded inline with the built JS, but
// in production, it will be extracted into a separate CSS file.
import './myStylesheet.scss';

// Static assets can then be used as resource paths in <img> or <a> elements (or other places):
export function IconComponent(): ReactElement {
	return <img src={myIcon} alt="My Icon"/>;
}
```

When using JSX (inline HTML) syntax inside a file (i.e. React components), the file should be given a `.tsx` extension.
Elsewhere, `.ts` extensions are sufficient.

### Testing
The repository uses [Jest][jest] to run tests on `Typescript` & `React`.
To run the tests:
```
pnpm test
```
To run test on file changes (good for test-first TTD):
```
pnpm test:watch
```
To generate code coverage report in `./coverage` | browser UI at `./coverage/lcov-report/index.html`:
```
pnpm test:coverage
```
Conventions:
- Test files are located in `./test`; located to mirror `.src`.
- Named as `###.test.ts` depending on file to test.
- Unit tests should be concise, focused, and strive to avoid coupling with underlying implementation.

### Linting & typechecking

The repository uses [ESLint][eslint] for linting.

To run the linter over the repository:

```
pnpm lint
```

To run ESLint over the repository and automatically fix linting errors (where possible):

```
pnpm lint:fix
```

To run typescript type checker:
```
pnpm type-check
```
To run typechecking on respective folders:
```bash
pnpm type-check:test  # ./test
pnpm type-check:src   # ./src
```
[node]: https://nodejs.org/en/ "Node.js website"
[eslint]: https://eslint.org/ "ESLint website"
[jest]: https://jestjs.io/ "Jest website"
[babel]: https://babeljs.io/ "Babel website"
[pandora-server-directory]: https://github.com/Project-Pandora-Game/pandora-server-directory
[pandora-server-shard]: https://github.com/Project-Pandora-Game/pandora-server-shard

## File structure

Files for Pandora's client are organized in the following way.
If you are adding a new feature, please consider where to place the code based on the following tree.

- `assets` - Static non-code files such as icons.
- `debug` - Code useful for debugging. This code is normally not actually used anywhere, but look here for useful tools to help you during development.
- `common` - Code not strictly related to Pandora itself. Any code here should only use things from `common` and `assets`.
	- `userInteraction` - Code related to how user interacts with the UI - for example components for a button, various inputs, ...
	- `layout` - Code related to organising things on the screen
- `services` - Code that runs in the background, not normally visible by users
	- `accountLogic` - Logic around account-only actions (login, direct messaging, ...). Only needs directory connection.
	- `gameLogic` - Logic around "game" features (character selection, chat, character/space state). Needs shard connection.
- `config` - Build-time configuration data
- `styles` - Anything related to global styling and theming
- `ui` - All the UI code of Pandora
	- `components` - UI components that are reusable across multiple screens
	- `screens` - Each screen is meant to be shown by itself in the main UI area of the client. Parts of a screen are not meant to be reused by other screens.
	- `dialogs` - Isolated UI that runs on top of some screen, but not intergrated into it
	- `header` - Header. The always visible bar on top.
- `graphics` - All code related to graphics rendering; should be lazy-loadable
- `management` - Anything that is only relevant to Pandora admins; should be lazy-loadable
- `editor` - Code that is only relevant to the editor; loads only when editor entrypoint is used
