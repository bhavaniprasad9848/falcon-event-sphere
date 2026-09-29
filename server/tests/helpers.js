const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');

let mongoServer;

/**
 * Uses an in-memory MongoDB by default.
 * Set TEST_MONGO_URI to use a real database instead (e.g. the one from docker compose).
 */
async function connectDb() {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }
  const dbName = `falcon_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(uri, { dbName });
}

async function disconnectDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

let counter = 0;
async function registerUser(app, name = 'User', extra = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: `user${counter}_${Date.now()}@test.dev`, password: 'password123', ...extra });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, auth: `Bearer ${res.body.token}` };
}


const inDays = (d, h = 0) => new Date(Date.now() + d * 86400000 + h * 3600000).toISOString();

/** Organizer creates an event; returns the event JSON. */
async function createEvent(app, auth, overrides = {}) {
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', auth)
    .send({
      title: 'Test Event',
      description: 'A test event description',
      category: 'Tech',
      tags: [],
      location: { name: 'Room 101' },
      startsAt: inDays(2),
      endsAt: inDays(2, 2),
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  return res.body.event;
}

module.exports = { connectDb, disconnectDb, clearDb, registerUser, createEvent, inDays };
