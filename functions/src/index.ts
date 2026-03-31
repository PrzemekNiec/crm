import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { OAuth2Client } from "google-auth-library";
import * as crypto from "crypto";


initializeApp();
const db = getFirestore();

// ─── Environment config ─────────────────────────────────────
const googleClientId = defineString("GOOGLE_CLIENT_ID");
const googleClientSecret = defineString("GOOGLE_CLIENT_SECRET");
const webhookUrl = defineString("CALENDAR_WEBHOOK_URL");

// ─── connectGoogleCalendar ──────────────────────────────────
// Accepts an auth code from the frontend, exchanges it for
// access + refresh tokens, and stores them in Firestore.

export const connectGoogleCalendar = onCall(
  { region: "europe-west1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    }
    const uid = request.auth.uid;

    // 2. Validate input
    const code = request.data?.code;
    if (!code || typeof code !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Brakuje kodu autoryzacji (code)."
      );
    }

    // 3. Exchange code for tokens
    const oauth2Client = new OAuth2Client(
      googleClientId.value(),
      googleClientSecret.value(),
      "postmessage" // redirect_uri for popup flow
    );

    let tokens;
    try {
      const { tokens: t } = await oauth2Client.getToken({
        code,
        // Force offline access to get refresh_token
      });
      tokens = t;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Token exchange failed";
      logger.error("calendar.oauth.exchangeFailed", { error: message });
      throw new HttpsError(
        "internal",
        "Nie udało się wymienić kodu na tokeny Google."
      );
    }

    if (!tokens.access_token) {
      throw new HttpsError(
        "internal",
        "Google nie zwrócił access_token."
      );
    }

    // 4. Save tokens in Firestore
    const integrationRef = db
      .collection("users")
      .doc(uid)
      .collection("integrations")
      .doc("google_workspace");

    await integrationRef.set(
      {
        connected: true,
        oauthStatus: "active",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date ?? null,
        scope: tokens.scope ?? null,
        connectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("calendar.oauth.connected", { uid });

    return { success: true };
  }
);

// ─── Helper: refresh access token if expired ────────────────
// Base version returns null on failure (safe for webhook context).

async function tryGetValidAccessToken(
  uid: string
): Promise<{ accessToken: string; calendarId: string } | null> {
  const integrationRef = db
    .collection("users")
    .doc(uid)
    .collection("integrations")
    .doc("google_workspace");

  const snap = await integrationRef.get();
  if (!snap.exists) return null;

  const data = snap.data()!;
  if (data.oauthStatus === "reauth_required") return null;

  let accessToken = data.accessToken as string;
  const refreshToken = data.refreshToken as string | null;
  const expiry = data.tokenExpiry as number | null;
  const calendarId = (data.selectedCalendarId as string) || "primary";

  // Refresh if expired or about to expire (5 min buffer)
  const isExpired = expiry != null && Date.now() > expiry - 5 * 60 * 1000;

  if (isExpired && refreshToken) {
    const oauth2Client = new OAuth2Client(
      googleClientId.value(),
      googleClientSecret.value()
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token!;

      await integrationRef.update({
        accessToken,
        tokenExpiry: credentials.expiry_date ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      logger.error("calendar.oauth.refreshFailed", { uid, error: String(err) });
      await integrationRef.update({
        oauthStatus: "reauth_required",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return null;
    }
  }

  return { accessToken, calendarId };
}

// Throwing version for onCall functions.
async function getValidAccessToken(
  uid: string
): Promise<{ accessToken: string; calendarId: string }> {
  const result = await tryGetValidAccessToken(uid);
  if (!result) {
    throw new HttpsError(
      "failed-precondition",
      "Brak połączenia z Google Calendar lub token wygasł. Połącz ponownie konto."
    );
  }
  return result;
}

// ─── syncTaskToGoogleCalendar ───────────────────────────────
// Creates or updates a Google Calendar event for a task.

interface SyncTaskData {
  taskId: string;
  title: string;
  description?: string;
  dueDate: string; // ISO string
  durationMin: number;
  googleEventId: string;
  type?: string; // task type: call, meeting, followup, docs, check, custom
}

// ─── Smart formatting for Google Calendar events ────────────
const CALENDAR_FORMAT: Record<string, { emoji: string; colorId: string }> = {
  call: { emoji: "📞", colorId: "4" },       // Pink / Flamingo
};
const DEFAULT_FORMAT = { emoji: "💼", colorId: "11" }; // Red / Tomato

function formatForCalendar(
  title: string,
  type?: string
): { summary: string; colorId: string } {
  const fmt = (type && CALENDAR_FORMAT[type]) || DEFAULT_FORMAT;
  return { summary: `${fmt.emoji} ${title}`, colorId: fmt.colorId };
}

// Regex to strip CRM emoji prefixes from Google Calendar titles
const EMOJI_PREFIX_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s+/u;

export const syncTaskToGoogleCalendar = onCall(
  { region: "europe-west1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    }
    const uid = request.auth.uid;

    // 2. Validate input
    const data = request.data as SyncTaskData;
    if (!data.taskId || !data.title || !data.dueDate || !data.googleEventId) {
      throw new HttpsError(
        "invalid-argument",
        "Brakuje wymaganych danych zadania."
      );
    }

    // 3. Get valid access token
    const { accessToken, calendarId } = await getValidAccessToken(uid);

    // 4. Build calendar event with smart formatting (emoji + color)
    const startDate = new Date(data.dueDate);
    const endDate = new Date(
      startDate.getTime() + (data.durationMin || 30) * 60 * 1000
    );

    const { summary, colorId } = formatForCalendar(data.title, data.type);

    const event = {
      id: data.googleEventId,
      summary,
      colorId,
      description: data.description || "",
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "Europe/Warsaw",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "Europe/Warsaw",
      },
    };

    // 5. Upsert event (try PATCH first, if 404 then insert with custom ID)
    let htmlLink: string | null = null;

    try {
      // Try PATCH first (most syncs after initial create will be updates)
      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${data.googleEventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (patchRes.ok) {
        const body = await patchRes.json();
        htmlLink = body.htmlLink ?? null;
      } else if (patchRes.status === 404) {
        // Event doesn't exist yet — use standard insert (NOT /import)
        // The id field in the body tells Google to use our custom event ID
        const insertRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );

        if (!insertRes.ok) {
          const errBody = await insertRes.text();
          logger.error("calendar.sync.insertFailed", { uid, error: errBody });
          throw new Error(`Calendar API insert failed: ${insertRes.status}`);
        }
        const body = await insertRes.json();
        htmlLink = body.htmlLink ?? null;
      } else {
        const errBody = await patchRes.text();
        logger.error("calendar.sync.patchFailed", { uid, error: errBody });
        throw new Error(`Calendar API patch failed: ${patchRes.status}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Calendar API error";
      logger.error("calendar.sync.taskFailed", { uid, error: message });

      // Update task sync state to failed
      await db
        .collection("users")
        .doc(uid)
        .collection("tasks")
        .doc(data.taskId)
        .update({
          syncState: "failed",
          syncErrorMessage: message,
          syncAttempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

      throw new HttpsError(
        "internal",
        "Nie udało się zsynchronizować z kalendarzem."
      );
    }

    // 6. Update task document with sync result
    //    Read current syncRevision so we mark it as processed (anti-loop)
    const taskRef = db
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .doc(data.taskId);

    const taskSnap = await taskRef.get();
    const currentSyncRevision = taskSnap.exists
      ? (taskSnap.data()?.syncRevision ?? 0)
      : 0;

    await taskRef.update({
      syncState: "synced",
      googleEventHtmlLink: htmlLink,
      lastSyncedCalendarId: calendarId,
      lastSyncedAt: FieldValue.serverTimestamp(),
      lastProcessedSyncRevision: currentSyncRevision,
      syncErrorCode: null,
      syncErrorMessage: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("calendar.sync.taskSynced", { uid, taskId: data.taskId });

    return { success: true, googleEventId: data.googleEventId, htmlLink };
  }
);

// ─── deleteTaskFromGoogleCalendar ─────────────────────────────
// Deletes a Google Calendar event by its event ID.

export const deleteTaskFromGoogleCalendar = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    }
    const uid = request.auth.uid;

    const googleEventId = request.data?.googleEventId;
    if (!googleEventId || typeof googleEventId !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Brakuje googleEventId."
      );
    }

    const { accessToken, calendarId } = await getValidAccessToken(uid);

    const deleteRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 = success, 404 = already gone, 410 = deleted — all fine
    if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
      const errBody = await deleteRes.text();
      logger.error("calendar.sync.deleteFailed", { uid, googleEventId, error: errBody });
      throw new HttpsError(
        "internal",
        "Nie udało się usunąć wydarzenia z kalendarza."
      );
    }

    logger.info("calendar.sync.eventDeleted", { uid, googleEventId });
    return { success: true };
  }
);

// ─── registerCalendarWatch ──────────────────────────────────
// Registers a Google Calendar push notification channel and
// obtains the initial syncToken for incremental sync.

export const registerCalendarWatch = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    }
    const uid = request.auth.uid;
    const { accessToken, calendarId } = await getValidAccessToken(uid);

    // 0. Stop existing watch channel (if any) to avoid duplicates
    const integrationRef = db
      .collection("users")
      .doc(uid)
      .collection("integrations")
      .doc("google_workspace");

    const existingSnap = await integrationRef.get();
    const existingData = existingSnap.data();
    const oldChannelId = existingData?.calendar?.watchChannelId as string | undefined;
    const oldResourceId = existingData?.calendar?.watchResourceId as string | undefined;

    if (oldChannelId && oldResourceId) {
      const stopped = await stopWatchChannel(accessToken, oldChannelId, oldResourceId);
      if (stopped) {
        logger.info("calendar.watch.stopped", { uid, channelId: oldChannelId });
      }
      await db.collection("calendarWatchChannels").doc(oldChannelId).delete().catch(() => {});
    }

    // 1–4. Register new channel (syncToken + watch + Firestore)
    try {
      const { channelId } = await registerNewWatchChannel(uid, accessToken, calendarId);
      logger.info("calendar.watch.registered", { uid, channelId });
      return { success: true, channelId };
    } catch (err) {
      logger.error("calendar.watch.registerFailed", {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError(
        "internal",
        "Nie udało się zarejestrować webhooka kalendarza."
      );
    }
  }
);

// ─── googleCalendarWebhook ──────────────────────────────────
// HTTP endpoint that receives push notifications from Google
// Calendar. Processes changed events and updates CRM tasks.

export const googleCalendarWebhook = onRequest(
  { region: "europe-west1", invoker: "public" },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const channelId = req.headers["x-goog-channel-id"] as string | undefined;
    const resourceState = req.headers["x-goog-resource-state"] as
      | string
      | undefined;

    // Initial sync confirmation — just acknowledge
    if (resourceState === "sync") {
      logger.info("calendar.webhook.syncConfirmed", { channelId: channelId ?? "unknown" });
      res.status(200).send("OK");
      return;
    }

    if (!channelId) {
      logger.error("calendar.webhook.missingChannelId");
      res.status(200).send("OK");
      return;
    }

    try {
      // 1. Find user by channelId
      const channelSnap = await db
        .collection("calendarWatchChannels")
        .doc(channelId)
        .get();

      if (!channelSnap.exists) {
        logger.error("calendar.webhook.unknownChannel", { channelId });
        res.status(200).send("OK");
        return;
      }

      const uid = channelSnap.data()!.uid as string;

      // 2. Get integration data
      const integrationRef = db
        .collection("users")
        .doc(uid)
        .collection("integrations")
        .doc("google_workspace");

      const integrationSnap = await integrationRef.get();
      if (!integrationSnap.exists) {
        logger.error("calendar.webhook.noIntegration", { uid });
        res.status(200).send("OK");
        return;
      }

      const integrationData = integrationSnap.data()!;
      const syncToken = integrationData.calendar?.syncToken as
        | string
        | undefined;
      const calendarId =
        (integrationData.selectedCalendarId as string) || "primary";

      if (!syncToken) {
        logger.error("calendar.webhook.noSyncToken", { uid });
        res.status(200).send("OK");
        return;
      }

      // 3. Get valid access token
      const tokenResult = await tryGetValidAccessToken(uid);
      if (!tokenResult) {
        logger.error("calendar.webhook.noAccessToken", { uid });
        res.status(200).send("OK");
        return;
      }

      // 4. Incremental sync — fetch only changed events
      let newSyncToken: string | null = null;
      let pageToken: string | undefined;
      const changedEvents: Array<{
        id: string;
        status: string;
        summary?: string;
        description?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }> = [];

      do {
        const params = new URLSearchParams({ syncToken });
        if (pageToken) params.set("pageToken", pageToken);

        const listRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          {
            headers: {
              Authorization: `Bearer ${tokenResult.accessToken}`,
            },
          }
        );

        if (listRes.status === 410) {
          // syncToken expired — perform full re-sync to recover
          logger.warn("calendar.sync.tokenExpired", { uid });

          // Re-fetch all events to get new syncToken
          let recoveryPageToken: string | undefined;
          let recoverySyncToken: string | null = null;

          do {
            const rp = new URLSearchParams({ maxResults: "250", showDeleted: "true" });
            if (recoveryPageToken) rp.set("pageToken", recoveryPageToken);

            const recoveryRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${rp}`,
              { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
            );

            if (!recoveryRes.ok) {
              logger.error("calendar.sync.fullResyncFailed", { uid, status: recoveryRes.status });
              await integrationRef.update({
                "calendar.syncToken": null,
                updatedAt: FieldValue.serverTimestamp(),
              });
              res.status(200).send("OK");
              return;
            }

            const recoveryData = await recoveryRes.json();
            if (recoveryData.items) {
              changedEvents.push(...recoveryData.items);
            }
            recoverySyncToken = recoveryData.nextSyncToken ?? null;
            recoveryPageToken = recoveryData.nextPageToken;
          } while (recoveryPageToken);

          if (recoverySyncToken) {
            await integrationRef.update({
              "calendar.syncToken": recoverySyncToken,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          logger.info("calendar.sync.fullResyncComplete", { uid, eventsCount: changedEvents.length });
          // Fall through to process changed events below
          break;
        }

        if (!listRes.ok) {
          const err = await listRes.text();
          logger.error("calendar.webhook.eventsListFailed", { uid, error: err });
          res.status(200).send("OK");
          return;
        }

        const data = await listRes.json();
        if (data.items) {
          changedEvents.push(...data.items);
        }
        newSyncToken = data.nextSyncToken ?? null;
        pageToken = data.nextPageToken;
      } while (pageToken);

      // 5. Save new syncToken
      if (newSyncToken) {
        await integrationRef.update({
          "calendar.syncToken": newSyncToken,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 6. Process changed events — only our CRM events (prefix "crmtask")
      const crmEvents = changedEvents.filter(
        (e) => e.id && e.id.startsWith("crmtask")
      );

      if (crmEvents.length === 0) {
        logger.info("calendar.webhook.noCrmEvents", { uid });
        res.status(200).send("OK");
        return;
      }

      logger.info("calendar.webhook.processing", { uid, count: crmEvents.length });

      const tasksRef = db.collection("users").doc(uid).collection("tasks");

      for (const event of crmEvents) {
        // Find task by googleEventId
        const taskQuery = await tasksRef
          .where("googleEventId", "==", event.id)
          .limit(1)
          .get();

        if (taskQuery.empty) {
          logger.info("calendar.webhook.taskNotFound", { uid, eventId: event.id });
          continue;
        }

        const taskDoc = taskQuery.docs[0];
        const taskData = taskDoc.data();

        // Event cancelled/deleted in Google Calendar
        if (event.status === "cancelled") {
          logger.info("calendar.webhook.eventCancelled", { uid, eventId: event.id });
          continue;
        }

        // Build update payload — ANTI-LOOP: do NOT increment syncRevision
        const update: Record<string, unknown> = {
          updatedBy: "google_webhook",
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Update title if changed — strip CRM emoji prefix first
        if (event.summary) {
          const cleanTitle = event.summary.replace(EMOJI_PREFIX_RE, "");
          if (cleanTitle !== taskData.title) {
            update.title = cleanTitle;
          }
        }

        // Update description if changed
        if (
          event.description !== undefined &&
          event.description !== taskData.description
        ) {
          update.description = event.description;
        }

        // Update dueDate if changed
        const eventStart =
          event.start?.dateTime || event.start?.date || null;
        if (eventStart) {
          const newDueAt = new Date(eventStart);
          const oldDueAt = taskData.dueAt?.toDate
            ? taskData.dueAt.toDate()
            : null;

          // Only update if date actually changed (> 60s difference)
          if (
            !oldDueAt ||
            Math.abs(newDueAt.getTime() - oldDueAt.getTime()) > 60000
          ) {
            update.dueAt = newDueAt;
          }
        }

        // ANTI-LOOP: set lastProcessedSyncRevision = syncRevision
        // so the CRM→Google sync won't re-trigger
        update.lastProcessedSyncRevision = taskData.syncRevision ?? 0;
        update.syncState = "synced";

        // Only write if there are actual data changes
        const hasDataChanges = Object.keys(update).some(
          (k) =>
            !["updatedBy", "updatedAt", "lastProcessedSyncRevision", "syncState"].includes(k)
        );

        if (hasDataChanges) {
          await taskDoc.ref.update(update);
          logger.info("calendar.webhook.taskUpdated", { uid, taskId: taskDoc.id });
        } else {
          logger.info("calendar.webhook.noChanges", { uid, taskId: taskDoc.id });
        }
      }

      logger.info("calendar.webhook.done", { uid });
    } catch (err) {
      logger.error("calendar.webhook.processingError", { error: String(err) });
    }

    res.status(200).send("OK");
  }
);

// ─── onDealRejected: Calendar Soft Delete ───────────────
// Listens for deal rejection and updates related Google Calendar
// events with [ODRZUCONE] prefix + cleared reminders.
// Retry-safe (idempotent) + structured logging.

const REJECTED_PREFIX = "[ODRZUCONE] ";

export const onDealRejected = onDocumentUpdated(
  {
    document: "users/{uid}/deals/{dealId}",
    region: "europe-west1",
    retry: true,
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    // Only fire when isRejected transitions from falsy → true
    if (beforeData.isRejected || !afterData.isRejected) return;

    const uid = event.params.uid;
    const dealId = event.params.dealId;
    const clientId = afterData.clientId as string | undefined;

    logger.info("Deal rejected — starting calendar soft delete", {
      uid,
      dealId,
      clientId,
    });

    if (!clientId) {
      logger.warn("Deal has no clientId, skipping calendar cleanup", {
        uid,
        dealId,
      });
      return;
    }

    // 1. Get valid access token (returns null if no connection / reauth needed)
    const tokenResult = await tryGetValidAccessToken(uid);
    if (!tokenResult) {
      logger.warn(
        "Cannot get Google access token for user — calendar cleanup skipped",
        { uid, dealId }
      );
      return;
    }

    const { accessToken, calendarId } = tokenResult;

    // 2. Query tasks for this client that have a Google Calendar event
    const tasksSnap = await db
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .where("clientId", "==", clientId)
      .where("googleEventId", "!=", null)
      .get();

    if (tasksSnap.empty) {
      logger.info("No calendar-synced tasks found for client", {
        uid,
        dealId,
        clientId,
      });
      return;
    }

    logger.info(`Found ${tasksSnap.size} calendar events to update`, {
      uid,
      dealId,
      clientId,
    });

    // 3. PATCH each calendar event: prefix title + clear reminders
    for (const taskDoc of tasksSnap.docs) {
      const taskData = taskDoc.data();
      const googleEventId = taskData.googleEventId as string;

      try {
        // Fetch current event to check title (idempotency)
        const getRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (getRes.status === 404 || getRes.status === 410) {
          logger.info("Calendar event already deleted, skipping", {
            uid,
            googleEventId,
            taskId: taskDoc.id,
          });
          continue;
        }

        if (!getRes.ok) {
          const errBody = await getRes.text();
          logger.error("Failed to GET calendar event", {
            uid,
            googleEventId,
            taskId: taskDoc.id,
            status: getRes.status,
            error: errBody,
          });
          continue;
        }

        const eventData = await getRes.json();
        const currentSummary = (eventData.summary as string) || "";

        // Idempotency: skip if prefix already present
        if (currentSummary.startsWith(REJECTED_PREFIX)) {
          logger.info("Event already has [ODRZUCONE] prefix, skipping", {
            uid,
            googleEventId,
            taskId: taskDoc.id,
          });
          continue;
        }

        // PATCH: add prefix + clear reminders
        const patchRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: `${REJECTED_PREFIX}${currentSummary}`,
              reminders: { useDefault: false, overrides: [] },
            }),
          }
        );

        if (!patchRes.ok) {
          const errBody = await patchRes.text();
          logger.error("Failed to PATCH calendar event", {
            uid,
            googleEventId,
            taskId: taskDoc.id,
            status: patchRes.status,
            error: errBody,
          });
          continue;
        }

        logger.info("Calendar event updated with [ODRZUCONE] prefix", {
          uid,
          googleEventId,
          taskId: taskDoc.id,
        });
      } catch (err) {
        logger.error("Unexpected error updating calendar event", {
          uid,
          googleEventId,
          taskId: taskDoc.id,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    logger.info("Deal rejection calendar cleanup complete", {
      uid,
      dealId,
      eventsProcessed: tasksSnap.size,
    });
  }
);

// ─── Helper: stop a Google Calendar watch channel ───────────

async function stopWatchChannel(
  accessToken: string,
  channelId: string,
  resourceId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/channels/stop",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: channelId, resourceId }),
      }
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// ─── Helper: register a new watch channel + get syncToken ───

async function registerNewWatchChannel(
  uid: string,
  accessToken: string,
  calendarId: string
): Promise<{ channelId: string; expiration: number | null }> {
  // 1. Get initial syncToken
  let syncToken: string | null = null;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "250", showDeleted: "true" });
    if (pageToken) params.set("pageToken", pageToken);

    const listRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      throw new Error(`events.list failed: ${listRes.status}`);
    }

    const data = await listRes.json();
    syncToken = data.nextSyncToken ?? null;
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (!syncToken) {
    throw new Error("Failed to obtain syncToken");
  }

  // 2. Register watch channel
  const channelId = crypto.randomUUID();
  const address = webhookUrl.value();

  const watchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: channelId, type: "web_hook", address }),
    }
  );

  if (!watchRes.ok) {
    throw new Error(`events.watch failed: ${watchRes.status}`);
  }

  const watchData = await watchRes.json();
  const expiration = watchData.expiration ? Number(watchData.expiration) : null;

  // 3. Save to Firestore
  const integrationRef = db
    .collection("users")
    .doc(uid)
    .collection("integrations")
    .doc("google_workspace");

  await integrationRef.update({
    "calendar.watchChannelId": channelId,
    "calendar.watchResourceId": watchData.resourceId ?? null,
    "calendar.syncToken": syncToken,
    "calendar.watchExpiration": expiration,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("calendarWatchChannels").doc(channelId).set({
    uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { channelId, expiration };
}

// ─── renewCalendarWatches ───────────────────────────────────
// Scheduled function that runs every 6 hours. Finds watch
// channels expiring within 24h and renews them automatically.

export const renewCalendarWatches = onSchedule(
  {
    schedule: "every 6 hours",
    region: "europe-west1",
    timeoutSeconds: 120,
  },
  async () => {
    const now = Date.now();
    const renewThreshold = now + 24 * 60 * 60 * 1000; // 24h from now

    // Find all users with active Google integration
    const usersSnap = await db.collectionGroup("integrations")
      .where("oauthStatus", "==", "active")
      .get();

    let renewed = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of usersSnap.docs) {
      if (doc.id !== "google_workspace") continue;

      const data = doc.data();
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;

      const watchChannelId = data.calendar?.watchChannelId as string | undefined;
      const watchResourceId = data.calendar?.watchResourceId as string | undefined;
      const watchExpiration = data.calendar?.watchExpiration as number | undefined;

      // Skip if no watch channel registered
      if (!watchChannelId) {
        skipped++;
        continue;
      }

      // Skip if channel is still fresh (expires after threshold)
      if (watchExpiration && watchExpiration > renewThreshold) {
        skipped++;
        continue;
      }

      logger.info("calendar.watch.renewing", {
        uid,
        oldChannelId: watchChannelId,
        expiresAt: watchExpiration ? new Date(watchExpiration).toISOString() : "unknown",
      });

      // Get valid access token
      const tokenResult = await tryGetValidAccessToken(uid);
      if (!tokenResult) {
        logger.warn("calendar.watch.renewSkipped", { uid, reason: "no valid token" });
        failed++;
        continue;
      }

      // Stop old channel
      if (watchResourceId) {
        const stopped = await stopWatchChannel(tokenResult.accessToken, watchChannelId, watchResourceId);
        if (stopped) {
          await db.collection("calendarWatchChannels").doc(watchChannelId).delete().catch(() => {});
          logger.info("calendar.watch.stopped", { uid, channelId: watchChannelId });
        }
      }

      // Register new channel
      try {
        const { channelId, expiration } = await registerNewWatchChannel(
          uid,
          tokenResult.accessToken,
          tokenResult.calendarId
        );
        logger.info("calendar.watch.renewed", {
          uid,
          newChannelId: channelId,
          expiresAt: expiration ? new Date(expiration).toISOString() : "unknown",
        });
        renewed++;
      } catch (err) {
        logger.error("calendar.watch.renewFailed", {
          uid,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    logger.info("calendar.watch.renewSummary", { renewed, skipped, failed });
  }
);
