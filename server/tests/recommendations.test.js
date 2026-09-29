const request = require('supertest');
const { createApp } = require('../src/app');
const { setLlmClient } = require('../src/services/recommender');
const { connectDb, disconnectDb, clearDb, registerUser, createEvent } = require('./helpers');

const app = createApp();
beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(async () => {
  setLlmClient(null);
  await clearDb();
});

async function campus() {
  const org = await registerUser(app, 'Org', { role: 'organizer' });
  const ai = await createEvent(app, org.auth, { title: 'AI Workshop', category: 'Tech', tags: ['AI'] });
  const hoops = await createEvent(app, org.auth, { title: 'Basketball Game', category: 'Sports', tags: ['Basketball'] });
  const yoga = await createEvent(app, org.auth, { title: 'Yoga', category: 'Wellness', tags: ['Yoga'] });
  const fair = await createEvent(app, org.auth, { title: 'Career Fair', category: 'Career', tags: ['Networking'] });
  return { org, ai, hoops, yoga, fair };
}

const recs = (auth) => request(app).get('/api/me/recommendations').set('Authorization', auth);

describe('recommendations', () => {
  test('matches events to stated interests, with a reason', async () => {
    await campus();
    const stu = await registerUser(app, 'Stu', { interests: ['AI', 'Wellness'] });
    const res = await recs(stu.auth);
    expect(res.body.source).toBe('personalized');
    const titles = res.body.items.map((i) => i.event.title);
    expect(titles.slice(0, 2).sort()).toEqual(['AI Workshop', 'Yoga']);
    expect(res.body.items[0].reason).toMatch(/interest/);
  });

  test('learns from RSVP history and hides events already RSVPd', async () => {
    const { org, hoops } = await campus();
    const soccer = await createEvent(app, org.auth, { title: 'Soccer Match', category: 'Sports', tags: ['Soccer'] });
    const stu = await registerUser(app, 'Stu');
    await request(app).put(`/api/events/${hoops.id}/rsvp`).set('Authorization', stu.auth).send({ status: 'going' });

    const res = await recs(stu.auth);
    const titles = res.body.items.map((i) => i.event.title);
    expect(titles).not.toContain('Basketball Game');
    expect(titles[0]).toBe(soccer.title);
    expect(res.body.items[0].reason).toBe('Similar to "Basketball Game"');
  });

  test('new students with no signals get popular events', async () => {
    await campus();
    const stu = await registerUser(app, 'New');
    const res = await recs(stu.auth);
    expect(res.body.source).toBe('popular');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test('uses the LLM re-ranker when available and ignores ids it made up', async () => {
    const { yoga, fair } = await campus();
    const fake = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: `Here you go: {"picks":[{"id":"${fair.id}","reason":"Great for your internship search"},{"id":"000000000000000000000000","reason":"made up"},{"id":"${yoga.id}","reason":"Recharge before exams"}]}`,
          }],
        }),
      },
    };
    setLlmClient(fake);
    const stu = await registerUser(app, 'Stu', { interests: ['Career'] });
    const res = await recs(stu.auth);
    expect(fake.messages.create).toHaveBeenCalledTimes(1);
    expect(res.body.source).toBe('ai');
    expect(res.body.items.map((i) => [i.event.title, i.reason])).toEqual([
      ['Career Fair', 'Great for your internship search'],
      ['Yoga', 'Recharge before exams'],
    ]);
  });

  test('falls back to built-in scoring if the LLM fails', async () => {
    await campus();
    setLlmClient({ messages: { create: jest.fn().mockRejectedValue(new Error('timeout')) } });
    const stu = await registerUser(app, 'Stu', { interests: ['AI'] });
    const res = await recs(stu.auth);
    expect(res.body.source).toBe('personalized');
    expect(res.body.items[0].event.title).toBe('AI Workshop');
  });
});
