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
        `before running "npm run build".`,
    );
  }
  try {
    return readFileSync(SKILL_PATH, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read skill file at ${SKILL_PATH}: ${(err as Error).message}`,
    );
  }
}

const SKILL_TEXT = loadSkillText();

// ---------------------------------------------------------------------------
// Direction pools
// ---------------------------------------------------------------------------
const TONES = [
  "Brutally minimal",
  "Maximalist / dense",
  "Retro-futuristic",
  "Organic / natural",
  "Luxury / refined",
  "Playful / toy-like",
  "Editorial / magazine",
  "Brutalist / raw",
  "Art deco / geometric",
  "Soft / pastel",
  "Industrial / utilitarian",
  "Warm commercial",
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

// Page-level silhouette pool — separate from component shape language.
// Added so the "everything is a centered box" convergence is rolled against
// too, not just component radii.
const SILHOUETTES = [
  "Asymmetric split — unequal columns, off-center focal point",
  "Overlap — elements breaking out of their container, layered z-depth",
  "Diagonal flow — content that doesn't sit on a strict horizontal grid",
  "Grid-breaking hero — one element deliberately violates the grid",
  "Full-bleed edge-to-edge — content runs to the viewport edge on one side",
  "Generous negative space or controlled density — never an accidental in-between",
] as const;

// ---------------------------------------------------------------------------
// Banned patterns — checked verbatim against submitted plan text at verify time.
// ---------------------------------------------------------------------------
const BANNED_FONT_PATTERNS = [
  /\binter\b/i,
  /\broboto\b/i,
  /\barial\b/i,
  /\bsystem-ui\b/i,
  /\bspace grotesk\b/i,
];
const BANNED_PALETTE_PATTERNS = [
  /purple[- ]to[- ]blue/i,
  /purple.{0,20}gradient/i,
  /gradient.{0,20}purple/i,
];

// Universal Rule 1 — plain words only. These are jargon words the skill
// names explicitly as ones briefs tempt the model toward. This is a floor,
// not an exhaustive list — the plan's own "words we avoid" section should
// name more, specific to its subject.
const BANNED_JARGON_PATTERNS = [
  /\bleverage\b/i,
  /\borchestration\b/i,
  /\bposture\b/i,
  /\bparadigm\b/i,
  /\bseamless(ly)?\b/i,
  /\brobust\b/i,
  /\bunlock\b/i,
  /\bempower(ment)?\b/i,
  /\bsynerg(y|ize)\b/i,
  /\bholistic\b/i,
  /\bfrictionless\b/i,
  /\belevate\b/i,
  /\bnext-generation\b/i,
  /\bcutting-edge\b/i,
  /\bbest-in-class\b/i,
];

// Universal Rule 2 — never invent fake data labels (fake coordinates, status
// readouts, spec/archive codes, simulation values, HUD-style tags). These
// patterns match the exact failure pattern regardless of subject matter.
const BANNED_FAKE_LABEL_PATTERNS = [
  /\bLOC:\s*-?\d+\.\d+/i, // fake coordinate label
  /-?\d{1,3}\.\d{2,},\s*-?\d{1,3}\.\d{2,}/, // raw lat/long-style pair
  /\bSTATUS:\s*[A-Z\s]{3,}/, // fake status readout
  /\bSTATE:\s*[A-Z\s]{3,}/,
  /\bMODE:\s*[A-Z\s]{3,}/,
  /\bSPEC-\d+\b/i, // fake spec/catalog code
  /\/\/\s*DESIGN ARCHIVE/i,
  /\bSIMULATED\s+[A-Z_]+:/i, // fake simulation readout
  /\bTAXONOMY OF\b/i, // fake system-relabel of a person/section
  /\bBLOOM_T\s*:/i,
];

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
  silhouette: string;
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
  writeFileSync(
    HISTORY_PATH,
    JSON.stringify(entries.slice(-MAX_HISTORY), null, 2),
  );
}

function pickAvoiding<T>(
  pool: readonly T[],
  recentlyUsed: T[],
  avoidLast: number,
): T {
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
  silhouette: string;
  issuedAt: number;
}

const PENDING = new Map<string, PendingDirection>();
const MAX_PENDING = 200; // simple bound so a long-running process can't leak memory

function issueDirection(subject: string, avoidLast: number) {
  const history = loadHistory();
  const tone = pickAvoiding(
    TONES,
    history.map((h) => h.tone),
    avoidLast,
  );
  const paletteStrategy = pickAvoiding(
    PALETTE_STRATEGIES,
    history.map((h) => h.paletteStrategy),
    avoidLast,
  );
  const fontPairing = pickAvoiding(
    FONT_PAIRINGS,
    history.map((h) => h.fontPairing),
    avoidLast,
  );
  const shapeLanguage = pickAvoiding(
    SHAPE_LANGUAGES,
    history.map((h) => h.shapeLanguage),
    avoidLast,
  );
  const silhouette = pickAvoiding(
    SILHOUETTES,
    history.map((h) => h.silhouette),
    avoidLast,
  );

  const token = randomUUID();
  if (PENDING.size >= MAX_PENDING) {
    const oldestKey = PENDING.keys().next().value;
    if (oldestKey) PENDING.delete(oldestKey);
  }
  PENDING.set(token, {
    subject,
    tone,
    paletteStrategy,
    fontPairing,
    shapeLanguage,
    silhouette,
    issuedAt: Date.now(),
  });

  return {
    token,
    tone,
    paletteStrategy,
    fontPairing,
    shapeLanguage,
    silhouette,
  };
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

  // --- Rolled-direction reference checks ---
  if (!lower.includes(pending.tone.toLowerCase().split(" ")[0])) {
    reasons.push(
      `Plan does not appear to reference the rolled tone: "${pending.tone}".`,
    );
  }
  if (!lower.includes(pending.fontPairing.toLowerCase().split(" ")[0])) {
    reasons.push(
      `Plan does not appear to reference the rolled font pairing: "${pending.fontPairing}".`,
    );
  }
  if (
    !lower.includes(
      pending.silhouette
        .toLowerCase()
        .split(" ")[0]
        .replace(/[^a-z]/g, ""),
    )
  ) {
    reasons.push(
      `Plan does not appear to reference the rolled page silhouette: "${pending.silhouette}". Add a Step 6 silhouette statement — the page must not default to a centered box.`,
    );
  }

  // --- Generic-default checks ---
  for (const pattern of BANNED_FONT_PATTERNS) {
    if (pattern.test(planText)) {
      reasons.push(
        `Plan uses a banned default display font matching ${pattern}.`,
      );
    }
  }
  for (const pattern of BANNED_PALETTE_PATTERNS) {
    if (pattern.test(planText)) {
      reasons.push(`Plan uses a banned default palette matching ${pattern}.`);
    }
  }
  if (!/#[0-9a-f]{3,8}/i.test(planText)) {
    reasons.push(
      `Plan does not contain any concrete hex color values — Step 3 requires real hexes, not color names.`,
    );
  }

  // --- Universal Rule 1: plain words only (applies to every project, no exceptions) ---
  const jargonHits = BANNED_JARGON_PATTERNS.filter((p) => p.test(planText));
  if (jargonHits.length > 0) {
    reasons.push(
      `Plan uses jargon banned under Universal Rule 1 (plain words only): matched ${jargonHits.length} pattern(s) ` +
        `(e.g. ${jargonHits[0]}). Rewrite in words a normal person would say out loud — this applies regardless of the app's subject.`,
    );
  }

  // --- Universal Rule 2: never invent fake data labels (applies to every project, no exceptions) ---
  const fakeLabelHits = BANNED_FAKE_LABEL_PATTERNS.filter((p) =>
    p.test(planText),
  );
  if (fakeLabelHits.length > 0) {
    reasons.push(
      `Plan contains a fabricated system-readout-style label banned under Universal Rule 2 (no fake data labels): ` +
        `matched ${fakeLabelHits.length} pattern(s). Delete invented coordinates/status fields/spec codes/simulation ` +
        `values or replace with the plain name of the thing they label — this applies regardless of tone or subject.`,
    );
  }

  // --- Motion budget check: must be named, and must not be unbounded ---
  const mentionsMotionBudget =
    /motion budget/i.test(planText) || /signature moment/i.test(planText);
  if (!mentionsMotionBudget) {
    reasons.push(
      `Plan does not name an explicit motion budget (e.g. "1 signature moment + 2 micro-interactions"). Motion must be a stated, bounded budget, not left implicit.`,
    );
  }
  const motionWordMatches =
    planText.match(
      /\b(animate|animation|animates|transition|fade|slide|bounce|stagger)\b/gi,
    ) || [];
  if (motionWordMatches.length > 12) {
    reasons.push(
      `Plan describes motion ${motionWordMatches.length} times, which reads as "everything animates" rather than a small, deliberate budget. Cut it down to one signature moment plus a few micro-interactions.`,
    );
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
    silhouette: pending.silhouette,
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
      "Full designer-turned-developer skill instructions for producing distinctive, non-generic, non-AI-slop UI, " +
      "including the two universal rules: plain words only, and never invent fake data labels.",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: SKILL_TEXT }],
  }),
);

server.registerTool(
  "roll_design_direction",
  {
    title: "Roll Design Direction",
    description:
      "Rolls a tone, palette strategy, font pairing, page silhouette, and shape language for a new UI project, " +
      "avoiding recent picks. Returns a one-time token. IMPORTANT: this roll is NOT committed to history until you " +
      "call validate_design_plan with this token and your finished design-plan doc. Do not treat the roll alone as " +
      "permission to proceed to code — write the plan, then call validate_design_plan before generating any component " +
      "code. Regardless of the rolled tone, the plan must still follow the skill's two universal rules: plain, " +
      "sayable-out-loud words only, and no fabricated coordinate/status/spec-code/simulation labels.",
    inputSchema: {
      subject: z
        .string()
        .default("Untitled project")
        .describe("What the product concretely is"),
      audience: z
        .string()
        .default("General users")
        .describe("Who opens this and in what state of mind"),
      avoidLast: z.number().int().min(0).max(20).default(3),
    },
  },
  async ({ subject, audience, avoidLast }) => {
    const {
      token,
      tone,
      paletteStrategy,
      fontPairing,
      shapeLanguage,
      silhouette,
    } = issueDirection(subject, avoidLast);

    const summary = [
      `Token: ${token}`,
      `Tone: ${tone}`,
      `Palette strategy: ${paletteStrategy}`,
      `Font pairing: ${fontPairing}`,
      `Page silhouette: ${silhouette}`,
      `Shape language: ${shapeLanguage}`,
      ``,
      `Justify this pick in one sentence tying it back to: "${subject}" for an audience described as "${audience}".`,
      `Proceed through Step 3–6 of the skill using this direction, naming a motion budget (one signature moment `,
      `plus a few micro-interactions) and writing every label/headline/button in plain, sayable-out-loud words `,
      `with no invented coordinates, status fields, spec codes, or simulation readouts. Then call validate_design_plan `,
      `with this token and the full plan text BEFORE writing any component code. This roll will not be counted `,
      `toward future variance until it's verified.`,
    ].join("\n");

    return { content: [{ type: "text", text: summary }] };
  },
);

server.registerTool(
  "validate_design_plan",
  {
    title: "Validate Design Plan",
    description:
      "Checks a written design-plan doc against the direction issued by roll_design_direction or start_design_plan, " +
      "and against the skill's fixed rules. Confirms the rolled tone/palette/font/silhouette are actually referenced; " +
      "rejects generic defaults (Inter/Roboto/Arial/system-ui/Space Grotesk, purple-to-blue gradients); rejects jargon " +
      "banned under Universal Rule 1 (plain words only — applies to every project regardless of subject); rejects " +
      "fabricated system-readout-style labels banned under Universal Rule 2 (fake coordinates, STATUS: fields, spec " +
      "codes, simulation values — applies to every project regardless of subject); and requires a named, bounded " +
      "motion budget rather than absent or unbounded motion. Only an 'approved' result commits the direction to " +
      "history so future rolls avoid repeating it. This is an auditable checkpoint, not an enforcement mechanism — " +
      "nothing prevents skipping this call, but doing so means the direction is never logged and " +
      "get_recent_directions will show it was never verified.",
    inputSchema: {
      token: z
        .string()
        .describe(
          "The token returned by roll_design_direction or start_design_plan",
        ),
      planText: z
        .string()
        .describe(
          "The full written design-plan doc (Step 3–6 output) to check",
        ),
    },
  },
  async ({ token, planText }) => {
    const result = verifyPlan(token, planText);
    const text = result.approved
      ? "APPROVED. Direction logged. You may proceed to component code."
      : `REJECTED. Do not proceed to component code yet. Issues:\n- ${result.reasons.join("\n- ")}`;
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "get_recent_directions",
  {
    title: "Get Recent Design Directions",
    description:
      "Returns the last N VERIFIED design directions, most recent first. Rolls that were never verified do not appear here.",
    inputSchema: {
      limit: z.number().int().min(1).max(MAX_HISTORY).default(10),
    },
  },
  async ({ limit }) => {
    const history = loadHistory();
    const recent = history.slice(-limit).reverse();
    return {
      content: [{ type: "text", text: JSON.stringify(recent, null, 2) }],
    };
  },
);

server.registerPrompt(
  "start_design_plan",
  {
    title: "Start Signature Design Plan",
    description:
      "Produces a ready-to-paste prompt combining the signature-interface skill with a freshly rolled direction and " +
      "a verification token for a new project. Takes no structured arguments: some MCP clients (e.g. Antigravity) " +
      "call prompts/get without sending an 'arguments' object at all, and z.object(...).parse(undefined) fails at " +
      "the top level no matter what per-field .default() values are set. Omitting argsSchema entirely skips " +
      "argument validation altogether -- the documented pattern for a prompt that can be safely called with zero " +
      "arguments. The brief fields below are generic placeholders -- edit them directly in the returned text, or " +
      "use the roll_design_direction TOOL instead, since tools are invoked with real structured arguments during " +
      "a chat turn rather than via a client's prompt-preview mechanism.",
    // No argsSchema here on purpose -- see description above.
  },
  async () => {
    const subject = "Untitled project";
    const audience = "General users";
    const singleJob =
      "Not yet specified — describe the app's single primary job";
    const emotionalArc =
      "Not yet specified — describe how the user should feel start to finish";

    const {
      token,
      tone,
      paletteStrategy,
      fontPairing,
      shapeLanguage,
      silhouette,
    } = issueDirection(subject, 3);

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
      `- Page silhouette: ${silhouette}`,
      `- Shape language: ${shapeLanguage}`,
      ``,
      `Before writing any component code, write the full design-plan doc (skill Step 3–6): name a motion budget `,
      `(one signature moment + a few micro-interactions), and write every headline/button/label in plain, `,
      `sayable-out-loud words with zero invented coordinates, status fields, spec codes, or simulation readouts — `,
      `these two rules apply no matter what this app is about. Then call the validate_design_plan tool with token `,
      `"${token}" and the plan text. Only proceed to code on APPROVED.`,
    ].join("\n");

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${SKILL_TEXT}\n\n---\n\n${briefBlock}`,
          },
        },
      ],
    };
  },
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