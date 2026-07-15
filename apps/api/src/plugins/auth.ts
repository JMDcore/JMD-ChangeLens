import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { loginSchema, registerSchema } from "@changelens/contracts";
import { auditLogs, sessions, users } from "@changelens/database";

import { createOpaqueToken, keyedHash, sha256 } from "../lib/crypto.js";
import { AppError, parseInput } from "../lib/errors.js";
import type { ApiDependencies, AuthenticatedUser } from "../types.js";

export const SESSION_COOKIE = "cl_session";
export const CSRF_COOKIE = "cl_csrf";
const passwordOptions = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 };
const dummyPasswordHash = hash("this-is-not-a-real-user-password", passwordOptions);

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
}): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

function setSessionCookies(reply: FastifyReply, token: string, csrf: string, dependencies: ApiDependencies): void {
  const maxAge = dependencies.env.SESSION_TTL_DAYS * 24 * 60 * 60;
  const common = {
    path: "/",
    secure: dependencies.env.COOKIE_SECURE,
    sameSite: "strict" as const,
    maxAge,
  };
  reply.setCookie(SESSION_COOKIE, token, { ...common, httpOnly: true });
  reply.setCookie(CSRF_COOKIE, csrf, { ...common, httpOnly: false });
}

async function createSession(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  dependencies: ApiDependencies,
): Promise<void> {
  const token = createOpaqueToken();
  const csrf = createOpaqueToken(24);
  const expiresAt = new Date(Date.now() + dependencies.env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000);
  await dependencies.database.db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    userAgent: request.headers["user-agent"]?.slice(0, 300),
    ipHash: keyedHash(request.ip, dependencies.env.WEBHOOK_SIGNING_SECRET),
  });
  setSessionCookies(reply, token, csrf, dependencies);
}

export async function registerAuthentication(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  app.decorateRequest("authUser", null);
  app.decorateRequest("sessionTokenHash", null);

  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue");

    const tokenHash = sha256(token);
    const [session] = await dependencies.database.db
      .select({
        sessionId: sessions.id,
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!session) throw new AppError(401, "SESSION_INVALID", "Your session is invalid or has expired");
    request.authUser = publicUser(session);
    request.sessionTokenHash = tokenHash;

    if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1_000) {
      await dependencies.database.db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, session.sessionId));
    }
  });

  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = parseInput(registerSchema, request.body);
      const [existing] = await dependencies.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existing) throw new AppError(409, "EMAIL_IN_USE", "An account already exists for this email");

      const passwordHash = await hash(input.password, passwordOptions);
      const [created] = await dependencies.database.db
        .insert(users)
        .values({ name: input.name, email: input.email, passwordHash })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        });
      if (!created) throw new AppError(500, "ACCOUNT_CREATION_FAILED", "The account could not be created");

      await createSession(request, reply, created.id, dependencies);
      await dependencies.database.db.insert(auditLogs).values({
        userId: created.id,
        action: "auth.register",
        entityType: "user",
        entityId: created.id,
        requestId: request.id,
      });
      return reply.code(201).send({ user: publicUser(created) });
    },
  );

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = parseInput(loginSchema, request.body);
      const [user] = await dependencies.database.db.select().from(users).where(eq(users.email, input.email)).limit(1);
      const valid = await verify(user?.passwordHash ?? (await dummyPasswordHash), input.password);
      if (!user || !valid) throw new AppError(401, "CREDENTIALS_INVALID", "Email or password is incorrect");

      await createSession(request, reply, user.id, dependencies);
      await dependencies.database.db.insert(auditLogs).values({
        userId: user.id,
        action: "auth.login",
        entityType: "session",
        requestId: request.id,
      });
      return { user: publicUser(user) };
    },
  );

  app.get("/api/auth/me", { preHandler: app.authenticate }, async (request) => ({ user: request.authUser }));

  app.post("/api/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    if (request.sessionTokenHash) {
      await dependencies.database.db.delete(sessions).where(eq(sessions.tokenHash, request.sessionTokenHash));
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.clearCookie(CSRF_COOKIE, { path: "/" });
    return reply.code(204).send();
  });
}
