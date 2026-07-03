#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = join(__dirname, "..", "data", "skill.md");

function loadSkillText(): string {
  if (!existsSync(SKILL_PATH)) {
    throw new Error(
      `Could not find skill file at ${SKILL_PATH}\n` +
      `Make sure "data/skill.md" exists at the project root (next to "src/") ` +
      `before running "npm run build".`
    );
  }
  try {
    return readFileSync(SKILL_PATH, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read skill file at ${SKILL_PATH}: ${(err as Error).message}`);
  }
}

const SKILL_TEXT = loadSkillText();

// ---------------------------------------------------------------------------
// Direction pools
// ---------------------------------------------------------------------------
const TONES = [
  "Brutally minimal", "Maximalist / dense", "Retro-futuristic", "Organic / natural",
  "Luxury / refined", "Playful / toy-like", "Editorial / magazine", "Brutalist / raw",
  "Art deco / geometric", "Soft / pastel", "Industrial / utilitarian", "Warm commercial",
] as const;

const PALETTE_STRATEGIES = [
  "Single dominant hue + one sharp complementary accent",
  "Monochrome + one accent reserved for the single most important action",
  "Duotone — two hues doing all the work, no third color",
  "Earth/muted palette + one saturated alarm color reserved for urgency",
  "High-contrast dark mode with one electric accent",
  "Pastel field + one deeply saturated anchor color",
] as const;

const FONT_PAIRINGS = [
  "Characterful serif display + clean grotesk body",
  "Geometric sans display + humanist serif body (inverted from expectation)",
  "Slab/mono display for a technical subject + neutral body",
  "Condensed display for density + a wider, calmer body face",
  "A single distinctive face at multiple weights, no second family",
] as const;

const SHAPE_LANGUAGES = [
  "Sharp corners everywhere — precision and trust",
  "Heavy rounding everywhere — friendly and approachable",
  "Pill buttons + sharp cards — commercial energy with structure",
  "Mixed: sharp on data-dense elements, rounded on interactive elements",
] as const;

// Banned defaults — checked verbatim against submitted plan text at verify time.
const BANNED_FONT_PATTERNS = [/\binter\b/i, /\broboto\b/i, /\barial\b/i, /\bsystem-ui\b/i, /\bspace grotesk\b/i];
const BANNED_PALETTE_PATTERNS = [/purple[- ]to[- ]blue/i, /purple.{0,20}gradient/i, /gradient.{0,20}purple/i];

// ---------------------------------------------------------------------------
// Persistent variance history — ONLY verified/approved plans are written here.
// A rolled-but-never-verified direction does not count toward future variance.
// ---------------------------------------------------------------------------
const HISTORY_DIR = join(homedir(), ".signature-design-mcp");
const HISTORY_PATH = join(HISTORY_DIR, "history.json");
const MAX_HISTORY = 50;

interface DirectionLogEntry {
  timestamp: string;
  subject: string;
  tone: string;
  paletteStrategy: string;
  fontPairing: string;
  shapeLanguage: string;
  verified: true;
}

function loadHistory(): DirectionLogEntry[] {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: DirectionLogEntry[]) {
  if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(entries.slice(-MAX_HISTORY), null, 2));
}

function pickAvoiding<T>(pool: readonly T[], recentlyUsed: T[], avoidLast: number): T {
  const banned = new Set(recentlyUsed.slice(-avoidLast));
  const available = pool.filter((item) => !banned.has(item));
  const source = available.length > 0 ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}

// ---------------------------------------------------------------------------
// In-memory pending tokens — issued by roll/start, consumed by verify.
// Not persisted: a token only lives for the duration of this server process,
// which matches one build session in practice.
// ---------------------------------------------------------------------------
interface PendingDirection {
  subject: string;
  tone: string;
  paletteStrategy: string;
  fontPairing: string;
  shapeLanguage: string;
  issuedAt: number;
}

const PENDING = new Map<string, PendingDirection>();
const MAX_PENDING = 200; // simple bound so a long-running process can't leak memory

function issueDirection(subject: string, avoidLast: number) {
  const history = loadHistory();
  const tone = pickAvoiding(TONES, history.map((h) => h.tone), avoidLast);
  const paletteStrategy = pickAvoiding(PALETTE_STRATEGIES, history.map((h) => h.paletteStrategy), avoidLast);
  const fontPairing = pickAvoiding(FONT_PAIRINGS, history.map((h) => h.fontPairing), avoidLast);
  const shapeLanguage = pickAvoiding(SHAPE_LANGUAGES, history.map((h) => h.shapeLanguage), avoidLast);

  const token = randomUUID();
  if (PENDING.size >= MAX_PENDING) {
    const oldestKey = PENDING.keys().next().value;
    if (oldestKey) PENDING.delete(oldestKey);
  }
  PENDING.set(token, { subject, tone, paletteStrategy, fontPairing, shapeLanguage, issuedAt: Date.now() });

  return { token, tone, paletteStrategy, fontPairing, shapeLanguage };
}

function verifyPlan(token: string, planText: string) {
  const pending = PENDING.get(token);
  if (!pending) {
    return {
      approved: false,
      reasons: [
        `Unknown or already-used token "${token}". Call roll_design_direction or start_design_plan first, and verify each token only once.`,
      ],
    };
  }

  const reasons: string[] = [];
  const lower = planText.toLowerCase();

  if (!lower.includes(pending.tone.toLowerCase().split(" ")[0])) {
    reasons.push(`Plan does not appear to reference the rolled tone: "${pending.tone}".`);
  }
  if (!lower.includes(pending.fontPairing.toLowerCase().split(" ")[0])) {
    reasons.push(`Plan does not appear to reference the rolled font pairing: "${pending.fontPairing}".`);
  }
  for (const pattern of BANNED_FONT_PATTERNS) {
    if (pattern.test(planText)) {
      reasons.push(`Plan uses a banned default display font matching ${pattern}.`);
    }
  }
  for (const pattern of BANNED_PALETTE_PATTERNS) {
    if (pattern.test(planText)) {
      reasons.push(`Plan uses a banned default palette matching ${pattern}.`);
    }
  }
  if (!/#[0-9a-f]{3,8}/i.test(planText)) {
    reasons.push(`Plan does not contain any concrete hex color values — Step 3 requires real hexes, not color names.`);
  }

  if (reasons.length > 0) {
    return { approved: false, reasons };
  }

  PENDING.delete(token);
  const history = loadHistory();
  const entry: DirectionLogEntry = {
    timestamp: new Date().toISOString(),
    subject: pending.subject,
    tone: pending.tone,
    paletteStrategy: pending.paletteStrategy,
    fontPairing: pending.fontPairing,
    shapeLanguage: pending.shapeLanguage,
    verified: true,
  };
  saveHistory([...history, entry]);

  return { approved: true, reasons: [] as string[] };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "signature-design-mcp",
  version: "1.0.0",
});

server.registerResource(
  "signature-interface-skill",
  "skill://signature-interface",
  {
    title: "Signature Interface Design Skill",
    description:
      "Full designer-turned-developer skill instructions for producing distinctive, non-generic, non-AI-slop UI.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: SKILL_TEXT }],
  })
);

server.registerTool(
  "roll_design_direction",
  {
    title: "Roll Design Direction",
    description:
      "Rolls a tone, palette strategy, font pairing, and shape language for a new UI project, avoiding recent picks. " +
      "Returns a one-time token. IMPORTANT: this roll is NOT committed to history until you call verify_design_plan " +
      "with this token and your finished design-plan doc. Do not treat the roll alone as permission to proceed to code — " +
      "write the plan, then call verify_design_plan before generating any component code.",
    inputSchema: {
      subject: z.string().describe("What the product concretely is"),
      audience: z.string().describe("Who opens this and in what state of mind"),
      avoidLast: z.number().int().min(0).max(20).default(3),
    },
  },
  async ({ subject, audience, avoidLast }) => {
    const { token, tone, paletteStrategy, fontPairing, shapeLanguage } = issueDirection(subject, avoidLast);

    const summary = [
      `Token: ${token}`,
      `Tone: ${tone}`,
      `Palette strategy: ${paletteStrategy}`,
      `Font pairing: ${fontPairing}`,
      `Shape language: ${shapeLanguage}`,
      ``,
      `Justify this pick in one sentence tying it back to: "${subject}" for an audience described as "${audience}".`,
      `Proceed through Step 3–5 of the skill using this direction, then call verify_design_plan with this token `,
      `and the full plan text BEFORE writing any component code. This roll will not be counted toward future `,
      `variance until it's verified.`,
    ].join("\n");

    return { content: [{ type: "text", text: summary }] };
  }
);

server.registerTool(
  "verify_design_plan",
  {
    title: "Verify Design Plan",
    description:
      "Checks a written design-plan doc against the direction issued by roll_design_direction or start_design_plan: " +
      "confirms the rolled tone/palette/font are actually referenced, and rejects known generic defaults " +
      "(Inter/Roboto/Arial/system-ui/Space Grotesk, purple-to-blue gradients). Only an 'approved' result commits " +
      "the direction to history so future rolls avoid repeating it. This is an auditable checkpoint, not an " +
      "enforcement mechanism — nothing prevents skipping this call, but doing so means the direction is never " +
      "logged and get_recent_directions will show it was never verified.",
    inputSchema: {
      token: z.string().describe("The token returned by roll_design_direction or start_design_plan"),
      planText: z.string().describe("The full written design-plan doc (Step 3–5 output) to check"),
    },
  },
  async ({ token, planText }) => {
    const result = verifyPlan(token, planText);
    const text = result.approved
      ? "APPROVED. Direction logged. You may proceed to component code."
      : `REJECTED. Do not proceed to component code yet. Issues:\n- ${result.reasons.join("\n- ")}`;
    return { content: [{ type: "text", text }] };
  }
);

server.registerTool(
  "get_recent_directions",
  {
    title: "Get Recent Design Directions",
    description: "Returns the last N VERIFIED design directions, most recent first. Rolls that were never verified do not appear here.",
    inputSchema: {
      limit: z.number().int().min(1).max(MAX_HISTORY).default(10),
    },
  },
  async ({ limit }) => {
    const history = loadHistory();
    const recent = history.slice(-limit).reverse();
    return { content: [{ type: "text", text: JSON.stringify(recent, null, 2) }] };
  }
);

server.registerPrompt(
  "start_design_plan",
  {
    title: "Start Signature Design Plan",
    description:
      "Produces a ready-to-paste prompt combining the signature-interface skill with a freshly rolled direction and " +
      "a verification token for a new project.",
    argsSchema: {
      subject: z.string(),
      audience: z.string(),
      singleJob: z.string(),
      emotionalArc: z.string(),
    },
  },
  async ({ subject, audience, singleJob, emotionalArc }) => {
    const { token, tone, paletteStrategy, fontPairing, shapeLanguage } = issueDirection(subject, 3);

    const briefBlock = [
      `## Brief`,
      `- Subject: ${subject}`,
      `- Audience: ${audience}`,
      `- Single job: ${singleJob}`,
      `- Emotional arc: ${emotionalArc}`,
      ``,
      `## Rolled direction (do not override unless the brief clearly conflicts) — token: ${token}`,
      `- Tone: ${tone}`,
      `- Palette strategy: ${paletteStrategy}`,
      `- Font pairing: ${fontPairing}`,
      `- Shape language: ${shapeLanguage}`,
      ``,
      `Before writing any component code, write the full design-plan doc (skill Step 3–5), then call the `,
      `verify_design_plan tool with token "${token}" and the plan text. Only proceed to code on APPROVED.`,
    ].join("\n");

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: `${SKILL_TEXT}\n\n---\n\n${briefBlock}` },
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("signature-design-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting signature-design-mcp:", err);
  process.exit(1);
});
