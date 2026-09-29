const request = require('supertest');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb, clearDb, registerUser, createEvent, inDays } = require('./helpers');

const app = createApp();
beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

const organizer = () => registerUser(app, 'Org', { role: 'organizer' });

describe('events', () => {
  test('only organizers can create events', async () => {
    const student = await registerUser(app, 'Stu');
    const res = await request(app).post('/api/events').set('Authorization', student.auth).send({});
    expect(res.status).toBe(403);
  });

  test('validates dates', async () => {
    const org = await organizer();
    const res = await request(app).post('/api/events').set('Authorization', org.auth).send({
      title: 'Bad dates', description: 'ends before it starts', category: 'Tech',
      location: { name: 'X' }, startsAt: inDays(2), endsAt: inDays(1),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/endsAt/);
  });

  test('anyone can browse, search and filter upcoming events', async () => {
    const org = await organizer();
    await createEvent(app, org.auth, { title: 'AI Workshop', category: 'Tech', tags: ['AI'] });
    await createEvent(app, org.auth, { title: 'Yoga Morning', category: 'Wellness', startsAt: inDays(1), endsAt: inDays(1, 1) });
    await createEvent(app, org.auth, { title: 'Cancelled thing', category: 'Tech' }).then((e) =>
      request(app).patch(`/api/events/${e.id}`).set('Authorization', org.auth).send({ cancelled: true })
    );

    const all = await request(app).get('/api/events');
    expect(all.body.events.map((e) => e.title)).toEqual(['Yoga Morning', 'AI Workshop']); // soonest first, cancelled hidden

    const search = await request(app).get('/api/events?q=ai');
    expect(search.body.events.map((e) => e.title)).toEqual(['AI Workshop']);

    const cat = await request(app).get('/api/events?category=Wellness');
    expect(cat.body.events).toHaveLength(1);

    const weird = await request(app).get('/api/events?q=(((');
    expect(weird.status).toBe(200); // regex characters are escaped
  });

  test('only the owner can edit or delete', async () => {
    const org = await organizer();
    const other = await registerUser(app, 'Other', { role: 'organizer' });
    const event = await createEvent(app, org.auth);

    expect((await request(app).patch(`/api/events/${event.id}`).set('Authorization', other.auth).send({ title: 'Hijacked' })).status).toBe(403);
    expect((await request(app).patch(`/api/events/${event.id}`).set('Authorization', org.auth).send({ title: 'Renamed event' })).body.event.title).toBe('Renamed event');
    expect((await request(app).delete(`/api/events/${event.id}`).set('Authorization', other.auth)).status).toBe(403);
    expect((await request(app).delete(`/api/events/${event.id}`).set('Authorization', org.auth)).status).toBe(204);
  });

  test('calendar export', async () => {
    const org = await organizer();
    const event = await createEvent(app, org.auth, { title: 'Career Fair, Fall' });
    const res = await request(app).get(`/api/events/${event.id}/calendar.ics`);
    expect(res.headers['content-type']).toMatch('text/calendar');
    expect(res.text).toContain('BEGIN:VEVENT');
    expect(res.text).toContain('SUMMARY:Career Fair\\, Fall');
  });
});

describe('RSVP & capacity', () => {
  test('going / interested / cancel keep counts correct', async () => {
    const org = await organizer();
    const stu = await registerUser(app, 'Stu');
    const event = await createEvent(app, org.auth, { capacity: 10 });
    const rsvp = (status) => request(app).put(`/api/events/${event.id}/rsvp`).set('Authorization', stu.auth).send({ status });

    let res = await rsvp('interested');
    expect(res.body.event).toMatchObject({ goingCount: 0, interestedCount: 1, seatsLeft: 10, myRsvp: 'interested' });
    res = await rsvp('going');
    expect(res.body.event).toMatchObject({ goingCount: 1, interestedCount: 0, seatsLeft: 9, myRsvp: 'going' });
    res = await rsvp('going'); // clicking twice changes nothing
    expect(res.body.event).toMatchObject({ goingCount: 1, seatsLeft: 9 });
    res = await request(app).delete(`/api/events/${event.id}/rsvp`).set('Authorization', stu.auth);
    expect(res.body.event).toMatchObject({ goingCount: 0, interestedCount: 0, seatsLeft: 10, myRsvp: null });
  });

  test('never overbooks, even when many students click at the same time', async () => {
    const org = await organizer();
    const event = await createEvent(app, org.auth, { capacity: 3 });
    const students = await Promise.all(Array.from({ length: 8 }, (_, i) => registerUser(app, `S${i}`)));

    const results = await Promise.all(
      students.map((s) => request(app).put(`/api/events/${event.id}/rsvp`).set('Authorization', s.auth).send({ status: 'going' }))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);

    const final = await request(app).get(`/api/events/${event.id}`);
    expect(final.body.event).toMatchObject({ goingCount: 3, seatsLeft: 0 });
  });

  test('organizer cannot shrink capacity below attendees, and sees who is coming', async () => {
    const org = await organizer();
    const event = await createEvent(app, org.auth, { capacity: 5 });
    const a = await registerUser(app, 'Ana');
    const b = await registerUser(app, 'Ben');
    await request(app).put(`/api/events/${event.id}/rsvp`).set('Authorization', a.auth).send({ status: 'going' });
    await request(app).put(`/api/events/${event.id}/rsvp`).set('Authorization', b.auth).send({ status: 'going' });

    expect((await request(app).patch(`/api/events/${event.id}`).set('Authorization', org.auth).send({ capacity: 1 })).status).toBe(400);
    const ok = await request(app).patch(`/api/events/${event.id}`).set('Authorization', org.auth).send({ capacity: 2 });
    expect(ok.body.event).toMatchObject({ capacity: 2, seatsLeft: 0 });

    const list = await request(app).get(`/api/events/${event.id}/attendees`).set('Authorization', org.auth);
    expect(list.body.attendees.map((x) => x.name)).toEqual(['Ana', 'Ben']);
    expect((await request(app).get(`/api/events/${event.id}/attendees`).set('Authorization', a.auth)).status).toBe(403);
  });

  test('my events page groups going / interested / hosting', async () => {
    const org = await organizer();
    const stu = await registerUser(app, 'Stu');
    const e1 = await createEvent(app, org.auth, { title: 'One' });
    const e2 = await createEvent(app, org.auth, { title: 'Two' });
    await request(app).put(`/api/events/${e1.id}/rsvp`).set('Authorization', stu.auth).send({ status: 'going' });
    await request(app).put(`/api/events/${e2.id}/rsvp`).set('Authorization', stu.auth).send({ status: 'interested' });

    const mine = await request(app).get('/api/me/events').set('Authorization', stu.auth);
    expect(mine.body.going.map((e) => e.title)).toEqual(['One']);
    expect(mine.body.interested.map((e) => e.title)).toEqual(['Two']);
    const hosting = await request(app).get('/api/me/events').set('Authorization', org.auth);
    expect(hosting.body.hosting).toHaveLength(2);
  });
});
