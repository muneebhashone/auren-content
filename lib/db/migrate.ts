import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  console.log(`Migrating ${url}...`);
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("Done.");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
