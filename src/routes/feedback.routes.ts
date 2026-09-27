import { Router } from 'express';
import {
  submitFeedback,
  getMyFeedback,
  getAllFeedbackAdmin,
  respondToFeedbackAdmin,
} from '../controllers/feedback.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

const EXCO_ADMIN_ROLES = [
  'ADMIN',
  'LEADERSHIP',
  'FOLLOW_UP',
  'PROGRAM_PLANNING',
  'MEDIA',
  'CONTENT',
  'COMMUNITY_MANAGEMENT',
];

// User routes (all authenticated users)
router.post('/', authenticateJWT, submitFeedback);
router.get('/my', authenticateJWT, getMyFeedback);

// Admin/Exco routes
router.get('/admin', authenticateJWT, requireRole(EXCO_ADMIN_ROLES), getAllFeedbackAdmin);
router.put('/admin/:id/respond', authenticateJWT, requireRole(EXCO_ADMIN_ROLES), respondToFeedbackAdmin);

export default router;
