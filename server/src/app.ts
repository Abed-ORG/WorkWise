import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import userRoutes from './modules/users/users.routes';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import projectRoutes from './modules/projects/projects.routes';
import taskRoutes from './routes/task.routes';
import commentRoutes from './routes/comment.routes';
import aiRoutes from './modules/ai/ai.routes';

import notificationRoutes from './routes/notification.routes';
import activityRoutes from './routes/activity.routes';
import { errorHandler } from './middleware/error.middleware';
import { env } from './config/env';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: {
    success: false,
    status: 429,
    message: 'Too many authentication attempts. Please try again later.',
    details: null,
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', healthRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/tasks', taskRoutes);
app.use('/comments', commentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/activities', activityRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use(errorHandler);

export default app;
