import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const getPublicTestimonials = async (req: Request, res: Response) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isPublic: true, isApproved: true },
      include: {
        user: {
          select: { fullName: true, avatarUrl: true, role: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ testimonials });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch testimonials' });
  }
};

export const submitTestimonial = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { content, isPublic } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const testimonial = await prisma.testimonial.create({
      data: {
        userId,
        content,
        isPublic: isPublic ?? true,
        isApproved: false, // Requires admin approval
      },
    });

    return res.status(201).json({
      message: 'Testimonial submitted successfully. Pending admin review.',
      testimonial,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to submit testimonial' });
  }
};
