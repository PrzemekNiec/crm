import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { OAuth2Client } from "google-auth-library";


initializeApp();
const db = getFirestore();

// ─── Environment config ─────────────────────────────────────
const googleClientId = defineString("GOOGLE_CLIENT_ID");
const googleClientSecret = defineString("GOOGLE_CLIENT_SECRET");

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

async function getValidAccessToken(
  uid: string
): Promise<{ accessToken: string; calendarId: string }> {
  const integrationRef = db
    .collection("users")
    .doc(uid)
    .collection("integrations")
    .doc("google_workspace");

  const snap = await integrationRef.get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Brak połączenia z Google Calendar. Połącz konto w Ustawieniach."
    );
  }

  const data = snap.data()!;
  if (data.oauthStatus === "reauth_required") {
    throw new HttpsError(
      "failed-precondition",
      "Token Google wygasł. Połącz ponownie konto w Ustawieniach."
    );
  }

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
      throw new HttpsError(
        "failed-precondition",
        "Nie udało się odświeżyć tokena Google. Połącz ponownie konto."
      );
    }
  }

  return { accessToken, calendarId };
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
}

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

    // 4. Build calendar event
    const startDate = new Date(data.dueDate);
    const endDate = new Date(
      startDate.getTime() + (data.durationMin || 30) * 60 * 1000
    );

    const event = {
      id: data.googleEventId,
      summary: data.title,
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
