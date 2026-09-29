const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');
  const server = createApp().listen(config.port, () => {
    console.log(`Falcon Event Sphere API on http://localhost:${config.port}`);
    console.log(config.anthropicApiKey ? 'AI recommendations: ON (Claude)' : 'AI recommendations: OFF (built-in scoring)');
  });
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
