import "dotenv/config";
import { spawn } from "node:child_process";
import { createClient } from "@libsql/client";

async function clearRunningJobs() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const rs = await client.execute({
    sql: "DELETE FROM generation_jobs WHERE status = ? RETURNING id, iso_week",
    args: ["running"],
  });
  if (rs.rows.length > 0) {
    console.log(`Cleared ${rs.rows.length} running job(s):`);
    for (const row of rs.rows) {
      console.log(`  - id=${row.id} iso_week=${row.iso_week}`);
    }
  } else {
    console.log("No running jobs to clear.");
  }
  client.close();
}

async function main() {
  await clearRunningJobs();
  const child = spawn("next", ["dev", ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
