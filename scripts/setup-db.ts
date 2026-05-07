import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

type EnvMap = Record<string, string>;

function parseEnvFile(envPath: string): EnvMap {
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, "utf8");
  const env: EnvMap = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function run(): Promise<void> {
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, ".env.local");
  const schemaPath = path.join(projectRoot, "sql", "schema.sql");

  if (!existsSync(schemaPath)) {
    throw new Error(`No se encontró el archivo SQL: ${schemaPath}`);
  }

  const fileEnv = parseEnvFile(envPath);
  const env = { ...fileEnv, ...process.env } as EnvMap;

  const databaseUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Falta SUPABASE_DB_URL (o DATABASE_URL) en .env.local. " +
        "Con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY no se puede ejecutar DDL SQL directamente."
    );
  }

  const sql = readFileSync(schemaPath, "utf8");

  if (!sql.trim()) {
    throw new Error("sql/schema.sql está vacío.");
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });

  console.log("Conectando a Supabase Postgres...");
  await client.connect();

  try {
    console.log("Ejecutando schema.sql...");
    await client.query(sql);
    console.log("Schema ejecutado correctamente en Supabase.");
  } finally {
    await client.end();
    console.log("Conexión cerrada.");
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error al ejecutar setup-db:", message);
  process.exit(1);
});
