import { Router } from 'express';
import {
  getAdminOverview,
  getAllParticipants,
  assignFollowUpMember,
  getPendingTestimonials,
  approveTestimonial,
  getDynamicFormFields,
  createDynamicFormField,
  updateDynamicFormField,
  deleteDynamicFormField,
  reorderDynamicFormFields,
  updateSystemSettings,
  updateUserRoles,
} from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();

const ALL_EXCO_ROLES = [
  'LEADERSHIP',
  'ADMIN',
  'COMMUNITY_MANAGEMENT',
  'FOLLOW_UP',
  'PROGRAM_PLANNING',
  'MEDIA',
  'CONTENT',
];

const FORM_BUILDER_ROLES = [
  'LEADERSHIP',
  'ADMIN',
  'COMMUNITY_MANAGEMENT',
  'FOLLOW_UP',
];

// Base protection: Any EXCO team member
router.use(authenticateJWT, requireRole(ALL_EXCO_ROLES));

// General EXCO Read & Overview Routes
router.get('/overview', getAdminOverview);
router.get('/participants', getAllParticipants);
router.get('/forms/fields', getDynamicFormFields);
router.get('/testimonials/pending', getPendingTestimonials);

// Form Builder Mutations (Restricted to Leadership, Community Management, Follow-Up)
router.post('/forms/fields', requireRole(FORM_BUILDER_ROLES), createDynamicFormField);
router.put('/forms/fields/reorder', requireRole(FORM_BUILDER_ROLES), reorderDynamicFormFields);
router.put('/forms/fields/:id', requireRole(FORM_BUILDER_ROLES), updateDynamicFormField);
router.delete('/forms/fields/:id', requireRole(FORM_BUILDER_ROLES), deleteDynamicFormField);

// Operational Admin Mutations
router.put('/users/:id/roles', requireRole(FORM_BUILDER_ROLES), updateUserRoles);
router.post('/assign-followup', requireRole(FORM_BUILDER_ROLES), assignFollowUpMember);
router.put('/testimonials/:id/approve', requireRole(FORM_BUILDER_ROLES), approveTestimonial);
router.put('/settings', requireRole(FORM_BUILDER_ROLES), updateSystemSettings);

export default router;
