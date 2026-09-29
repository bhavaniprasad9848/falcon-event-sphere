const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const { verifyToken } = require('../utils/tokens');

async function userFromRequest(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'User no longer exists');
  return user;
}

/** Route requires a logged-in user. */
async function requireAuth(req, _res, next) {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, 'Please log in');
  req.user = user;
  next();
}

/** Route works for everyone, but knows who you are if you're logged in. */
async function optionalAuth(req, _res, next) {
  req.user = await userFromRequest(req);
  next();
}

/** Only organizers can create events. */
function requireOrganizer(req, _res, next) {
  if (req.user?.role !== 'organizer') throw new HttpError(403, 'Only organizers can do this');
  next();
}

module.exports = { requireAuth, optionalAuth, requireOrganizer };
