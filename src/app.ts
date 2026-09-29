import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import progressRoutes from './routes/progress.routes';
import followupRoutes from './routes/followup.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import calendarRoutes from './routes/calendar.routes';
import programmeRoutes from './routes/programme.routes';
import testimonialRoutes from './routes/testimonial.routes';
import adminRoutes from './routes/admin.routes';
import feedbackRoutes from './routes/feedback.routes';
import pollRoutes from './routes/poll.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', platform: 'TIME TRADE API', timestamp: new Date() });
});

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/followup', followupRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/programme', programmeRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/polls', pollRoutes);

// Error Middleware
app.use(errorHandler);

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function autoMigrateDatabase() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "birthday" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "ageRange" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "goals" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "expectations" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "customAnswers" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "fileName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "accessType" TEXT DEFAULT 'LINK';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "fileName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Streak" ADD COLUMN IF NOT EXISTS "isProtected" BOOLEAN DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Streak" ADD COLUMN IF NOT EXISTS "bonusStreak" INTEGER DEFAULT 0;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "isAutoIncrement" BOOLEAN DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "startUnit" INTEGER DEFAULT 1;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "unitsPerDay" INTEGER DEFAULT 3;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "unitType" TEXT DEFAULT 'CHAPTERS';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "bookName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "bibleVersion" TEXT DEFAULT 'KJV';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "bibleUrlTemplate" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isAutoIncrement" BOOLEAN DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "startUnit" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "unitsPerDay" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "unitType" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "bookName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "dayNumber" INTEGER;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSettings" (
          "id" TEXT NOT NULL,
          "isAdminRegistrationActive" BOOLEAN NOT NULL DEFAULT true,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSettings" ("id", "isAdminRegistrationActive", "updatedAt")
      VALUES ('global', true, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Poll" (
          "id" TEXT NOT NULL,
          "question" TEXT NOT NULL,
          "description" TEXT,
          "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
          "isStandalone" BOOLEAN NOT NULL DEFAULT true,
          "showAsPopup" BOOLEAN NOT NULL DEFAULT false,
          "taskId" TEXT,
          "programmeId" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PollOption" (
          "id" TEXT NOT NULL,
          "pollId" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          "displayOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PollVote" (
          "id" TEXT NOT NULL,
          "pollId" TEXT NOT NULL,
          "optionId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_pollId_userId_optionId_key" ON "PollVote"("pollId", "userId", "optionId");
    `);

    console.log('✅ Database schema auto-synchronized with Neon PostgreSQL.');
  } catch (err: any) {
    console.warn('Auto-migration non-fatal note:', err.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 TIME TRADE Backend Server running on http://localhost:${config.port}`);
    autoMigrateDatabase();
  });
}

export default app;
