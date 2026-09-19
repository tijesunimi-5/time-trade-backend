import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { participantRegisterSchema, adminRegisterSchema, loginSchema } from '../validators/auth.validator';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

// Helper to get or create global settings
async function getSettings() {
  let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 'global', isAdminRegistrationActive: true },
    });
  }
  return settings;
}

// 1. Participant Passwordless Registration
export const registerParticipant = async (req: Request, res: Response) => {
  try {
    const parseResult = participantRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, fullName, phone, birthday, ageRange, goals, expectations, customAnswers } = parseResult.data;

    let user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, streak: true },
    });

    if (user) {
      // User exists: update profile if participant
      if (user.role.includes('PARTICIPANT')) {
        await prisma.profile.upsert({
          where: { userId: user.id },
          update: {
            birthday,
            ageRange,
            goals,
            expectations,
            customAnswers: customAnswers ? JSON.stringify(customAnswers) : undefined,
          },
          create: {
            userId: user.id,
            birthday,
            ageRange,
            goals,
            expectations,
            customAnswers: customAnswers ? JSON.stringify(customAnswers) : undefined,
          },
        });
      }
    } else {
      // Create new participant
      user = await prisma.user.create({
        data: {
          email,
          fullName,
          phone,
          role: 'PARTICIPANT',
          profile: {
            create: {
              birthday,
              ageRange,
              goals,
              expectations,
              customAnswers: customAnswers ? JSON.stringify(customAnswers) : undefined,
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
        include: { profile: true, streak: true },
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        rolesList: user.role.split(',').map((r) => r.trim()),
        avatarUrl: user.avatarUrl,
        profile: user.profile,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

// 2. Admin & EXCO Registration (/admin/auth)
export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    if (!settings.isAdminRegistrationActive) {
      return res.status(403).json({ error: 'Admin registration is currently turned off by EXCO.' });
    }

    const parseResult = adminRegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password, fullName, roles, phone } = parseResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await hashPassword(password);
    const joinedRoles = Array.from(new Set(roles)).join(',');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        role: joinedRoles,
        profile: {
          create: {
            goals: 'Admin & EXCO Leadership Team',
          },
        },
      },
      include: { profile: true },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      message: 'Admin account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        rolesList: user.role.split(',').map((r) => r.trim()),
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Admin registration failed' });
  }
};

// 3. Unified Login Endpoint
export const login = async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, streak: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Email not found. Please register first.' });
    }

    const userRoles = user.role.split(',').map((r) => r.trim());
    const isAdminOrFollowUp = userRoles.includes('ADMIN') || userRoles.includes('FOLLOW_UP');

    // If Admin/Follow-Up, require valid password match
    if (isAdminOrFollowUp) {
      if (!password) {
        return res.status(400).json({ error: 'Password is required for Admin/Coach login' });
      }
      if (user.passwordHash) {
        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid password credentials' });
        }
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      message: 'Sign in successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        rolesList: userRoles,
        avatarUrl: user.avatarUrl,
        profile: user.profile,
        streak: user.streak,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Login failed' });
  }
};

// 4. Public Admin Auth Status Check
export const getAdminRegistrationStatus = async (req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    return res.json({ isAdminRegistrationActive: settings.isAdminRegistrationActive });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// 5. Get Current User
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
    const rolesList = user.role.split(',').map((r) => r.trim());

    return res.json({
      user: {
        ...userWithoutPassword,
        rolesList,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
};
