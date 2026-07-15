import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export interface DatabaseClient {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  close: () => Promise<void>;
}

export function createDatabase(connectionString: string): DatabaseClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "changelens",
  });
  const db = drizzle({ client: pool, schema });

  return {
    db,
    pool,
    close: async () => pool.end(),
  };
}

export * from "./schema.js";
export { schema };
