import { Router } from 'express';
import {
  getAdminOverview,
  getAllParticipants,
  assignFollowUpMember,
  getPendingTestimonials,
  approveTestimonial,
  getDynamicFormFields,
  createDynamicFormField,
} from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Protect all admin routes
router.use(authenticateJWT, requireRole(['ADMIN']));

router.get('/overview', getAdminOverview);
router.get('/participants', getAllParticipants);
router.post('/assign-followup', assignFollowUpMember);
router.get('/testimonials/pending', getPendingTestimonials);
router.put('/testimonials/:id/approve', approveTestimonial);
router.get('/forms/fields', getDynamicFormFields);
router.post('/forms/fields', createDynamicFormField);

export default router;
