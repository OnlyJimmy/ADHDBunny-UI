# ADHDBunny UI

SillyBunny has a beautiful UI. Don't you wish you couldn't see any of it so you wouldn't get distracted?
ADHDBunny is a desktop-first SillyBunny UI overhaul designed to keep chat central while
making common tools easier to reach.

## Regions

1. Existing chat window
2. Existing composer
3. Guided Generations action rail, when that extension is enabled
4. Floating workspace tree menu
5. Grouped SillyBunny destinations:
   - Connection: API, Presets, Sampling, Formatting, Agents
   - Characters: Characters, Groups, World Info, Persona
   - Interface: Backgrounds, Extensions
   - Settings: Settings, Server, Console Logs
6. Persistent right-side inspector for the selected tool

The extension does not replace SillyBunny's drawer logic. Its menu dispatches
the existing controls and restyles the opened drawer into the inspector area.
The stock layout remains active below the configured minimum viewport width.

## Installation

### Install from GitHub

Open SillyBunny's Extensions panel, choose **Install Extension**, and enter:

`https://github.com/OnlyJimmy/ADHDBunny-UI`

After installation, ADHDBunny UI queues the desktop workspace layout for
activation and displays a refresh notice. The layout intentionally remains
inactive until SillyBunny is refreshed, avoiding interface changes during
installation.

### Manual installation

1. Close SillyBunny.
2. Extract the `ADHDBunny-UI` folder into `public/scripts/extensions/third-party/`.
3. Start SillyBunny and refresh the page.
4. Refresh SillyBunny when the ADHDBunny UI installation notice appears.

The final path should contain:
`public/scripts/extensions/third-party/ADHDBunny-UI/manifest.json`

## Compatibility

ADHDBunny UI targets SillyBunny's desktop layout. The stock layout remains
active below the configured minimum viewport width. Settings from the former
Personal Workspace Layout name are migrated automatically.
