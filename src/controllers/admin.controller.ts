import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminOverview = async (req: Request, res: Response) => {
  try {
    const totalParticipants = await prisma.user.count({
      where: { role: { contains: 'PARTICIPANT' } },
    });
    const totalFollowUps = await prisma.user.count({
      where: { role: { contains: 'FOLLOW_UP' } },
    });
    const totalTasks = await prisma.task.count({ where: { isActive: true } });
    const totalCompletions = await prisma.taskCompletion.count();
    const pendingTestimonials = await prisma.testimonial.count({ where: { isApproved: false } });

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global', isAdminRegistrationActive: true },
    });

    return res.json({
      stats: {
        totalParticipants,
        totalFollowUps,
        totalTasks,
        totalCompletions,
        pendingTestimonials,
        activeChallengeDay: 17,
      },
      settings,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin overview' });
  }
};

export const getAllParticipants = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        streak: true,
        assignedFollowUps: {
          include: { followUpMember: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsedUsers = users.map((u) => ({
      ...u,
      rolesList: u.role.split(',').map((r) => r.trim()),
    }));

    return res.json({ participants: parsedUsers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch participants' });
  }
};

export const updateUserRoles = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { roles, fullName, phone } = req.body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: 'At least one role is required' });
    }

    const joinedRoles = Array.from(new Set(roles)).join(',');

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: joinedRoles,
        fullName: fullName || undefined,
        phone: phone || undefined,
      },
    });

    return res.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        rolesList: updatedUser.role.split(',').map((r) => r.trim()),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update user roles' });
  }
};

export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { isAdminRegistrationActive } = req.body;

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {
        isAdminRegistrationActive: typeof isAdminRegistrationActive === 'boolean' ? isAdminRegistrationActive : true,
      },
      create: {
        id: 'global',
        isAdminRegistrationActive: typeof isAdminRegistrationActive === 'boolean' ? isAdminRegistrationActive : true,
      },
    });

    return res.json({ message: 'Settings updated successfully', settings });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
};

export const assignFollowUpMember = async (req: Request, res: Response) => {
  try {
    const { followUpId, participantId } = req.body;
    if (!followUpId || !participantId) {
      return res.status(400).json({ error: 'followUpId and participantId required' });
    }

    const assignment = await prisma.followUpAssignment.upsert({
      where: {
        followUpId_participantId: { followUpId, participantId },
      },
      update: {},
      create: { followUpId, participantId },
    });

    return res.json({ message: 'Follow-up member assigned successfully', assignment });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to assign follow-up member' });
  }
};

export const getPendingTestimonials = async (req: Request, res: Response) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isApproved: false },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return res.json({ testimonials });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch pending testimonials' });
  }
};

export const approveTestimonial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: { isApproved: true, isPublic: true },
    });
    return res.json({ message: 'Testimonial approved', testimonial });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to approve testimonial' });
  }
};

// --- DYNAMIC FORM & REGISTRATION QUESTION BUILDER (SAVE, PUBLISH, UNPUBLISH, VERSIONING) ---

export const getAllForms = async (req: Request, res: Response) => {
  try {
    const forms = await prisma.dynamicForm.findMany({
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ forms });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch forms' });
  }
};

export const saveForm = async (req: Request, res: Response) => {
  try {
    const { id, title, description, fields } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Form title is required' });
    }

    let form;
    if (id) {
      // Update existing form info
      form = await prisma.dynamicForm.update({
        where: { id },
        data: {
          title,
          description,
        },
      });

      // Sync questions: Delete old fields & recreate specified fields
      if (Array.isArray(fields)) {
        await prisma.dynamicFormField.deleteMany({
          where: { formId: id },
        });

        await Promise.all(
          fields.map((f: any, index: number) => {
            const stringifiedOptions = typeof f.options === 'object' ? JSON.stringify(f.options) : f.options;
            return prisma.dynamicFormField.create({
              data: {
                formId: id,
                fieldName: f.fieldName || `q_${Date.now()}_${index}`,
                label: f.label,
                fieldType: f.fieldType || 'text',
                isRequired: !!f.isRequired,
                options: stringifiedOptions || undefined,
                displayOrder: typeof f.displayOrder === 'number' ? f.displayOrder : index + 1,
                isActive: f.isActive !== false,
              },
            });
          })
        );
      }
    } else {
      // Create new Form as Draft (isPublished: false)
      const formattedFields = Array.isArray(fields)
        ? fields.map((f: any, index: number) => {
            const stringifiedOptions = typeof f.options === 'object' ? JSON.stringify(f.options) : f.options;
            return {
              fieldName: f.fieldName || `q_${Date.now()}_${index}`,
              label: f.label,
              fieldType: f.fieldType || 'text',
              isRequired: !!f.isRequired,
              options: stringifiedOptions || undefined,
              displayOrder: typeof f.displayOrder === 'number' ? f.displayOrder : index + 1,
              isActive: f.isActive !== false,
            };
          })
        : [];

      form = await prisma.dynamicForm.create({
        data: {
          title,
          description,
          isPublished: false,
          fields: {
            create: formattedFields,
          },
        },
      });
    }

    const savedForm = await prisma.dynamicForm.findUnique({
      where: { id: form.id },
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return res.status(200).json({ message: 'Form saved successfully', form: savedForm });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save form' });
  }
};

export const publishForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const targetForm = await prisma.dynamicForm.findUnique({ where: { id } });
    if (!targetForm) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Unpublish all forms first (only 1 published form active at a time)
    await prisma.dynamicForm.updateMany({
      data: { isPublished: false },
    });

    // Publish target form
    const publishedForm = await prisma.dynamicForm.update({
      where: { id },
      data: { isPublished: true },
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return res.json({ message: `"${publishedForm.title}" is now LIVE for public registration.`, form: publishedForm });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to publish form' });
  }
};

export const unpublishForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const unpublishedForm = await prisma.dynamicForm.update({
      where: { id },
      data: { isPublished: false },
    });

    return res.json({ message: `"${unpublishedForm.title}" has been UNPUBLISHED. Public registration is now closed.`, form: unpublishedForm });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to unpublish form' });
  }
};

export const deleteForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dynamicForm.delete({ where: { id } });
    return res.json({ message: 'Form deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete form' });
  }
};

export const getDynamicFormFields = async (req: Request, res: Response) => {
  try {
    // 1. Look for active published form
    const publishedForm = await prisma.dynamicForm.findFirst({
      where: { isPublished: true },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (publishedForm) {
      return res.json({
        isPublished: true,
        formTitle: publishedForm.title,
        formDescription: publishedForm.description,
        fields: publishedForm.fields,
      });
    }

    // 2. Fallback: Return all dynamic form fields in database so admin answer viewer can resolve questions
    const allFields = await prisma.dynamicFormField.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return res.json({
      isPublished: false,
      formTitle: allFields.length > 0 ? 'Custom Registration Questionnaire' : null,
      fields: allFields,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch dynamic fields' });
  }
};

export const createDynamicFormField = async (req: Request, res: Response) => {
  try {
    const { formId, fieldName, label, fieldType, isRequired, options, displayOrder, isActive } = req.body;
    
    if (!label || !fieldType) {
      return res.status(400).json({ error: 'Question label and answer type are required' });
    }

    const generatedKey = fieldName || `q_${Date.now()}`;
    const stringifiedOptions = typeof options === 'object' ? JSON.stringify(options) : options;

    const field = await prisma.dynamicFormField.create({
      data: {
        formId: formId || undefined,
        fieldName: generatedKey,
        label,
        fieldType,
        isRequired: !!isRequired,
        options: stringifiedOptions || undefined,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        isActive: isActive !== false,
      },
    });

    return res.status(201).json({ message: 'Question created successfully', field });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create dynamic field' });
  }
};

export const updateDynamicFormField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label, fieldType, isRequired, options, displayOrder, isActive } = req.body;

    const stringifiedOptions = typeof options === 'object' ? JSON.stringify(options) : options;

    const field = await prisma.dynamicFormField.update({
      where: { id },
      data: {
        label: label || undefined,
        fieldType: fieldType || undefined,
        isRequired: typeof isRequired === 'boolean' ? isRequired : undefined,
        options: stringifiedOptions !== undefined ? stringifiedOptions : undefined,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    });

    return res.json({ message: 'Question updated successfully', field });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update dynamic field' });
  }
};

export const deleteDynamicFormField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dynamicFormField.delete({ where: { id } });
    return res.json({ message: 'Question deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete dynamic field' });
  }
};

export const reorderDynamicFormFields = async (req: Request, res: Response) => {
  try {
    const { fieldOrders } = req.body;
    if (!Array.isArray(fieldOrders)) {
      return res.status(400).json({ error: 'fieldOrders array required' });
    }

    await Promise.all(
      fieldOrders.map((item: { id: string; displayOrder: number }) =>
        prisma.dynamicFormField.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return res.json({ message: 'Questions reordered successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reorder fields' });
  }
};
