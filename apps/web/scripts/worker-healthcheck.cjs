// Healthcheck cho container worker (BullMQ) — xem service `worker` trong
// docker-compose.prod.yml. Worker không mở cổng HTTP; nó chỉ sống được khi nói
// chuyện được với Redis, nên PING Redis là tín hiệu sát nhất.
// Exit 0 = healthy, 1 = unhealthy. Luôn tự thoát trong ~4s (healthcheck timeout 5s).
const IORedis = require("ioredis");

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  connectTimeout: 3000,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
  lazyConnect: true,
});

const fail = (msg) => {
  console.error(`[worker-healthcheck] ${msg}`);
  process.exit(1);
};

setTimeout(() => fail("timed out"), 4000).unref();
// Lỗi kết nối đã đi qua .catch bên dưới; nuốt event để ioredis khỏi in
// "Unhandled error event" kèm stack vào log healthcheck.
redis.on("error", () => {});

redis
  .connect()
  .then(() => redis.ping())
  .then((reply) => {
    if (reply !== "PONG") fail(`unexpected reply: ${reply}`);
    redis.disconnect();
    process.exit(0);
  })
  .catch((err) => fail(err.message));
