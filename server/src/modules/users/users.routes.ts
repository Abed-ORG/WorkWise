import { Router, Request, Response } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET  /api/users/me → get current user profile
// PATCH /api/users/me → update current user profile

router.get('/me', (req: Request, res: Response) => usersController.getMe(req, res));
router.patch('/me', (req: Request, res: Response) => usersController.updateMe(req, res));
router.patch('/me/password', (req: Request, res: Response) => usersController.changePassword(req, res));
router.patch('/me/onboarding', (req: Request, res: Response) => usersController.updateOnboarding(req, res));

export default router;
