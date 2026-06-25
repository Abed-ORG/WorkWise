import dotenv from "dotenv";

dotenv.config();


const requiredEnvVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

const optionalEnv = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const smtpHost = optionalEnv(process.env.SMTP_HOST);
const smtpUser = optionalEnv(process.env.SMTP_USER);
const smtpPassword = smtpHost?.includes("gmail.com")
  ? process.env.SMTP_PASS?.replace(/\s+/g, "")
  : optionalEnv(process.env.SMTP_PASS);
const smtpFrom = optionalEnv(process.env.MAIL_FROM)
  || optionalEnv(process.env.EMAIL_FROM)
  || (smtpUser ? `WorkWise <${smtpUser}>` : undefined);
const emailFrom = optionalEnv(process.env.EMAIL_FROM)
  || smtpFrom
  || "WorkWise <onboarding@resend.dev>";

export const env = {
  port: process.env.PORT || "5000",
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  email: {
    resendApiKey: optionalEnv(process.env.RESEND_API_KEY),
    from: emailFrom,
    smtp: {
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: smtpUser,
      pass: smtpPassword,
      from: smtpFrom,
    },
  },
};
