const Event = require('../models/Event');
const Rsvp = require('../models/Rsvp');
const config = require('../config');

/**
 * Recommendation engine in two stages:
 *  1. Content-based scoring (always on): compares each upcoming event with the
 *     student's interests and with events they've RSVP'd to before.
 *  2. Optional LLM re-ranking with Claude: the top candidates plus the student's
 *     profile are sent to the model, which picks the best matches and writes a
 *     one-line reason for each. If the API key is missing or the call fails,
 *     we fall back to stage 1 so the page always works.
 */

const norm = (s) => s.toLowerCase().trim();
const DAY = 24 * 60 * 60 * 1000;

function buildProfile(user, pastEvents) {
  const interests = new Set(user.interests.map(norm));
  const historyCategories = new Map();
  const historyTags = new Map();
  for (const e of pastEvents) {
    historyCategories.set(e.category, (historyCategories.get(e.category) || 0) + 1);
    for (const t of e.tags) historyTags.set(norm(t), (historyTags.get(norm(t)) || 0) + 1);
  }
  return { interests, historyCategories, historyTags, pastEvents };
}

/** Score one event for one student. Returns { score, reasons[] }. */
function scoreEvent(event, profile, now = Date.now()) {
  let score = 0;
  const reasons = [];
  const tags = event.tags.map(norm);

  if (profile.interests.has(norm(event.category))) {
    score += 3;
    reasons.push(`Matches your interest in ${event.category}`);
  }
  const tagHits = event.tags.filter((t) => profile.interests.has(norm(t)));
  if (tagHits.length) {
    score += 2 * tagHits.length;
    reasons.push(`Matches your interest in ${tagHits.slice(0, 2).join(' & ')}`);
  }

  const catHistory = profile.historyCategories.get(event.category) || 0;
  if (catHistory) {
    score += 1.5 * Math.min(catHistory, 3);
    const similar = profile.pastEvents.find((p) => p.category === event.category);
    if (similar) reasons.push(`Similar to "${similar.title}"`);
  }
  const historyTagHits = tags.filter((t) => profile.historyTags.has(t)).length;
  score += Math.min(historyTagHits, 3);

  // A little boost for popular and soon-happening events
  score += 0.5 * Math.log1p(event.goingCount);
  const daysAway = (new Date(event.startsAt).getTime() - now) / DAY;
  if (daysAway >= 0 && daysAway <= 7) score += 0.5;

  if (!reasons.length && event.goingCount >= 5) reasons.push(`Popular: ${event.goingCount} students going`);
  if (!reasons.length) reasons.push('Happening soon on campus');
  return { score, reasons };
}

// ---- Optional LLM stage ----

let llmClient = null;
function getLlmClient() {
  if (llmClient) return llmClient;
  if (!config.anthropicApiKey) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  llmClient = new Anthropic({ apiKey: config.anthropicApiKey, timeout: 8000, maxRetries: 1 });
  return llmClient;
}
/** Tests can inject a fake client. Pass null to reset. */
function setLlmClient(client) {
  llmClient = client;
}

async function llmRerank(user, profile, ranked, limit) {
  const client = getLlmClient();
  if (!client) return null;

  const candidates = ranked.slice(0, 15).map(({ event }) => ({
    id: event._id.toString(),
    title: event.title,
    category: event.category,
    tags: event.tags,
    startsAt: event.startsAt,
    summary: event.description.slice(0, 200),
  }));
  const prompt = [
    'You recommend campus events to a university student.',
    `Student interests: ${user.interests.join(', ') || 'none given'}.`,
    `Department: ${user.department || 'unknown'}.`,
    `Events they RSVP'd to before: ${profile.pastEvents.map((e) => e.title).join('; ') || 'none'}.`,
    '',
    `Pick the ${limit} best events for this student from the candidates below.`,
    'For each, write a short, specific reason (max 15 words) addressed to the student.',
    'Reply with JSON only, in this exact shape: {"picks":[{"id":"<event id>","reason":"<reason>"}]}',
    '',
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join('\n');

  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

  // Only trust ids that were actually in the candidate list
  const byId = new Map(ranked.map((r) => [r.event._id.toString(), r.event]));
  const picks = (json.picks || [])
    .filter((p) => byId.has(p.id) && typeof p.reason === 'string')
    .slice(0, limit)
    .map((p) => ({ event: byId.get(p.id), reason: p.reason.slice(0, 160) }));
  return picks.length ? picks : null;
}

// Small per-user cache so we don't call the LLM on every page load.
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const invalidateUser = (userId) => cache.delete(userId.toString());

async function recommendFor(user, { limit = 6 } = {}) {
  const key = user._id.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now() && hit.limit === limit) return hit.value;

  const now = new Date();
  const rsvps = await Rsvp.find({ user: user._id }).select('event');
  const rsvpIds = rsvps.map((r) => r.event);
  const pastEvents = await Event.find({ _id: { $in: rsvpIds } }).select('title category tags');

  const candidates = await Event.find({
    cancelled: false,
    startsAt: { $gte: now },
    _id: { $nin: rsvpIds },
    organizer: { $ne: user._id },
  })
    .sort({ startsAt: 1 })
    .limit(200);

  const profile = buildProfile(user, pastEvents);
  const hasSignals = profile.interests.size > 0 || pastEvents.length > 0;
  const ranked = candidates
    .map((event) => ({ event, ...scoreEvent(event, profile) }))
    .sort((a, b) => b.score - a.score);

  let value;
  let ai = null;
  if (hasSignals && ranked.length) {
    try {
      ai = await llmRerank(user, profile, ranked, limit);
    } catch (err) {
      if (!config.isTest) console.warn('LLM re-rank failed, using built-in scores:', err.message);
    }
  }

  if (ai) {
    value = { source: 'ai', items: ai };
  } else if (hasSignals) {
    value = { source: 'personalized', items: ranked.slice(0, limit).map((r) => ({ event: r.event, reason: r.reasons[0] })) };
  } else {
    const popular = [...candidates].sort((a, b) => b.goingCount - a.goingCount).slice(0, limit);
    value = {
      source: 'popular',
      items: popular.map((event) => ({ event, reason: 'Popular on campus. Add interests to personalize.' })),
    };
  }

  cache.set(key, { value, limit, expires: Date.now() + CACHE_MS });
  return value;
}

module.exports = { recommendFor, scoreEvent, buildProfile, setLlmClient, invalidateUser };
