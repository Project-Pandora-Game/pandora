
# The Pandora Game Project
<img
    style="display: block;margin: auto;width: 30%;"
    src="https://avatars.githubusercontent.com/u/88410864?s=200&v=4"
    alt="Pandora Logo">
</img>
<div style="text-align: center;">An open-source 2D web-based game in the making.</div>

## Getting Started

### Prerequisites

Required software:
 - Node.js v18+
 - Either corepack enabled (recommended) or manually installed pnpm
 - Git
 - Visual Studio Code (recommended)

For more detailed steps you can follow [Pandora asset creation tutorial: Development tools installation](https://github.com/Project-Pandora-Game/Documentation/blob/master/Asset_creation_tutorial.md#development-tools-installation)

### Client connecting to official servers

If you don't want to run your own [Server](#server-directory) & [Shard](#server-shard) alongside the client, you can connect directly to the official server by editing the [`pandora-client-web/.env`](./pandora-client-web/.env) (not the `.template`!) file, replacing
```
DIRECTORY_ADDRESS="http://127.0.0.1:25560"
```
With:
```
DIRECTORY_ADDRESS="https://project-pandora.com"
```

And then skip to the step 4 of the "Initial setup" section, selecting "Run Client" instead of "Local Pandora Stack".

## Local Dev Server

### Initial setup

These steps need to only be done once to setup Pandora stack locally:

1. Clone the [pandora-assets](https://github.com/Project-Pandora-Game/pandora-assets) repository to the same directory you cloned this repository into.

2. Build the assets by opening `pandora-assets` in VSCode, waiting for setup to finish, then pressing Ctrl+Shift+B. __Alternatively__ you can build them by running following command in the `pandora-assets` folder:
```
git submodule update --init; pnpm i; pnpm build
```

3. After doing that, your folder structure should look like this (note the `out` folder in `pandora-assets`):
```
(Your Pandora project folder)
├── pandora
│   ├── pandora-client-web
│   ├── pandora-common
│   ├── pandora-server-directory
│   └── pandora-server-shard
└── pandora-assets
    ├── out
    └── src
```

4. Open the `pandora` folder with VSCode, select "trust" and wait for setup to finish. __Alternatively__ you can run the following command in the `pandora` folder:
```
pnpm i
```

### Actually running the project

If you are using VSCode and the setup finished, simply press F5 and wait for all 4 components to start.

If want to start Pandora in console, then run following command in the `pandora` folder and then navigate to [http://localhost:6969](http://localhost:6969/):
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
