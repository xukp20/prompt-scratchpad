# Prompt Scratchpad

Prompt Scratchpad is a lightweight VS Code companion for terminal-based coding agents such as Codex and Claude Code.

It gives you a dedicated drafting space inside VS Code, so you can keep reading terminal output while preparing the next prompt, then paste or move that draft back into the active terminal when you are ready.

## Why Prompt Scratchpad

Terminal-first AI workflows are powerful, but they have an annoying ergonomics problem: the same terminal is often used for both long model output and the next prompt.

That creates friction:

- you scroll up to read
- you scroll back down to type
- you lose your place
- you repeat the cycle

Prompt Scratchpad removes that friction with a simple idea:

- draft outside the terminal
- keep the terminal visible
- send the draft back only when it is ready

It stays intentionally focused. Prompt Scratchpad does not try to replace your terminal workflow. It just makes that workflow smoother.

## What it does

- Opens from a compact status bar entry: `PS`
- Provides a persistent scratchpad inside VS Code
- Supports three open locations:
  - sidebar
  - panel
  - editor
- Keeps one shared draft across all three presentations
- Includes text actions:
  - `Copy`
  - `Clear`
  - `Cut`
  - `Append`
- Includes terminal actions:
  - `Paste to Terminal`
  - `Move to Terminal`
- Persists the draft across reloads
- Sends text to the active terminal without pressing Enter
- Warns if no active terminal is available

## Typical workflow

1. Open Prompt Scratchpad from the status bar.
2. Draft the next prompt while keeping terminal output visible.
3. Use:
   - `Paste to Terminal` to send the draft without clearing it
   - `Move to Terminal` to send the draft and clear the scratchpad

`Move to Terminal` is especially useful when the scratchpad is acting as a temporary staging area for repeated CLI prompts.

## Screenshots

Draft the next prompt while keeping your terminal context in view:

![Prompt Scratchpad drafting in the VS Code sidebar](./figs/sidebar-draft.png)

Move the draft back into the active terminal when it is ready:

![Prompt Scratchpad after moving the draft to the terminal](./figs/sidebar-move-to-terminal.png)

## Configuration

### `promptScratchpad.openLocation`

Controls where the status bar action opens the scratchpad.

Available values:

- `sidebar`
- `panel`
- `editor`

Default:

```json
{
  "promptScratchpad.openLocation": "sidebar"
}
```

## Commands

- `Prompt Scratchpad: Open Scratchpad`
- `Prompt Scratchpad: Open in Sidebar`
- `Prompt Scratchpad: Open in Panel`
- `Prompt Scratchpad: Open in Editor`

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

## License

[MIT](./LICENSE)
