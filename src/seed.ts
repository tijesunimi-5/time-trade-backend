import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding YOUR TIME TRADE database with 90-Day Programme Architecture...');

  // Clean existing tables
  await prisma.taskCompletion.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.followUpAssignment.deleteMany();
  await prisma.followUpNote.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.participantPersonalTask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.programmeDay.deleteMany();
  await prisma.programmeWeek.deleteMany();
  await prisma.programmePhase.deleteMany();
  await prisma.programme.deleteMany();
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

  // 2. Create Admin & EXCO Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@timetrade.com',
      passwordHash,
      fullName: 'Dr. Samuel Vance (EXCO)',
      role: 'ADMIN,LEADERSHIP,FOLLOW_UP',
      phone: '+1 (555) 019-2831',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      profile: {
        create: {
          goals: 'Guide global participants through 90 days of structured growth.',
        },
      },
    },
  });

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

  // 3. Create Demo Participants (passwordless email auth)
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

  await prisma.followUpAssignment.create({
    data: { followUpId: followUp.id, participantId: participant1.id },
  });

  // 4. Seed Curated Resources
  const resMindset = await prisma.resource.create({
    data: {
      title: 'Mindset: The New Psychology of Success',
      type: 'BOOK',
      author: 'Carol S. Dweck',
      contentNotes: 'Core study on Fixed vs Growth Mindset.',
    },
  });

  const resEmotionalAgility = await prisma.resource.create({
    data: {
      title: 'Emotional Agility',
      type: 'BOOK',
      author: 'Susan David',
      contentNotes: 'Recognizing emotional triggers and self-regulation.',
    },
  });

  const resBoundaries = await prisma.resource.create({
    data: {
      title: 'Boundaries: When to Say Yes, How to Say No',
      type: 'BOOK',
      author: 'Dr. Henry Cloud & Dr. John Townsend',
      contentNotes: 'Personal responsibility, healthy boundaries, and relational clarity.',
    },
  });

  const resPsychologyOfMoney = await prisma.resource.create({
    data: {
      title: 'The Psychology of Money',
      type: 'BOOK',
      author: 'Morgan Housel',
      contentNotes: 'Timeless lessons on wealth, greed, and financial decision-making.',
    },
  });

  // 5. Seed Task Templates
  const tmplPrayer = await prisma.taskTemplate.create({
    data: {
      title: 'Prayer & Quiet Solitude',
      description: 'Spend 20 minutes in morning solitude and prayer.',
      taskType: 'NON_NEGOTIABLE',
      pillar: 'SPIRITUAL',
      defaultRequired: true,
      defaultDurationMinutes: 20,
    },
  });

  const tmplDevotion = await prisma.taskTemplate.create({
    data: {
      title: 'Bible Reading / Devotion',
      description: 'Engage with daily Scripture reading and quiet reflection.',
      taskType: 'NON_NEGOTIABLE',
      pillar: 'SPIRITUAL',
      defaultRequired: false,
      defaultDurationMinutes: 15,
    },
  });

  // 6. Seed Programme Architecture (90 Days)
  const programme = await prisma.programme.create({
    data: {
      title: 'YOUR TIME TRADE 90-Day Personal Growth Challenge',
      description: 'A structured 90-day experience to reset, restart, and refocus your life.',
      startDate: '2026-09-27',
      isActive: true,
    },
  });

  // Create 3 Phases
  const phaseReset = await prisma.programmePhase.create({
    data: {
      programmeId: programme.id,
      title: 'RESET',
      phaseNumber: 1,
      durationDays: 30,
      objective: 'Pause, examine current state, identify patterns, beliefs, behaviours, and areas needing attention.',
      isUnlocked: true,
    },
  });

  await prisma.programmePhase.create({
    data: {
      programmeId: programme.id,
      title: 'RESTART',
      phaseNumber: 2,
      durationDays: 30,
      objective: 'Rebuild healthier habits, behaviours, relationships, and daily systems.',
      isUnlocked: false,
    },
  });

  await prisma.programmePhase.create({
    data: {
      programmeId: programme.id,
      title: 'REFOCUS',
      phaseNumber: 3,
      durationDays: 30,
      objective: 'Intentionally decide what deserves your attention, energy, and long-term commitment.',
      isUnlocked: false,
    },
  });

  // Seed Phase 1 Weeks
  const week1 = await prisma.programmeWeek.create({
    data: {
      phaseId: phaseReset.id,
      weekNumber: 1,
      theme: 'Reset Your Mindset',
      objective: 'Examine beliefs shaping how you see yourself, success, failure, and your future.',
      keyAreas: 'Self-belief, success, failure, responsibility, comparison, personal narratives.',
      anchorResource: 'Mindset by Carol Dweck',
    },
  });

  const week2 = await prisma.programmeWeek.create({
    data: {
      phaseId: phaseReset.id,
      weekNumber: 2,
      theme: 'Reset Your Emotional Life',
      objective: 'Recognize how you experience and respond to emotions and identify unhealthy patterns.',
      keyAreas: 'Emotional awareness, triggers, anger, fear, rejection, stress, coping mechanisms.',
      anchorResource: 'Emotional Agility by Susan David',
    },
  });

  const week3 = await prisma.programmeWeek.create({
    data: {
      phaseId: phaseReset.id,
      weekNumber: 3,
      theme: 'Reset Your Relationships',
      objective: 'Examine relationships, communication, personal responsibility, and boundaries.',
      keyAreas: 'Friendship, family, communication, conflict, saying no, personal boundaries.',
      anchorResource: 'Boundaries by Dr. Henry Cloud & Dr. John Townsend',
    },
  });

  const week4 = await prisma.programmeWeek.create({
    data: {
      phaseId: phaseReset.id,
      weekNumber: 4,
      theme: 'Reset Your Money & Work Mindset',
      objective: 'Examine beliefs and behaviours around money, work, earning, and financial responsibility.',
      keyAreas: 'Money beliefs, spending, saving, financial audit, work ethic, lifestyle expectations.',
      anchorResource: 'The Psychology of Money by Morgan Housel',
    },
  });

  const weeks = [week1, week2, week3, week4];
  const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // Seed 30 Days & Tasks
  for (let dayNum = 1; dayNum <= 30; dayNum++) {
    const weekIdx = Math.floor((dayNum - 1) / 7);
    const assignedWeek = weeks[Math.min(weekIdx, 3)];
    const dayOfWeek = daysOfWeek[(dayNum - 1) % 7];

    const dayObj = await prisma.programmeDay.create({
      data: {
        weekId: assignedWeek.id,
        dayNumber: dayNum,
        dayOfWeek,
        title: `Day ${dayNum}: ${assignedWeek.theme}`,
        focus: `Daily growth focus for ${assignedWeek.theme}`,
      },
    });

    // Add Prayer (Mon-Sat)
    if (dayOfWeek !== 'SUN') {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          templateId: tmplPrayer.id,
          title: 'Morning Prayer & Quiet Solitude',
          description: 'Spend 20 minutes in morning prayer and silent reflection.',
          taskType: 'NON_NEGOTIABLE',
          pillar: 'SPIRITUAL',
          isNonNegotiable: true,
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: assignedWeek.weekNumber,
          durationMinutes: 20,
          displayOrder: 1,
        },
      });

      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          templateId: tmplDevotion.id,
          title: 'Daily Scripture Reading & Devotion',
          description: 'Engage with daily Scripture reading and quiet devotional study.',
          taskType: 'NON_NEGOTIABLE',
          pillar: 'SPIRITUAL',
          isNonNegotiable: true,
          isOptional: true,
          isRequired: false,
          dayNumber: dayNum,
          weekNumber: assignedWeek.weekNumber,
          durationMinutes: 15,
          displayOrder: 2,
        },
      });
    }

    // Add Weekly Curated Learning Task based on Week
    if (assignedWeek.weekNumber === 1) {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          resourceId: resMindset.id,
          title: 'Mindset Audit: Growth vs Fixed',
          description: 'Read selected Chapter 1 excerpt on how mindset shapes personal responsibility.',
          taskType: 'LEARNING',
          pillar: 'MENTAL',
          pageRange: `Chapter 1, pages ${10 + dayNum}–${20 + dayNum}`,
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: 1,
          durationMinutes: 20,
          displayOrder: 3,
        },
      });
    } else if (assignedWeek.weekNumber === 2) {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          resourceId: resEmotionalAgility.id,
          title: 'Emotional Triggers & Response Audit',
          description: 'Read selected pages on recognizing internal emotional patterns under stress.',
          taskType: 'LEARNING',
          pillar: 'MENTAL',
          pageRange: `Chapter 2, pages ${15 + dayNum}–${25 + dayNum}`,
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: 2,
          durationMinutes: 20,
          displayOrder: 3,
        },
      });
    } else if (assignedWeek.weekNumber === 3) {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          resourceId: resBoundaries.id,
          title: 'Boundaries: Relational Responsibility',
          description: 'Read assigned section on healthy personal boundaries and communication.',
          taskType: 'LEARNING',
          pillar: 'SOCIAL',
          pageRange: `Chapter 3, pages ${20 + dayNum}–${30 + dayNum}`,
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: 3,
          durationMinutes: 20,
          displayOrder: 3,
        },
      });
    } else {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          resourceId: resPsychologyOfMoney.id,
          title: 'Money Mindset & Financial Audit',
          description: 'Read selected chapter on spending habits and personal financial responsibility.',
          taskType: 'LEARNING',
          pillar: 'MENTAL',
          pageRange: `Chapter 4, pages ${25 + dayNum}–${35 + dayNum}`,
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: 4,
          durationMinutes: 20,
          displayOrder: 3,
        },
      });
    }

    // Wednesday Discussion
    if (dayOfWeek === 'WED') {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          title: 'Wednesday Cohort Discussion',
          description: `Participate in cohort dialogue: "What patterns have you observed this week in ${assignedWeek.theme}?"`,
          taskType: 'COMMUNITY',
          pillar: 'SOCIAL',
          discussionQuestions: 'What beliefs or habits have been controlling your choices without realizing it?',
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: assignedWeek.weekNumber,
          durationMinutes: 25,
          displayOrder: 4,
        },
      });
    }

    // Saturday Deep Reflection
    if (dayOfWeek === 'SAT') {
      await prisma.task.create({
        data: {
          dayId: dayObj.id,
          title: 'Saturday Deep Reflection Ledger',
          description: 'Complete weekly written audit and personal growth entry.',
          taskType: 'GROWTH',
          pillar: 'MENTAL',
          instructions: 'Reflect on wins, friction points, and lessons learned this week.',
          isRequired: true,
          dayNumber: dayNum,
          weekNumber: assignedWeek.weekNumber,
          durationMinutes: 30,
          displayOrder: 4,
        },
      });
    }
  }

  // 7. Seed Dynamic Form Fields
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
  console.log('   Admin: admin@timetrade.com | password123 (Roles: ADMIN, LEADERSHIP, FOLLOW_UP)');
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
