const Redis = require("ioredis");
const env = require("../config/env");

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const record = this.store.get(key);
    if (!record) return null;

    if (record.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return record.value;
  }

  set(key, value, ttlSeconds = env.cacheTtlSeconds) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  deletePattern(pattern) {
    const regexPattern = new RegExp(
      "^" + pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&").replace(/\*/g, ".*") + "$"
    );

    for (const key of this.store.keys()) {
      if (regexPattern.test(key)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

class HybridCacheService {
  constructor() {
    this.memoryCache = new MemoryCache();
    this.redisClient = null;
    this.isRedisReady = false;

    this.initRedis();
  }

  initRedis() {
    const redisTarget = env.redisUrl || (process.env.REDIS_URL ? process.env.REDIS_URL : null);

    if (redisTarget) {
      try {
        this.redisClient = new Redis(redisTarget, {
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: () => null,
          lazyConnect: false,
        });

        this.redisClient.on("connect", () => {
          this.isRedisReady = true;
          console.log("[Cache] Connected to Redis successfully.");
        });

        this.redisClient.on("error", (err) => {
          this.isRedisReady = false;
        });

        this.redisClient.on("close", () => {
          this.isRedisReady = false;
        });
      } catch (error) {
        this.isRedisReady = false;
      }
    }
  }

  async get(key) {
    if (this.isRedisReady && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw !== null) {
          return JSON.parse(raw);
        }
      } catch (err) {
      }
    }

    return this.memoryCache.get(key);
  }

  async set(key, value, ttlSeconds = env.cacheTtlSeconds) {
    this.memoryCache.set(key, value, ttlSeconds);

    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
      } catch (err) {
      }
    }
  }

  async delete(key) {
    this.memoryCache.delete(key);

    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
      }
    }
  }

  async deletePattern(pattern) {
    this.memoryCache.deletePattern(pattern);

    if (this.isRedisReady && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err) {
      }
    }
  }

  async clear() {
    this.memoryCache.clear();

    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (err) {
      }
    }
  }

  getType() {
    return this.isRedisReady ? "redis" : "memory";
  }
}

module.exports = new HybridCacheService();
