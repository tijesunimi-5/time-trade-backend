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
  deleteTaskTemplate,
  deleteResource,
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
router.delete('/admin/template/:id', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), deleteTaskTemplate);
router.post('/admin/resource', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), createOrUpdateResource);
router.delete('/admin/resource/:id', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), deleteResource);
router.post('/admin/assign-task', authenticateJWT, requireRole(['PROGRAM_PLANNING', 'LEADERSHIP', 'ADMIN']), assignTaskToDay);

export default router;
