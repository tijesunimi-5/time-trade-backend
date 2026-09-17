import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().optional(),
  role: z.enum(['PARTICIPANT', 'FOLLOW_UP', 'ADMIN']).optional().default('PARTICIPANT'),
  ageRange: z.string().optional(),
  goals: z.string().optional(),
  expectations: z.string().optional(),
  customAnswers: z.record(z.any()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
