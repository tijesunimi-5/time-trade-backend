import { z } from 'zod';

export const participantRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  ageRange: z.string().optional(),
  expectations: z.string().optional(),
  goals: z.string().optional(),
  customAnswers: z.record(z.any()).optional(),
});

export const adminRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  roles: z.array(z.string()).min(1, 'At least one role must be selected'),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().optional(),
});
