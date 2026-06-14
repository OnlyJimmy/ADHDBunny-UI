# ADHDBunny UI

A desktop-first SillyBunny UI overhaul designed to keep chat central while
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

After installation, open ADHDBunny UI's extension settings, enable the desktop
workspace layout, and refresh SillyBunny. The layout intentionally remains
inactive until that refresh to avoid changing the interface during installation.

### Manual installation

1. Close SillyBunny.
2. Extract the `ADHDBunny-UI` folder into `public/scripts/extensions/third-party/`.
3. Start SillyBunny and refresh the page.
4. Open Extensions, enable the desktop workspace layout under **ADHDBunny UI**,
   and refresh SillyBunny.

The final path should contain:
`public/scripts/extensions/third-party/ADHDBunny-UI/manifest.json`

## Compatibility

ADHDBunny UI targets SillyBunny's desktop layout. The stock layout remains
active below the configured minimum viewport width. Settings from the former
Personal Workspace Layout name are migrated automatically.
