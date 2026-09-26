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

  // 3. Programme Shell (EMPTY hierarchy by default - EXCO builds all phases/weeks/days manually)
  const todayStr = new Date().toISOString().split('T')[0];
  await prisma.programme.create({
    data: {
      title: 'TIME TRADE 90-Day Personal Growth Challenge',
      description: 'A structured personal growth journey configured dynamically.',
      startDate: todayStr,
      isActive: true,
    },
  });

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
