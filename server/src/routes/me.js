const express = require('express');
const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const { requireAuth } = require('../middleware/auth');
const { serializeEvent } = require('../utils/serialize');
const { recommendFor } = require('../services/recommender');

const router = express.Router();
router.use(requireAuth);

// Events I'm going to / interested in / hosting
router.get('/events', async (req, res) => {
  const rsvps = await Rsvp.find({ user: req.user._id });
  const status = new Map(rsvps.map((r) => [r.event.toString(), r.status]));
  const [rsvpEvents, hosting] = await Promise.all([
    Event.find({ _id: { $in: [...rsvps.map((r) => r.event)] } }).sort({ startsAt: 1 }),
    Event.find({ organizer: req.user._id }).sort({ startsAt: 1 }),
  ]);
  const tag = (e) => serializeEvent(e, { myRsvp: status.get(e._id.toString()) ?? null });
  res.json({
    going: rsvpEvents.filter((e) => status.get(e._id.toString()) === 'going').map(tag),
    interested: rsvpEvents.filter((e) => status.get(e._id.toString()) === 'interested').map(tag),
    hosting: hosting.map(tag),
  });
});

// Personalized recommendations
router.get('/recommendations', async (req, res) => {
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 6));
  const { source, items } = await recommendFor(req.user, { limit });
  res.json({ source, items: items.map(({ event, reason }) => ({ event: serializeEvent(event), reason })) });
});

module.exports = router;
