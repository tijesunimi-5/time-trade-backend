import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

// Helper: Calculate date string for Day X given startDate (YYYY-MM-DD)
function getDateForDayNumber(startDateStr: string, dayNumber: number): string {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().split('T')[0];
}

// Helper: Calculate Day Number given startDate (YYYY-MM-DD) and target date (YYYY-MM-DD)
function getDayNumberFromDate(startDateStr: string, targetDateStr: string): number {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const target = Date.UTC(ty, tm - 1, td);
  const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

export const getCurrentProgramme = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const programme = await prisma.programme.findFirst({
      where: { isActive: true },
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            weeks: {
              orderBy: { weekNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!programme) {
      return res.status(404).json({ error: 'No active programme found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const rawDayNumber = getDayNumberFromDate(programme.startDate, todayStr);
    
    // Clamp or determine active status
    const currentDayNumber = rawDayNumber < 1 ? 1 : (rawDayNumber > 90 ? 90 : rawDayNumber);
    const currentPhaseNumber = Math.min(3, Math.max(1, Math.ceil(currentDayNumber / 30)));
    const currentWeekNumber = Math.min(12, Math.max(1, Math.ceil(currentDayNumber / 7)));

    // Fetch details for current week theme
    const currentPhase = programme.phases.find(p => p.phaseNumber === currentPhaseNumber);
    const currentWeek = currentPhase?.weeks.find(w => w.weekNumber === currentWeekNumber);

    return res.json({
      programme: {
        id: programme.id,
        title: programme.title,
        description: programme.description,
        startDate: programme.startDate,
      },
      todayDate: todayStr,
      rawDayNumber,
      currentDayNumber,
      currentPhaseNumber,
      currentWeekNumber,
      currentPhaseTitle: currentPhase?.title || 'RESET',
      currentWeekTheme: currentWeek?.theme || 'Reset Your Mindset',
      anchorResource: currentWeek?.anchorResource || 'Mindset by Carol Dweck',
      phases: programme.phases,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch current programme' });
  }
};

export const getDayDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const requestedDayNum = req.query.day ? parseInt(req.query.day as string, 10) : undefined;
    const requestedDateStr = req.query.date as string;

    const programme = await prisma.programme.findFirst({ where: { isActive: true } });
    if (!programme) return res.status(404).json({ error: 'No active programme found' });

    const todayStr = new Date().toISOString().split('T')[0];
    const activeTodayDayNum = getDayNumberFromDate(programme.startDate, todayStr);

    let targetDayNum = requestedDayNum;
    if (!targetDayNum && requestedDateStr) {
      targetDayNum = getDayNumberFromDate(programme.startDate, requestedDateStr);
    }
    if (!targetDayNum) {
      targetDayNum = activeTodayDayNum < 1 ? 1 : (activeTodayDayNum > 90 ? 90 : activeTodayDayNum);
    }

    const targetDateStr = getDateForDayNumber(programme.startDate, targetDayNum);
    const isToday = targetDateStr === todayStr;
    const isPast = targetDateStr < todayStr;
    const isFuture = targetDateStr > todayStr;

    const activePhaseNum = Math.min(3, Math.max(1, Math.ceil(activeTodayDayNum / 30)));
    const targetPhaseNum = Math.min(3, Math.max(1, Math.ceil(targetDayNum / 30)));
    const isPhaseLocked = targetPhaseNum > activePhaseNum;

    // Fetch Day from DB
    const day = await prisma.programmeDay.findFirst({
      where: { dayNumber: targetDayNum },
      include: {
        week: {
          include: {
            phase: true,
          },
        },
        tasks: {
          where: { isActive: true },
          include: {
            resource: true,
          },
          orderBy: [
            { isNonNegotiable: 'desc' },
            { displayOrder: 'asc' },
          ],
        },
      },
    });

    // Also fetch non-negotiable tasks (apply every day) if not already bound
    const nonNegotiableTasks = await prisma.task.findMany({
      where: {
        isActive: true,
        isNonNegotiable: true,
        dayId: null,
      },
      include: {
        resource: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    let allTasks = [...(day?.tasks || []), ...nonNegotiableTasks];

    // De-duplicate tasks if any overlap
    const seenIds = new Set<string>();
    allTasks = allTasks.filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    // User completion & personal tasks
    let completedTaskIds: string[] = [];
    let personalTasks: any[] = [];

    if (userId) {
      const completions = await prisma.taskCompletion.findMany({
        where: {
          participantId: userId,
          completionDate: targetDateStr,
        },
        select: { taskId: true },
      });
      completedTaskIds = completions.map(c => c.taskId);

      personalTasks = await prisma.participantPersonalTask.findMany({
        where: { participantId: userId, isActive: true },
      });
    }

    const tasksWithCompletion = allTasks.map(t => ({
      ...t,
      isCompleted: completedTaskIds.includes(t.id),
    }));

    return res.json({
      dayNumber: targetDayNum,
      targetDate: targetDateStr,
      todayDate: todayStr,
      isToday,
      isPast,
      isFuture,
      isPhaseLocked,
      dayTitle: day?.title || `Day ${targetDayNum}`,
      dayFocus: day?.focus || null,
      weekNumber: day?.week.weekNumber || Math.ceil(targetDayNum / 7),
      weekTheme: day?.week.theme || null,
      phaseTitle: day?.week.phase.title || (targetPhaseNum === 1 ? 'RESET' : targetPhaseNum === 2 ? 'RESTART' : 'REFOCUS'),
      phaseNumber: targetPhaseNum,
      tasks: tasksWithCompletion,
      personalTasks,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch day details' });
  }
};

export const getCalendarOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const programme = await prisma.programme.findFirst({
      where: { isActive: true },
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            weeks: {
              orderBy: { weekNumber: 'asc' },
              include: {
                days: {
                  orderBy: { dayNumber: 'asc' },
                  include: {
                    tasks: {
                      select: { id: true, isNonNegotiable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!programme) return res.status(404).json({ error: 'No active programme found' });

    const todayStr = new Date().toISOString().split('T')[0];
    const currentDayNum = getDayNumberFromDate(programme.startDate, todayStr);
    const activePhaseNum = Math.min(3, Math.max(1, Math.ceil(currentDayNum / 30)));

    // User completion count per completionDate if userId present
    let completionsByDate: Record<string, number> = {};
    if (userId) {
      const userCompletions = await prisma.taskCompletion.findMany({
        where: { participantId: userId },
        select: { completionDate: true },
      });
      userCompletions.forEach(c => {
        completionsByDate[c.completionDate] = (completionsByDate[c.completionDate] || 0) + 1;
      });
    }

    const phasesOverview = programme.phases.map(phase => {
      const isLocked = phase.phaseNumber > activePhaseNum;

      const weeks = phase.weeks.map(week => {
        const days = week.days.map(day => {
          const dayDateStr = getDateForDayNumber(programme.startDate, day.dayNumber);
          const totalTasks = day.tasks.length + 2; // day tasks + default non-negotiables
          const completedCount = completionsByDate[dayDateStr] || 0;
          const isToday = dayDateStr === todayStr;
          const isPast = dayDateStr < todayStr;
          const isFuture = dayDateStr > todayStr;

          return {
            id: day.id,
            dayNumber: day.dayNumber,
            title: day.title || `Day ${day.dayNumber}`,
            focus: day.focus,
            date: dayDateStr,
            isToday,
            isPast,
            isFuture,
            totalTasks,
            completedTasks: completedCount,
            isFullyCompleted: totalTasks > 0 && completedCount >= totalTasks,
          };
        });

        return {
          id: week.id,
          weekNumber: week.weekNumber,
          theme: week.theme,
          anchorResource: week.anchorResource,
          days,
        };
      });

      return {
        id: phase.id,
        phaseNumber: phase.phaseNumber,
        title: phase.title,
        durationDays: phase.durationDays,
        objective: phase.objective,
        isUnlocked: !isLocked,
        isLocked,
        weeks,
      };
    });

    return res.json({
      programme: {
        id: programme.id,
        title: programme.title,
        startDate: programme.startDate,
      },
      currentDayNumber: currentDayNum < 1 ? 1 : (currentDayNum > 90 ? 90 : currentDayNum),
      activePhaseNumber: activePhaseNum,
      todayDate: todayStr,
      phases: phasesOverview,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch calendar overview' });
  }
};

export const addPersonalTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, category, durationMinutes } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required' });

    const personalTask = await prisma.participantPersonalTask.create({
      data: {
        participantId: userId,
        title,
        category: category || 'Personal',
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 30,
      },
    });

    return res.status(201).json({ personalTask });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add personal task' });
  }
};

export const deletePersonalTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    await prisma.participantPersonalTask.deleteMany({
      where: { id, participantId: userId },
    });

    return res.json({ message: 'Personal task removed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete personal task' });
  }
};

// --- ADMIN CMS ENDPOINTS ---

export const getAdminProgrammeTree = async (req: Request, res: Response) => {
  try {
    const programme = await prisma.programme.findFirst({
      where: { isActive: true },
      include: {
        phases: {
          orderBy: { phaseNumber: 'asc' },
          include: {
            weeks: {
              orderBy: { weekNumber: 'asc' },
              include: {
                days: {
                  orderBy: { dayNumber: 'asc' },
                  include: {
                    tasks: {
                      include: { resource: true, template: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const templates = await prisma.taskTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ programme, templates, resources });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin tree' });
  }
};

export const createOrUpdateTaskTemplate = async (req: Request, res: Response) => {
  try {
    const { id, title, description, taskType, pillar, defaultRequired, defaultDurationMinutes, iconCategory } = req.body;

    if (!title || !pillar) {
      return res.status(400).json({ error: 'Title and Pillar are required' });
    }

    let template;
    if (id) {
      template = await prisma.taskTemplate.update({
        where: { id },
        data: { title, description, taskType, pillar, defaultRequired, defaultDurationMinutes, iconCategory },
      });
    } else {
      template = await prisma.taskTemplate.create({
        data: { title, description, taskType, pillar, defaultRequired, defaultDurationMinutes, iconCategory },
      });
    }

    return res.status(201).json({ template });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save template' });
  }
};

export const createOrUpdateResource = async (req: Request, res: Response) => {
  try {
    const { id, title, type, author, url, contentNotes } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and Type are required' });
    }

    let resource;
    if (id) {
      resource = await prisma.resource.update({
        where: { id },
        data: { title, type, author, url, contentNotes },
      });
    } else {
      resource = await prisma.resource.create({
        data: { title, type, author, url, contentNotes },
      });
    }

    return res.status(201).json({ resource });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save resource' });
  }
};

export const assignTaskToDay = async (req: Request, res: Response) => {
  try {
    const {
      dayId,
      templateId,
      resourceId,
      title,
      description,
      pillar,
      taskType,
      isNonNegotiable,
      pageRange,
      timestampRange,
      discussionQuestions,
      durationMinutes,
    } = req.body;

    if (!title || !pillar) {
      return res.status(400).json({ error: 'Title and Pillar are required' });
    }

    const task = await prisma.task.create({
      data: {
        dayId: dayId || null,
        templateId: templateId || null,
        resourceId: resourceId || null,
        title,
        description: description || '',
        pillar,
        taskType: taskType || 'GROWTH',
        isNonNegotiable: isNonNegotiable || false,
        pageRange,
        timestampRange,
        discussionQuestions,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 15,
      },
      include: { resource: true },
    });

    return res.status(201).json({ task });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to assign task to day' });
  }
};
