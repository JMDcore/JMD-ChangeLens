import type { ApiEnvironment } from "@changelens/config";
import type { PublicUser } from "@changelens/contracts";
import type { DatabaseClient } from "@changelens/database";
import type { ChangeLensQueues } from "@changelens/queue";
import type { ScreenshotStore } from "@changelens/storage";

export interface ApiDependencies {
  env: ApiEnvironment;
  database: DatabaseClient;
  queues: ChangeLensQueues;
  screenshots: ScreenshotStore;
}

export type AuthenticatedUser = PublicUser;
