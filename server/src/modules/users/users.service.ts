import bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import prisma from '../../utils/prisma';
import { sendVerificationEmail } from '../../services/mail.service';

const hashVerificationCode = (code: string) => createHash('sha256').update(code).digest('hex');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class UsersService {

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        notificationPreference: true,
        onboardingCompleted: true,
        onboardingDismissed: true,
        createdAt: true,
        _count: {
          select: { projectMembers: true },
        },
        projectMembers: {
          select: {
            role: true,
            project: { select: { id: true, name: true, key: true } },
          },
          orderBy: { joinedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user;
  }

  async updateUser(userId: string, data: { name?: string; avatarUrl?: string }) {
    if (data.name !== undefined && !data.name.trim()) {
      throw new Error('INVALID_NAME');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        notificationPreference: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('INVALID_CURRENT_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async requestEmailChange(userId: string, newEmail: string) {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new Error('INVALID_EMAIL');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (normalizedEmail === user.email) {
      throw new Error('EMAIL_UNCHANGED');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new Error('EMAIL_ALREADY_IN_USE');
    }

    await prisma.emailChangeRequest.deleteMany({ where: { userId } });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const requestRecord = await prisma.emailChangeRequest.create({
      data: {
        newEmail: normalizedEmail,
        codeHash: hashVerificationCode(code),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userId,
      },
    });

    try {
      await sendVerificationEmail({ to: normalizedEmail, recipientName: user.name, code });
    } catch (error) {
      await prisma.emailChangeRequest.delete({ where: { id: requestRecord.id } });
      throw error;
    }
  }

  async confirmEmailChange(userId: string, code: string) {
    const requestRecord = await prisma.emailChangeRequest.findFirst({
      where: { userId, codeHash: hashVerificationCode(code) },
    });

    if (!requestRecord || requestRecord.expiresAt <= new Date()) {
      if (requestRecord) {
        await prisma.emailChangeRequest.delete({ where: { id: requestRecord.id } });
      }
      throw new Error('INVALID_OR_EXPIRED_VERIFICATION_CODE');
    }

    try {
      const user = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { email: requestRecord.newEmail },
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            notificationPreference: true,
          },
        });
        await tx.emailChangeRequest.deleteMany({ where: { userId } });
        return updatedUser;
      });

      return user;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new Error('EMAIL_ALREADY_IN_USE');
      }
      throw error;
    }
  }

  async updateOnboarding(userId: string, status: 'COMPLETED' | 'DISMISSED') {
    return prisma.user.update({
      where: { id: userId },
      data: status === 'COMPLETED'
        ? { onboardingCompleted: true, onboardingDismissed: false }
        : { onboardingDismissed: true },
      select: {
        onboardingCompleted: true,
        onboardingDismissed: true,
      },
    });
  }
}

export const usersService = new UsersService();
