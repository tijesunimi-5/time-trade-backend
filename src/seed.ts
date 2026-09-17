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

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@timetrade.com',
      passwordHash,
      fullName: 'Dr. Samuel Vance (EXCO)',
      role: 'ADMIN',
      phone: '+1 (555) 019-2831',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          goals: 'Guide 10,000 global participants through 90 days of structured growth.',
        },
      },
    },
  });

  // 2. Create Follow-Up Member
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

  // 3. Create Demo Participants
  const participant1 = await prisma.user.create({
    data: {
      email: 'participant@timetrade.com',
      passwordHash,
      fullName: 'David Okonkwo',
      role: 'PARTICIPANT',
      phone: '+234 803 123 4567',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
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
      passwordHash,
      fullName: 'Sarah Jenkins',
      role: 'PARTICIPANT',
      phone: '+1 (555) 482-9910',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          ageRange: '18-24',
          goals: 'Emotional intelligence and social connection growth.',
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

  const participant3 = await prisma.user.create({
    data: {
      email: 'marcus@timetrade.com',
      passwordHash,
      fullName: 'Marcus Sterling',
      role: 'PARTICIPANT',
      phone: '+44 7700 900077',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          ageRange: '35-44',
          goals: 'Business execution and decision-making clarity.',
        },
      },
      streak: {
        create: {
          currentStreak: 0,
          longestStreak: 5,
          totalCompleted: 14,
          overallPercentage: 28.0,
          lastCompletedDate: '2026-09-14',
        },
      },
    },
  });

  // Assign participants to follow-up member
  await prisma.followUpAssignment.createMany({
    data: [
      { followUpId: followUp.id, participantId: participant1.id },
      { followUpId: followUp.id, participantId: participant2.id },
      { followUpId: followUp.id, participantId: participant3.id },
    ],
  });

  // 4. Create Initial Tasks across 3 Pillars
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
      {
        title: 'Weekly Sermon & Audio Note-Taking',
        description: 'Listen to the designated weekly message on "Systematic Consistency" and write 3 key takeaways.',
        pillar: 'SPIRITUAL',
        category: 'Sermon Reflection',
        frequencyType: 'WEEKLY',
        isNonNegotiable: false,
        durationMinutes: 45,
        displayOrder: 3,
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
        displayOrder: 4,
        resourceUrl: 'https://open.spotify.com/episode/financial-literacy-101',
      },
      {
        title: 'Emotional Intelligence & Reflection Journaling',
        description: 'Write down 3 emotional triggers faced today and your calculated response.',
        pillar: 'MENTAL',
        category: 'Emotional Development',
        frequencyType: 'DAILY',
        isNonNegotiable: false,
        durationMinutes: 15,
        displayOrder: 5,
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
        displayOrder: 6,
        instructions: 'Post in the community group before 8:00 PM GMT.',
      },
    ],
  });

  // Seed sample task completions for demo participant1
  const allTasks = await prisma.task.findMany();
  const todayStr = new Date().toISOString().split('T')[0];

  for (const task of allTasks) {
    if (task.isNonNegotiable || task.displayOrder <= 4) {
      await prisma.taskCompletion.create({
        data: {
          participantId: participant1.id,
          taskId: task.id,
          completionDate: todayStr,
        },
      });
    }
  }

  // 5. Seed Leaderboard Config
  await prisma.leaderboardConfig.create({
    data: {
      id: 'global',
      isEnabled: true,
      showNames: true,
      metricType: 'CONSISTENCY_PERCENTAGE',
    },
  });

  // 6. Seed Calendar Events
  await prisma.calendarEvent.createMany({
    data: [
      {
        title: 'Cohort Orientation & 90-Day Blueprint Masterclass',
        description: 'Live kick-off briefing explaining the Spiritual, Social, and Mental pillar milestones.',
        pillar: 'SPIRITUAL',
        eventDate: '2026-09-01',
        resourceUrl: 'https://zoom.us/j/demo12345',
      },
      {
        title: 'Financial Literacy Workshop: Wealth Systems',
        description: 'Special deep-dive session on building personal financial systems that survive emotion.',
        pillar: 'MENTAL',
        eventDate: '2026-09-15',
        resourceUrl: 'https://zoom.us/j/demo67890',
      },
      {
        title: 'Phase 1 Review & Celebration (Day 30)',
        description: 'Reflecting on Month 1: Reset, Restart, and Refocus.',
        pillar: 'SOCIAL',
        eventDate: '2026-09-30',
      },
    ],
  });

  // 7. Seed Testimonials
  await prisma.testimonial.createMany({
    data: [
      {
        userId: participant1.id,
        content: 'Your Time Trade changed how I approach my daily routines. Motivation lasts 3 days; this system has kept me consistent for 60+ days without burnout.',
        isPublic: true,
        isApproved: true,
      },
      {
        userId: participant2.id,
        content: 'The non-negotiable spiritual and mental tracking gives me so much clarity every morning before I open social media.',
        isPublic: true,
        isApproved: true,
      },
    ],
  });

  // 8. Seed Dynamic Form Fields for Registration
  await prisma.dynamicFormField.createMany({
    data: [
      {
        fieldName: 'primaryGoal',
        label: 'What is your single most important goal for this 90-day challenge?',
        fieldType: 'textarea',
        isRequired: true,
        displayOrder: 1,
      },
      {
        fieldName: 'primaryPillarFocus',
        label: 'Which pillar requires your greatest breakthrough?',
        fieldType: 'select',
        options: JSON.stringify(['Spiritual Growth', 'Mental & Financial Literacy', 'Social & Relationships']),
        isRequired: true,
        displayOrder: 2,
      },
    ],
  });

  console.log('✅ Seeding complete!');
  console.log('🔑 Credentials created:');
  console.log('   Admin: admin@timetrade.com | password123');
  console.log('   Follow-up: followup@timetrade.com | password123');
  console.log('   Participant: participant@timetrade.com | password123');
}

seed()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
