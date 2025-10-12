// backend/routes/services/auth.js
const jwt = require("jsonwebtoken");

const DEFAULT_ALG = "HS256";
const DEFAULT_EXP_SECONDS = 60 * 60 * 12; // 12 uur

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET ontbreekt in productie-omgeving.");
  }
  return secret || "dev_secret";
}
function getVerifyOptions() {
  const opts = { algorithms: [DEFAULT_ALG], clockTolerance: 5 };
  if (process.env.JWT_ISS) opts.issuer = process.env.JWT_ISS;
  if (process.env.JWT_AUD) opts.audience = process.env.JWT_AUD;
  return opts;
}
function getSignOptions({ expSeconds, subject } = {}) {
  const opts = { algorithm: DEFAULT_ALG, expiresIn: expSeconds || DEFAULT_EXP_SECONDS };
  if (process.env.JWT_ISS) opts.issuer = process.env.JWT_ISS;
  if (process.env.JWT_AUD) opts.audience = process.env.JWT_AUD;
  if (subject) opts.subject = String(subject);
  return opts;
}

function extractToken(req) {
  const hdr = req.headers.authorization || req.headers.Authorization || "";
  if (hdr && /^Bearer\s+/i.test(hdr)) return hdr.replace(/^Bearer\s+/i, "").trim();
  if (req.cookies && (req.cookies.token || req.cookies.access_token)) {
    return req.cookies.token || req.cookies.access_token;
  }
  if (req.query && typeof req.query.token === "string") return req.query.token;
  return null;
}
function verifyJwt(token) {
  return jwt.verify(token, getJwtSecret(), getVerifyOptions());
}
function signToken(payload = {}, { expSeconds, subject } = {}) {
  return jwt.sign(payload, getJwtSecret(), getSignOptions({ expSeconds, subject }));
}

function setAuthCookie(res, token, { days = 7, name = "token" } = {}) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(name, token, {
    httpOnly: true, secure: isProd, sameSite: "lax", path: "/",
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}
function clearAuthCookie(res, { name = "token" } = {}) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(name, "", {
    httpOnly: true, secure: isProd, sameSite: "lax", path: "/",
    expires: new Date(0),
  });
}

function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      res.set('WWW-Authenticate','Bearer realm="api", error="invalid_token", error_description="missing"');
      return res.status(401).json({ error: "Geen token" });
    }
    req.user = verifyJwt(token);
    return next();
  } catch {
    res.set('WWW-Authenticate','Bearer realm="api", error="invalid_token", error_description="invalid or expired"');
    return res.status(401).json({ error: "Token ongeldig of verlopen" });
  }
}
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try { req.user = verifyJwt(token); } catch {}
  return next();
}
function requireRole(...allowed) {
  const allow = new Set(allowed.flat().filter(Boolean));
  return (req, res, next) => {
    if (!req.user) {
      res.set('WWW-Authenticate','Bearer realm="api"');
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    if (!allow.has(req.user.role)) return res.status(403).json({ error: "Onvoldoende rechten" });
    return next();
  };
}
function requireStation(paramName = "stationId") {
  return (req, res, next) => {
    const userStation = req.user?.stationId;
    if (!userStation) return res.status(403).json({ error: "Geen station-toegang" });
    const routeVal = req.params?.[paramName];
    if (routeVal != null && String(routeVal) !== String(userStation)) {
      return res.status(403).json({ error: "Station komt niet overeen" });
    }
    return next();
  };
}

function issueToken(res, payload, { cookie = false, days = 7, subject, expSeconds } = {}) {
  const token = signToken(payload, { subject, expSeconds });
  if (cookie) setAuthCookie(res, token, { days });
  return token;
}
function issueLogout(res, { name = "token" } = {}) {
  clearAuthCookie(res, { name });
  return { ok: true };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireStation,
  extractToken,
  verifyJwt,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  issueToken,
  issueLogout,
};
