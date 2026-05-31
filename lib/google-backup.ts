/**
 * Google Drive organized backup.
 *
 * Parent's Drive layout:
 *   Spinini/
 *     _family/
 *       parent-settings.json
 *       backup-manifest.json
 *     Emma/
 *       profile.json
 *       school.json
 *       chores.json
 *       rewards.json
 *       journal.json
 *       creativity.json
 *       reading.json
 *       wishes.json
 *       money.json
 *       contacts.json
 *       fitness.json
 *       backup-info.json
 *     Jake/
 *       ...
 *
 * Kid's own Drive layout:
 *   Spinini - Emma/
 *     profile.json
 *     school.json
 *     journal.json
 *     creativity.json
 *     reading.json
 *     wishes.json
 *     fitness.json
 *     backup-info.json
 */

const DRIVE_API    = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const ROOT_NAME    = "Spinini";
const FOLDER_MIME  = "application/vnd.google-apps.folder";

// ─── Low-level Drive helpers ─────────────────────────────────────────────────

async function driveRequest(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function findItem(token: string, name: string, parentId: string, mimeType?: string): Promise<string | null> {
  const mime = mimeType ? ` and mimeType='${mimeType}'` : "";
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents${mime} and trashed=false`
  );
  const data = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id)`, token);
  return data?.files?.[0]?.id ?? null;
}

async function findRootFolder(token: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${ROOT_NAME}' and 'root' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const data = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id)`, token);
  return data?.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const meta: Record<string, any> = { name, mimeType: FOLDER_MIME };
  if (parentId) meta.parents = [parentId];
  const data = await driveRequest(`${DRIVE_API}/files?fields=id`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  return data.id;
}

async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const pid = parentId ?? "root";
  const existing = await findItem(token, name, pid, FOLDER_MIME);
  return existing ?? (await createFolder(token, name, parentId));
}

async function upsertJsonFile(token: string, name: string, content: object, parentId: string): Promise<void> {
  const existing = await findItem(token, name, parentId);
  const body_json = JSON.stringify(content, null, 2);
  const boundary = "FK_BOUND";
  const meta = existing ? { name } : { name, parents: [parentId] };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(meta),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    body_json,
    `--${boundary}--`,
  ].join("\r\n");

  const url = existing
    ? `${DRIVE_UPLOAD}/files/${existing}?uploadType=multipart`
    : `${DRIVE_UPLOAD}/files?uploadType=multipart`;
  await driveRequest(url, token, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function readJsonFile(token: string, name: string, parentId: string): Promise<any | null> {
  const fileId = await findItem(token, name, parentId);
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

// ─── Kid category splitting ───────────────────────────────────────────────────

function kidFiles(kid: any): Record<string, object> {
  return {
    "profile.json": {
      id: kid.profile.id,
      name: kid.profile.name,
      age: kid.profile.age,
      mascot: kid.profile.mascot,
      avatarUri: kid.profile.avatarUri,
      color: kid.profile.color,
      createdAt: kid.profile.createdAt,
    },
    "school.json": {
      grades: kid.grades ?? [],
      assignments: kid.assignments ?? [],
      behavior: kid.behavior ?? {},
      incidents: kid.incidents ?? [],
    },
    "chores.json": {
      chores: kid.chores ?? [],
    },
    "rewards.json": {
      bank: kid.bank ?? {},
      bankHistory: kid.bankHistory ?? [],
      appRewardRules: kid.rules?.appRewardRules ?? [],
    },
    "journal.json": {
      journal: kid.journal ?? [],
    },
    "creativity.json": {
      drawings: kid.drawings ?? [],
      ideas: kid.ideas ?? [],
      todos: kid.todos ?? [],
      books: kid.books ?? [],
    },
    "reading.json": {
      readingBooks: kid.readingBooks ?? [],
    },
    "wishes.json": {
      wishes: kid.wishes ?? [],
    },
    "money.json": {
      money: kid.money ?? {},
    },
    "contacts.json": {
      contacts: kid.contacts ?? [],
    },
    "fitness.json": {
      fitnessLogs: kid.fitnessLogs ?? [],
    },
  };
}

const KID_OWN_FILES = ["profile.json", "school.json", "journal.json", "creativity.json", "reading.json", "wishes.json", "fitness.json"];

// ─── Backup ───────────────────────────────────────────────────────────────────

async function backupOneKid(token: string, kid: any, rootFolderId: string): Promise<void> {
  const kidFolderId = await ensureFolder(token, kid.profile.name, rootFolderId);
  const files = kidFiles(kid);
  for (const [name, data] of Object.entries(files)) {
    await upsertJsonFile(token, name, data, kidFolderId);
  }
  await upsertJsonFile(token, "backup-info.json", {
    kidName: kid.profile.name,
    lastBackupAt: new Date().toISOString(),
    version: 2,
  }, kidFolderId);
}

/** Back up ALL kids + parent settings to parent's Google Drive. */
export async function backupAllToDrive(token: string, state: any): Promise<BackupManifest> {
  const rootId    = await ensureFolder(token, ROOT_NAME);
  const familyId  = await ensureFolder(token, "_family", rootId);

  await upsertJsonFile(token, "parent-settings.json", {
    name: state.parentSettings.name,
    emailDigest: state.parentSettings.emailDigest,
    backupEnabled: state.parentSettings.backupEnabled,
    importantInfo: state.importantInfo ?? {},
  }, familyId);

  const now = new Date().toISOString();
  const manifest: BackupManifest = { backedUpAt: now, kids: [] };

  for (const kid of (state.kids ?? [])) {
    await backupOneKid(token, kid, rootId);
    manifest.kids.push({ name: kid.profile.name, id: kid.profile.id, backedUpAt: now });
  }

  await upsertJsonFile(token, "backup-manifest.json", manifest, familyId);
  return manifest;
}

/** Back up a single kid's subset of data to the kid's own Google Drive. */
export async function backupKidToOwnDrive(token: string, kid: any): Promise<void> {
  const folderName = `Spinini - ${kid.profile.name}`;
  const rootId = await ensureFolder(token, folderName);
  const allFiles = kidFiles(kid);

  for (const name of KID_OWN_FILES) {
    if (allFiles[name]) await upsertJsonFile(token, name, allFiles[name], rootId);
  }
  await upsertJsonFile(token, "backup-info.json", {
    kidName: kid.profile.name,
    lastBackupAt: new Date().toISOString(),
    version: 2,
  }, rootId);
}

// ─── Restore ─────────────────────────────────────────────────────────────────

async function restoreKidFromFolder(token: string, folderId: string, kidName: string, currentKid?: any): Promise<any> {
  const [profile, school, chores, rewards, journal, creativity, reading, wishes, money, contacts, fitness] =
    await Promise.all([
      readJsonFile(token, "profile.json",   folderId),
      readJsonFile(token, "school.json",    folderId),
      readJsonFile(token, "chores.json",    folderId),
      readJsonFile(token, "rewards.json",   folderId),
      readJsonFile(token, "journal.json",   folderId),
      readJsonFile(token, "creativity.json",folderId),
      readJsonFile(token, "reading.json",   folderId),
      readJsonFile(token, "wishes.json",    folderId),
      readJsonFile(token, "money.json",     folderId),
      readJsonFile(token, "contacts.json",  folderId),
      readJsonFile(token, "fitness.json",   folderId),
    ]);

  return {
    profile:          profile        ?? currentKid?.profile ?? { id: Date.now().toString(), name: kidName },
    grades:           school?.grades         ?? currentKid?.grades ?? [],
    assignments:      school?.assignments    ?? currentKid?.assignments ?? [],
    behavior:         school?.behavior       ?? currentKid?.behavior ?? { totalPoints: 0, events: [] },
    incidents:        school?.incidents      ?? currentKid?.incidents ?? [],
    chores:           chores?.chores         ?? currentKid?.chores ?? [],
    bank:             rewards?.bank          ?? currentKid?.bank ?? { balance: 0 },
    bankHistory:      rewards?.bankHistory   ?? currentKid?.bankHistory ?? [],
    journal:          journal?.journal       ?? currentKid?.journal ?? [],
    drawings:         creativity?.drawings   ?? currentKid?.drawings ?? [],
    ideas:            creativity?.ideas      ?? currentKid?.ideas ?? [],
    todos:            creativity?.todos      ?? currentKid?.todos ?? [],
    books:            creativity?.books      ?? currentKid?.books ?? [],
    readingBooks:     reading?.readingBooks  ?? currentKid?.readingBooks ?? [],
    wishes:           wishes?.wishes         ?? currentKid?.wishes ?? [],
    money:            money?.money           ?? currentKid?.money ?? {},
    contacts:         contacts?.contacts     ?? currentKid?.contacts ?? [],
    fitnessLogs:      fitness?.fitnessLogs   ?? currentKid?.fitnessLogs ?? [],
    // Preserve live/settings-only fields from current state
    rules:            currentKid?.rules,
    alarms:           currentKid?.alarms ?? [],
    notifications:    currentKid?.notifications ?? [],
    appUnlockSessions: currentKid?.appUnlockSessions ?? [],
    vault:            currentKid?.vault ?? [],
  };
}

/** Restore all kids + parent settings from the parent's Google Drive. */
export async function restoreAllFromDrive(token: string, currentState: any): Promise<any> {
  const rootId = await findRootFolder(token);
  if (!rootId) throw new Error("No Spinini folder found in Google Drive.");

  const familyId = await findItem(token, "_family", rootId, FOLDER_MIME);
  let parentSettings = { ...currentState.parentSettings };
  if (familyId) {
    const ps = await readJsonFile(token, "parent-settings.json", familyId);
    if (ps) parentSettings = { ...parentSettings, ...ps };
  }

  const q = encodeURIComponent(
    `'${rootId}' in parents and mimeType='${FOLDER_MIME}' and name!='_family' and trashed=false`
  );
  const foldersData = await driveRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, token);
  const kidFolders: { id: string; name: string }[] = foldersData?.files ?? [];

  const kids = await Promise.all(
    kidFolders.map(f => {
      const current = currentState.kids?.find((k: any) => k.profile.name === f.name);
      return restoreKidFromFolder(token, f.id, f.name, current);
    })
  );

  return { ...currentState, parentSettings, kids };
}

// ─── Manifest / status ────────────────────────────────────────────────────────

export interface BackupManifest {
  backedUpAt: string;
  kids: Array<{ name: string; id: string; backedUpAt: string }>;
}

export async function getBackupManifest(token: string): Promise<BackupManifest | null> {
  const rootId = await findRootFolder(token);
  if (!rootId) return null;
  const familyId = await findItem(token, "_family", rootId, FOLDER_MIME);
  if (!familyId) return null;
  return await readJsonFile(token, "backup-manifest.json", familyId);
}

/** Get last-backup time for a single kid (from their backup-info.json) */
export async function getKidBackupInfo(token: string, kidName: string): Promise<{ lastBackupAt: string } | null> {
  const rootId = await findRootFolder(token);
  if (!rootId) return null;
  const kidFolderId = await findItem(token, kidName, rootId, FOLDER_MIME);
  if (!kidFolderId) return null;
  return await readJsonFile(token, "backup-info.json", kidFolderId);
}

// ─── Google Photos upload (kept from previous version) ────────────────────────

export async function uploadToGooglePhotos(
  token: string,
  base64Data: string,
  filename: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const bytes = base64Data.startsWith("data:") ? base64Data.split(",")[1] : base64Data;
  const binaryRes = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Goog-Upload-Content-Type": mimeType,
      "X-Goog-Upload-Protocol": "raw",
      "X-Goog-Upload-File-Name": filename,
    },
    body: Buffer.from(bytes, "base64"),
  });
  if (!binaryRes.ok) throw new Error(`Photos upload error ${binaryRes.status}`);
  const uploadToken = await binaryRes.text();

  const createRes = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      newMediaItems: [{ description: "Spinini", simpleMediaItem: { uploadToken, fileName: filename } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Photos create error ${createRes.status}`);
  const data = await createRes.json();
  return data.newMediaItemResults?.[0]?.mediaItem?.id ?? "";
}
