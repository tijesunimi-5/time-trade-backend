import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding YOUR TIME TRADE database...');

  // Clean existing tables
  await prisma.taskCompletion.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.followUpAssignment.deleteMany();
  await prisma.followUpNote.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.dynamicFormField.deleteMany();
  await prisma.leaderboardConfig.deleteMany();
  await prisma.systemSettings.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create System Settings
  await prisma.systemSettings.create({
    data: {
      id: 'global',
      isAdminRegistrationActive: true,
    },
  });

  // 2. Create Admin (with multiple roles: ADMIN, FOLLOW_UP)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@timetrade.com',
      passwordHash,
      fullName: 'Dr. Samuel Vance (EXCO)',
      role: 'ADMIN,FOLLOW_UP',
      phone: '+1 (555) 019-2831',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          goals: 'Guide 10,000 global participants through 90 days of structured growth.',
        },
      },
    },
  });

  // 3. Create Follow-Up Coach
  const followUp = await prisma.user.create({
    data: {
      email: 'followup@timetrade.com',
      passwordHash,
      fullName: 'Coach Grace Taylor',
      role: 'FOLLOW_UP',
      phone: '+1 (555) 839-1029',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          goals: 'Support cohort participants with empathetic, factual follow-up.',
        },
      },
    },
  });

  // 4. Create Demo Participants (no passwords required!)
  const participant1 = await prisma.user.create({
    data: {
      email: 'participant@timetrade.com',
      fullName: 'David Okonkwo',
      role: 'PARTICIPANT',
      phone: '+234 803 123 4567',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          birthday: '1996-08-14',
          ageRange: '25-34',
          goals: 'Master spiritual discipline and build strong financial literacy habits.',
          expectations: 'Consistency over motivation.',
        },
      },
      streak: {
        create: {
          currentStreak: 12,
          longestStreak: 12,
          totalCompleted: 48,
          overallPercentage: 82.5,
          lastCompletedDate: new Date().toISOString().split('T')[0],
        },
      },
    },
  });

  const participant2 = await prisma.user.create({
    data: {
      email: 'sarah@timetrade.com',
      fullName: 'Sarah Jenkins',
      role: 'PARTICIPANT',
      phone: '+1 (555) 482-9910',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          birthday: '2001-04-22',
          ageRange: '18-24',
          goals: 'Emotional intelligence and social connection growth.',
          expectations: 'Community accountability and clear task tracking.',
        },
      },
      streak: {
        create: {
          currentStreak: 4,
          longestStreak: 8,
          totalCompleted: 32,
          overallPercentage: 64.0,
          lastCompletedDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        },
      },
    },
  });

  // Assign participants to follow-up coach
  await prisma.followUpAssignment.createMany({
    data: [
      { followUpId: followUp.id, participantId: participant1.id },
      { followUpId: followUp.id, participantId: participant2.id },
    ],
  });

  // 5. Create Initial Tasks across 3 Pillars
  await prisma.task.createMany({
    data: [
      // SPIRITUAL PILLAR
      {
        title: 'Daily Prayer & Solitude',
        description: 'Spend 20 minutes in focused morning prayer and intentional quiet solitude.',
        pillar: 'SPIRITUAL',
        category: 'Spiritual Discipline',
        frequencyType: 'DAILY',
        isNonNegotiable: true,
        durationMinutes: 20,
        displayOrder: 1,
        instructions: 'Find a distraction-free space. Prioritize gratitude and silent listening.',
      },
      {
        title: 'Bible Character Study: Daniel',
        description: 'Read Daniel Chapter 1-2. Note down key principles of steadfast compromise-free living.',
        pillar: 'SPIRITUAL',
        category: 'Scripture Study',
        frequencyType: 'DAILY',
        isNonNegotiable: true,
        durationMinutes: 25,
        displayOrder: 2,
        resourceUrl: 'https://www.biblegateway.com/passage/?search=Daniel+1&version=NIV',
      },
      // MENTAL PILLAR
      {
        title: 'Financial Literacy: Cash Flow Audit',
        description: 'Read assigned 15 pages of "The Psychology of Money" chapter on saving vs spending.',
        pillar: 'MENTAL',
        category: 'Financial Literacy',
        frequencyType: 'DAILY',
        isNonNegotiable: false,
        durationMinutes: 30,
        displayOrder: 3,
        resourceUrl: 'https://open.spotify.com/episode/financial-literacy-101',
      },
      // SOCIAL PILLAR
      {
        title: 'WhatsApp Group Weekly Thought Contribution',
        description: 'Share your personal insight on this week\'s topic in the main WhatsApp Community group.',
        pillar: 'SOCIAL',
        category: 'Community Engagement',
        frequencyType: 'WEEKLY',
        isNonNegotiable: false,
        durationMinutes: 10,
        displayOrder: 4,
      },
    ],
  });

  // Seed sample task completions for demo participant1
  const allTasks = await prisma.task.findMany();
  const todayStr = new Date().toISOString().split('T')[0];

  for (const task of allTasks) {
    if (task.isNonNegotiable || task.displayOrder <= 3) {
      await prisma.taskCompletion.create({
        data: {
          participantId: participant1.id,
          taskId: task.id,
          completionDate: todayStr,
        },
      });
    }
  }

  // 6. Seed Leaderboard Config
  await prisma.leaderboardConfig.create({
    data: {
      id: 'global',
      isEnabled: true,
      showNames: true,
      metricType: 'CONSISTENCY_PERCENTAGE',
    },
  });

  // 7. Seed Dynamic Form Fields for Admin Questions Builder
  await prisma.dynamicFormField.createMany({
    data: [
      {
        fieldName: 'expectations',
        label: 'What are your primary expectations for this 90-day challenge?',
        fieldType: 'textarea',
        isRequired: true,
        displayOrder: 1,
      },
      {
        fieldName: 'birthday',
        label: 'Date of Birth',
        fieldType: 'date',
        isRequired: false,
        displayOrder: 2,
      },
      {
        fieldName: 'primaryPillarFocus',
        label: 'Which pillar requires your greatest breakthrough?',
        fieldType: 'select',
        options: JSON.stringify(['Spiritual Growth', 'Mental & Financial Literacy', 'Social & Relationships']),
        isRequired: true,
        displayOrder: 3,
      },
    ],
  });

  console.log('✅ Seeding complete!');
  console.log('🔑 Credentials created:');
  console.log('   Admin: admin@timetrade.com | password123 (Roles: ADMIN, FOLLOW_UP)');
  console.log('   Follow-up: followup@timetrade.com | password123 (Role: FOLLOW_UP)');
  console.log('   Participant: participant@timetrade.com (Passwordless Email Auth)');
}

seed()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
