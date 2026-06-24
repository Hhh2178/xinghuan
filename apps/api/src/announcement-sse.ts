import type { ServerResponse } from "node:http";
import type { AnnouncementRecord, AnnouncementStreamEvent } from "@xinghuan/shared";

const announcementClients = new Map<string, ServerResponse>();
const ANNOUNCEMENT_PUBLISHED_EVENT: AnnouncementStreamEvent = "announcement.published";
const ANNOUNCEMENT_UPDATED_EVENT: AnnouncementStreamEvent = "announcement.updated";

export function attachAnnouncementStream(response: ServerResponse, clientId: string) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  response.write(": connected\n\n");
  announcementClients.set(clientId, response);
  response.on("close", () => {
    announcementClients.delete(clientId);
  });
}

export function broadcastAnnouncement(event: AnnouncementStreamEvent, payload: AnnouncementRecord) {
  if (event !== ANNOUNCEMENT_PUBLISHED_EVENT && event !== ANNOUNCEMENT_UPDATED_EVENT) {
    return;
  }
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of announcementClients.values()) {
    response.write(frame);
  }
}
