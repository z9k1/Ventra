const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const DEFAULT_SCHEMA = "drizzle";
const DEFAULT_TABLE = "__drizzle_migrations";

function getArgValue(flag) {
  const arg = process.argv.find((item) => item.startsWith(`${flag}=`));
  return arg ? arg.slice(flag.length + 1) : undefined;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listMigrationFiles(drizzleDir) {
  const entries = fs.readdirSync(drizzleDir);
  const sqlFiles = entries.filter((name) => /^\d+_.+\.sql$/.test(name));
  sqlFiles.sort((a, b) => {
    const aMatch = a.match(/^(\d+)/);
    const bMatch = b.match(/^(\d+)/);
    const aNum = aMatch ? Number(aMatch[1]) : Number.MAX_SAFE_INTEGER;
    const bNum = bMatch ? Number(bMatch[1]) : Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });
  return sqlFiles.map((file) => ({
    file,
    tag: file.replace(/\.sql$/, "")
  }));
}

function computeSqlHash(sqlText) {
  return crypto.createHash("sha256").update(sqlText).digest("hex");
}

function getBreakpointFlag(sqlText) {
  return sqlText.includes("--> statement-breakpoint");
}

function ensureJournalEntries({ drizzleDir, journalPath, journal, syncJournal }) {
  if (!syncJournal) return { journal, added: [] };

  const migrations = listMigrationFiles(drizzleDir);
  const existingTags = new Set(journal.entries.map((entry) => entry.tag));
  const missing = migrations.filter((item) => !existingTags.has(item.tag));

  if (missing.length === 0) return { journal, added: [] };

  const maxWhen = journal.entries.reduce((max, entry) => {
    if (typeof entry.when === "number") return Math.max(max, entry.when);
    return max;
  }, 0);

  const added = [];
  let nextWhen = maxWhen > 0 ? maxWhen : Date.now();
  for (const item of missing) {
    const sqlPath = path.join(drizzleDir, item.file);
    const sqlText = fs.readFileSync(sqlPath, "utf8");
    nextWhen += 1000;
    const entry = {
      idx: journal.entries.length,
      version: journal.version ?? "7",
      when: nextWhen,
      tag: item.tag,
      breakpoints: getBreakpointFlag(sqlText)
    };
    journal.entries.push(entry);
    added.push(entry);
  }

  writeJson(journalPath, journal);
  return { journal, added };
}

function getEntriesToBaseline(journal, options) {
  const { onlyTags, includeLatest } = options;
  if (onlyTags.length > 0) {
    return journal.entries.filter((entry) => onlyTags.includes(entry.tag));
  }

  if (includeLatest || journal.entries.length <= 1) {
    return journal.entries;
  }

  const latestWhen = journal.entries.reduce((max, entry) => {
    if (typeof entry.when === "number") return Math.max(max, entry.when);
    return max;
  }, 0);

  return journal.entries.filter((entry) => entry.when !== latestWhen);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL não definido.");
    process.exit(1);
  }

  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  const journalPath = path.join(drizzleDir, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    console.error("Não foi possível encontrar drizzle/meta/_journal.json.");
    process.exit(1);
  }

  const syncJournal = !hasFlag("--no-sync-journal");
  const includeLatest = hasFlag("--include-latest");
  const onlyTagsArg = getArgValue("--only-tags");
  const onlyTags = onlyTagsArg ? onlyTagsArg.split(",").map((t) => t.trim()).filter(Boolean) : [];

  let journal = readJson(journalPath);
  const { journal: updatedJournal, added } = ensureJournalEntries({
    drizzleDir,
    journalPath,
    journal,
    syncJournal
  });
  journal = updatedJournal;

  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    console.error("_journal.json não contém entries de migrations.");
    process.exit(1);
  }

  const entriesToBaseline = getEntriesToBaseline(journal, { onlyTags, includeLatest });
  if (entriesToBaseline.length === 0) {
    console.error("Nenhuma migration selecionada para baseline.");
    process.exit(1);
  }

  const migrationMeta = new Map();
  for (const entry of journal.entries) {
    const migrationPath = path.join(drizzleDir, `${entry.tag}.sql`);
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Arquivo de migration não encontrado: ${migrationPath}`);
    }
    const sqlText = fs.readFileSync(migrationPath, "utf8");
    migrationMeta.set(entry.tag, {
      hash: computeSqlHash(sqlText),
      when: entry.when
    });
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const schema = process.env.DRIZZLE_MIGRATIONS_SCHEMA || DEFAULT_SCHEMA;
  const table = process.env.DRIZZLE_MIGRATIONS_TABLE || DEFAULT_TABLE;

  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS "${schema}"."${table}" (\n` +
      `  id SERIAL PRIMARY KEY,\n` +
      `  hash text NOT NULL,\n` +
      `  created_at bigint\n` +
      `)`
  );

  const existingRows = await client.query(
    `select hash, created_at from "${schema}"."${table}"`
  );
  const existing = new Set(
    existingRows.rows.map((row) => `${row.hash}:${row.created_at}`)
  );

  const inserted = [];
  for (const entry of entriesToBaseline) {
    const meta = migrationMeta.get(entry.tag);
    if (!meta) continue;
    const key = `${meta.hash}:${meta.when}`;
    if (existing.has(key)) continue;

    await client.query(
      `insert into "${schema}"."${table}" ("hash", "created_at") values ($1, $2)`,
      [meta.hash, meta.when]
    );
    inserted.push(entry.tag);
  }

  await client.end();

  if (added.length > 0) {
    console.log(`_journal.json atualizado com: ${added.map((e) => e.tag).join(", ")}`);
  }
  console.log(`Baselines inseridos: ${inserted.length ? inserted.join(", ") : "(nenhum)"}`);
  console.log("Pronto. Agora execute: npx drizzle-kit migrate");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
