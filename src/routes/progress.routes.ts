import { Router } from 'express';
import { getParticipantProgress } from '../controllers/progress.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, getParticipantProgress);

export default router;
