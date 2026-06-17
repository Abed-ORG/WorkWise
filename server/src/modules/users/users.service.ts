import prisma from '../../utils/prisma';

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
