// scripts/staff-user.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manage logins for the app (lib/auth/users.ts). Reads DATABASE_URL from the
// environment or .env.local.
//
//   npm run staff -- add sam@rasvertex.com.au "Sam Burke"           new password made up and printed
//   npm run staff -- add sam@rasvertex.com.au "Sam Burke" 'MyPass'  set this password (also resets one)
//   npm run staff -- disable someone@rasvertex.com.au               block a login
//   npm run staff -- enable someone@rasvertex.com.au
//   npm run staff -- list
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { ensureTable, upsertUser, setActive, listUsers } = await import("../lib/auth/users");
  const [cmd, email, name, given] = process.argv.slice(2);
  await ensureTable();

  if (cmd === "add" && email && name) {
    const password = given || randomBytes(12).toString("base64url");
    if (password.length < 10) throw new Error("Use a password of at least 10 characters");
    await upsertUser(email, name, password);
    console.log(`Saved ${email} (${name}).`);
    if (!given) console.log(`Password: ${password}`);
  } else if ((cmd === "disable" || cmd === "enable") && email) {
    const n = await setActive(email, cmd === "enable");
    console.log(n ? `${email} ${cmd}d.` : `No user ${email}.`);
  } else if (cmd === "list") {
    console.table(await listUsers());
  } else {
    console.log('Usage: npm run staff -- add <email> "<name>" [password] | disable <email> | enable <email> | list');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
