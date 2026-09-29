const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth, requireOrganizer } = require('../middleware/auth');
const { serializeEvent } = require('../utils/serialize');
const { setRsvp, removeRsvp } = require('../services/rsvpService');
const { invalidateUser } = require('../services/recommender');
const { eventToIcs } = require('../utils/ics');
const { CATEGORIES } = require('../constants');

const router = express.Router();

const eventFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  location: z.object({
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().max(200).optional(),
  }),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  capacity: z.number().int().min(1).max(100000).nullable(),
  imageUrl: z.url().or(z.literal('')),
};

const createSchema = z
  .object({ ...eventFields, tags: eventFields.tags.default([]), capacity: eventFields.capacity.default(null), imageUrl: eventFields.imageUrl.default('') })
  .refine((e) => e.endsAt > e.startsAt, { message: 'must be after the start time', path: ['endsAt'] })
  .refine((e) => e.startsAt > new Date(), { message: 'must be in the future', path: ['startsAt'] });

const updateSchema = z
  .object({
    title: eventFields.title,
    description: eventFields.description,
    category: eventFields.category,
    tags: eventFields.tags,
    location: eventFields.location,
    startsAt: eventFields.startsAt,
    endsAt: eventFields.endsAt,
    capacity: eventFields.capacity,
    imageUrl: eventFields.imageUrl,
    cancelled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

const rsvpSchema = z.object({ status: z.enum(['going', 'interested']) });

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loadEvent(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Event not found');
  const event = await Event.findById(id);
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

function assertOwner(event, user) {
  if (event.organizer.toString() !== user._id.toString()) {
    throw new HttpError(403, 'Only the organizer of this event can do that');
  }
}

async function withMyRsvp(event, user) {
  if (!user) return serializeEvent(event, { myRsvp: null });
  const rsvp = await Rsvp.findOne({ event: event._id, user: user._id });
  return serializeEvent(event, { myRsvp: rsvp?.status ?? null });
}

// ---- Browse & search (public) ----
router.get('/', async (req, res) => {
  const { q, category, from, to } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

  const filter = { cancelled: false, startsAt: { $gte: from ? new Date(from) : new Date() } };
  if (to) filter.startsAt.$lte = new Date(to);
  if (category && CATEGORIES.includes(category)) filter.category = category;
  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }, { 'location.name': rx }];
  }

  const sort = req.query.sort === 'popular' ? { goingCount: -1, startsAt: 1 } : { startsAt: 1 };
  const [events, total] = await Promise.all([
    Event.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Event.countDocuments(filter),
  ]);
  res.json({ events: events.map((e) => serializeEvent(e)), page, total, pages: Math.ceil(total / limit) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const event = await loadEvent(req.params.id);
  res.json({ event: await withMyRsvp(event, req.user) });
});

// Add to calendar
router.get('/:id/calendar.ics', async (req, res) => {
  const event = await loadEvent(req.params.id);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="event-${event._id}.ics"`);
  res.send(eventToIcs(event));
});

// ---- Organizer actions ----
router.post('/', requireAuth, requireOrganizer, validate(createSchema), async (req, res) => {
  const event = await Event.create({
    ...req.body,
    seatsLeft: req.body.capacity,
    organizer: req.user._id,
    organizerName: req.user.name,
  });
  res.status(201).json({ event: serializeEvent(event, { myRsvp: null }) });
});

router.patch('/:id', requireAuth, validate(updateSchema), async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertOwner(event, req.user);

  const next = { ...req.body };
  const startsAt = next.startsAt ?? event.startsAt;
  const endsAt = next.endsAt ?? event.endsAt;
  if (endsAt <= startsAt) throw new HttpError(400, 'endsAt: must be after the start time');

  if ('capacity' in next) {
    if (next.capacity != null && next.capacity < event.goingCount) {
      throw new HttpError(400, `capacity: ${event.goingCount} students are already going`);
    }
    next.seatsLeft = next.capacity == null ? null : next.capacity - event.goingCount;
  }
  Object.assign(event, next);
  await event.save();
  res.json({ event: await withMyRsvp(event, req.user) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertOwner(event, req.user);
  await Promise.all([Rsvp.deleteMany({ event: event._id }), event.deleteOne()]);
  res.status(204).end();
});

// Organizer can see who's coming
router.get('/:id/attendees', requireAuth, async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertOwner(event, req.user);
  const rsvps = await Rsvp.find({ event: event._id }).sort({ createdAt: 1 });
  const users = await User.find({ _id: { $in: rsvps.map((r) => r.user) } }).select('name email department');
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  res.json({
    attendees: rsvps
      .filter((r) => byId.has(r.user.toString()))
      .map((r) => {
        const u = byId.get(r.user.toString());
        return { name: u.name, email: u.email, department: u.department, status: r.status, at: r.createdAt };
      }),
  });
});

// ---- RSVP ----
router.put('/:id/rsvp', requireAuth, validate(rsvpSchema), async (req, res) => {
  const event = await loadEvent(req.params.id);
  const updated = await setRsvp(event, req.user, req.body.status);
  invalidateUser(req.user._id);
  res.json({ event: serializeEvent(updated, { myRsvp: req.body.status }) });
});

router.delete('/:id/rsvp', requireAuth, async (req, res) => {
  const event = await loadEvent(req.params.id);
  const updated = await removeRsvp(event, req.user);
  invalidateUser(req.user._id);
  res.json({ event: serializeEvent(updated, { myRsvp: null }) });
});

module.exports = router;
