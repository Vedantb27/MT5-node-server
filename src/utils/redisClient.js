// utils/redisClient.js
const { createClient } = require('redis');

const client = createClient({
  url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
});

let redisReady = false;

client.on('connect', () => console.log('Redis client connected'));
client.on('ready', () => {
  console.log('Redis client ready');
  redisReady = true;
});
client.on('error', err => {
  console.error('Redis error:', err);
  redisReady = false;
});
client.on('end', () => console.log('Redis connection closed'));

(async () => {
  try {
    await client.connect();
    console.log('Redis connected');
  } catch (e) {
    console.error('Failed to connect to Redis:', e);
  }
})();

module.exports = { redisClient: client, redisReady };