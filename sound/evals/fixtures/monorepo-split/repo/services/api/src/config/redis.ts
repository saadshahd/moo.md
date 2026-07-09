import Redis, { RedisOptions } from "ioredis";
import config from "./index.js";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisOptions: RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      password: config.redis.password,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4, // 4 (IPv4) or 6 (IPv6)
    };

    redisClient = new Redis(redisOptions);

    redisClient.on("connect", () => {
      console.log("🔗 Redis connecting...");
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis connection established");
    });

    redisClient.on("error", (error) => {
      console.error("❌ Redis connection error:", error);
    });

    redisClient.on("close", () => {
      console.log("🔌 Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });
  }

  return redisClient;
};

export const initializeRedis = async (): Promise<void> => {
  const client = getRedisClient();

  try {
    await client.connect();
    await client.ping();
    console.log("✅ Redis initialization complete");
  } catch (error) {
    console.error("❌ Redis initialization failed:", error);
    throw error;
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("✅ Redis connection closed");
  }
};

// Redis utility functions
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = getRedisClient();
  }

  async set(key: string, value: string | object, ttl?: number): Promise<void> {
    const serializedValue =
      typeof value === "string" ? value : JSON.stringify(value);

    if (ttl) {
      await this.client.setex(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async hset(
    key: string,
    field: string,
    value: string | object,
  ): Promise<void> {
    const serializedValue =
      typeof value === "string" ? value : JSON.stringify(value);
    await this.client.hset(key, field, serializedValue);
  }

  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T> {
    return (await this.client.hgetall(key)) as T;
  }
}
