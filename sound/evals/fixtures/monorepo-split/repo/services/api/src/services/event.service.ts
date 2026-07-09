import { ClickHouseClient } from "@clickhouse/client";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { validate } from "ajv";

import { databaseClient } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import {
  UIEventSchema,
  PerformanceMetricSchema,
  ABTestResultSchema,
  EventBatchSchema,
} from "../schemas/event.schema.js";
import type {
  UIEvent,
  PerformanceMetric,
  ABTestResult,
  EventBatch,
  WebSocketMessage,
  QueryOptions,
  QueryResult,
} from "../types/index.js";

export interface EventHistoryOptions {
  sessionId?: string;
  eventType?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface SessionStats {
  sessionId: string;
  totalEvents: number;
  eventTypes: Record<string, number>;
  duration: number;
  lastActivity: string;
  performanceMetrics: {
    averageLoadTime?: number;
    totalInteractions: number;
    errorCount: number;
  };
}

export interface BatchProcessResult {
  processedIds: string[];
  processedCount: number;
  failedCount: number;
  errors?: Array<{ index: number; error: string }>;
}

export class EventService {
  private clickhouse: ClickHouseClient;
  private redis: Redis;
  private realtimeChannel = "realtime_events";

  constructor() {
    this.clickhouse = databaseClient;
    this.redis = redisClient;
  }

  /**
   * Process a single UI event
   */
  async processUIEvent(event: UIEvent): Promise<string> {
    const eventId = event.id || randomUUID();
    const timestamp = event.timestamp || new Date().toISOString();

    // Validate the event
    this.validateUIEvent(event);

    // Enrich event with additional data
    const enrichedEvent = {
      ...event,
      id: eventId,
      timestamp,
      processed_at: new Date().toISOString(),
    };

    // Insert into ClickHouse
    await this.insertUIEvent(enrichedEvent);

    // Publish to Redis for real-time processing
    await this.publishEvent("ui_event", enrichedEvent);

    // Update session tracking
    await this.updateSessionTracking(event.sessionId, timestamp);

    return eventId;
  }

  /**
   * Process a performance metric
   */
  async processPerformanceMetric(metric: PerformanceMetric): Promise<string> {
    const metricId = metric.id || randomUUID();
    const timestamp = metric.timestamp || new Date().toISOString();

    // Validate the metric
    this.validatePerformanceMetric(metric);

    const enrichedMetric = {
      ...metric,
      id: metricId,
      timestamp,
      processed_at: new Date().toISOString(),
    };

    // Insert into ClickHouse
    await this.insertPerformanceMetric(enrichedMetric);

    // Publish to Redis
    await this.publishEvent("performance_metric", enrichedMetric);

    // Update session tracking
    await this.updateSessionTracking(metric.sessionId, timestamp);

    return metricId;
  }

  /**
   * Process an A/B test result
   */
  async processABTestResult(result: ABTestResult): Promise<string> {
    const resultId = result.id || randomUUID();
    const timestamp = result.timestamp || new Date().toISOString();

    // Validate the result
    this.validateABTestResult(result);

    const enrichedResult = {
      ...result,
      id: resultId,
      timestamp,
      processed_at: new Date().toISOString(),
    };

    // Insert into ClickHouse
    await this.insertABTestResult(enrichedResult);

    // Publish to Redis
    await this.publishEvent("ab_test_result", enrichedResult);

    // Update session tracking
    await this.updateSessionTracking(result.sessionId, timestamp);

    return resultId;
  }

// [trimmed — 604 lines total in source, showing first 150: processUIEvent/processPerformanceMetric/processABTestResult, each pattern is ClickHouse insert + this.publishEvent(...) to Redis]
