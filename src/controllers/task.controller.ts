import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { updateParticipantStreak } from '../utils/streak';
import { calculateAutoIncrementReading } from '../utils/readingPlan';
import { getOrEnsureActiveProgramme } from './programme.controller';

const prisma = new PrismaClient();

function getTimeOfDayPriority(timeOfDay?: string | null): number {
  if (!timeOfDay) return 2;
  const upper = timeOfDay.trim().toUpperCase();
  if (upper === 'MORNING') return 1;
  if (upper === 'NIGHT' || upper === 'EVENING') return 3;
  return 2; // Normal (ANYTIME, AFTERNOON, etc.)
}

export const getTodayTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const programme = await getOrEnsureActiveProgramme();
    const [sy, sm, sd] = programme.startDate.split('-').map(Number);
    const [ty, tm, td] = dateStr.split('-').map(Number);
    const start = Date.UTC(sy, sm - 1, sd);
    const target = Date.UTC(ty, tm - 1, td);
    const dayNumber = Math.max(1, Math.floor((target - start) / (1000 * 60 * 60 * 24)) + 1);

    // Fetch active tasks
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
      include: { resource: true },
      orderBy: { displayOrder: 'asc' },
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

    const tasksWithCompletion = tasks.map((task) => {
      const isAuto = task.isAutoIncrement || task.resource?.isAutoIncrement || task.resource?.type === 'BIBLE';
      let autoIncrementInfo = null;
      let dynamicPageRange = task.pageRange;
      let dynamicResourceUrl = task.resourceUrl || task.resource?.url;

      if (isAuto) {
        autoIncrementInfo = calculateAutoIncrementReading({
          dayNumber,
          startUnit: task.startUnit ?? task.resource?.startUnit,
          unitsPerDay: task.unitsPerDay ?? task.resource?.unitsPerDay,
          unitType: task.unitType || task.resource?.unitType,
          bookName: task.bookName || task.resource?.bookName || task.title,
          bibleVersion: task.resource?.bibleVersion,
          baseUrlOrTemplate: task.resource?.bibleUrlTemplate || task.resource?.url || task.resourceUrl,
          resourceType: task.resource?.type,
        });

        dynamicPageRange = autoIncrementInfo.calculatedRange;
        if (autoIncrementInfo.calculatedUrl) {
          dynamicResourceUrl = autoIncrementInfo.calculatedUrl;
        }
      }

      return {
        ...task,
        pageRange: dynamicPageRange,
        resourceUrl: dynamicResourceUrl,
        autoIncrementInfo,
        isCompleted: completions.includes(task.id),
      };
    });

    // Structure tasks: Morning (1) -> Normal (2) -> Night (3)
    tasksWithCompletion.sort((a, b) => {
      const pA = getTimeOfDayPriority(a.timeOfDay);
      const pB = getTimeOfDayPriority(b.timeOfDay);
      if (pA !== pB) return pA - pB;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

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
    const {
      dayId,
      templateId,
      resourceId,
      title,
      description,
      pillar,
      taskType,
      timeOfDay,
      isNonNegotiable,
      pageRange,
      timestampRange,
      discussionQuestions,
      durationMinutes,
      resourceUrl,
      fileUrl,
      fileName,
      isActive,
    } = req.body;

    const dataToUpdate: any = {};
    if (dayId !== undefined) dataToUpdate.dayId = dayId || null;
    if (templateId !== undefined) dataToUpdate.templateId = templateId || null;
    if (resourceId !== undefined) dataToUpdate.resourceId = resourceId || null;
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (pillar !== undefined) dataToUpdate.pillar = pillar;
    if (taskType !== undefined) dataToUpdate.taskType = taskType;
    if (timeOfDay !== undefined) dataToUpdate.timeOfDay = timeOfDay || 'ANYTIME';
    if (isNonNegotiable !== undefined) dataToUpdate.isNonNegotiable = !!isNonNegotiable;
    if (pageRange !== undefined) dataToUpdate.pageRange = pageRange || null;
    if (timestampRange !== undefined) dataToUpdate.timestampRange = timestampRange || null;
    if (discussionQuestions !== undefined) dataToUpdate.discussionQuestions = discussionQuestions || null;
    if (durationMinutes !== undefined) dataToUpdate.durationMinutes = durationMinutes ? parseInt(durationMinutes, 10) : undefined;
    if (resourceUrl !== undefined) dataToUpdate.resourceUrl = resourceUrl || null;
    if (fileUrl !== undefined) dataToUpdate.fileUrl = fileUrl || null;
    if (fileName !== undefined) dataToUpdate.fileName = fileName || null;
    if (isActive !== undefined) dataToUpdate.isActive = !!isActive;

    const task = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
      include: { resource: true },
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

export const reorderTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskOrders } = req.body;
    if (!Array.isArray(taskOrders) || taskOrders.length === 0) {
      return res.status(400).json({ error: 'taskOrders array is required' });
    }

    await prisma.$transaction(
      taskOrders.map((item: { id: string; displayOrder: number }) =>
        prisma.task.update({
          where: { id: item.id },
          data: { displayOrder: Number(item.displayOrder) || 0 },
        })
      )
    );

    return res.json({ message: 'Tasks reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering tasks:', error);
    return res.status(500).json({ error: error.message || 'Failed to reorder tasks' });
  }
};
