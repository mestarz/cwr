# Emma Web Editor

Emma Web Editor is a browser-based code reading and editing workspace powered by the Pi Agent TypeScript SDK. It is built with React, TypeScript, Vite, Monaco Editor, and a local Node.js backend.

The editor focuses on a lightweight workflow:

- open a local project directory from the start screen
- inspect source files in the center editor
- send text instructions to Pi Agent from the input box
- stream Agent execution status, tool calls, and selected model names to the top status bar
- show related files with per-file explanations in the left rail
- show AI explanations and Mermaid/Markdown diagrams as right-side floating panels only when needed

## Features

- **Pi Agent integration**
  - Uses `@earendil-works/pi-coding-agent` directly from TypeScript.
  - Does not call a local Pi CLI process.
  - Model resolution and authentication go through Pi Agent / Pi AI registry.

- **Configurable intent routing**
  - Intent understanding can run through a configured model.
  - Task routing is split into two execution types:
    - `local_file_task`: function-level, file-level, selected-text understanding, or simple single-file edits.
    - `module_task`: cross-file feature understanding, related-file discovery, module refactoring, or larger changes.
  - Model profiles are configured in `config/intent.config.json`.

- **Streaming execution feedback**
  - The backend exposes `/api/chat/stream` as NDJSON.
  - The frontend status bar shows what the Agent is currently doing.
  - Tool calls such as file reads, grep, find, list, explanation display, diagram display, and related-file display are surfaced to the UI.
  - The selected Pi Agent model is shown when model-backed work starts.

- **Related file workflow**
  - Related files are shown in the left rail, not dumped into the explanation text.
  - Each related file includes a short reason describing its role in the requested feature or module.
  - Workspace scanning respects Git ignore rules where possible.

- **Floating Agent widgets**
  - AI explanations are short, human-readable, and limited to 300 Chinese characters.
  - Markdown/Mermaid diagrams are shown as floating panels.
  - Diagram prompts distinguish:
    - `overview`: high-level architecture or flow diagrams.
    - `module_detail`: module-level detail diagrams that can include file names, function names, variable names, and call points.
  - Mermaid diagrams are constrained for the floating panel:
    - max 10 nodes
    - max depth 4 layers
    - max width 4 nodes per layer
    - focused nodes can be highlighted with Mermaid `classDef` / `class` or `style`.

## Requirements

- Node.js 20 or newer is recommended.
- npm
- Pi Agent / Pi AI credentials configured in the environment or auth storage used by `@earendil-works/pi-ai`.

The default model profiles use:

- intent and light tasks: `openai-codex/gpt-5.3-codex-spark`
- module tasks: `openai-codex/gpt-5.5`

Edit `config/intent.config.json` if your local Pi Agent model registry uses different names.

## Install

```bash
npm install
```

## Build

Use the project script:

```bash
./build.sh
```

This runs the frontend TypeScript/Vite build and the backend TypeScript build.

## Run

Start the backend and frontend:

```bash
./run.sh
```

Restart both services:

```bash
./run.sh -R
```

Stop both services:

```bash
./run.sh -S
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4174`

Runtime logs and pid files are written under `.runtime/`.

## Project Structure

```text
config/
  intent.config.json              Intent routing and model profiles
server/
  index.ts                        Local API server
  piAgentBridge.ts                Main Pi Agent bridge and custom display tools
  piAgentModels.ts                Pi Agent model registry/auth resolver
  intent/                         Intent understanding logic
  skills/                         Frontend display skills
  workspaceFiles.ts               Workspace file discovery with ignore handling
src/
  features/start/                 Project selection start screen
  features/editor/                Editor workspace UI
  services/agentClient.ts         HTTP and NDJSON streaming client
  styles/global.css               App styles
docs/issues/                      Implementation notes and completed issue records
```

## Configuration

The main configuration file is `config/intent.config.json`.

Important fields:

- `modelProfiles`: named model profiles used by routing.
- `intentUnderstanding.mode`: `model` or `rules`.
- `intentUnderstanding.modelProfile`: model profile used for intent understanding.
- `tasks`: task definitions and routing target.
- `defaultTaskKind`: fallback task kind.

Example task routing:

- local file work uses the `local-file` model profile.
- module-level work uses the `module-work` model profile.

## Git Remote

This project is intended to be pushed to:

```bash
git@github.com:mestarz/cwr.git
```
