import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', healthRoutes);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/comments', commentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/activities', activityRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use(errorHandler);

export default app;
