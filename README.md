
# The Pandora Game Project
A monorepo.
## Getting Started
### Prerequisite

- Get [Node.js](https://nodejs.org/en/)
- Enable `yarn` with (requires nodejs >= 16.10, check [yarn documentation](https://yarnpkg.com/getting-started/install)):
  ```console
  corepack enable
  ```
- Install dependencies with `yarn`:
  ```console
  yarn
  ```
### Server Directory
Launch dev server:
```console
cd ./pandora-server-directory/
yarn dev
```

### Server Shard
Launch dev server:
```console
cd ./pandora-server-shard/
yarn dev
```

### Client Web
Launch dev server:
```console
cd ./pandora-client-web/
yarn dev
```
You'd need both [Server](#server-directory) & [Shard](#server-shard) running in the background to have a functioning client.

Or connect directly to the beta server by replacing:
```
DIRECTORY_ADDRESS="http://127.0.0.1:25560"
```
With:
```
DIRECTORY_ADDRESS="https://project-pandora.com"
```
In [.env](./pandora-client-web/.env) file.

### Commons
Launch dev server:
```console
cd ./pandora-common-web/
yarn dev
```

## Specifications

Please refer to the [documentation](https://github.com/Project-Pandora-Game/Documentation) repository.

## Licenses

| Sub Project                             | License file                            |
| --------------------------------------- | --------------------------------------- |
| [Commons](pandora-common/)              | [MIT](pandora-common/LICENSE)           |
| [Web Client](pandora-client-web/)       | [GNU](pandora-client-web/LICENSE)       |
| [Server Directory](pandora-client-web/) | [GNU](pandora-server-directory/LICENSE) |
| [Server Shard](pandora-client-web/)     | [GNU](pandora-client-web/LICENSE)       |
