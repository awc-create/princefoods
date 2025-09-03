// scripts/add-react-imports.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const exts = new Set([".tsx", ".jsx"]);

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", ".next", "out", "dist", "coverage"].includes(ent.name)) continue;
      out.push(...listFiles(p));
    } else if (exts.has(path.extname(ent.name))) {
      out.push(p);
    }
  }
  return out;
}

function needsImportReact(code) {
  if (/\bfrom\s+['"]react['"]/.test(code) || /\brequire\(['"]react['"]\)/.test(code)) return false;
  return /<[A-Za-z]|<\/[A-Za-z]|<>\s*|<\/>\s*/.test(code);
}

function insertImportReact(code) {
  const importLine = `import React from 'react';\n`;
  const lines = code.split(/\r?\n/);
  let i = 0;
  if (lines[i]?.charCodeAt(0) === 0xfeff) i++;

  const isDirective = (l) => /^\s*['"]use (client|server)['"]\s*;?\s*$/.test(l);
  const isBlockCommentStart = (l) => /^\s*\/\*/.test(l);
  const isLineComment = (l) => /^\s*\/\//.test(l);

  let headerEnd = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "" || isDirective(l) || isBlockCommentStart(l) || isLineComment(l)) {
      headerEnd = i + 1;
      i++;
    } else break;
  }

  const before = lines.slice(0, headerEnd).join("\n");
  const after = lines.slice(headerEnd).join("\n");
  const pre = before === "" || before.endsWith("\n") ? before : before + "\n";
  const post = after && !after.startsWith("\n") ? "\n" + after : after;

  return pre + importLine + post;
}

const files = listFiles(ROOT);
let changed = 0;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  if (!needsImportReact(code)) continue;
  const updated = insertImportReact(code);
  if (updated !== code) {
    fs.writeFileSync(file, updated, "utf8");
    changed++;
    console.log(`+ Added React import: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone. Updated ${changed} file(s).`);
