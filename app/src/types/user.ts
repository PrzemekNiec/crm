import type { Timestamp } from "firebase/firestore";

export type DeviceMode = "trusted" | "shared";

export type CalendarCompletionBehavior = "keep_mark_done" | "delete";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  timezone: string;
  deviceMode: DeviceMode;
  authPersistenceMode: "local" | "session";
  calendarCompletionBehavior: CalendarCompletionBehavior;
  defaultEventDurationMin: number;
  defaultReminderMin: number;
  inactiveClientAlertDays: number;
  onboardingCompleted: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  updatedAt: Timestamp;
}
