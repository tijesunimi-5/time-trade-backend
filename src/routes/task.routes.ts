import { Router } from 'express';
import { getTodayTasks, toggleTaskCompletion, createTask, updateTask, deleteTask, reorderTasks } from '../controllers/task.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/today', authenticateJWT, getTodayTasks);
router.post('/toggle', authenticateJWT, toggleTaskCompletion);

// Admin task management
router.put('/reorder', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN', 'COMMUNITY_MANAGEMENT', 'MEDIA', 'CONTENT']), reorderTasks);
router.post('/', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), createTask);
router.put('/:id', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), updateTask);
router.delete('/:id', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), deleteTask);

export default router;
