const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const HttpError = require('../utils/HttpError');

/**
 * Atomically take one seat. The filter `seatsLeft > 0` and the decrement happen in a
 * single database operation, so two students clicking "Going" at the same moment
 * can never both get the last seat.
 */
async function reserveSeat(event) {
  if (event.capacity == null) {
    return Event.findByIdAndUpdate(event._id, { $inc: { goingCount: 1 } }, { returnDocument: 'after' });
  }
  const updated = await Event.findOneAndUpdate(
    { _id: event._id, seatsLeft: { $gt: 0 } },
    { $inc: { seatsLeft: -1, goingCount: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new HttpError(409, 'Sorry, this event is full');
  return updated;
}

function releaseSeat(event) {
  const inc = event.capacity == null ? { goingCount: -1 } : { goingCount: -1, seatsLeft: 1 };
  return Event.findByIdAndUpdate(event._id, { $inc: inc }, { returnDocument: 'after' });
}

const bumpInterested = (eventId, by) =>
  Event.findByIdAndUpdate(eventId, { $inc: { interestedCount: by } }, { returnDocument: 'after' });

/** Set a student's RSVP to 'going' or 'interested'. Returns the updated event. */
async function setRsvp(event, user, status) {
  if (event.cancelled) throw new HttpError(400, 'This event was cancelled');
  if (event.endsAt < new Date()) throw new HttpError(400, 'This event has already ended');

  const existing = await Rsvp.findOne({ event: event._id, user: user._id });
  if (existing?.status === status) return Event.findById(event._id);

  let updated = event;
  if (status === 'going') {
    updated = await reserveSeat(event); // may throw "full" before we change anything
    if (existing) await bumpInterested(event._id, -1);
  } else {
    updated = await bumpInterested(event._id, 1);
    if (existing?.status === 'going') updated = await releaseSeat(event);
  }

  try {
    await Rsvp.findOneAndUpdate(
      { event: event._id, user: user._id },
      { status },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Roll back the counter change if saving the RSVP failed
    if (status === 'going') await releaseSeat(event);
    else await bumpInterested(event._id, -1);
    throw err;
  }
  return Event.findById(event._id);
}

async function removeRsvp(event, user) {
  const existing = await Rsvp.findOneAndDelete({ event: event._id, user: user._id });
  if (!existing) return event;
  if (existing.status === 'going') return releaseSeat(event);
  return bumpInterested(event._id, -1);
}

module.exports = { setRsvp, removeRsvp };
