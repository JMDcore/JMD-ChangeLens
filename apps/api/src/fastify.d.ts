import type { FastifyReply } from "fastify";

import type { AuthenticatedUser } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedUser | null;
    sessionTokenHash: string | null;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
