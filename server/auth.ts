import type { NextFunction, Request, Response } from "express";
import * as crypto from "crypto";

type SessionUser = {
  username: string;
  role: "admin";
  exp: number;
};

type AuthConfig = {
  adminApiToken: string;
  apiAuthConfigured: boolean;
  apiAuthRequired: boolean;
  appAdminPassword: string;
  appAdminUser: string;
  internalAccessPassword: string;
  internalAccessUser: string;
  sessionCookieName: string;
  sessionLoginEnabled: boolean;
  sessionSecret: string;
  sessionTtlMs: number;
};

function parseBasicAuth(value: string | undefined): { username: string; password: string } | null {
  if (!value) return null;

  const [scheme, encoded] = value.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function extractBearerToken(value: string | undefined): string {
  if (!value) return "";
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      return;
    }
    const key = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!key) {
      return;
    }
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  });
  return cookies;
}

function getRequestOrigin(req: Request): string {
  return String(req.headers.origin || "").trim();
}

function getRequestHostOrigin(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const firstProtocol = String(protocol).split(",")[0]?.trim() || "http";
  return `${firstProtocol}://${req.headers.host}`;
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && appUrl !== "MY_APP_URL") {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      console.warn("[Security Warning] Ignoring invalid APP_URL for Origin validation.");
    }
  }

  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
  configuredOrigins.forEach((origin) => {
    const trimmed = origin.trim();
    if (!trimmed) {
      return;
    }
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      console.warn("[Security Warning] Ignoring invalid ALLOWED_ORIGINS entry.");
    }
  });

  return origins;
}

function createConfig(): AuthConfig {
  const adminApiToken = process.env.ADMIN_API_TOKEN?.trim() || "";
  const internalAccessUser = process.env.INTERNAL_ACCESS_USER?.trim() || "omiflow";
  const internalAccessPassword = process.env.INTERNAL_ACCESS_PASSWORD?.trim() || "";
  const sessionTtlHours = Math.max(Number.parseInt(process.env.OMNIFLOW_SESSION_TTL_HOURS || "12", 10) || 12, 1);
  const appAdminUser = process.env.OMNIFLOW_ADMIN_USER?.trim() || internalAccessUser || "omiflow";
  const appAdminPassword = process.env.OMNIFLOW_ADMIN_PASSWORD?.trim() || "";
  const sessionLoginEnabled = Boolean(appAdminPassword);
  const apiAuthRequired =
    process.env.REQUIRE_APP_AUTH === "true" ||
    process.env.NODE_ENV === "production" ||
    Boolean(appAdminPassword || adminApiToken || internalAccessPassword);

  return {
    adminApiToken,
    apiAuthConfigured: sessionLoginEnabled || Boolean(adminApiToken) || Boolean(internalAccessPassword),
    apiAuthRequired,
    appAdminPassword,
    appAdminUser,
    internalAccessPassword,
    internalAccessUser,
    sessionCookieName: "omiflow_session",
    sessionLoginEnabled,
    sessionSecret: process.env.OMNIFLOW_SESSION_SECRET?.trim() || adminApiToken || crypto.randomBytes(32).toString("hex"),
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1000,
  };
}

export function createServerAuth() {
  const config = createConfig();
  const allowedOrigins = getAllowedOrigins();

  function signSessionPayload(payload: string): string {
    return crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  }

  function createSessionToken(username: string): string {
    const payload = base64UrlEncode(JSON.stringify({
      username,
      role: "admin",
      exp: Date.now() + config.sessionTtlMs,
    } satisfies SessionUser));
    return `${payload}.${signSessionPayload(payload)}`;
  }

  function readSession(req: Request): SessionUser | null {
    const token = parseCookies(req)[config.sessionCookieName];
    if (!token) {
      return null;
    }

    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signature, signSessionPayload(payload))) {
      return null;
    }

    try {
      const session = JSON.parse(base64UrlDecode(payload)) as Partial<SessionUser>;
      if (
        session.role !== "admin" ||
        typeof session.username !== "string" ||
        typeof session.exp !== "number" ||
        session.exp < Date.now()
      ) {
        return null;
      }
      return session as SessionUser;
    } catch {
      return null;
    }
  }

  function serializeSessionCookie(token: string, maxAgeMs: number): string {
    const attributes = [
      `${config.sessionCookieName}=${encodeURIComponent(token)}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      `Max-Age=${Math.max(Math.floor(maxAgeMs / 1000), 0)}`,
    ];

    if (process.env.NODE_ENV === "production") {
      attributes.push("Secure");
    }

    return attributes.join("; ");
  }

  function clearSessionCookie(): string {
    return `${config.sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  function hasInternalBasicCredentials(req: Request): boolean {
    if (!config.internalAccessPassword) {
      return false;
    }
    const credentials = parseBasicAuth(req.headers.authorization);
    return Boolean(
      credentials?.username === config.internalAccessUser &&
      safeEqual(credentials.password, config.internalAccessPassword)
    );
  }

  function hasAdminToken(req: Request): boolean {
    if (!config.adminApiToken) {
      return false;
    }
    const headerToken = String(req.headers["x-admin-token"] || "");
    const bearerToken = extractBearerToken(req.headers.authorization);
    return safeEqual(headerToken, config.adminApiToken) || safeEqual(bearerToken, config.adminApiToken);
  }

  function hasApiAccess(req: Request): boolean {
    if (!config.apiAuthRequired) {
      return true;
    }
    return Boolean(readSession(req) || hasAdminToken(req) || hasInternalBasicCredentials(req));
  }

  function requireInternalAccess(req: Request, res: Response, next: NextFunction) {
    if (!config.internalAccessPassword) {
      return next();
    }

    if (hasInternalBasicCredentials(req)) {
      return next();
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="OmniFlow Internal Test"');
    return res.status(401).send("Internal test access required.");
  }

  function requireRequestOrigin(req: Request, res: Response, next: NextFunction) {
    if (!isUnsafeMethod(req.method)) {
      return next();
    }

    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin) {
      return next();
    }

    const sameOrigin = requestOrigin === getRequestHostOrigin(req);
    if (sameOrigin || allowedOrigins.has(requestOrigin)) {
      return next();
    }

    return res.status(403).json({
      error: "Cross-origin API request blocked.",
      expectedOrigin: getRequestHostOrigin(req),
    });
  }

  function requireApiAccess(req: Request, res: Response, next: NextFunction) {
    if (!config.apiAuthRequired) {
      return next();
    }

    if (!config.apiAuthConfigured) {
      return res.status(503).json({
        error: "Application authentication is required but no server-side credential is configured.",
        authRequired: true,
        loginEnabled: false,
      });
    }

    if (hasApiAccess(req)) {
      return next();
    }

    return res.status(401).json({
      error: "Authentication required.",
      authRequired: true,
      loginEnabled: config.sessionLoginEnabled,
    });
  }

  function requireAdminToken(req: Request, res: Response, next: NextFunction) {
    if (!config.apiAuthRequired) {
      return next();
    }

    if (!config.apiAuthConfigured) {
      return res.status(503).json({
        error: "Admin authentication is required but no server-side credential is configured.",
        authRequired: true,
        loginEnabled: false,
      });
    }

    if (readSession(req) || hasAdminToken(req) || hasInternalBasicCredentials(req)) {
      return next();
    }

    return res.status(401).json({
      error: "Unauthorized admin action. Sign in or provide a valid server-side admin credential.",
      authRequired: true,
      loginEnabled: config.sessionLoginEnabled,
    });
  }

  function sessionHandler(req: Request, res: Response) {
    const session = readSession(req);
    const internalUserAuthenticated = hasInternalBasicCredentials(req);
    const tokenAuthenticated = hasAdminToken(req);
    const authenticated = Boolean(session || internalUserAuthenticated || tokenAuthenticated);

    res.json({
      authenticated,
      authRequired: config.apiAuthRequired,
      loginEnabled: config.sessionLoginEnabled,
      user: session
        ? { username: session.username, role: session.role }
        : authenticated
          ? { username: internalUserAuthenticated ? config.internalAccessUser : "admin-token", role: "admin" }
          : null,
    });
  }

  function loginHandler(req: Request, res: Response) {
    if (!config.sessionLoginEnabled) {
      return res.status(503).json({
        error: "Password login is not enabled. Configure OMNIFLOW_ADMIN_PASSWORD on the server.",
        authRequired: config.apiAuthRequired,
        loginEnabled: false,
      });
    }

    const username = String(req.body?.username || "");
    const password = String(req.body?.password || "");
    if (username !== config.appAdminUser || !safeEqual(password, config.appAdminPassword)) {
      return res.status(401).json({
        error: "Invalid username or password.",
        authRequired: true,
        loginEnabled: true,
      });
    }

    const token = createSessionToken(config.appAdminUser);
    res.setHeader("Set-Cookie", serializeSessionCookie(token, config.sessionTtlMs));
    return res.json({
      authenticated: true,
      user: { username: config.appAdminUser, role: "admin" },
    });
  }

  function logoutHandler(_req: Request, res: Response) {
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.json({ authenticated: false });
  }

  return {
    loginHandler,
    logoutHandler,
    requireAdminToken,
    requireApiAccess,
    requireInternalAccess,
    requireRequestOrigin,
    securityStatus: () => ({
      apiAuthRequired: config.apiAuthRequired,
      requestOriginProtectionEnabled: true,
      sessionLoginEnabled: config.sessionLoginEnabled,
      sessionSecretConfigured: Boolean(process.env.OMNIFLOW_SESSION_SECRET?.trim()),
      adminTokenConfigured: Boolean(config.adminApiToken),
      internalAccessProtectionEnabled: Boolean(config.internalAccessPassword),
      allowedOrigins: Array.from(allowedOrigins),
    }),
    sessionHandler,
  };
}
