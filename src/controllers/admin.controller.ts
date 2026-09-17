import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminOverview = async (req: Request, res: Response) => {
  try {
    const totalParticipants = await prisma.user.count({ where: { role: 'PARTICIPANT' } });
    const totalFollowUps = await prisma.user.count({ where: { role: 'FOLLOW_UP' } });
    const totalTasks = await prisma.task.count({ where: { isActive: true } });
    const totalCompletions = await prisma.taskCompletion.count();

    const pendingTestimonials = await prisma.testimonial.count({ where: { isApproved: false } });

    // Recent completions
    const recentActivity = await prisma.taskCompletion.findMany({
      take: 10,
      orderBy: { completedAt: 'desc' },
      include: {
        participant: { select: { fullName: true, email: true } },
        task: { select: { title: true, pillar: true } },
      },
    });

    return res.json({
      stats: {
        totalParticipants,
        totalFollowUps,
        totalTasks,
        totalCompletions,
        pendingTestimonials,
        activeChallengeDay: 17,
      },
      recentActivity,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin overview' });
  }
};

export const getAllParticipants = async (req: Request, res: Response) => {
  try {
    const participants = await prisma.user.findMany({
      where: { role: 'PARTICIPANT' },
      include: {
        profile: true,
        streak: true,
        assignedFollowUps: {
          include: { followUpMember: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ participants });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch participants' });
  }
};

export const assignFollowUpMember = async (req: Request, res: Response) => {
  try {
    const { followUpId, participantId } = req.body;
    if (!followUpId || !participantId) {
      return res.status(400).json({ error: 'followUpId and participantId required' });
    }

    const assignment = await prisma.followUpAssignment.upsert({
      where: {
        followUpId_participantId: { followUpId, participantId },
      },
      update: {},
      create: { followUpId, participantId },
    });

    return res.json({ message: 'Follow-up member assigned successfully', assignment });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to assign follow-up member' });
  }
};

export const getPendingTestimonials = async (req: Request, res: Response) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isApproved: false },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ testimonials });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch pending testimonials' });
  }
};

export const approveTestimonial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: { isApproved: true, isPublic: true },
    });
    return res.json({ message: 'Testimonial approved', testimonial });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to approve testimonial' });
  }
};

export const getDynamicFormFields = async (req: Request, res: Response) => {
  try {
    const fields = await prisma.dynamicFormField.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return res.json({ fields });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch dynamic fields' });
  }
};

export const createDynamicFormField = async (req: Request, res: Response) => {
  try {
    const field = await prisma.dynamicFormField.create({ data: req.body });
    return res.status(201).json({ field });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create dynamic field' });
  }
};
