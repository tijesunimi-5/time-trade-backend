import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password, fullName, phone, role, ageRange, goals, expectations, customAnswers } = parseResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        role: role as any,
        profile: {
          create: {
            ageRange,
            goals,
            expectations,
            customAnswers: customAnswers ? JSON.stringify(customAnswers) : null,
          },
        },
        streak: {
          create: {
            currentStreak: 0,
            longestStreak: 0,
            totalCompleted: 0,
            overallPercentage: 0,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
    });

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        profile: user.profile,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
    });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        profile: user.profile,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Login failed' });
  }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        profile: true,
        streak: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
};
