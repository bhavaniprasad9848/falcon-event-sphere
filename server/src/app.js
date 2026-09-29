const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { CATEGORIES, INTEREST_SUGGESTIONS } = require('./constants');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/meta', (_req, res) =>
    res.json({ categories: CATEGORIES, interestSuggestions: INTEREST_SUGGESTIONS, aiEnabled: Boolean(config.anthropicApiKey) })
  );

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 50 });
  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/me', require('./routes/me'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
