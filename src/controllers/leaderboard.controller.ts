import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const config = await prisma.leaderboardConfig.findUnique({
      where: { id: 'global' },
    });

    if (config && !config.isEnabled) {
      return res.json({
        isEnabled: false,
        rankings: [],
      });
    }

    const streaks = await prisma.streak.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { overallPercentage: 'desc' },
        { currentStreak: 'desc' },
        { totalCompleted: 'desc' },
      ],
      take: 50,
    });

    const rankings = streaks.map((s, index) => ({
      rank: index + 1,
      participantId: s.user.id,
      fullName: config?.showNames ? s.user.fullName : `Participant #${index + 1}`,
      avatarUrl: config?.showNames ? s.user.avatarUrl : null,
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      totalCompleted: s.totalCompleted,
      overallPercentage: s.overallPercentage,
    }));

    return res.json({
      isEnabled: true,
      showNames: config?.showNames ?? true,
      rankings,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  }
};
