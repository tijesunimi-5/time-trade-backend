import { Router } from 'express';
import { register, login, getCurrentUser } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateJWT, getCurrentUser);

export default router;
