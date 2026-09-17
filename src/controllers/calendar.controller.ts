import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCalendarEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: { eventDate: 'asc' },
    });
    return res.json({ events });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch calendar events' });
  }
};

export const createCalendarEvent = async (req: Request, res: Response) => {
  try {
    const event = await prisma.calendarEvent.create({ data: req.body });
    return res.status(201).json({ event });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create calendar event' });
  }
};
