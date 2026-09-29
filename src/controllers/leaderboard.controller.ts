import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getOrEnsureActiveProgramme } from './programme.controller';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

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

  if (period === 'YESTERDAY') {
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];
    return { startDate: yestStr, endDate: yestStr };
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

export function generateSystemFeedComments(rankings: any[]) {
  const comments: Array<{ icon: string; text: string; category: string }> = [];

  if (!rankings || rankings.length === 0) {
    comments.push({
      icon: '⏳',
      text: 'The leaderboard is fresh! Complete your first task today to claim Rank #1!',
      category: 'NOTICE',
    });
    return comments;
  }

  const rank1 = rankings[0];
  const rank2 = rankings[1];

  // Comment 1: Rank 1 Champion
  if (rank1 && rank1.credits > 0) {
    comments.push({
      icon: '👑',
      text: `Today, a new champion arises! ${rank1.fullName} is dominating 1st place with ${rank1.credits} credits! Who has what it takes to dethrone them?`,
      category: 'CHAMPION',
    });
  }

  // Comment 2: Tight Race between #1 and #2
  if (rank1 && rank2 && rank1.credits > 0 && (rank1.credits - rank2.credits <= 10)) {
    const diff = rank1.credits - rank2.credits;
    comments.push({
      icon: '🌶️',
      text: `Shots fired! ${rank2.fullName} is trailing ${rank1.fullName} by just ${diff} credits! One single task can flip 1st place!`,
      category: 'BATTLE',
    });
  }

  // Comment 3: FCFS Speed Demon
  const fastest = rankings.find(r => r.fcfsTime);
  if (fastest) {
    comments.push({
      icon: '⚡',
      text: `Speed demon alert! ${fastest.fullName} logged their tasks early today at ${fastest.fcfsTime}. First Come First Serve advantage locked!`,
      category: 'SPEED',
    });
  }

  // Comment 4: Highest Streak Beast
  const streakBeast = [...rankings].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  if (streakBeast && streakBeast.currentStreak >= 3) {
    comments.push({
      icon: '🔥',
      text: `${streakBeast.fullName} is on an absolute fire streak of ${streakBeast.currentStreak} days! Pure consistency in action!`,
      category: 'STREAK',
    });
  }

  // Comment 5: Cohort Callout
  const zeroTaskCount = rankings.filter(r => r.completedTasks === 0).length;
  if (zeroTaskCount > 0) {
    comments.push({
      icon: '😏',
      text: `Cohort check: ${zeroTaskCount} participant(s) are snoozing while the leaders lock in their 5 credits per task. Wake up!`,
      category: 'SAVAGE',
    });
  }

  return comments;
}

export function generateSmartMotivationalMessage(input: {
  userRank: number;
  totalParticipants: number;
  userCredits: number;
  completedTasks: number;
  totalTasks: number;
  leaderName: string;
  leaderCredits: number;
  userStreak: number;
  userName: string;
}) {
  const {
    userRank,
    totalParticipants,
    userCredits,
    completedTasks,
    totalTasks,
    leaderName,
    leaderCredits,
    userStreak,
    userName,
  } = input;

  const firstName = userName ? userName.split(' ')[0] : 'Champion';

  // Case 1: Rank #1 (The Leader)
  if (userRank === 1 && userCredits > 0) {
    return {
      mood: 'CHAMPION',
      title: `👑 KING OF THE HILL! YOU'RE RANK #1 TODAY!`,
      message: `Outstanding effort, ${firstName}! You're sitting at #1 on the leaderboard today with ${userCredits} credits (${completedTasks} tasks crushed). But remember: the crown is heavy, and competitors are eyeing your spot. Protect your streak and return tomorrow to defend your throne!`,
      tag: 'PROTECT THE CROWN',
    };
  }

  // Case 2: Fell from #1 / Behind 1st place with tasks remaining
  if (userRank > 1 && leaderCredits > userCredits && completedTasks < totalTasks && totalTasks > 0) {
    const diff = leaderCredits - userCredits;
    return {
      mood: 'CHALLENGE',
      title: `👑 SOMEONE IS TAKING YOUR SPOT, KING!`,
      message: `You're currently sitting at Rank #${userRank} today (${userCredits} pts). ${leaderName} is holding 1st place with ${leaderCredits} pts (${diff} pts ahead). Don't let them get comfortable on your throne! Knock out your remaining ${totalTasks - completedTasks} task(s) right now and reclaim what's yours!`,
      tag: 'RECLAIM YOUR SPOT',
    };
  }

  // Case 3: Podium (Rank 2 or 3)
  if ((userRank === 2 || userRank === 3) && userCredits > 0) {
    const diff = leaderCredits - userCredits;
    return {
      mood: 'PODIUM',
      title: `🥈 SO CLOSE TO THE TOP! YOU'RE RANK #${userRank}!`,
      message: `You're on the podium today, ${firstName}! Sitting at Rank #${userRank} with ${userCredits} pts, just ${diff} pts behind ${leaderName}. One quick task can launch you into 1st place!`,
      tag: 'ATTACK 1ST PLACE',
    };
  }

  // Case 4: All tasks completed today
  if (totalTasks > 0 && completedTasks >= totalTasks) {
    return {
      mood: 'SUCCESS',
      title: `🔥 DAILY DOMINATION COMPLETE!`,
      message: `All ${completedTasks}/${totalTasks} growth tasks crushed today! You earned ${userCredits} credits and kept your ${userStreak}-day streak burning hot (Rank #${userRank} of ${totalParticipants}). Rest well tonight, champion — tomorrow we fight again!`,
      tag: 'STREAK SECURED',
    };
  }

  // Case 5: 0 tasks completed today
  if (completedTasks === 0 && totalTasks > 0) {
    return {
      mood: 'SAVAGE_WARN',
      title: `⏰ THE DAY IS SLIPPING AWAY, ${firstName.toUpperCase()}!`,
      message: `0 tasks completed so far today? Your cohort mates are racking up credits while you sleep on your goals! Get up, hit your non-negotiables, and climb out of Rank #${userRank}!`,
      tag: 'WAKE UP & WORK',
    };
  }

  // Case 6: Mid-progress (e.g. 2/5 tasks)
  if (completedTasks > 0 && completedTasks < totalTasks) {
    return {
      mood: 'PROGRESS',
      title: `🚀 BUILDING MOMENTUM! (${completedTasks}/${totalTasks} TASKS DONE)`,
      message: `Great progress! You've finished ${completedTasks} of ${totalTasks} tasks today (${userCredits} pts, Rank #${userRank}). Keep pushing to finish the rest and climb higher!`,
      tag: 'FINISH STRONG',
    };
  }

  // Default
  return {
    mood: 'NEUTRAL',
    title: `🎯 READY TO DOMINATE TODAY, ${firstName.toUpperCase()}?`,
    message: `Check off your daily growth checklist below to earn credits, extend your streak, and climb today's cohort leaderboard!`,
    tag: 'START TASKS',
  };
}

export const getLeaderboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'TODAY';
    const userId = req.user?.userId;
    const programme = await getOrEnsureActiveProgramme();

    // Fetch all users (participants and admins)
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

    const participants = allUsers;

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
      fullName: item.user.fullName,
      avatarUrl: item.user.avatarUrl,
      credits: item.credits,
      completedTasks: item.completedTasks,
      currentStreak: item.user.streak?.currentStreak || 0,
      fcfsTime: item.latestTime !== Infinity ? new Date(item.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
    }));

    const systemFeedComments = generateSystemFeedComments(rankings);

    let userRanking = null;
    if (userId) {
      const userRankIndex = rankings.findIndex(r => r.participantId === userId);
      if (userRankIndex !== -1) {
        const uRank = rankings[userRankIndex];
        const rank1 = rankings[0];

        // Fetch total assigned tasks for today
        const totalTasksCount = await prisma.task.count({ where: { isActive: true } });

        const smartMsg = generateSmartMotivationalMessage({
          userRank: uRank.rank,
          totalParticipants: rankings.length,
          userCredits: uRank.credits,
          completedTasks: uRank.completedTasks,
          totalTasks: totalTasksCount || 5,
          leaderName: rank1 ? rank1.fullName : 'Competitor',
          leaderCredits: rank1 ? rank1.credits : 0,
          userStreak: uRank.currentStreak,
          userName: uRank.fullName,
        });

        userRanking = {
          ...uRank,
          smartMessage: smartMsg,
        };
      }
    }

    return res.json({
      isLive: programme.isLive,
      period,
      startDate,
      endDate,
      rankings,
      systemFeedComments,
      userRanking,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  }
};
