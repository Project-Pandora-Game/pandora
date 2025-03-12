<!--
Thank you for your pull request!

These comments will guide you through creating a pull request and filling in all that is required. You don't need to remove the comments when you are done.
You can view CONTRIBUTING.md for a detailed description of the pull request process.

Title for the pull request should be in the following form: [TYPE] Short name that is understandable by itself
TYPE should be one of the following: FEATURE, ADD, CHANGE, REMOVE, FIX, REFACTOR, DEV, CHORE
The rest of the title should describe what the PR changes mainly, doesn't need to describe the details of the change (someone looking at the list of PRs should be able to tell which part of Pandora it touches, not necessarily how).
Use past tense.
-->

## References

<!--
Add references to issues or other pull requests here, for example:
fixes #42
resolves #69
ref #123   (use to reference related things within Pandora's repositories, without special meaning)
xref #666   (use to reference _external_ resources; use full https URL)
-->

_None_

## About The Pull Request

<!--
Describe *what* you are trying to do.
This sets expectation for the reviewer, making it easier to get into reviewing it.

[optional]
If the change is more complex, then try to explain why and how is it accomplished.
This is, however, much less important than the "what", as that is more easily seen from code than the aim is, usually.
-->

## Changelog

<!--
Write the name that you want to be used in the changelog (single line) and the changelog itself, following the examples below.

The changelog should be aimed at players - it shouldn't contain technical details and it should be concise.
Use past tense. For more complex changes you can write several points or include links to where interested people can find more details.
Leave the changelog wrapped in a codeblock, but remove sections you didn't use at all.

If the PR doesn't change anything users or asset developers can notice, it is fine to remove this section altogether.
-->

Authored by: Clare & Claudia

```md
Platform changes:
- Added ability to show current passwords for locks for the person who set it
- Reworked the way login tokens work in Pandora:
  - Logging out in one tab now logs you out of the same account in all other tabs of the same browser
  - Pandora is now supporting login tokens over multiple devices

Fixes:
- Fixed the target name of a kick message being the one who initiated it
- Fixed an issue that could lead to an inaccurate display of online status in the contacts list

Technical changes:
- Improved tooling related to development and testing; you can find more details [in the original PR](<https://github.com/Project-Pandora-Game/pandora/pull/781>)
```

## Checklist

<!-- Checklist for you to make sure you didn't miss something -->
- [ ] The change has been tested locally
- [ ] Added documentation to the new code and updated existing documentation where needed
- [ ] I understand this patch is submitted under the [Pandora's Contributor Agreement](https://github.com/Project-Pandora-Game/pandora/blob/master/contributor-licence-agreement.md)
