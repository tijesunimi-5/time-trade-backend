import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { updateParticipantStreak } from '../utils/streak';

const prisma = new PrismaClient();

export const getTodayTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Fetch active tasks
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
      orderBy: [
        { isNonNegotiable: 'desc' },
        { displayOrder: 'asc' },
      ],
    });

    // Fetch user completions for this date
    let completions: string[] = [];
    if (userId) {
      const userCompletions = await prisma.taskCompletion.findMany({
        where: {
          participantId: userId,
          completionDate: dateStr,
        },
        select: { taskId: true },
      });
      completions = userCompletions.map((c) => c.taskId);
    }

    const tasksWithCompletion = tasks.map((task) => ({
      ...task,
      isCompleted: completions.includes(task.id),
    }));

    return res.json({
      date: dateStr,
      tasks: tasksWithCompletion,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch tasks' });
  }
};

export const toggleTaskCompletion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { taskId, completionDate, notes } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = completionDate || todayStr;

    // Interaction Guard: Cannot complete future days
    if (dateStr > todayStr) {
      return res.status(400).json({ error: 'You cannot complete tasks for future days in advance.' });
    }

    // Check if task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const existingCompletion = await prisma.taskCompletion.findUnique({
      where: {
        participantId_taskId_completionDate: {
          participantId: userId,
          taskId,
          completionDate: dateStr,
        },
      },
    });

    let completed = false;

    if (existingCompletion) {
      // Remove completion
      await prisma.taskCompletion.delete({
        where: { id: existingCompletion.id },
      });
      completed = false;
    } else {
      // Add completion
      await prisma.taskCompletion.create({
        data: {
          participantId: userId,
          taskId,
          completionDate: dateStr,
          notes,
        },
      });
      completed = true;
    }

    // Recalculate streak & progress
    const updatedStreak = await updateParticipantStreak(userId);

    return res.json({
      message: completed ? 'Task marked complete' : 'Task completion removed',
      taskId,
      completed,
      streak: updatedStreak,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to toggle task' });
  }
};

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task = await prisma.task.create({
      data: req.body,
    });
    return res.status(201).json({ task });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create task' });
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.update({
      where: { id },
      data: req.body,
    });
    return res.json({ task });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update task' });
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.task.delete({ where: { id } });
    return res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete task' });
  }
};
