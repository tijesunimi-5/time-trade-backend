import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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
  const roles = roleStr.split(',').map((r) => r.trim());
  return roles.some((r) => EXCO_ROLES.includes(r));
}

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

    // Fetch candidate streaks
    const streaks = await prisma.streak.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: [
        { overallPercentage: 'desc' },
        { currentStreak: 'desc' },
        { totalCompleted: 'desc' },
      ],
      take: 200, // Fetch top candidates to filter down to top 50 participants
    });

    // Exclude EXCO members from participant challenge rankings
    const participantStreaks = streaks.filter((s) => !isExcoMember(s.user.role)).slice(0, 50);

    const rankings = participantStreaks.map((s, index) => ({
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
