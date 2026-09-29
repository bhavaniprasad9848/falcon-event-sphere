const mongoose = require('mongoose');
const { CATEGORIES } = require('../constants');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, required: true },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    location: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      address: { type: String, trim: true, maxlength: 200, default: '' },
    },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    imageUrl: { type: String, trim: true, default: '' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizerName: { type: String, required: true },

    // Capacity handling: capacity=null means unlimited.
    // seatsLeft is decremented atomically so two students can't grab the last seat.
    capacity: { type: Number, min: 1, default: null },
    seatsLeft: { type: Number, min: 0, default: null },
    goingCount: { type: Number, default: 0 },
    interestedCount: { type: Number, default: 0 },

    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
