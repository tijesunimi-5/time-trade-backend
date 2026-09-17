import { Router } from 'express';
import { getAssignedParticipants, addFollowUpNote } from '../controllers/followup.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/assigned', authenticateJWT, requireRole(['FOLLOW_UP', 'ADMIN']), getAssignedParticipants);
router.post('/notes', authenticateJWT, requireRole(['FOLLOW_UP', 'ADMIN']), addFollowUpNote);

export default router;
