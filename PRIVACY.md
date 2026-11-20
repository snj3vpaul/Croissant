# Privacy

Croissant is built to be private by default.

**What stays on your machine**
- Your favourite teams, nicknames and settings, in `~/.croissant/config.json` (readable only by you).
- Your questions, unless you choose a cloud brain.

**What leaves your machine**
- Requests for public sports data to ESPN (`site.api.espn.com`) and TheSportsDB (`thesportsdb.com`). These include the team or league being looked up, nothing about you.
- If you pick a cloud brain (Anthropic or OpenAI): your question plus the public match data for your favourite teams. Nothing else is sent. The local Ollama brain sends this only to your own machine.

**What Croissant never does**
- No accounts, analytics, telemetry or tracking.
- API keys are read from environment variables and never written to disk.
- The web companion listens on `127.0.0.1` only, so it isn't reachable from other devices on your network.
