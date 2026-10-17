# Contributing to 032musicplayer

Thanks for your interest in contributing!

Check the existing [issues](https://github.com/lux032/032musicplayer/issues).

## IMPORTANT

For feature contributions that do not have an existing feature request, please open an issue or discussion **BEFORE** beginning to implement it to determine whether or not the feature would be acceptable for the app. Simply submitting a large feature with thousands of new or changed lines of code without asking if the feature is desired for the application will run the risk of instant closure.

Bug fixes are likely to be accepted without discussion.

## Development environment

032musicplayer is built and tested with Node.js `v23.11.0` and pnpm `11.5.2`. Newer versions of Node.js are also supported.

Useful development commands include:

- `pnpm run dev` - Start the electron app development environment
- `pnpm run dev:watch` - Start the electron app development environment with main process autoreloading
- `pnpm run package:dev` - Quick unpacked production build
- `pnpm run build:remote` - Manually rebuild the remote app if you make changes

## AI Disclosure

AI-generated code **is accepted** under the following conditions:

1. You are a professional or hobbyist developer using agentic coding as a tool rather than a crutch
2. You are manually reviewing the output code before submitting the pull-request
3. You are manually testing the functionality of your code before submitting the pull-request

Pull requests are **manually reviewed** by maintainers which means that submitting any form of slop wastes our precious time that could otherwise go towards fixing bugs or implementing new features.

When communicating with maintainers or other users in issues, discussions, or pull requests, DO NOT respond to others with solely AI generated text. I and other maintainers spend REAL and VALUABLE time maintaining this project, so communicating in your own words is the bare minimum that I ask of you.

## Pull requests

Please include:

- A clear description of the change in your own words
- Screenshots or recordings for UI changes if applicable

## Translations

Translations: include new strings in `en.json` (and `zh-Hans.json` where possible). Other language files are inherited from Feishin and may be incomplete.
