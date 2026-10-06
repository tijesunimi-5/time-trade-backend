import { PrismaClient } from '@prisma/client';
import { getTodayDateString } from './date';

const prisma = new PrismaClient();

export const updateParticipantStreak = async (participantId: string, reqOrDate?: any) => {
  // Fetch existing streak record for protection flags
  const streakRecord = await prisma.streak.findUnique({
    where: { participantId },
  });

  const isProtected = streakRecord?.isProtected || false;
  const bonusStreak = streakRecord?.bonusStreak || 0;

  // Get all completions for participant
  const completions = await prisma.taskCompletion.findMany({
    where: { participantId },
    select: { completionDate: true },
    orderBy: { completionDate: 'desc' },
  });

  const totalCompleted = completions.length;
  const totalAssignedTasks = await prisma.task.count({
    where: { isActive: true },
  });

  // Unique dates of completions (sorted descending e.g. ['2026-09-28', '2026-09-26'])
  const uniqueDates = Array.from(new Set(completions.map((c) => c.completionDate))).sort().reverse();

  let todayStr = getTodayDateString(reqOrDate);
  if (typeof reqOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reqOrDate)) {
    todayStr = reqOrDate;
  }

  // Streak policy update: Streaks never reset to 0 when days are missed.
  // Every active day completed adds continuously to the participant's streak where they left off.
  const currentStreak = uniqueDates.length + bonusStreak;
  const previousLongest = streakRecord?.longestStreak || 0;
  const longestStreak = Math.max(currentStreak, previousLongest, uniqueDates.length + bonusStreak);
  const totalAssigned = totalAssignedTasks * 90;
  const overallPercentage = Math.min(100, Math.round((totalCompleted / Math.max(1, totalAssignedTasks * 17)) * 100));
  const lastCompletedDate = uniqueDates[0] || null;

  await prisma.streak.upsert({
    where: { participantId },
    update: {
      currentStreak,
      longestStreak,
      totalCompleted,
      totalAssigned,
      overallPercentage,
      lastCompletedDate,
    },
    create: {
      participantId,
      currentStreak,
      longestStreak,
      totalCompleted,
      totalAssigned,
      overallPercentage,
      lastCompletedDate,
      isProtected,
      bonusStreak,
    },
  });

  return {
    currentStreak,
    longestStreak,
    totalCompleted,
    overallPercentage,
    lastCompletedDate,
    isProtected,
    bonusStreak,
  };
};
