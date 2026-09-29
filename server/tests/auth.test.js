const request = require('supertest');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb, clearDb, registerUser } = require('./helpers');

const app = createApp();
beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

describe('auth & profile', () => {
  test('register as a student with interests', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Priya', email: 'priya@test.dev', password: 'password123', interests: ['AI', 'Yoga'],
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Priya', role: 'student', interests: ['AI', 'Yoga'] });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  test('rejects duplicate emails and weak passwords', async () => {
    const body = { name: 'A', email: 'a@test.dev', password: 'password123' };
    await request(app).post('/api/auth/register').send(body);
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(409);
    expect((await request(app).post('/api/auth/register').send({ ...body, email: 'b@test.dev', password: 'short' })).status).toBe(400);
  });

  test('cannot register with an unknown role', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@test.dev', password: 'password123', role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('login and update interests', async () => {
    const u = await registerUser(app, 'Sam');
    const bad = await request(app).post('/api/auth/login').send({ email: u.user.email, password: 'wrongpass' });
    expect(bad.status).toBe(401);

    const res = await request(app).patch('/api/auth/me').set('Authorization', u.auth).send({ interests: ['AI', 'AI', 'Soccer'] });
    expect(res.body.user.interests).toEqual(['AI', 'Soccer']);
  });
});
