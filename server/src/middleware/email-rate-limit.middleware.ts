import rateLimit from "express-rate-limit";

const message = {
  success: false,
  status: 429,
  message: "Too many email requests. Please try again in one hour.",
  details: null,
};

export const passwordResetEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const invitationEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as any).user?.userId || "anonymous"),
  message,
});
