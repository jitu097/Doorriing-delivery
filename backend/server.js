const http = require('http');
const app = require('./src/app');
const { logger } = require('./src/utils/logger');
const { env } = require('./src/config/env');

const PORT = env.PORT || 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT}`);
});
