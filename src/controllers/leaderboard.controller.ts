import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getOrEnsureActiveProgramme } from './programme.controller';

const prisma = new PrismaClient();

const EXCO_ROLES = [
  'ADMIN',
  'LEADERSHIP',
  'FOLLOW_UP',
  'PROGRAM_PLANNING',
  'MEDIA',
  'CONTENT',
  'COMMUNITY_MANAGEMENT',
];

function isExcoMember(roleStr?: string | null): boolean {
  if (!roleStr) return false;
  const roles = roleStr.split(',').map((r) => r.trim().toUpperCase());
  return roles.some((r) => EXCO_ROLES.includes(r));
}

function getDateRangeForPeriod(period: string) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (period === 'TODAY') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (period === 'THIS_WEEK') {
    const dayOfWeek = now.getUTCDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }

  if (period === 'LAST_WEEK') {
    const dayOfWeek = now.getUTCDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lastMon = new Date(now);
    lastMon.setUTCDate(now.getUTCDate() + diffToMon - 7);
    const lastSun = new Date(lastMon);
    lastSun.setUTCDate(lastMon.getUTCDate() + 6);
    return {
      startDate: lastMon.toISOString().split('T')[0],
      endDate: lastSun.toISOString().split('T')[0],
    };
  }

  if (period === 'THIS_MONTH') {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0];
    return { startDate: firstDay, endDate: lastDay };
  }

  // ALL_TIME
  return { startDate: '2000-01-01', endDate: '2099-12-31' };
}

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'TODAY';
    const programme = await getOrEnsureActiveProgramme();

    // Fetch all non-EXCO users (participants)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        streak: true,
      },
    });

    const participants = allUsers.filter((u) => !isExcoMember(u.role));

    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Fetch completions within period for all participants
    const completions = await prisma.taskCompletion.findMany({
      where: {
        completionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        participantId: true,
        taskId: true,
        completedAt: true,
      },
    });

    // Group completions per user
    const userCompletionsMap: Record<string, { count: number; latestTime: number }> = {};

    completions.forEach((c) => {
      const time = new Date(c.completedAt).getTime();
      if (!userCompletionsMap[c.participantId]) {
        userCompletionsMap[c.participantId] = { count: 1, latestTime: time };
      } else {
        userCompletionsMap[c.participantId].count += 1;
        if (time > userCompletionsMap[c.participantId].latestTime) {
          userCompletionsMap[c.participantId].latestTime = time;
        }
      }
    });

    // Calculate credits (5 credits per completed task) & sort by FCFS
    const candidateList = participants.map((user) => {
      const comp = userCompletionsMap[user.id] || { count: 0, latestTime: Infinity };
      const credits = comp.count * 5;
      return {
        user,
        completedTasks: comp.count,
        credits,
        latestTime: comp.latestTime,
      };
    });

    // Sort: highest credits first; if tied, earliest completion time first (FCFS)
    candidateList.sort((a, b) => {
      if (b.credits !== a.credits) {
        return b.credits - a.credits;
      }
      if (a.latestTime !== b.latestTime) {
        return a.latestTime - b.latestTime;
      }
      return a.user.fullName.localeCompare(b.user.fullName);
    });

    const rankings = candidateList.map((item, index) => ({
      rank: index + 1,
      participantId: item.user.id,
      fullName: item.user.fullName, // ALWAYS show real names
      avatarUrl: item.user.avatarUrl,
      credits: item.credits,
      completedTasks: item.completedTasks,
      currentStreak: item.user.streak?.currentStreak || 0,
      fcfsTime: item.latestTime !== Infinity ? new Date(item.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
    }));

    return res.json({
      isLive: programme.isLive,
      period,
      startDate,
      endDate,
      rankings,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  }
};
