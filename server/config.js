import nodemailer from "nodemailer";
export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const origin = new URL(env.APP_ORIGIN || "http://localhost:8080").origin;
  const provisional = env.ALLOW_PROVISIONAL_STUDENTS === "true";
  if (
    production &&
    (env.ADMIN_MFA_GATEWAY_CONFIRMED !== "true" ||
      !env.SMTP_HOST ||
      !env.MAIL_FROM)
  )
    throw new Error(
      "Production requires configured SMTP and an institution-managed MFA gateway protecting admin access. See docs/SECURITY.md.",
    );
  if (production && new URL(origin).protocol !== "https:")
    throw new Error("Production requires an HTTPS origin.");
  if (production && provisional)
    throw new Error("Provisional student login is forbidden in production.");
  let sendMail = null;
  if (env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465),
      secure: env.SMTP_SECURE !== "false",
      requireTLS: env.SMTP_SECURE === "false",
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    });
    if (!env.MAIL_FROM)
      throw new Error("MAIL_FROM is required when SMTP is configured.");
    sendMail = (mail) => transport.sendMail({ ...mail, from: env.MAIL_FROM });
  }
  return {
    origin,
    production,
    provisional,
    secret: env.RATE_LIMIT_SECRET,
    sendMail,
    databasePath: env.DATABASE_PATH || "./var/notify.sqlite",
  };
}
