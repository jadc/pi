import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, getPackageDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { colorToHex, parseColor } from "@earendil-works/pi-tui";

/**
 * Writes a hue-shifted copy of a base theme to <agent-dir>/random-hue/random.json.
 * The base theme is set in <agent-dir>/random-hue/config.json as `{ "theme": "<name>" }`,
 * and may be any user theme in <agent-dir>/themes/ or a built-in (dark, light). Without that file,
 * random.json is removed and Pi falls back to its default "system" theme.
 *
 * Requires these settings: `"theme": "random"` and `"themes": ["random-hue/random.json"]` (the file, not the directory, so config.json isn't loaded as a theme).
 *
 * Pi loads extensions before it reads theme files, so the file written here is what Pi applies
 * from the very first frame (no flash of the base theme). /reload and session switches advance the hue
 * by `step` percent of the wheel (config.json, default 10) from the last session's, wrapping at 360°.
 * The last offset is stored in <agent-dir>/random-hue/state.json.
 *
 * The file deliberately lives outside <agent-dir>/themes/: Pi hot-reloads the active theme only
 * from there, so keeping it out means a newly launched Pi doesn't recolor the ones already open.
 */

const OUTPUT_THEME = "random";
const CONFIG_FILE = "random-hue/config.json";
const OUTPUT_DIR = "random-hue";
// Remembers the last hue offset so each session shifts it further instead of picking at random.
const STATE_FILE = "random-hue/state.json";
// Default step per session, as a percentage of the full hue wheel (overridable via config `"step"`).
const DEFAULT_STEP_PERCENT = 10;
// Colors whose meaning depends on their hue (diff red/green, errors) are left untouched.
const FIXED_TOKENS = new Set(["error", "toolDiffAdded", "toolDiffRemoved"]);

type ThemeJson = {
  name?: string;
  vars?: Record<string, string | number>;
  colors: Record<string, string | number>;
  export?: Record<string, string>;
  [key: string]: unknown;
};

function resolve(value: string | number, vars: Record<string, string | number>, depth = 0): string | number {
  if (typeof value === "string" && Object.hasOwn(vars, value) && depth < 10) {
    return resolve(vars[value]!, vars, depth + 1);
  }
  return value;
}

/**
 * Shifts any color format Pi accepts (hex, okhsl(), oklch(), ...). Leaves terminal-default ("")
 * and 256-color palette indexes alone: their actual color is up to the terminal.
 */
function shiftColor(value: string | number, degrees: number): string | number {
  if (typeof value !== "string" || value === "") return value;
  const color = parseColor(value);
  if (color.kind === "indexed") return value;
  return shiftHex(colorToHex(color), degrees);
}

function shiftHex(hex: string, degrees: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const [L, a, b] = linearToOklab(
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  );
  const C = Math.hypot(a, b);
  if (C < 1e-4) return hex; // greys have no hue
  const h = Math.atan2(b, a) + (degrees * Math.PI) / 180;

  // Keep lightness and hue; reduce chroma until the color fits in sRGB.
  let lo = 0;
  let hi = C;
  let rgb = oklchToLinear(L, C, h);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(L, lo, h);
  }
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

type Vec3 = [number, number, number];

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055);
const inGamut = ([r, g, b]: Vec3) => [r, g, b].every((v) => v >= -1e-6 && v <= 1 + 1e-6);

function linearToOklab(r: number, g: number, b: number): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklchToLinear(L: number, C: number, h: number): Vec3 {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function buildShiftedTheme(base: ThemeJson, degrees: number): ThemeJson {
  const vars = base.vars ?? {};
  const colors: Record<string, string | number> = {};
  for (const [token, raw] of Object.entries(base.colors)) {
    const value = resolve(raw, vars);
    colors[token] = FIXED_TOKENS.has(token) ? value : shiftColor(value, degrees);
  }
  const exportColors = base.export
    ? Object.fromEntries(Object.entries(base.export).map(([k, v]) => [k, shiftColor(v, degrees)]))
    : undefined;

  // Colors are fully resolved, so the output needs no vars.
  const { vars: _vars, ...rest } = base;
  return { ...rest, name: OUTPUT_THEME, colors, ...(exportColors ? { export: exportColors } : {}) };
}

/**
 * Returns the base theme name and hue step (percent of the 360° wheel) from config.json,
 * or undefined when the file does not exist.
 */
function readConfig(agentDir: string): { theme: string; step: number } | undefined {
  const configPath = join(agentDir, CONFIG_FILE);
  if (!existsSync(configPath)) return undefined;
  let config: { theme?: unknown; step?: unknown };
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8")) as typeof config;
  } catch (error) {
    throw new Error(`${configPath}: invalid JSON (${error instanceof Error ? error.message : error})`);
  }
  if (typeof config.theme !== "string" || !config.theme.trim()) {
    throw new Error(`${configPath}: "theme" must be a non-empty string`);
  }
  const theme = config.theme.trim();
  if (theme === OUTPUT_THEME) throw new Error(`${configPath}: "theme" cannot be "${OUTPUT_THEME}" itself`);
  if (theme === "system") throw new Error(`${configPath}: the "system" theme is generated at runtime and has no JSON to shift`);
  const step = typeof config.step === "number" && Number.isFinite(config.step) ? config.step : DEFAULT_STEP_PERCENT;
  return { theme, step };
}

/**
 * Writes via a per-process temp file renamed over the target: the rename is atomic, so a Pi
 * process starting at the same moment never reads a half-written file.
 */
function writeAtomic(path: string, data: unknown, indent?: number): void {
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, `${JSON.stringify(data, null, indent)}\n`);
    renameSync(tmp, path);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Advances the previous session's hue by `stepPercent` of the wheel, wrapping at 360°, and persists it. */
function nextHue(agentDir: string, stepPercent: number): number {
  const statePath = join(agentDir, STATE_FILE);
  let last = 0;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8")) as { degrees?: unknown };
    if (typeof state.degrees === "number" && Number.isFinite(state.degrees)) last = state.degrees;
  } catch {}
  const degrees = (((last + (stepPercent / 100) * 360) % 360) + 360) % 360;
  writeAtomic(statePath, { degrees });
  return degrees;
}

/** User themes first, then Pi's built-in themes (same lookup Pi uses for a theme name). */
function findThemeFile(agentDir: string, name: string): string {
  const packageDir = getPackageDir();
  const builtinDir = join(packageDir, existsSync(join(packageDir, "src")) ? "src" : "dist", "modes", "interactive", "theme");
  const candidates = [join(agentDir, "themes", `${name}.json`), join(builtinDir, `${name}.json`)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`base theme "${name}" not found (looked in: ${candidates.join(", ")})`);
  return found;
}

export default function (_pi: ExtensionAPI) {
  // Runs synchronously at extension load (startup, /reload, session switch), before Pi reads theme
  // files, so Pi applies the new file from the first frame.
  try {
    const agentDir = getAgentDir();
    const outDir = join(agentDir, OUTPUT_DIR);
    const outPath = join(outDir, `${OUTPUT_THEME}.json`);

    const config = readConfig(agentDir);
    if (config === undefined) {
      // No config: remove the generated theme so Pi falls back to its default "system" theme
      // (Pi's setTheme() does this when the selected theme is missing). settings.json is untouched.
      rmSync(outPath, { force: true });
      return;
    }
    const basePath = findThemeFile(agentDir, config.theme);

    const base = JSON.parse(readFileSync(basePath, "utf-8").replace(/^\uFEFF/, "")) as ThemeJson;
    mkdirSync(outDir, { recursive: true });
    writeAtomic(outPath, buildShiftedTheme(base, nextHue(agentDir, config.step)), 2);
  } catch (error) {
    console.error("random-hue: failed to generate theme (keeping the previous one, if any):", error);
  }
}
