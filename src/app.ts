import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import progressRoutes from './routes/progress.routes';
import followupRoutes from './routes/followup.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import calendarRoutes from './routes/calendar.routes';
import testimonialRoutes from './routes/testimonial.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json());

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', platform: 'YOUR TIME TRADE API', timestamp: new Date() });
});

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/followup', followupRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/admin', adminRoutes);

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
    console.log('✅ Database schema auto-synchronized with Neon PostgreSQL.');
  } catch (err: any) {
    console.warn('Auto-migration non-fatal note:', err.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 YOUR TIME TRADE Backend Server running on http://localhost:${config.port}`);
    autoMigrateDatabase();
  });
}

export default app;
