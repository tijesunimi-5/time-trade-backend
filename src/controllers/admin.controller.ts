import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminOverview = async (req: Request, res: Response) => {
  try {
    const totalParticipants = await prisma.user.count({
      where: { role: { contains: 'PARTICIPANT' } },
    });
    const totalFollowUps = await prisma.user.count({
      where: { role: { contains: 'FOLLOW_UP' } },
    });
    const totalTasks = await prisma.task.count({ where: { isActive: true } });
    const totalCompletions = await prisma.taskCompletion.count();
    const pendingTestimonials = await prisma.testimonial.count({ where: { isApproved: false } });

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global', isAdminRegistrationActive: true },
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
      settings,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin overview' });
  }
};

export const getAllParticipants = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        streak: true,
        assignedFollowUps: {
          include: { followUpMember: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsedUsers = users.map((u) => ({
      ...u,
      rolesList: u.role.split(',').map((r) => r.trim()),
    }));

    return res.json({ participants: parsedUsers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch participants' });
  }
};

export const updateUserRoles = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { roles, fullName, phone } = req.body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: 'At least one role is required' });
    }

    const joinedRoles = Array.from(new Set(roles)).join(',');

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: joinedRoles,
        fullName: fullName || undefined,
        phone: phone || undefined,
      },
    });

    return res.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        rolesList: updatedUser.role.split(',').map((r) => r.trim()),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update user roles' });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { isAdminRegistrationActive } = req.body;

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {
        isAdminRegistrationActive: typeof isAdminRegistrationActive === 'boolean' ? isAdminRegistrationActive : true,
      },
      create: {
        id: 'global',
        isAdminRegistrationActive: typeof isAdminRegistrationActive === 'boolean' ? isAdminRegistrationActive : true,
      },
    });

    return res.json({ message: 'Settings updated successfully', settings });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update settings' });
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
