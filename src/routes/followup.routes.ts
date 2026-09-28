import { Router } from 'express';
import { getAssignedParticipants, addFollowUpNote } from '../controllers/followup.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

const FOLLOW_UP_ROLES = ['FOLLOW_UP', 'ADMIN', 'LEADERSHIP', 'EXCO', 'COMMUNITY_MANAGEMENT', 'PROGRAM_PLANNING'];

router.get('/assigned', authenticateJWT, requireRole(FOLLOW_UP_ROLES), getAssignedParticipants);
router.post('/notes', authenticateJWT, requireRole(FOLLOW_UP_ROLES), addFollowUpNote);

export default router;
