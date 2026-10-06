import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  description: z.string().min(5, 'Task description is required'),
  pillar: z.enum(['SPIRITUAL', 'SOCIAL', 'MENTAL']),
  category: z.string().optional(),
  frequencyType: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ONE_TIME', 'RECURRING']).default('DAILY'),
  isNonNegotiable: z.boolean().default(false),
  isOptional: z.boolean().default(false),
  dayNumber: z.number().int().optional(),
  weekNumber: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  resourceUrl: z.string().url().optional().or(z.literal('')),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().optional().default(15),
  isAutoIncrement: z.boolean().optional(),
  startUnit: z.number().int().optional(),
  startDayNumber: z.number().int().optional(),
  unitsPerDay: z.number().int().optional(),
  unitType: z.string().optional(),
  bookName: z.string().optional(),
  resourceId: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
});

export const toggleTaskCompletionSchema = z.object({
  taskId: z.string().uuid(),
  completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().optional(),
});
