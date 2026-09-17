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

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 YOUR TIME TRADE Backend Server running on http://localhost:${config.port}`);
  });
}

export default app;
