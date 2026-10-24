import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { hash, verify, Algorithm } from "@node-rs/argon2";
export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function fields(body, allowed) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !allowed.includes(k))
  )
    fail(400, "Unexpected request fields.");
}
export function text(value, label, min = 1, max = 120) {
  if (typeof value !== "string") fail(400, `${label} is required.`);
  const v = value.normalize("NFKC").trim();
  if (
    v.length < min ||
    v.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
  )
    fail(400, `Invalid ${label.toLowerCase()}.`);
  return v;
}
export function email(value) {
  const v = text(value, "Email", 3, 254).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*@nwu\.ac\.bd$/.test(v))
    fail(400, "Use an official nwu.ac.bd email address.");
  return v;
}
export function studentIdentity(body) {
  if (body.identifier !== undefined) {
    if (body.studentId !== undefined || body.email !== undefined)
      fail(400, "Enter either an ID or an email, not multiple identities.");
    const value = text(
      body.identifier,
      "Student ID or email",
      11,
      254,
    ).toLowerCase();
    const match = /^(\d{11})(?:@nwu\.ac\.bd)?$/.exec(value);
    if (!match)
      fail(
        400,
        "Enter an 11-digit student ID or its matching nwu.ac.bd email.",
      );
    return { id: match[1], address: `${match[1]}@nwu.ac.bd` };
  }
  const id = text(body.studentId, "Student ID", 11, 11),
    address = email(body.email);
  if (!/^\d{11}$/.test(id) || address !== `${id}@nwu.ac.bd`)
    fail(400, "Student ID and university email must match exactly.");
  return { id, address };
}
export function password(value) {
  if (
    typeof value !== "string" ||
    value.length < 15 ||
    value.length > 128 ||
    !/\S/.test(value)
  )
    fail(400, "Use a password or passphrase of 15 to 128 characters.");
  return value;
}
export const hashPassword = (value) =>
  hash(password(value), {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export async function checkPassword(encoded, value) {
  if (typeof value !== "string" || value.length > 128) return false;
  try {
    return await verify(encoded, value);
  } catch {
    return false;
  }
}
export function throttle(
  db,
  secret,
  scope,
  key,
  limit,
  window = 15 * 60 * 1000,
) {
  const now = Date.now(),
    bucket = createHmac("sha256", secret)
      .update(`${scope}:${key}`)
      .digest("hex");
  db.prepare("DELETE FROM rate_limits WHERE resets_at<?").run(now);
  db.prepare(
    "INSERT INTO rate_limits(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
  ).run(bucket, now + window);
  if (
    db.prepare("SELECT count FROM rate_limits WHERE key=?").get(bucket).count >
    limit
  )
    fail(429, "Too many attempts. Please try again later.");
}
