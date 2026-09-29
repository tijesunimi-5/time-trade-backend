import { Router } from 'express';
import {
  createPoll,
  updatePoll,
  getAdminPolls,
  updatePollStatus,
  deletePoll,
  getActiveStandalonePolls,
  getTaskPoll,
  votePoll,
} from '../controllers/poll.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Participant endpoints
router.get('/active', authenticateJWT, getActiveStandalonePolls);
router.get('/task/:taskId', authenticateJWT, getTaskPoll);
router.post('/:id/vote', authenticateJWT, votePoll);

// EXCO & Admin endpoints
router.get('/admin', authenticateJWT, requireRole(['LEADERSHIP', 'ADMIN', 'PROGRAM_PLANNING', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), getAdminPolls);
router.post('/', authenticateJWT, requireRole(['LEADERSHIP', 'ADMIN', 'PROGRAM_PLANNING', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), createPoll);
router.put('/:id', authenticateJWT, requireRole(['LEADERSHIP', 'ADMIN', 'PROGRAM_PLANNING', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), updatePoll);
router.patch('/:id/status', authenticateJWT, requireRole(['LEADERSHIP', 'ADMIN', 'PROGRAM_PLANNING', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), updatePollStatus);
router.delete('/:id', authenticateJWT, requireRole(['LEADERSHIP', 'ADMIN', 'PROGRAM_PLANNING', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), deletePoll);

export default router;
