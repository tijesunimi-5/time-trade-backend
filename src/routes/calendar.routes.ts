import { Router } from 'express';
import { getCalendarEvents, createCalendarEvent } from '../controllers/calendar.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getCalendarEvents);
router.post('/', authenticateJWT, requireRole(['ADMIN']), createCalendarEvent);

export default router;
