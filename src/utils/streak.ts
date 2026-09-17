import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const updateParticipantStreak = async (participantId: string) => {
  // Get all completions for participant
  const completions = await prisma.taskCompletion.findMany({
    where: { participantId },
    select: { completionDate: true },
    orderBy: { completionDate: 'desc' },
  });

  const totalCompleted = await prisma.taskCompletion.count({
    where: { participantId },
  });

  const totalAssignedTasks = await prisma.task.count({
    where: { isActive: true },
  });

  // Unique dates of completions
  const uniqueDates = Array.from(new Set(completions.map((c) => c.completionDate))).sort().reverse();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Calculate current streak
  let checkDate = new Date();
  let hasActivityTodayOrYesterday = false;

  if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
    hasActivityTodayOrYesterday = true;
    let d = uniqueDates.includes(today) ? new Date() : new Date(Date.now() - 86400000);

    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (uniqueDates.includes(dateStr)) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  if (uniqueDates.length > 0) {
    let streakCount = 1;
    longestStreak = 1;

    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const curr = new Date(uniqueDates[i]);
      const prev = new Date(uniqueDates[i + 1]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        streakCount++;
        if (streakCount > longestStreak) {
          longestStreak = streakCount;
        }
      } else {
        streakCount = 1;
      }
    }
  }

  const totalAssigned = totalAssignedTasks * 90; // estimated maximum potential tasks across 90 days
  const overallPercentage = Math.min(100, Math.round((totalCompleted / Math.max(1, totalAssignedTasks * 17)) * 100)); // normalized up to current day 17

  const lastCompletedDate = uniqueDates[0] || null;

  await prisma.streak.upsert({
    where: { participantId },
    update: {
      currentStreak,
      longestStreak: Math.max(currentStreak, longestStreak),
      totalCompleted,
      totalAssigned,
      overallPercentage,
      lastCompletedDate,
    },
    create: {
      participantId,
      currentStreak,
      longestStreak: Math.max(currentStreak, longestStreak),
      totalCompleted,
      totalAssigned,
      overallPercentage,
      lastCompletedDate,
    },
  });

  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, longestStreak),
    totalCompleted,
    overallPercentage,
    lastCompletedDate,
  };
};
