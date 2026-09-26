import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🧹 Cleaning database and setting up fresh TIME TRADE 90-Day Architecture...');

  // Clean all existing tables completely
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

  // 1. System Settings
  await prisma.systemSettings.create({
    data: {
      id: 'global',
      isAdminRegistrationActive: true,
    },
  });

  // 2. Initial Clean Admin Account (for EXCO Portal Access)
  await prisma.user.create({
    data: {
      email: 'admin@timetrade.com',
      passwordHash,
      fullName: 'System Admin',
      role: 'ADMIN,LEADERSHIP,FOLLOW_UP',
      profile: {
        create: {
          goals: 'EXCO Leadership & System Operations Admin',
        },
      },
    },
  });

  // 3. Programme Architecture (90 Days Structural Framework - NO dummy tasks/resources)
  const todayStr = new Date().toISOString().split('T')[0];
  const programme = await prisma.programme.create({
    data: {
      title: 'TIME TRADE 90-Day Personal Growth Challenge',
      description: 'A structured 90-day personal growth journey across Reset, Restart, and Refocus phases.',
      startDate: todayStr,
      isActive: true,
    },
  });

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

  const phaseRestart = await prisma.programmePhase.create({
    data: {
      programmeId: programme.id,
      title: 'RESTART',
      phaseNumber: 2,
      durationDays: 30,
      objective: 'Rebuild healthier habits, behaviours, relationships, and daily systems.',
      isUnlocked: false,
    },
  });

  const phaseRefocus = await prisma.programmePhase.create({
    data: {
      programmeId: programme.id,
      title: 'REFOCUS',
      phaseNumber: 3,
      durationDays: 30,
      objective: 'Intentionally decide what deserves your attention, energy, and long-term commitment.',
      isUnlocked: false,
    },
  });

  const weekThemes = [
    { num: 1, phase: phaseReset, theme: 'Reset Your Mindset' },
    { num: 2, phase: phaseReset, theme: 'Examine Habits & Routines' },
    { num: 3, phase: phaseReset, theme: 'Spiritual Alignment & Reflection' },
    { num: 4, phase: phaseReset, theme: 'Emotional & Relational Audit' },
    { num: 5, phase: phaseRestart, theme: 'Building Core Routines' },
    { num: 6, phase: phaseRestart, theme: 'Physical & Mental Energy' },
    { num: 7, phase: phaseRestart, theme: 'Time & Attention Management' },
    { num: 8, phase: phaseRestart, theme: 'Financial Responsibility & Stewardship' },
    { num: 9, phase: phaseRefocus, theme: 'Vision & Long-Term Purpose' },
    { num: 10, phase: phaseRefocus, theme: 'Relational & Community Stewardship' },
    { num: 11, phase: phaseRefocus, theme: 'Consistency Under Pressure' },
    { num: 12, phase: phaseRefocus, theme: 'Legacy & Sustained Growth' },
  ];

  const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  for (const wt of weekThemes) {
    const weekObj = await prisma.programmeWeek.create({
      data: {
        phaseId: wt.phase.id,
        weekNumber: wt.num,
        theme: wt.theme,
        anchorResource: null,
      },
    });

    const startDay = (wt.num - 1) * 7 + 1;
    const endDay = wt.num * 7;

    for (let dayNum = startDay; dayNum <= Math.min(endDay, 90); dayNum++) {
      const dayOfWeek = daysOfWeek[(dayNum - 1) % 7];
      await prisma.programmeDay.create({
        data: {
          weekId: weekObj.id,
          dayNumber: dayNum,
          dayOfWeek,
          title: `Day ${dayNum}`,
          focus: `Daily growth focus for ${wt.theme}`,
        },
      });
    }
  }

  console.log('✅ Database successfully cleaned!');
  console.log('🔑 Credentials created:');
  console.log('   Admin Email: admin@timetrade.com');
  console.log('   Admin Password: password123');
  console.log('📋 All dummy tasks, templates, resources, participants, and dynamic registration questions cleared.');
}

seed()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
