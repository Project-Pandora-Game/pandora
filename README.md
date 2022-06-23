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
- [License](#license)

## Development
### Quick start
#### Requirements
- [Node][node] version 18 or above:
- Enable Yarn through corepack which is include in node 18:
```
corepack enable
```
#### Install dependencies
Install dependencies using `yarn` (should only need to run once when cloning):

```
yarn
```

#### Running client


To run the application in development mode (with hot reload):

```
yarn dev
```
You'd need both [Server][pandora-server-directory] & [Shard][pandora-server-shard] running in the background to have a functioning client. Or connect directly to the beta server by replacing:
```
DIRECTORY_ADDRESS="http://127.0.0.1:25560"
```
With:
```
DIRECTORY_ADDRESS="https://project-pandora.com"
```
In [.env](./.env) file (appears after you finish [quick start](#quick-start))

#### Building
To build the application to the `/dist` directory:

```
yarn build
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
The repository uses [Jest][jest] with [SWC][swc] to run tests on `Typescript` & `React`.
To run the tests:
```
yarn test
```
To run test on file changes (good for test-first TTD):
```
yarn test:watch
```
To generate code coverage report in `./coverage` | browser UI at `./coverage/lcov-report/index.html`:
```
yarn test:coverage
```
Conventions:
- Test files are located in `./test`; located to mirror `.src`.
- Named as `###.test.ts` depending on file to test.
- Unit tests should be concise, focused, and strive to avoid coupling with underlying implementation.

### Linting & typechecking

The repository uses [ESLint][eslint] for linting.

To run the linter over the repository:

```
yarn lint
```

To run ESLint over the repository and automatically fix linting errors (where possible):

```
yarn lint:fix
```

To run typescript type checker:
```
yarn type-check
```
To run typechecking on respective folders:
```bash
yarn type-check:test  # ./test
yarn type-check:src   # ./src
```
## License

All code in this repository is licensed under [GPL v3](LICENSE) or later.

```text
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

[node]: https://nodejs.org/en/ "Node.js website"
[eslint]: https://eslint.org/ "ESLint website"
[jest]: https://jestjs.io/ "Jest website"
[babel]: https://babeljs.io/ "Babel website"
[swc]: https://swc.rs/ "Swc website"
[pandora-server-directory]: https://github.com/Project-Pandora-Game/pandora-server-directory
[pandora-server-shard]: https://github.com/Project-Pandora-Game/pandora-server-shard

