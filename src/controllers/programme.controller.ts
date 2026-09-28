import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import fs from 'fs';
import path from 'path';
import { generateSmartMotivationalMessage } from './leaderboard.controller';

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

// Helper: Ensure an active programme exists in database, or create default 90-day architecture
export async function getOrEnsureActiveProgramme() {
  let programme = await prisma.programme.findFirst({
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
                    where: { isActive: true },
                    include: { resource: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!programme) {
    const todayStr = new Date().toISOString().split('T')[0];
    await prisma.programme.create({
      data: {
        title: 'TIME TRADE 90-Day Personal Growth Challenge',
        description: 'A structured personal growth journey configured dynamically.',
        startDate: todayStr,
        isActive: true,
      },
    });

    programme = await prisma.programme.findFirst({
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
                      where: { isActive: true },
                      include: { resource: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  return programme!;
}

export const getCurrentProgramme = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const programme = await getOrEnsureActiveProgramme();

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
        isLive: programme.isLive,
      },
      isLive: programme.isLive,
      todayDate: todayStr,
      rawDayNumber: programme.isLive ? rawDayNumber : 0,
      currentDayNumber: programme.isLive ? currentDayNumber : 0,
      currentPhaseNumber: programme.isLive ? currentPhaseNumber : 0,
      currentWeekNumber: programme.isLive ? currentWeekNumber : 0,
      currentPhaseTitle: programme.isLive ? (currentPhase?.title || null) : null,
      currentWeekTheme: programme.isLive ? (currentWeek?.theme || null) : null,
      anchorResource: programme.isLive ? (currentWeek?.anchorResource || null) : null,
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

    const programme = await getOrEnsureActiveProgramme();

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

    // User completion, personal tasks & daily journal note
    let completedTaskIds: string[] = [];
    let personalTasks: any[] = [];
    let userJournalNote = '';

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

      const noteObj = await prisma.dailyJournalNote.findUnique({
        where: {
          participantId_noteDate: {
            participantId: userId,
            noteDate: targetDateStr,
          },
        },
      });
      if (noteObj) userJournalNote = noteObj.content;
    }

    const tasksWithCompletion = allTasks.map(t => ({
      ...t,
      isCompleted: completedTaskIds.includes(t.id),
    }));

    let smartMotivationalBanner = null;
    if (userId && programme.isLive) {
      try {
        const allUsers = await prisma.user.findMany({ select: { id: true, fullName: true, role: true, streak: true } });
        const EXCO_ROLES = ['ADMIN', 'LEADERSHIP', 'FOLLOW_UP', 'PROGRAM_PLANNING', 'MEDIA', 'CONTENT', 'COMMUNITY_MANAGEMENT'];
        const participants = allUsers.filter(u => !u.role?.split(',').some(r => EXCO_ROLES.includes(r.trim().toUpperCase())));

        const completions = await prisma.taskCompletion.findMany({
          where: { completionDate: targetDateStr },
          select: { participantId: true, completedAt: true },
        });

        const userCompMap: Record<string, { count: number; latestTime: number }> = {};
        completions.forEach(c => {
          const time = new Date(c.completedAt).getTime();
          if (!userCompMap[c.participantId]) {
            userCompMap[c.participantId] = { count: 1, latestTime: time };
          } else {
            userCompMap[c.participantId].count += 1;
            if (time > userCompMap[c.participantId].latestTime) {
              userCompMap[c.participantId].latestTime = time;
            }
          }
        });

        const candidateList = participants.map(u => {
          const comp = userCompMap[u.id] || { count: 0, latestTime: Infinity };
          return { user: u, credits: comp.count * 5, completedTasks: comp.count, latestTime: comp.latestTime };
        }).sort((a, b) => {
          if (b.credits !== a.credits) return b.credits - a.credits;
          if (a.latestTime !== b.latestTime) return a.latestTime - b.latestTime;
          return a.user.fullName.localeCompare(b.user.fullName);
        });

        const userRankIndex = candidateList.findIndex(c => c.user.id === userId);
        const userObj = allUsers.find(u => u.id === userId);
        const userCompCount = completedTaskIds.length;

        if (userRankIndex !== -1) {
          const userItem = candidateList[userRankIndex];
          const rank1Item = candidateList[0];

          smartMotivationalBanner = generateSmartMotivationalMessage({
            userRank: userRankIndex + 1,
            totalParticipants: candidateList.length,
            userCredits: userCompCount * 5,
            completedTasks: userCompCount,
            totalTasks: tasksWithCompletion.length || 5,
            leaderName: rank1Item ? rank1Item.user.fullName : 'Competitor',
            leaderCredits: rank1Item ? rank1Item.credits : 0,
            userStreak: userObj?.streak?.currentStreak || 0,
            userName: userObj?.fullName || 'Participant',
          });
        }
      } catch (e) {
        console.error('Failed to generate smart banner:', e);
      }
    }

    return res.json({
      dayNumber: targetDayNum,
      targetDate: targetDateStr,
      todayDate: todayStr,
      isLive: programme.isLive,
      isToday: programme.isLive ? isToday : false,
      isPast: programme.isLive ? isPast : false,
      isFuture: programme.isLive ? isFuture : true,
      isPhaseLocked: programme.isLive ? isPhaseLocked : false,
      dayTitle: day?.title || `Day ${targetDayNum}`,
      dayFocus: day?.focus || null,
      weekNumber: day?.week.weekNumber || Math.ceil(targetDayNum / 7),
      weekTheme: day?.week.theme || null,
      phaseTitle: day?.week.phase.title || null,
      phaseNumber: targetPhaseNum,
      tasks: tasksWithCompletion,
      personalTasks,
      journalNote: userJournalNote,
      smartMotivationalBanner,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch day details' });
  }
};

export const getCalendarOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const programme = await getOrEnsureActiveProgramme();

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
    const programme = await getOrEnsureActiveProgramme();

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
    const { id, title, description, taskType, pillar, timeOfDay, defaultRequired, defaultDurationMinutes, iconCategory } = req.body;

    if (!title || !pillar) {
      return res.status(400).json({ error: 'Title and Pillar are required' });
    }

    let template;
    if (id) {
      template = await prisma.taskTemplate.update({
        where: { id },
        data: { title, description, taskType, pillar, timeOfDay: timeOfDay || 'ANYTIME', defaultRequired, defaultDurationMinutes, iconCategory },
      });
    } else {
      template = await prisma.taskTemplate.create({
        data: { title, description, taskType, pillar, timeOfDay: timeOfDay || 'ANYTIME', defaultRequired, defaultDurationMinutes, iconCategory },
      });
    }

    return res.status(201).json({ template });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save template' });
  }
};

export const uploadResourceFile = async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let base64Content = fileData;
    if (fileData.includes(';base64,')) {
      base64Content = fileData.split(';base64,')[1];
    }

    const cleanFileName = `${Date.now()}-${(fileName || 'file.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadsDir, cleanFileName);

    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${cleanFileName}`;
    return res.json({
      message: 'File uploaded successfully',
      fileUrl: relativeUrl,
      fileName: fileName || cleanFileName,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to upload resource file' });
  }
};

export const createOrUpdateResource = async (req: Request, res: Response) => {
  try {
    const { id, title, type, author, url, fileUrl, fileName, accessType, contentNotes } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and Type are required' });
    }

    let resource;
    if (id) {
      resource = await prisma.resource.update({
        where: { id },
        data: {
          title,
          type,
          author: author || null,
          url: url || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          accessType: accessType || (fileUrl ? 'FILE' : 'LINK'),
          contentNotes,
        },
      });
    } else {
      resource = await prisma.resource.create({
        data: {
          title,
          type,
          author: author || null,
          url: url || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          accessType: accessType || (fileUrl ? 'FILE' : 'LINK'),
          contentNotes,
        },
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
      timeOfDay,
      isNonNegotiable,
      pageRange,
      timestampRange,
      discussionQuestions,
      durationMinutes,
      resourceUrl,
      fileUrl,
      fileName,
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
        timeOfDay: timeOfDay || 'ANYTIME',
        isNonNegotiable: isNonNegotiable || false,
        pageRange,
        timestampRange,
        discussionQuestions,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 15,
        resourceUrl: resourceUrl || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
      },
      include: { resource: true },
    });

    return res.status(201).json({ task });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to assign task to day' });
  }
};

export const deleteTaskTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.taskTemplate.delete({ where: { id } });
    return res.json({ message: 'Task template deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete template' });
  }
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.resource.delete({ where: { id } });
    return res.json({ message: 'Resource deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete resource' });
  }
};

// --- PHASE, WEEK, DAY CRUD ---
export const createOrUpdatePhase = async (req: Request, res: Response) => {
  try {
    const { id, programmeId, title, phaseNumber, durationDays, objective, isUnlocked } = req.body;
    if (!title || phaseNumber === undefined) {
      return res.status(400).json({ error: 'Phase title and phaseNumber are required' });
    }

    const prog = await getOrEnsureActiveProgramme();
    const targetProgrammeId = programmeId || prog.id;

    let phase;
    if (id) {
      phase = await prisma.programmePhase.update({
        where: { id },
        data: {
          title,
          phaseNumber: parseInt(phaseNumber, 10),
          durationDays: durationDays ? parseInt(durationDays, 10) : 30,
          objective,
          isUnlocked: isUnlocked !== undefined ? !!isUnlocked : true,
        },
      });
    } else {
      phase = await prisma.programmePhase.create({
        data: {
          programmeId: targetProgrammeId,
          title,
          phaseNumber: parseInt(phaseNumber, 10),
          durationDays: durationDays ? parseInt(durationDays, 10) : 30,
          objective,
          isUnlocked: isUnlocked !== undefined ? !!isUnlocked : true,
        },
      });
    }

    return res.status(201).json({ phase });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save phase' });
  }
};

export const deletePhase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.programmePhase.delete({ where: { id } });
    return res.json({ message: 'Phase deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete phase' });
  }
};

export const createOrUpdateWeek = async (req: Request, res: Response) => {
  try {
    const { id, phaseId, weekNumber, theme, objective, keyAreas, anchorResource } = req.body;
    if (!phaseId || !theme || weekNumber === undefined) {
      return res.status(400).json({ error: 'phaseId, theme, and weekNumber are required' });
    }

    let week;
    if (id) {
      week = await prisma.programmeWeek.update({
        where: { id },
        data: {
          phaseId,
          weekNumber: parseInt(weekNumber, 10),
          theme,
          objective,
          keyAreas,
          anchorResource: anchorResource || null,
        },
      });
    } else {
      week = await prisma.programmeWeek.create({
        data: {
          phaseId,
          weekNumber: parseInt(weekNumber, 10),
          theme,
          objective,
          keyAreas,
          anchorResource: anchorResource || null,
        },
      });
    }

    return res.status(201).json({ week });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save week' });
  }
};

export const deleteWeek = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.programmeWeek.delete({ where: { id } });
    return res.json({ message: 'Week deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete week' });
  }
};

export const createOrUpdateDay = async (req: Request, res: Response) => {
  try {
    const { id, weekId, dayNumber, dayOfWeek, title, focus } = req.body;
    if (!weekId || dayNumber === undefined) {
      return res.status(400).json({ error: 'weekId and dayNumber are required' });
    }

    let day;
    if (id) {
      day = await prisma.programmeDay.update({
        where: { id },
        data: {
          weekId,
          dayNumber: parseInt(dayNumber, 10),
          dayOfWeek,
          title: title || `Day ${dayNumber}`,
          focus,
        },
      });
    } else {
      day = await prisma.programmeDay.create({
        data: {
          weekId,
          dayNumber: parseInt(dayNumber, 10),
          dayOfWeek,
          title: title || `Day ${dayNumber}`,
          focus,
        },
      });
    }

    return res.status(201).json({ day });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save day' });
  }
};

export const deleteDay = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.programmeDay.delete({ where: { id } });
    return res.json({ message: 'Day deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete day' });
  }
};

export const getPublicResources = async (req: Request, res: Response) => {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ resources });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch public resources' });
  }
};

export const commenceProgramme = async (req: Request, res: Response) => {
  try {
    const { isLive, startDate, clientDate, targetDayNumber } = req.body;
    const programme = await getOrEnsureActiveProgramme();

    let newStartDate = startDate;
    if (!newStartDate) {
      const baseDateStr = clientDate || new Date().toISOString().split('T')[0];
      const targetDay = targetDayNumber ? parseInt(targetDayNumber, 10) : 1;
      const [y, m, d] = baseDateStr.split('-').map(Number);
      const baseDate = new Date(Date.UTC(y, m - 1, d));
      baseDate.setUTCDate(baseDate.getUTCDate() - (targetDay - 1));
      newStartDate = baseDate.toISOString().split('T')[0];
    }

    const updatedProgramme = await prisma.programme.update({
      where: { id: programme.id },
      data: {
        isLive: typeof isLive === 'boolean' ? isLive : true,
        startDate: newStartDate,
      },
    });

    return res.json({
      message: updatedProgramme.isLive
        ? `90-Day Challenge officially COMMENCED & LIVE! Active Day: ${targetDayNumber || 1}`
        : '90-Day Challenge status updated to DRAFT.',
      programme: updatedProgramme,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update challenge status' });
  }
};

export const resetProgramme = async (req: Request, res: Response) => {
  try {
    const { targetDayNumber, clientDate, startDate } = req.body;
    const programme = await getOrEnsureActiveProgramme();

    let newStartDate = startDate;
    const targetDay = targetDayNumber ? parseInt(targetDayNumber, 10) : 1;

    if (!newStartDate) {
      const baseDateStr = clientDate || new Date().toISOString().split('T')[0];
      const [y, m, d] = baseDateStr.split('-').map(Number);
      const baseDate = new Date(Date.UTC(y, m - 1, d));
      baseDate.setUTCDate(baseDate.getUTCDate() - (targetDay - 1));
      newStartDate = baseDate.toISOString().split('T')[0];
    }

    const updatedProgramme = await prisma.programme.update({
      where: { id: programme.id },
      data: {
        isLive: true,
        startDate: newStartDate,
      },
    });

    return res.json({
      message: `Challenge calendar successfully calibrated! Today is now Day ${targetDay}.`,
      programme: updatedProgramme,
      currentDayNumber: targetDay,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reset challenge calendar' });
  }
};

export const saveJournalNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { noteDate, dayNumber, content } = req.body;
    const dateStr = noteDate || new Date().toISOString().split('T')[0];

    const journalNote = await prisma.dailyJournalNote.upsert({
      where: {
        participantId_noteDate: {
          participantId: userId,
          noteDate: dateStr,
        },
      },
      update: {
        content: content || '',
        dayNumber: dayNumber ? parseInt(dayNumber, 10) : undefined,
      },
      create: {
        participantId: userId,
        noteDate: dateStr,
        dayNumber: dayNumber ? parseInt(dayNumber, 10) : undefined,
        content: content || '',
      },
    });

    return res.json({ message: 'Journal reflection saved successfully', journalNote });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save journal note' });
  }
};

export const getJournalNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const journalNote = await prisma.dailyJournalNote.findUnique({
      where: {
        participantId_noteDate: {
          participantId: userId,
          noteDate: dateStr,
        },
      },
    });

    return res.json({ journalNote: journalNote?.content || '' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch journal note' });
  }
};

