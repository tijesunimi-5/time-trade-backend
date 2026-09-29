import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to format poll data with percentages and user vote status
const formatPollForUser = (poll: any, userId?: string) => {
  const totalVotesCount = poll.votes?.length || 0;

  // Distinct voters count (in case allowMultiple is true)
  const distinctVoters = new Set(poll.votes?.map((v: any) => v.userId)).size;

  const userVotedOptionIds = userId
    ? poll.votes?.filter((v: any) => v.userId === userId).map((v: any) => v.optionId) || []
    : [];

  const options = poll.options.map((opt: any) => {
    const optionVotes = poll.votes?.filter((v: any) => v.optionId === opt.id) || [];
    const voteCount = optionVotes.length;
    // Percentage calculated based on total distinct voters (or total option votes)
    const percentage = distinctVoters > 0 ? Math.round((voteCount / distinctVoters) * 100) : 0;
    const hasVoted = userVotedOptionIds.includes(opt.id);

    return {
      id: opt.id,
      text: opt.text,
      displayOrder: opt.displayOrder,
      voteCount,
      percentage,
      hasVoted,
    };
  });

  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    allowMultiple: poll.allowMultiple,
    isStandalone: poll.isStandalone,
    showAsPopup: poll.showAsPopup,
    dayNumber: poll.dayNumber || null,
    taskId: poll.taskId,
    taskTitle: poll.task?.title || null,
    status: poll.status,
    createdAt: poll.createdAt,
    totalVotes: distinctVoters,
    totalOptionVotes: totalVotesCount,
    hasVoted: userVotedOptionIds.length > 0,
    userVotedOptionIds,
    options,
  };
};

// 1. CREATE POLL (Admin / EXCO)
export const createPoll = async (req: Request, res: Response) => {
  try {
    const { question, description, allowMultiple, isStandalone, showAsPopup, dayNumber, taskId, options } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Poll question is required' });
    }

    if (!Array.isArray(options) || options.filter((o: string) => o && o.trim()).length < 2) {
      return res.status(400).json({ error: 'At least 2 non-empty options are required' });
    }

    const cleanOptions = options.map((o: string) => o.trim()).filter((o: string) => o.length > 0);

    const poll = await prisma.poll.create({
      data: {
        question: question.trim(),
        description: description?.trim() || null,
        allowMultiple: Boolean(allowMultiple),
        isStandalone: Boolean(isStandalone),
        showAsPopup: Boolean(showAsPopup),
        dayNumber: dayNumber ? parseInt(String(dayNumber), 10) : null,
        taskId: taskId || null,
        status: 'ACTIVE',
        createdById: (req as any).user?.userId || (req as any).user?.id || null,
        options: {
          create: cleanOptions.map((text: string, index: number) => ({
            text,
            displayOrder: index + 1,
          })),
        },
      },
      include: {
        options: true,
        votes: true,
        task: true,
      },
    });

    return res.status(201).json({
      message: 'Poll created successfully',
      poll: formatPollForUser(poll, (req as any).user?.userId || (req as any).user?.id),
    });
  } catch (error: any) {
    console.error('Error creating poll:', error);
    return res.status(500).json({ error: 'Failed to create poll' });
  }
};

// UPDATE POLL DETAILS & REORDER OPTIONS (Admin / EXCO)
export const updatePoll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question, description, allowMultiple, isStandalone, showAsPopup, dayNumber, taskId, status, options } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Poll question is required' });
    }

    if (!Array.isArray(options) || options.filter((o: any) => (typeof o === 'string' ? o.trim() : o?.text?.trim())).length < 2) {
      return res.status(400).json({ error: 'At least 2 non-empty options are required' });
    }

    const existingPoll = await prisma.poll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const normalizedOptions = options.map((opt: any, index: number) => {
      if (typeof opt === 'string') {
        return { text: opt.trim(), displayOrder: index + 1 };
      }
      return {
        id: opt.id || undefined,
        text: opt.text?.trim() || '',
        displayOrder: typeof opt.displayOrder === 'number' ? opt.displayOrder : index + 1,
      };
    }).filter((opt) => opt.text.length > 0);

    await prisma.poll.update({
      where: { id },
      data: {
        question: question.trim(),
        description: description?.trim() || null,
        allowMultiple: Boolean(allowMultiple),
        isStandalone: Boolean(isStandalone),
        showAsPopup: Boolean(showAsPopup),
        dayNumber: dayNumber ? parseInt(String(dayNumber), 10) : null,
        taskId: taskId || null,
        status: status || existingPoll.status,
      },
    });

    const keepOptionIds = normalizedOptions.filter((o) => o.id).map((o) => o.id as string);

    await prisma.pollOption.deleteMany({
      where: {
        pollId: id,
        id: { notIn: keepOptionIds },
      },
    });

    for (const opt of normalizedOptions) {
      if (opt.id) {
        await prisma.pollOption.update({
          where: { id: opt.id },
          data: {
            text: opt.text,
            displayOrder: opt.displayOrder,
          },
        });
      } else {
        await prisma.pollOption.create({
          data: {
            pollId: id,
            text: opt.text,
            displayOrder: opt.displayOrder,
          },
        });
      }
    }

    const updatedPoll = await prisma.poll.findUnique({
      where: { id },
      include: {
        options: { orderBy: { displayOrder: 'asc' } },
        votes: true,
        task: true,
      },
    });

    return res.json({
      message: 'Poll updated successfully',
      poll: formatPollForUser(updatedPoll, (req as any).user?.userId || (req as any).user?.id),
    });
  } catch (error: any) {
    console.error('Error updating poll:', error);
    return res.status(500).json({ error: 'Failed to update poll' });
  }
};

// 2. GET ALL POLLS (Admin / EXCO)
export const getAdminPolls = async (req: Request, res: Response) => {
  try {
    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            pillar: true,
          },
        },
      },
    });

    const formattedPolls = polls.map((poll) => {
      const distinctVoters = new Set(poll.votes.map((v) => v.userId)).size;
      const optionsWithDetails = poll.options.map((opt) => {
        const optionVotes = poll.votes.filter((v) => v.optionId === opt.id);
        const voteCount = optionVotes.length;
        const percentage = distinctVoters > 0 ? Math.round((voteCount / distinctVoters) * 100) : 0;

        return {
          id: opt.id,
          text: opt.text,
          displayOrder: opt.displayOrder,
          voteCount,
          percentage,
          voters: optionVotes.map((v) => ({
            id: v.user.id,
            fullName: v.user.fullName,
            email: v.user.email,
          })),
        };
      });

      return {
        id: poll.id,
        question: poll.question,
        description: poll.description,
        allowMultiple: poll.allowMultiple,
        isStandalone: poll.isStandalone,
        showAsPopup: poll.showAsPopup,
        dayNumber: poll.dayNumber || null,
        status: poll.status,
        taskId: poll.taskId,
        taskTitle: poll.task?.title || null,
        createdAt: poll.createdAt,
        totalVotersCount: distinctVoters,
        totalVotesCount: poll.votes.length,
        options: optionsWithDetails,
      };
    });

    return res.json({ polls: formattedPolls });
  } catch (error: any) {
    console.error('Error fetching admin polls:', error);
    return res.status(500).json({ error: 'Failed to fetch admin polls' });
  }
};

// 3. UPDATE POLL STATUS (Admin / EXCO)
export const updatePollStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'CLOSED', 'DRAFT'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be ACTIVE, CLOSED, or DRAFT' });
    }

    const updated = await prisma.poll.update({
      where: { id },
      data: { status },
    });

    return res.json({ message: 'Poll status updated successfully', poll: updated });
  } catch (error: any) {
    console.error('Error updating poll status:', error);
    return res.status(500).json({ error: 'Failed to update poll status' });
  }
};

// 4. DELETE POLL (Admin / EXCO)
export const deletePoll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.poll.delete({
      where: { id },
    });

    return res.json({ message: 'Poll deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting poll:', error);
    return res.status(500).json({ error: 'Failed to delete poll' });
  }
};

// 5. GET ACTIVE STANDALONE & POPUP POLLS (Participants)
export const getActiveStandalonePolls = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const polls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { isStandalone: true },
          { showAsPopup: true },
          { dayNumber: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        votes: true,
        task: true,
      },
    });

    const formatted = polls.map((p) => formatPollForUser(p, userId));

    return res.json({ polls: formatted });
  } catch (error: any) {
    console.error('Error fetching active standalone polls:', error);
    return res.status(500).json({ error: 'Failed to fetch active polls' });
  }
};

// 6. GET POLL ATTACHED TO A SPECIFIC TASK (Participants)
export const getTaskPoll = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    const poll = await prisma.poll.findFirst({
      where: {
        taskId,
        status: 'ACTIVE',
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        votes: true,
        task: true,
      },
    });

    if (!poll) {
      return res.json({ poll: null });
    }

    return res.json({ poll: formatPollForUser(poll, userId) });
  } catch (error: any) {
    console.error('Error fetching task poll:', error);
    return res.status(500).json({ error: 'Failed to fetch task poll' });
  }
};

// 7. VOTE ON A POLL (Participants)
export const votePoll = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Poll ID
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { optionIds } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ error: 'At least one option selection is required' });
    }

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'This poll is currently closed for voting' });
    }

    // Validate option IDs belong to this poll
    const validOptionIds = poll.options.map((o) => o.id);
    const selectedValidOptionIds = optionIds.filter((optId: string) => validOptionIds.includes(optId));

    if (selectedValidOptionIds.length === 0) {
      return res.status(400).json({ error: 'Invalid option selected for this poll' });
    }

    // Enforce allowMultiple flag
    const finalSelectedOptionIds = poll.allowMultiple
      ? selectedValidOptionIds
      : [selectedValidOptionIds[0]];

    // Execute atomic transaction: clear old votes for this user on this poll, then add new votes
    await prisma.$transaction([
      prisma.pollVote.deleteMany({
        where: {
          pollId: id,
          userId,
        },
      }),
      prisma.pollVote.createMany({
        data: finalSelectedOptionIds.map((optionId: string) => ({
          pollId: id,
          optionId,
          userId,
        })),
      }),
    ]);

    // Fetch updated poll
    const updatedPoll = await prisma.poll.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        votes: true,
        task: true,
      },
    });

    return res.json({
      message: 'Vote recorded successfully',
      poll: formatPollForUser(updatedPoll, userId),
    });
  } catch (error: any) {
    console.error('Error recording vote:', error);
    return res.status(500).json({ error: 'Failed to record vote' });
  }
};
