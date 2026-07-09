import { messagingApi } from "@line/bot-sdk";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";
import { recordChannelActivity } from "../infra/channel-activity.js";
import { resolveLineAccount } from "./accounts.js";
import type { LineSendResult } from "./types.js";

// Use the messaging API types directly
type Message = messagingApi.Message;
type TextMessage = messagingApi.TextMessage;
type ImageMessage = messagingApi.ImageMessage;
type LocationMessage = messagingApi.LocationMessage;
type FlexMessage = messagingApi.FlexMessage;
type FlexContainer = messagingApi.FlexContainer;
type TemplateMessage = messagingApi.TemplateMessage;
type QuickReply = messagingApi.QuickReply;
type QuickReplyItem = messagingApi.QuickReplyItem;

// Cache for user profiles
const userProfileCache = new Map<
  string,
  { displayName: string; pictureUrl?: string; fetchedAt: number }
>();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface LineSendOpts {
  channelAccessToken?: string;
  accountId?: string;
  verbose?: boolean;
  mediaUrl?: string;
  replyToken?: string;
}

function resolveToken(
  explicit: string | undefined,
  params: { accountId: string; channelAccessToken: string },
): string {
  if (explicit?.trim()) return explicit.trim();
  if (!params.channelAccessToken) {
    throw new Error(
      `LINE channel access token missing for account "${params.accountId}" (set channels.line.channelAccessToken or LINE_CHANNEL_ACCESS_TOKEN).`,
    );
  }
  return params.channelAccessToken.trim();
}

function normalizeTarget(to: string): string {
  const trimmed = to.trim();
  if (!trimmed) throw new Error("Recipient is required for LINE sends");

  // Strip internal prefixes
  let normalized = trimmed
    .replace(/^line:group:/i, "")
    .replace(/^line:room:/i, "")
    .replace(/^line:user:/i, "")
    .replace(/^line:/i, "");

  if (!normalized) throw new Error("Recipient is required for LINE sends");

  return normalized;
}

function createTextMessage(text: string): TextMessage {
  return { type: "text", text };
}

export function createImageMessage(
  originalContentUrl: string,
  previewImageUrl?: string,
): ImageMessage {
  return {
    type: "image",
    originalContentUrl,
    previewImageUrl: previewImageUrl ?? originalContentUrl,
  };
}

export function createLocationMessage(location: {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}): LocationMessage {
  return {
    type: "location",
    title: location.title.slice(0, 100), // LINE limit
    address: location.address.slice(0, 100), // LINE limit
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function logLineHttpError(err: unknown, context: string): void {
  if (!err || typeof err !== "object") return;
  const { status, statusText, body } = err as {
    status?: number;
    statusText?: string;
    body?: string;
  };
  if (typeof body === "string") {
    const summary = status ? `${status} ${statusText ?? ""}`.trim() : "unknown status";
    logVerbose(`line: ${context} failed (${summary}): ${body}`);
  }
}

export async function sendMessageLine(
  to: string,
  text: string,
  opts: LineSendOpts = {},
): Promise<LineSendResult> {
  const cfg = loadConfig();
  const account = resolveLineAccount({
    cfg,
    accountId: opts.accountId,
  });
  const token = resolveToken(opts.channelAccessToken, account);
  const chatId = normalizeTarget(to);

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: token,
  });

  const messages: Message[] = [];

  // Add media if provided
  if (opts.mediaUrl?.trim()) {
    messages.push(createImageMessage(opts.mediaUrl.trim()));
  }

  // Add text message
  if (text?.trim()) {
    messages.push(createTextMessage(text.trim()));
  }

  if (messages.length === 0) {
    throw new Error("Message must be non-empty for LINE sends");
  }

  // Use reply if we have a reply token, otherwise push
  if (opts.replyToken) {
    await client.replyMessage({
      replyToken: opts.replyToken,
      messages,
    });

    recordChannelActivity({
      channel: "line",
      accountId: account.accountId,
      direction: "outbound",
    });
// [trimmed — 629 lines total in source, showing first 150: sendMessageLine() calling client.replyMessage(...)/pushMessage(...) via @line/bot-sdk's messagingApi.MessagingApiClient — the side-effectful send call.]
