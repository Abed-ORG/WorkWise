import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/utils/prisma', () => ({ default: prisma }));

import app from '../src/app';

const registeredUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: '',
};

describe('auth endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a user successfully', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: typeof registeredUser }) => ({
      ...registeredUser,
      ...data,
    }));

    const response = await request(app).post('/auth/register').send({
      name: registeredUser.name,
      email: 'ADA@EXAMPLE.COM',
      password: 'secure-password',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(registeredUser.email);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: registeredUser.email }),
    }));
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue(registeredUser);

    const response = await request(app).post('/auth/register').send({
      name: registeredUser.name,
      email: registeredUser.email,
      password: 'secure-password',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email already exists');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('logs in with valid credentials and rejects invalid credentials', async () => {
    const password = 'secure-password';
    prisma.user.findUnique.mockResolvedValue({ ...registeredUser, password: await bcrypt.hash(password, 10) });

    const success = await request(app).post('/auth/login').send({ email: registeredUser.email, password });
    const rejected = await request(app).post('/auth/login').send({ email: registeredUser.email, password: 'wrong-password' });

    expect(success.status).toBe(200);
    expect(success.body.data.accessToken).toEqual(expect.any(String));
    expect(rejected.status).toBe(401);
    expect(rejected.body.message).toBe('Invalid email or password');
  });

  it('refreshes a valid refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(registeredUser);
    const registration = await request(app).post('/auth/register').send({
      name: registeredUser.name, email: registeredUser.email, password: 'secure-password',
    });

    const response = await request(app).post('/auth/refresh').send({ refreshToken: registration.body.data.refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });
});
