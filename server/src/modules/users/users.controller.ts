import { Request, Response } from 'express';
import { usersService } from './users.service';

export class UsersController {

  async getMe(req: Request, res: Response) {
    try {
      const userId = String((req as any).user?.userId);
      const user = await usersService.getUserById(userId);
      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateMe(req: Request, res: Response) {
    try {
      const userId = String((req as any).user?.userId);
      const { name, avatarUrl } = req.body;

      const user = await usersService.updateUser(userId, { name, avatarUrl });
      return res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      if (error.message === 'INVALID_NAME') {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async changePassword(req: Request, res: Response) {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!currentPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Current password and a new password of at least 8 characters are required',
      });
    }

    try {
      const userId = String((req as any).user?.userId);
      await usersService.changePassword(userId, currentPassword, newPassword);
      return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error: any) {
      if (error.message === 'INVALID_CURRENT_PASSWORD') {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async requestEmailChange(req: Request, res: Response) {
    const newEmail = String(req.body.newEmail || '').trim();

    if (!newEmail) {
      return res.status(400).json({ success: false, message: 'A new email address is required' });
    }

    try {
      const userId = String((req as any).user?.userId);
      await usersService.requestEmailChange(userId, newEmail);
      return res.status(200).json({ success: true, message: 'Verification code sent to the new email address' });
    } catch (error: any) {
      if (error.message === 'INVALID_EMAIL') {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
      if (error.message === 'EMAIL_UNCHANGED') {
        return res.status(400).json({ success: false, message: 'That is already your current email address' });
      }
      if (error.message === 'EMAIL_ALREADY_IN_USE') {
        return res.status(409).json({ success: false, message: 'That email address is already in use' });
      }
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (error.message === 'MAIL_NOT_CONFIGURED') {
        return res.status(503).json({ success: false, message: 'Email delivery is not configured yet' });
      }
      return res.status(502).json({ success: false, message: 'Unable to send the verification email' });
    }
  }

  async confirmEmailChange(req: Request, res: Response) {
    const code = String(req.body.code || '').trim();

    if (!code) {
      return res.status(400).json({ success: false, message: 'A verification code is required' });
    }

    try {
      const userId = String((req as any).user?.userId);
      const user = await usersService.confirmEmailChange(userId, code);
      return res.status(200).json({ success: true, message: 'Email address updated successfully', data: user });
    } catch (error: any) {
      if (error.message === 'INVALID_OR_EXPIRED_VERIFICATION_CODE') {
        return res.status(400).json({ success: false, message: 'This verification code is invalid or has expired' });
      }
      if (error.message === 'EMAIL_ALREADY_IN_USE') {
        return res.status(409).json({ success: false, message: 'That email address is already in use' });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateOnboarding(req: Request, res: Response) {
    const status = String(req.body.status || '');
    if (status !== 'COMPLETED' && status !== 'DISMISSED') {
      return res.status(400).json({ success: false, message: 'Invalid onboarding status' });
    }

    try {
      const userId = String((req as any).user?.userId);
      const state = await usersService.updateOnboarding(userId, status);
      return res.status(200).json({ success: true, data: state });
    } catch {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const usersController = new UsersController();
