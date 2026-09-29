import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getTodayDateString } from '../utils/date';

const prisma = new PrismaClient();

export const getAssignedParticipants = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch all registered users
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        streak: true,
        notesReceived: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        assignedFollowUps: {
          select: { followUpId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const EXCO_ROLES = ['ADMIN', 'LEADERSHIP', 'EXCO', 'COMMUNITY_MANAGEMENT', 'FOLLOW_UP', 'PROGRAM_PLANNING'];
    
    // Filter out EXCO team members from participant target roster
    const participantsOnly = users.filter((u) => {
      const roles = u.role.split(',').map((r) => r.trim().toUpperCase());
      return !roles.some((r) => EXCO_ROLES.includes(r));
    });

    const todayStr = getTodayDateString(req);
    const totalTodayActiveTasks = await prisma.task.count({ where: { isActive: true } });

    const result = await Promise.all(
      participantsOnly.map(async (p) => {
        const todayCompletedCount = await prisma.taskCompletion.count({
          where: { participantId: p.id, completionDate: todayStr },
        });

        const totalCompletedCount = p.streak?.totalCompleted || 0;
        const currentStreak = p.streak?.currentStreak || 0;
        const lastActive = p.streak?.lastCompletedDate || 'Never';
        const isProtected = p.streak?.isProtected || false;

        let diffDays = 0;
        if (lastActive !== 'Never') {
          const [ly, lm, ld] = lastActive.split('-').map(Number);
          const [ty, tm, td] = todayStr.split('-').map(Number);
          const lastDate = Date.UTC(ly, lm - 1, ld);
          const todayDate = Date.UTC(ty, tm - 1, td);
          diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        } else {
          diffDays = 999;
        }

        // Smart Risk Segmentation Algorithm
        let riskSegment: 'HIGH' | 'MEDIUM' | 'NORMAL' = 'NORMAL';
        let systemRecommendation = 'On track! Keep encouraging their streak.';

        if (diffDays >= 2 || lastActive === 'Never') {
          riskSegment = 'HIGH';
          systemRecommendation = `🔴 FLAGGED: Missed ${diffDays === 999 ? 'all' : diffDays} days of tasks. Urgent phone call or WhatsApp message recommended!`;
        } else if (diffDays === 1 || todayCompletedCount === 0) {
          riskSegment = 'MEDIUM';
          systemRecommendation = '🟡 NEEDS ATTENTION: Did not complete today/yesterday tasks yet. Send a quick check-in message.';
        } else {
          riskSegment = 'NORMAL';
          systemRecommendation = '🟢 ON TRACK: Consistent task completions today.';
        }

        const isAssignedToMe = p.assignedFollowUps.some((a) => a.followUpId === currentUserId);

        return {
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          avatarUrl: p.avatarUrl,
          profile: p.profile,
          currentStreak,
          longestStreak: p.streak?.longestStreak || 0,
          isProtected,
          todayProgress: `${todayCompletedCount}/${totalTodayActiveTasks || 1}`,
          todayCompletedCount,
          totalTodayActiveTasks: totalTodayActiveTasks || 1,
          totalCompletedCount,
          overallPercentage: Math.round(p.streak?.overallPercentage || 0),
          lastActive,
          riskSegment,
          systemRecommendation,
          isAssignedToMe,
          notes: p.notesReceived,
        };
      })
    );

    return res.json({ participants: result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch follow-up participants' });
  }
};

export const addFollowUpNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authorId = req.user?.userId;
    if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

    const { participantId, noteContent } = req.body;
    if (!participantId || !noteContent) {
      return res.status(400).json({ error: 'Participant ID and note content required' });
    }

    const note = await prisma.followUpNote.create({
      data: {
        authorId,
        participantId,
        noteContent,
      },
      include: {
        author: { select: { fullName: true } },
      },
    });

    return res.status(201).json({ note });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add note' });
  }
};
