export type AnnouncementType = "manual" | "release-note" | "system";

export type AnnouncementPriority = "normal" | "important" | "strong-reminder";

export type AnnouncementStatus = "draft" | "published" | "archived";

export type AnnouncementScope = "all-users" | "admins-only";

export type AnnouncementStreamEvent = "announcement.published" | "announcement.updated";

export interface AnnouncementRecord {
  id: string;
  title: string;
  summary: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  scope: AnnouncementScope;
  pinned: boolean;
  strongReminder: boolean;
  popupEnabled: boolean;
  versionTag?: string;
  publishedAt?: number;
  expireAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  readAt?: number;
}
