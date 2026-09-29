const serializeEvent = (e, extra = {}) => ({
  id: e._id.toString(),
  title: e.title,
  description: e.description,
  category: e.category,
  tags: e.tags,
  location: { name: e.location.name, address: e.location.address },
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  imageUrl: e.imageUrl,
  organizer: { id: e.organizer.toString(), name: e.organizerName },
  capacity: e.capacity,
  seatsLeft: e.seatsLeft,
  goingCount: e.goingCount,
  interestedCount: e.interestedCount,
  cancelled: e.cancelled,
  ...extra,
});

module.exports = { serializeEvent };
