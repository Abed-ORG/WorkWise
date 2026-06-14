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

export const env = {
  port: process.env.PORT || "5000",
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  email: {
    resendApiKey: process.env.RESEND_API_KEY?.trim(),
    from: process.env.EMAIL_FROM || "WorkWise <onboarding@resend.dev>",
    smtp: {
      host: process.env.SMTP_HOST?.trim(),
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS?.trim(),
      from: process.env.MAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim(),
    },
  },
};
