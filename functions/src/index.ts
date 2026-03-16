import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
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
      console.error("OAuth token exchange failed:", message);
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

    console.log(`Google Calendar connected for user ${uid}`);

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
      console.error("Token refresh failed:", err);
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
  call: { emoji: "📞", colorId: "5" },       // Yellow / Banana
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
          console.error("Calendar insert failed:", errBody);
          throw new Error(`Calendar API insert failed: ${insertRes.status}`);
        }
        const body = await insertRes.json();
        htmlLink = body.htmlLink ?? null;
      } else {
        const errBody = await patchRes.text();
        console.error("Calendar patch failed:", errBody);
        throw new Error(`Calendar API patch failed: ${patchRes.status}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Calendar API error";
      console.error("syncTaskToGoogleCalendar failed:", message);

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

    console.log(`Task ${data.taskId} synced to calendar for user ${uid}`);

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
      console.error("Calendar event delete failed:", errBody);
      throw new HttpsError(
        "internal",
        "Nie udało się usunąć wydarzenia z kalendarza."
      );
    }

    console.log(`Calendar event ${googleEventId} deleted for user ${uid}`);
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

    // 1. Get initial syncToken by listing all events (paginate to end)
    let syncToken: string | null = null;
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        maxResults: "250",
        showDeleted: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const listRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listRes.ok) {
        const err = await listRes.text();
        console.error("events.list failed:", err);
        throw new HttpsError("internal", "Nie udało się uzyskać syncToken.");
      }

      const data = await listRes.json();
      syncToken = data.nextSyncToken ?? null;
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (!syncToken) {
      throw new HttpsError("internal", "Nie udało się uzyskać syncToken.");
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
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address,
        }),
      }
    );

    if (!watchRes.ok) {
      const err = await watchRes.text();
      console.error("events.watch failed:", err);
      throw new HttpsError(
        "internal",
        "Nie udało się zarejestrować webhooka kalendarza."
      );
    }

    const watchData = await watchRes.json();

    // 3. Save watch metadata + syncToken
    const integrationRef = db
      .collection("users")
      .doc(uid)
      .collection("integrations")
      .doc("google_workspace");

    await integrationRef.update({
      "calendar.watchChannelId": channelId,
      "calendar.watchResourceId": watchData.resourceId ?? null,
      "calendar.syncToken": syncToken,
      "calendar.watchExpiration": watchData.expiration
        ? Number(watchData.expiration)
        : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. Create channelId → uid mapping for webhook lookup
    await db.collection("calendarWatchChannels").doc(channelId).set({
      uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `Calendar watch registered for user ${uid}, channelId: ${channelId}`
    );

    return { success: true, channelId };
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
      console.log("Watch channel confirmed (sync notification)");
      res.status(200).send("OK");
      return;
    }

    if (!channelId) {
      console.error("Webhook: missing x-goog-channel-id");
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
        console.error(`Webhook: no user for channelId ${channelId}`);
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
        console.error(`Webhook: no integration doc for user ${uid}`);
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
        console.error(`Webhook: no syncToken for user ${uid}`);
        res.status(200).send("OK");
        return;
      }

      // 3. Get valid access token
      const tokenResult = await tryGetValidAccessToken(uid);
      if (!tokenResult) {
        console.error(`Webhook: cannot get access token for user ${uid}`);
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
          // syncToken expired — need full re-sync
          console.warn(
            `Webhook: syncToken expired for user ${uid}, clearing`
          );
          await integrationRef.update({
            "calendar.syncToken": null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          res.status(200).send("OK");
          return;
        }

        if (!listRes.ok) {
          const err = await listRes.text();
          console.error("Webhook: events.list failed:", err);
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
        console.log(`Webhook: no CRM events changed for user ${uid}`);
        res.status(200).send("OK");
        return;
      }

      console.log(
        `Webhook: processing ${crmEvents.length} CRM events for user ${uid}`
      );

      const tasksRef = db.collection("users").doc(uid).collection("tasks");

      for (const event of crmEvents) {
        // Find task by googleEventId
        const taskQuery = await tasksRef
          .where("googleEventId", "==", event.id)
          .limit(1)
          .get();

        if (taskQuery.empty) {
          console.log(`Webhook: no task found for eventId ${event.id}`);
          continue;
        }

        const taskDoc = taskQuery.docs[0];
        const taskData = taskDoc.data();

        // Event cancelled/deleted in Google Calendar
        if (event.status === "cancelled") {
          console.log(`Webhook: event ${event.id} cancelled, skipping task update`);
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
          console.log(
            `Webhook: updated task ${taskDoc.id} from Google Calendar`
          );
        } else {
          console.log(
            `Webhook: no data changes for task ${taskDoc.id}, skipping write`
          );
        }
      }

      console.log(`Webhook: done processing for user ${uid}`);
    } catch (err) {
      console.error("Webhook processing error:", err);
    }

    res.status(200).send("OK");
  }
);
