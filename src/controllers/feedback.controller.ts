import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

// Submit new feedback (Participants & Excos)
export const submitFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { category, subject, message } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Feedback subject is required.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Feedback message content is required.' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        category: category || 'GENERAL',
        subject: subject.trim(),
        message: message.trim(),
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Feedback submitted successfully. Our team will review it shortly.',
      feedback,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to submit feedback' });
  }
};

// Get feedback submitted by the logged-in user
export const getMyFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const feedbacks = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    return res.json({ feedbacks });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch your feedback' });
  }
};

// Admin/Exco: Get all submitted feedback with filters & metrics
export const getAllFeedbackAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    const whereClause: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }
    if (categoryFilter && categoryFilter !== 'ALL') {
      whereClause.category = categoryFilter;
    }

    const feedbacks = await prisma.feedback.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    // Counts for stats
    const [total, pending, inProgress, resolved] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'PENDING' } }),
      prisma.feedback.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { status: 'RESOLVED' } }),
    ]);

    return res.json({
      metrics: {
        total,
        pending,
        inProgress,
        resolved,
      },
      feedbacks,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin feedback list' });
  }
};

// Admin/Exco: Respond to or update feedback status
export const respondToFeedbackAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    const responder = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { fullName: true, email: true },
    });

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        status: status || existing.status,
        adminResponse: adminResponse !== undefined ? adminResponse : existing.adminResponse,
        respondedBy: responder ? `${responder.fullName}` : 'Admin Team',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    return res.json({
      message: 'Feedback updated successfully.',
      feedback: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update feedback' });
  }
};
