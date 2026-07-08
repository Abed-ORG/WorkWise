import { Role } from '@prisma/client';
import { projectsService } from '../modules/projects/projects.service';
import prisma from '../utils/prisma';

const ONE_HOUR_MS = 60 * 60 * 1000;

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

class DailyDigestScheduler {
  private timer?: NodeJS.Timeout;

  start() {
    if (process.env.DAILY_DIGEST_SCHEDULER_ENABLED !== 'true') {
      return;
    }

    this.run().catch((error) => {
      console.warn('Daily digest scheduler skipped:', error instanceof Error ? error.message : error);
    });

    this.timer = setInterval(() => {
      this.run().catch((error) => {
        console.warn('Daily digest scheduler skipped:', error instanceof Error ? error.message : error);
      });
    }, ONE_HOUR_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async run() {
    const scheduledHour = Number(process.env.DAILY_DIGEST_HOUR_UTC || 18);
    const now = new Date();

    if (now.getUTCHours() !== scheduledHour) {
      return;
    }

    const since = startOfTodayUtc();
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        dailyDigests: {
          where: { createdAt: { gte: since }, source: 'scheduled' },
          select: { id: true },
          take: 1,
        },
        members: {
          where: { role: Role.ADMIN },
          select: { userId: true },
          take: 1,
        },
      },
    });

    for (const project of projects) {
      const admin = project.members[0];
      if (!admin || project.dailyDigests.length > 0) continue;
      await projectsService.generateDailyDigest(project.id, admin.userId, 'scheduled');
    }
  }
}

export const dailyDigestScheduler = new DailyDigestScheduler();
