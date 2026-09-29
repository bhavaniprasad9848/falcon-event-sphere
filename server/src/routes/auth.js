const express = require('express');
const { z } = require('zod');
const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { signToken } = require('../utils/tokens');
const { ROLES } = require('../constants');
const { invalidateUser } = require('../services/recommender');

const router = express.Router();

const interests = z.array(z.string().trim().min(1).max(40)).max(20);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'must be at least 8 characters').max(100),
  role: z.enum(ROLES).default('student'),
  department: z.string().trim().max(80).optional(),
  interests: interests.optional(),
});

const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1) });

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    department: z.string().trim().max(80).optional(),
    interests: interests.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

router.post('/register', validate(registerSchema), async (req, res) => {
  const { password, ...rest } = req.body;
  if (await User.exists({ email: rest.email })) throw new HttpError(409, 'Email is already registered');
  const user = await User.create({ ...rest, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

router.patch('/me', requireAuth, validate(profileSchema), async (req, res) => {
  Object.assign(req.user, req.body);
  if (req.body.interests) req.user.interests = [...new Set(req.body.interests)];
  await req.user.save();
  invalidateUser(req.user._id); // interests changed, so recommendations should too
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
