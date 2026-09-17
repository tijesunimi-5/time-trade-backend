import { Router } from 'express';
import { getPublicTestimonials, submitTestimonial } from '../controllers/testimonial.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getPublicTestimonials);
router.post('/', authenticateJWT, submitTestimonial);

export default router;
