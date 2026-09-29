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

  let currentStreak = 0;
  let longestStreak = 0;

  if (uniqueDates.length === 0) {
    currentStreak = bonusStreak;
  } else {
    const lastActivityDateStr = uniqueDates[0];
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const [ly, lm, ld] = lastActivityDateStr.split('-').map(Number);

    const todayDate = Date.UTC(ty, tm - 1, td);
    const lastDate = Date.UTC(ly, lm - 1, ld);
    const daysSinceLastActivity = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    // Rule: Missing 2 or more consecutive days up to today resets current streak to 0 (unless admin protected)
    if (daysSinceLastActivity >= 3 && !isProtected) {
      currentStreak = 0 + bonusStreak;
    } else {
      let activeDaysCount = 1;

      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const [y1, m1, d1] = uniqueDates[i].split('-').map(Number);
        const [y2, m2, d2] = uniqueDates[i + 1].split('-').map(Number);

        const date1 = Date.UTC(y1, m1 - 1, d1);
        const date2 = Date.UTC(y2, m2 - 1, d2);
        const diff = Math.floor((date1 - date2) / (1000 * 60 * 60 * 24));

        // diff <= 2 means 0 or 1 missed day (1-day grace gap allowed!)
        if (diff <= 2) {
          activeDaysCount++;
        } else {
          if (!isProtected) {
            break;
          } else {
            activeDaysCount++;
          }
        }
      }

      currentStreak = activeDaysCount + bonusStreak;
    }
  }

  // Calculate longest streak
  if (uniqueDates.length > 0) {
    let streakCount = 1;
    longestStreak = 1;

    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const [y1, m1, d1] = uniqueDates[i].split('-').map(Number);
      const [y2, m2, d2] = uniqueDates[i + 1].split('-').map(Number);
      const date1 = Date.UTC(y1, m1 - 1, d1);
      const date2 = Date.UTC(y2, m2 - 1, d2);
      const diff = Math.floor((date1 - date2) / (1000 * 60 * 60 * 24));

      if (diff <= 2) {
        streakCount++;
        if (streakCount > longestStreak) {
          longestStreak = streakCount;
        }
      } else {
        streakCount = 1;
      }
    }
  }

  longestStreak = Math.max(currentStreak, longestStreak);
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
