/**
 * Fills the database with demo users and upcoming events.
 * Run with:  npm run seed
 * Demo logins (password for both: password123)
 *   organizer@falcon.dev  - can create events
 *   student@falcon.dev    - interested in AI, Career, Basketball
 */
const mongoose = require('mongoose');
const config = require('../src/config');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Rsvp = require('../src/models/Rsvp');

const day = 24 * 60 * 60 * 1000;
const at = (daysFromNow, hour, minute = 0) => {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const EVENTS = [
  ['Intro to Generative AI Workshop', 'Tech', ['AI', 'Workshop', 'Python'], 'Hands-on session building a small chatbot with an LLM API. Laptops required; no prior AI experience needed.', 'Library Innovation Lab', 2, 17, 2, 40],
  ['Fall Career Fair', 'Career', ['Networking', 'Resume', 'Internships'], 'Meet 60+ employers hiring for internships and full-time roles. Bring printed resumes and dress business casual.', 'Campus Center Ballroom', 5, 10, 5, null],
  ['Resume Review Drop-In', 'Career', ['Resume', 'Career'], 'Career Services advisors give quick one-on-one feedback on your resume. First come, first served.', 'Career Services Office', 1, 13, 2, 25],
  ['Falcons vs. Rivals: Basketball Home Opener', 'Sports', ['Basketball', 'Game Day'], 'Cheer on the Falcons at the season opener. Free entry with student ID, first 200 fans get a T-shirt.', 'Garvey Sports Arena', 6, 19, 2, 800],
  ['Sunrise Yoga on the Lawn', 'Wellness', ['Yoga', 'Fitness', 'Mental Health'], 'Start your morning with a relaxing all-levels yoga flow. Mats provided.', 'Central Quad', 3, 7, 1, 30],
  ['24-Hour Campus Hackathon', 'Tech', ['Hackathon', 'Web Development', 'AI'], 'Form a team, build something amazing in 24 hours, and pitch to judges. Food and swag provided.', 'Engineering Building, Floor 2', 12, 18, 24, 120],
  ['Open Mic Night', 'Music', ['Live Music', 'Poetry'], 'Sing, play, or read your poetry. Sign-up sheet opens at 6:30 PM.', 'Student Union Cafe', 4, 19, 3, null],
  ['Community Food Drive Volunteering', 'Volunteering', ['Community Service', 'Food'], 'Help sort and pack donations for the local food bank. Volunteer hours are verified.', 'Riverside Food Bank', 8, 9, 4, 20],
  ['Data Science Speaker Series: ML in Healthcare', 'Academic', ['Data Science', 'AI', 'Research'], 'A guest researcher shares how machine learning models are used to predict patient outcomes.', 'Science Hall Auditorium', 9, 16, 1, 150],
  ['Watercolor Painting Social', 'Arts', ['Painting', 'Social'], 'Relax and paint with friends. All supplies included; beginners very welcome.', 'Art Studio 104', 7, 18, 2, 18],
  ['International Food Festival', 'Social', ['Cultural', 'Food'], 'Taste dishes from more than 20 countries, prepared by student cultural organizations.', 'Central Quad', 10, 12, 4, null],
  ['Cybersecurity CTF Night', 'Tech', ['Cybersecurity', 'Gaming'], 'Capture-the-flag challenges for beginners and experts. Teams of up to 3.', 'Computer Lab 210', 11, 18, 3, 45],
  ['Startup Pitch Competition', 'Career', ['Startups', 'Networking'], 'Student founders pitch to local investors for $5,000 in seed prizes.', 'Business School Atrium', 14, 17, 3, 200],
  ['Intramural Soccer Sign-Up Day', 'Sports', ['Soccer', 'Fitness'], 'Build a team or join as a free agent for the fall intramural league.', 'Rec Center Field', 2, 15, 3, null],
  ['Photography Walk: Campus at Golden Hour', 'Arts', ['Photography', 'Outdoors'], 'Guided photo walk with tips on composition and light. Phone cameras welcome.', 'Meet at Main Gate', 5, 17, 2, 20],
  ['Stress Less: Finals Prep Wellness Fair', 'Wellness', ['Mental Health', 'Wellness'], 'Therapy dogs, study tips, free snacks, and quiet spaces before finals week.', 'Library Main Floor', 20, 11, 5, null],
];

async function main() {
  await mongoose.connect(config.mongoUri);
  await Promise.all([User.deleteMany({}), Event.deleteMany({}), Rsvp.deleteMany({})]);

  const passwordHash = await User.hashPassword('password123');
  const organizer = await User.create({
    name: 'Campus Events Office', email: 'organizer@falcon.dev', passwordHash, role: 'organizer', department: 'Student Life',
  });
  const student = await User.create({
    name: 'Demo Student', email: 'student@falcon.dev', passwordHash, role: 'student',
    department: 'Computer Science', interests: ['AI', 'Career', 'Basketball'],
  });
  const crowd = await User.insertMany(
    Array.from({ length: 12 }, (_, i) => ({ name: `Student ${i + 1}`, email: `s${i + 1}@falcon.dev`, passwordHash }))
  );

  const events = await Event.insertMany(
    EVENTS.map(([title, category, tags, description, place, days, hour, hours, capacity]) => ({
      title, category, tags, description,
      location: { name: place, address: '' },
      startsAt: at(days, hour),
      endsAt: new Date(at(days, hour).getTime() + hours * 60 * 60 * 1000),
      capacity, seatsLeft: capacity,
      organizer: organizer._id, organizerName: organizer.name,
    }))
  );

  // Give some events a crowd so "popular" sorting has something to show
  const rsvps = [];
  events.forEach((event, i) => {
    const n = (i * 5) % crowd.length;
    crowd.slice(0, n).forEach((u) => rsvps.push({ event: event._id, user: u._id, status: 'going' }));
  });
  await Rsvp.insertMany(rsvps);
  for (const event of events) {
    const going = rsvps.filter((r) => r.event.equals(event._id)).length;
    await Event.updateOne({ _id: event._id }, {
      goingCount: going,
      seatsLeft: event.capacity == null ? null : event.capacity - going,
    });
  }

  console.log(`Seeded ${events.length} events, ${crowd.length + 2} users, ${rsvps.length} RSVPs.`);
  console.log('Log in as organizer@falcon.dev or student@falcon.dev (password: password123)');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
