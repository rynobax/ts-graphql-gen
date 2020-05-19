# ts-graphql-gen

Generate typescript types from graphql schema + documents.

# TODO

- watch mode (warn if watching too many files)
- add progress messages
- test on more real apps
- add recipes to repo
- readme + documentation
- test built files before publish
- change where gql is imported from

## Why not graphql-code-generator?

It's a great tool that I have used a lot. However, IMHO it is trying to do to much, and as a result I have encountered two issues.

1. The config is super confusing to me. There's a ton of flags that all change the output, some of which merely change how it looks, but not the types. With this project I am trying to reduce the amount of options, but make the options that are available flexible, so that it can support any client side query library.
2. I have raised a couple issues that have never been addressed, and was unable to figure out how to fix the issues myself. Maybe this is more of a issue with my ability to understand monorepos, but I wanted to try to solve this issue with a simpler codebase, that hopefully will be easier to contribute to.
