import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "./index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const client = createDatabase(connectionString);

try {
  await migrate(client.db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.info("ChangeLens database migrations completed.");
} finally {
  await client.close();
}
