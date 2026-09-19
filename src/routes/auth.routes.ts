import { Router } from 'express';
import {
  registerParticipant,
  registerAdmin,
  getAdminRegistrationStatus,
  login,
  getCurrentUser,
} from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', registerParticipant);
router.post('/admin/register', registerAdmin);
router.get('/admin/status', getAdminRegistrationStatus);
router.post('/login', login);
router.get('/me', authenticateJWT, getCurrentUser);

export default router;
