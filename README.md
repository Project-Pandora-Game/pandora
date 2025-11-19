# Project Pandora roleplaying platform

<img
    style="display: block; margin: auto; width: 30%;"
    src="https://avatars.githubusercontent.com/u/88410864?s=200&v=4"
    alt="Pandora Logo">
</img>
<div style="text-align: center;">An open-source 2.5D web-based roleplaying platform.</div>

# This repository

![GitHub CI Status](https://img.shields.io/github/actions/workflow/status/Project-Pandora-Game/pandora/ci.yml?logo=github&label=CI)

This repository contains code of the servers, the client, and common libraries.
It is intended to be used together with the [pandora-assets](https://github.com/Project-Pandora-Game/pandora-assets) repository, but in theory you can swap out the assets for completely different set based on these.

# Documentation

Documentation is stored in a separate [pandora-documentation](https://github.com/Project-Pandora-Game/pandora-documentation) repository common to all our repositories.

For instructions on getting a working local copy for development see the [Getting started](https://github.com/Project-Pandora-Game/pandora-documentation/blob/master/Getting_started.md) guide in the documentation repository.


# Repository structure

This repository contains the following projects:
- [`pandora-common`](pandora-common) - Shared library for all other projects.
- [`pandora-server-directory`](pandora-server-directory) - The "Directory" server, containing all account-focused, synchronization, and shard assignment logic. Currently designed to be single instance.
- [`pandora-server-shard`](pandora-server-shard) - The "Shard" server, containing all character and space focused logic. Designed to be horizontally scalable by an active Space being assigned to a single shard at a time.
- [`pandora-client-web`](pandora-client-web) - The web client for the platform, including both the standard client, the management tools, and the "Editor" for supporting asset creation.
- [`pandora-tests`](pandora-tests) - Set of End-To-End tests for Project Pandora.

# Contribution

If you are interesting in contributing to the project, please see the [`CONTRIBUTING`](CONTRIBUTING.md) file.
