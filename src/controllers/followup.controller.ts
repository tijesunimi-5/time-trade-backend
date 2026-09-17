import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const getAssignedParticipants = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const followUpId = req.user?.userId;
    if (!followUpId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch assignments for this follow up member
    const assignments = await prisma.followUpAssignment.findMany({
      where: { followUpId },
      include: {
        participant: {
          include: {
            profile: true,
            streak: true,
            notesReceived: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const result = await Promise.all(
      assignments.map(async (assignment) => {
        const p = assignment.participant;
        const todayCompletedCount = await prisma.taskCompletion.count({
          where: { participantId: p.id, completionDate: todayStr },
        });

        // Determine factual activity status
        const lastActive = p.streak?.lastCompletedDate || 'Never';
        let status = 'ACTIVE'; // ACTIVE, NEEDS_ATTENTION, INACTIVE

        if (lastActive === 'Never') {
          status = 'INACTIVE';
        } else if (lastActive !== todayStr) {
          const lastActiveDate = new Date(lastActive);
          const diffDays = Math.round((Date.now() - lastActiveDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays >= 2) {
            status = 'INACTIVE';
          } else if (diffDays === 1) {
            status = 'NEEDS_ATTENTION';
          }
        }

        return {
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          avatarUrl: p.avatarUrl,
          assignedAt: assignment.assignedAt,
          todayProgress: `${todayCompletedCount}/4`,
          weeklyProgress: `18/25`,
          lastActive,
          status,
          currentStreak: p.streak?.currentStreak || 0,
          overallPercentage: p.streak?.overallPercentage || 0,
          notes: p.notesReceived,
        };
      })
    );

    return res.json({ participants: result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch assigned participants' });
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
    });

    return res.status(201).json({ note });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add note' });
  }
};
