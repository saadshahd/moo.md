import { createClient, ClickHouseClient } from "@clickhouse/client";
import config from "./index.js";

let clickhouseClient: ClickHouseClient | null = null;

export const getClickHouseClient = (): ClickHouseClient => {
  if (!clickhouseClient) {
    clickhouseClient = createClient({
      host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      compression: {
        response: true,
        request: false,
      },
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
        async_insert_max_data_size: 10000000, // 10MB
        async_insert_busy_timeout_ms: 200,
      },
      request_timeout: 30000,
      max_open_connections: 10,
    });
  }
  return clickhouseClient;
};

export const initializeClickHouse = async (): Promise<void> => {
  const client = getClickHouseClient();

  try {
    // Test connection
    await client.ping();
    console.log("✅ ClickHouse connection established");

    // Create tables if they don't exist
    await createTables(client);
    console.log("✅ ClickHouse tables initialized");
  } catch (error) {
    console.error("❌ ClickHouse initialization failed:", error);
    throw error;
  }
};

const createTables = async (client: ClickHouseClient): Promise<void> => {
  // UI Events table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS ui_events (
        id UUID DEFAULT generateUUIDv4(),
        timestamp DateTime64(3) DEFAULT now64(3),
        session_id String,
        user_id Nullable(String),
        event_type LowCardinality(String),
        element_id Nullable(String),
        element_type Nullable(String),
        page_url String,
        user_agent String,
        viewport_width UInt16,
        viewport_height UInt16,
        properties Map(String, String),
        metadata Map(String, String),
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (timestamp, session_id, event_type)
      TTL timestamp + INTERVAL 90 DAY
      SETTINGS index_granularity = 8192
    `,
  });

  // Performance Metrics table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID DEFAULT generateUUIDv4(),
        timestamp DateTime64(3) DEFAULT now64(3),
        session_id String,
        user_id Nullable(String),
        page_url String,
        metric_type LowCardinality(String),
        metric_value Float64,
        additional_data Map(String, String),
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (timestamp, session_id, metric_type)
      TTL timestamp + INTERVAL 90 DAY
      SETTINGS index_granularity = 8192
    `,
  });

  // A/B Test Results table
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS ab_test_results (
        id UUID DEFAULT generateUUIDv4(),
        timestamp DateTime64(3) DEFAULT now64(3),
        session_id String,
        user_id Nullable(String),
        experiment_id String,
        variant_id String,
        event_type LowCardinality(String),
        conversion_value Nullable(Float64),
        properties Map(String, String),
        created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (timestamp, experiment_id, variant_id, event_type)
      TTL timestamp + INTERVAL 180 DAY
      SETTINGS index_granularity = 8192
    `,
  });
};

export const closeClickHouseConnection = async (): Promise<void> => {
  if (clickhouseClient) {
    await clickhouseClient.close();
    clickhouseClient = null;
    console.log("✅ ClickHouse connection closed");
  }
};
