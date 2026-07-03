# signature-design-mcp

An MCP server that turns a "designer-turned-developer" UI skill into
callable tools instead of a giant pasted system prompt — so AI-generated
interfaces stop converging on the same look (purple gradients, Inter font,
cream + terracotta, near-black + neon).

## What it does

- **`roll_design_direction`** — picks a tone, palette, font pairing, and
  shape language for a new project, avoiding whatever was used in your
  last few projects (remembered on disk, across sessions).
- **`get_recent_directions`** — shows your recent picks, so you can check
  things are actually staying varied.
- **`start_design_plan`** (prompt) — combines the full skill text with a
  fresh rolled direction, ready to drop into a build conversation.
- **`skill://signature-interface`** (resource) — the raw skill text, if a
  host just wants to inject it directly.

History is stored locally at `~/.signature-design-mcp/history.json` —
nothing leaves your machine.

## Setup

```bash
git clone <your-repo-url>
cd signature-design-mcp
npm install
npm run build
```

Make sure `data/skill.md` exists at the project root with the skill text
before building.

## Connect it

Add to your MCP config (Claude Desktop, Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "signature-design": {
      "command": "node",
      "args": ["/absolute/path/to/signature-design-mcp/dist/index.js"]
    }
  }
}
```
You can configure different MCP client settings to point to this server.

## Use it

Before writing any component code, call `roll_design_direction` (or
`start_design_plan`) with your brief — subject and audience. The model
justifies the roll, then follows the skill's token-lock and anti-pattern
steps. Next project gets a direction that deliberately avoids the last one.

## License

MIT
