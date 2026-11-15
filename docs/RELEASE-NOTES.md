## Omarchy Theme Studio 0.2.0

AI prompts now work without entering an API key in Studio.

- Signed-in agent mode reuses the login/configuration of Codex, Claude Code, Gemini CLI or OpenCode.
- Custom executable and argument support lets other non-interactive harnesses connect through stdin, prompt arguments or a response file.
- Model names are unrestricted; leave blank to use the harness default. Named agents are supported for Claude Code and OpenCode.
- Copy/paste exchange works with other AI apps, agents and models, including subscription chats without an automation interface.
- API/local-server mode remains optional. Chat website URLs now explain how to use an agent or copy/paste instead.
- Runs can be cancelled and have timeout/output limits. Agent output is validated before palettes enter the editor.

The app passes 22 automated tests and desktop/AppImage smoke checks. Generation through an existing ChatGPT-authenticated Codex CLI was tested successfully without entering an API key in Studio. Other CLI presets were checked against installed help and documentation; their live provider sessions were not tested.

Provider subscriptions determine available models and usage limits. Studio uses each agent’s own authentication and cannot guarantee that every subscription exposes automation. Use copy/paste for tools without it.

Download the x86_64 AppImage, allow it to run as a program, and open it. The desktop app remains separate from the Codex skill repository.
