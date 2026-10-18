import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";
import { twMerge } from "tailwind-merge";

const ROOT = path.resolve(import.meta.dir, "..", "src");
// Use `bun x` so the canonical-classes CLI resolves automatically.
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const patterns = [
  /\bclassName="([^"]*)"/g,
  /\bclassName=\{`([^`]*)`\}/g,
  /\bclass="([^"]*)"/g,
];

const fix = process.argv.includes("--fix");
let conflicts = 0;

for (const file of walk(ROOT)) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const raw = match[1];
        if (raw.includes("${")) continue; // conditional template literals need an AST-aware linter
        const classes = raw.replace(/\s+/g, " ").trim();
        if (!classes) continue;
        const merged = twMerge(classes);
        if (merged !== classes) {
          conflicts++;
          console.log(`${path.relative(process.cwd(), file)}:${index + 1}: conflicting Tailwind classes`);
          console.log(`  found:   ${classes}`);
          console.log(`  merged:  ${merged}`);
          if (fix) {
            content = content.replace(match[0], match[0].replace(raw, merged));
            changed = true;
          }
        }
      }
    }
  });

  if (fix && changed) fs.writeFileSync(file, content);
}

let hasIssues = !fix && conflicts > 0;

if (conflicts > 0) {
  console.log(`\nFound ${conflicts} conflicting className string(s).`);
} else {
  console.log("No conflicting Tailwind className strings found.");
}

// Canonical class suggestions (via @laststance/tailwind-suggest-canonical-classes)
console.log("\nChecking canonical Tailwind classes...");
const root = path.resolve(import.meta.dir, "..");
const canonicalCmd = fix
  ? $`bun x @laststance/tailwind-suggest-canonical-classes "src/**/*.{ts,tsx}" --css src/tailwind.css`.cwd(root).nothrow()
  : $`bun x @laststance/tailwind-suggest-canonical-classes "src/**/*.{ts,tsx}" --css src/tailwind.css --check`.cwd(root).nothrow();
const canonicalResult = await canonicalCmd;
if (!fix && canonicalResult.exitCode !== 0) hasIssues = true;

if (hasIssues) {
  console.log("\nTailwind issues found.");
  process.exit(1);
}

console.log("\nAll Tailwind checks passed.");