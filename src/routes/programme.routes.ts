import { Router } from 'express';
import {
  getCurrentProgramme,
  getDayDetails,
  getCalendarOverview,
  addPersonalTask,
  deletePersonalTask,
  getAdminProgrammeTree,
  createOrUpdateTaskTemplate,
  createOrUpdateResource,
  assignTaskToDay,
} from '../controllers/programme.controller';
import { authenticateJWT, optionalJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Public / Participant Routes
router.get('/current', optionalJWT, getCurrentProgramme);
router.get('/day', optionalJWT, getDayDetails);
router.get('/calendar', optionalJWT, getCalendarOverview);

// Personal Habits / Custom Tasks
router.post('/personal-task', authenticateJWT, addPersonalTask);
router.delete('/personal-task/:id', authenticateJWT, deletePersonalTask);

// Admin CMS Routes (Curators: PROGRAM_PLANNING, LEADERSHIP, ADMIN)
router.get('/admin/tree', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), getAdminProgrammeTree);
router.post('/admin/template', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), createOrUpdateTaskTemplate);
router.post('/admin/resource', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), createOrUpdateResource);
router.post('/admin/assign-task', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), assignTaskToDay);

export default router;
