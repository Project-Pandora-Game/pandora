
# The Pandora Game Project
<img
    style="display: block;margin: auto;width: 30%;"
    src="https://avatars.githubusercontent.com/u/88410864?s=200&v=4"
    alt="Pandora Logo">
</img>
<div style="text-align: center;">An open-source 2D web-based game in the making.</div>

## Getting Started
### Prerequisite

1. Get [Node.js](https://nodejs.org/en/)
2. Enable `pnpm` with (requires nodejs >= 18.x:
	```console
	corepack enable
	```
3. Install dependencies with `pnpm`:
	```console
	pnpm i
	```
### Client Web
If you don't want to launch [Server](#server-directory) & [Shard](#server-shard) along side client, you can connect directly to the beta server by replacing:

```
DIRECTORY_ADDRESS="http://127.0.0.1:25560"
```
With:
```
DIRECTORY_ADDRESS="https://project-pandora.com"
```
In [.env](./pandora-client-web/.env) file.

Before launching dev server:
```console
cd ./pandora-client-web/
pnpm dev
```
## Local Dev Server
If you want to run everything locally, follow these steps:

1. Get [pandora-assets](https://github.com/Project-Pandora-Game/pandora-assets) repo, follow the instruction with `git clone --recursive` to the same parent directory.
2.  Your folder structure would look like this:
    ```
 | parent (can be any name) |
 | ------------------------ |pandora
	| -- | pandora-assets
	```
3. Build the assets `pnpm i && pnpm build` in `pandora-assets` repo. You should have now have an `out` folder.
	```
 | parent (can be any name) |
 | ------------------------ |pandora
	| -- | pandora-assets/out
	```
4. Go back to `pandora` repository and launch dev services:
	```
	pnpm dev
	```
Congratulations, you've ran the entire pandora stack locally.

### Common problems

#### __Database fails to start__

You are most likely missing C++ redistributables required by MongoDB on your computer and no other application required them yet.
Download and install them from [here](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

## Specifications

Please refer to the [documentation](https://github.com/Project-Pandora-Game/Documentation) repository for more details.

### Project structure
Individual components and their repository:
  * [`Documentation`](https://github.com/Project-Pandora-Game/Documentation)
  * Assets ([`pandora-assets`](https://github.com/Project-Pandora-Game/pandora-assets))
  * Common ([`pandora-common`](./pandora-common/)) - shard library for all components.
  * Directory server ([`pandora-server-directory`](./pandora-server-directory/))
  * Shard server ([`pandora-server-shard`](./pandora-server-shard/))
  * Web Client ([`pandora-client-web`](./pandora-client-web/))

### Standards
* Code styles:
    * Not part of this document, enforced by linting; TODO: Writeup.
* Review process:
    * No direct pushes to master.
    * 2 Approving reviews required (can be blocked by anyone, requires resolving).
    * Preferred reviews by peers (code things by coders, assets by asset makers).
## Licenses

| Sub Project                             | License file                                |
| --------------------------------------- | ------------------------------------------- |
| [Commons](pandora-common/)              | [MIT](pandora-common/LICENSE)               |
| [Web Client](pandora-client-web/)       | [GPL-3.0](pandora-client-web/LICENSE)       |
| [Server Directory](pandora-client-web/) | [GPL-3.0](pandora-server-directory/LICENSE) |
| [Server Shard](pandora-client-web/)     | [GPL-3.0](pandora-client-web/LICENSE)       |
