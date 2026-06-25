import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  updatePassword,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Role } from "@prisma/client";
import { authLimiter } from "../middleware/auth-rate-limit.middleware";
import { passwordResetEmailLimiter } from "../middleware/email-rate-limit.middleware";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgot-password", passwordResetEmailLimiter, forgotPassword);
router.post("/reset-password", updatePassword);
router.post("/logout", authenticate, logout);
router.post("/refresh", refresh);

router.get(
  "/admin-test",
  authenticate,
  authorize([Role.ADMIN]),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted",
    });
  }
);
export default router;
