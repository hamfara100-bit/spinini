import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveVaultPassword, deleteVaultPassword } from "../vault-store";
import { uid } from "../utils";
import { saveRecoveryCode } from "../secure-tokens";
import { useFamilySync } from "./sync-bridge";
import { notificationFeature } from "./badges";
import {
  tttEmpty, tttWinner, tttFull, tttMarkForSeat, c4Empty, c4Drop, c4Winner, c4Full,
  otherSeat,
  pickHangmanWord, hangmanSolved, HANGMAN_MAX_WRONG,
  memoryDeck, type MemoryCard,
  checkersInit, checkersMoves, checkersApply, checkersWinner,
  chessInit, chessLegalMoves, chessApply, chessStatus, type ChessState,
  trashInit, trashTurn, type TrashState,
} from "../games/engine";
import {
  AppState, AppAction, KidState, KidProfile, KidRules,
  MoneyState, BehaviorScoreState, PermissionLedger, FamilyFilterStatus, CloudBackupConfig,
  ParentProfile, ParentSettings, TimerSessionState, ClassGrade, Memory, FavoriteItem,
  ImportantInfo, CommGuardSettings, BedtimeSoftLock, StoryMedia, FunLock, LOCKABLE_FEATURES,
  FunnySoundMessage, StreakState, VoiceNote, DocumentVault, MedicalDocuments,
  MedicationEntry, DoseLog, MedHandoff, MedFriend, WebFilterConfig,
  FamilyAgreement, StrangerAlert, SmartScreenTimeRule,
  FamilyMovie, FamilyMusicTrack, FamilyBook,
} from "./types";

const STORAGE_KEY = "@famkids/state/v1";

const defaultWebFilter: WebFilterConfig = {
  enabled: false,
  blockAdult: true,
  blockGambling: true,
  blockViolence: false,
  blockDrugs: true,
  blockSocialMedia: false,
  blockGaming: false,
  customBlocklist: [],
  customAllowlist: [],
  safeModeSearch: true,
  vpnStarted: false,
};

const defaultBedtimeSoftLock: BedtimeSoftLock = {
  enabled: false,
  start: "20:00",
  end: "07:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  message: "It's bedtime! 🌙 You can listen to stories and sleep sounds.",
};

function defaultKidRules(): KidRules {
  return {
    dailyLimitMinutes: 120,
    downtimeWindows: [
      // Both off by default — parent enables them in Screen Rules.
      { id: "bedtime", label: "Bedtime", startTime: "21:00", endTime: "07:00", days: [0,1,2,3,4,5,6], enabled: false },
      { id: "school",  label: "School",  startTime: "08:00", endTime: "15:00", days: [1,2,3,4,5],       enabled: false },
    ],
    appRules: [],
    appRewardRules: [],
    installedApps: [],   // parent adds real apps via App Rules → remote-apps screen
    webFilterLevel: "auto",
    webAllowlist: [],
    instantLocked: false,
    contentFilter: {
      blockExplicit: true,
      blockViolence: true,
      blockHateSpeech: true,
      blockGambling: true,
      blockDrugsAlcohol: true,
    },
    purchaseApprovalRequired: true,
    downloadApprovalRequired: true,
    screenTimeSchedule: {
      dailyLimitMinutes: 120,
      entertainmentLimitMinutes: 60,
      educationalAppsExempt: true,
      bedtimeEnabled: true,
      bedtimeStart: "21:00",
      bedtimeEnd: "07:00",
      bedtimeDays: [0,1,2,3,4,5,6],
      weekendLimitMinutes: 180,
      weekendOverrideEnabled: false,
    },
    safeSearch: {
      googleSafeSearch: true,
      bingSafeSearch: true,
      youtubeRestricted: true,
      youtubeSafeSearch: true,
    },
    bedtimeSoftLock: defaultBedtimeSoftLock,
    funLock: { enabled: false },
    lockedFeatures: [],
    freeMode: false,
    studyMode: false,
    blockedPackages: [],
    studyBlockedPackages: [],
    blockPrivateBrowsing: false,
    drivingModeEnabled: false,
    drivingSpeedThresholdKmh: 25,
    drivingBlockApps: true,
    screenTimePerChoreMinutes: 0,
    bonusScreenTimeMinutes: 0,
    webFilter: defaultWebFilter,
    morningRoutine: { enabled: true, items: [], resetHour: 4 },
    smartDeltaMinutes: 0,
    smartDeltaDate: "",
    lastMoodAlertDate: "",
  };
}

function defaultStreak(): StreakState {
  return { currentDays: 0, longestDays: 0, lastCompletedDate: "", totalChoresDone: 0 };
}

function defaultMoney(): MoneyState {
  return { currency: "USD", balance: 0, transactions: [], goals: [], debts: [], earnSchedules: [] };
}

function defaultBehavior(): BehaviorScoreState {
  return { totalPoints: 0, events: [] };
}

function defaultTimer(): TimerSessionState {
  return { active: false, label: "", durationMinutes: 25, isPaused: false };
}

const defaultCommGuard: CommGuardSettings = {
  blockUnknownCalls: false,
  blockUnknownTexts: false,
  allowedNumbers: [],
};

function newKidState(profile: KidProfile): KidState {
  return {
    profile,
    rules: defaultKidRules(),
    usage: [],
    bank: [],
    timer: defaultTimer(),
    chores: [],
    journal: [],
    drawings: [],
    todos: [],
    stopMotionProjects: [],
    books: [],
    readingBooks: [],
    ideas: [],
    album: [],
    vault: [],
    money: defaultMoney(),
    contacts: [],
    assignments: [],
    schedule: [],
    alarms: [],
    behavior: defaultBehavior(),
    incidents: [],
    safeZones: [],
    grades: [],
    coloringPages: [],
    buddyMessages: [],
    notifications: [],
    wishes: [],
    siteRequests: [],
    videoMessages: [],
    favorites: [],
    gadgets: [],
    achievements: [],
    discoveries: [],
    myStories: [],
    workoutPlans: [],
    workoutLogs: [],
    mealPlans: [],
    mealLogs: [],
    commGuard: defaultCommGuard,
    blockedLog: [],
    appUnlockSessions: [],
    funnySounds: [],
    locationHistory: [],
    streak: defaultStreak(),
    rewardRedemptions: [],
    callContacts: [],
    checkInRequests: [],
    voiceNotes: [],
    voiceRecordings: [],
    kidNotes: [],
    apologies: [],
    quizzes: [],
    ambientRecordings: [],
    speedEvents: [],
    phoneOffEvents: [],
    borrowRequests: [],
    moodEntries: [],
    kidRequests: [],
    allowanceSchedules: [],
    pointPayouts: [],
    paymentRequests: [],
    morningCompletedItems: [],
    aiResults: [],
    knownPackages: [],
    installAlerts: [],
  };
}

const defaultImportantInfo: ImportantInfo = {
  emergencyContacts: [],
  healthInsurance: "",
  lifeInsurance: "",
  doctorName: "",
  doctorPhone: "",
  emergencyPlan: "",
  emergencyLocation: "",
  additionalNotes: "",
};

const defaultMedical: MedicalDocuments = {
  vaccinations: [],
  prescriptions: [],
  bloodType: "",
  allergies: "",
  conditions: "",
  preferredHospital: "",
};

const defaultDocumentVault: DocumentVault = {
  insurance: [],
  identity: [],
  medical: defaultMedical,
  other: [],
};

const defaultParent: ParentProfile = {
  id: "parent-1",
  name: "Parent",
  mascot: "owl",
  color: "#7C5CFF",
};

const defaultParentSettings: ParentSettings = {
  pin: "",
  name: "Parent",
  uninstallProtection: false,
  emailDigest: false,
  backupEnabled: false,
  hasSeenAdDisclosure: false,
  adFree: false,
  digestEnabled: true,
  subscriptionTier: "family",
};

const defaultPermissions: PermissionLedger = {
  statuses: {
    camera: false,
    microphone: false,
    location: false,
    locationBackground: false,
    contacts: false,
    notifications: false,
    photoLibrary: false,
  },
  onboardingDone: false,
};

const defaultFamilyFilter: FamilyFilterStatus = {
  iosEnabled: false,
  androidEnabled: false,
};

const defaultCloudBackup: CloudBackupConfig = {
  enabled: false,
  autoBackup: false,
};

export const initialState: AppState = {
  kids: [],
  parent: defaultParent,
  parentSettings: defaultParentSettings,
  coParents: [],
  rewardShop: [],
  sosAlerts: [],
  socialAlerts: [],
  familyMessages: [],
  sharedAlbum: [],
  memories: [],
  stories: [],
  storyMedia: [],
  voiceSamples: [],
  advice: [],
  adviceCategories: [],
  agentMessages: [],
  aiResults: [],
  permissions: defaultPermissions,
  familyFilter: defaultFamilyFilter,
  cloudBackup: defaultCloudBackup,
  importantInfo: defaultImportantInfo,
  wellBeingCategories: [],
  wellBeingEntries: [],
  familySocialPosts: [],
  socialSeenAt: {},
  socialSeenLikes: {},
  familyVoteTopics: [],
  locationReminders: [],
  speedAlertSettings: {
    enabled: false,
    limitKmh: 80,
    aggressiveDeltaKmh: 20,
    pointsPerViolation: 10,
    alertParent: true,
  },
  setupDone: false,
  deviceRole: null,
  onlineGame: null,
  gameInvites: [],
  incomingCalls: [],
  parentNotes: [],
  parentTodos: [],
  familyCalendar: [],
  coParentSchedule: [],
  cannotPickupAlerts: [],
  sharedExpenses: [],
  documentVault: defaultDocumentVault,
  familyTree: [],
  medications: [],
  doseLogs: [],
  medHandoffs: [],
  medFriends: [],
  familyAgreements: [],
  strangerAlerts: [],
  badWordAlerts: [],
  tamperAlerts: [],
  smartScreenTimeRules: [],
  familyMovies: [],
  familyMusic: [],
  familyBooks: [],
  version: 1,
};

function updateKid(state: AppState, kidId: string, updater: (k: KidState) => KidState): AppState {
  return { ...state, kids: state.kids.map(k => k.profile.id === kidId ? updater(k) : k) };
}

// ── Online Game Night helpers ────────────────────────────────────────────────
const MEMORY_PAIRS_ONLINE = 6;

function ogInitBoard(gameId: import("./types").OnlineGameId): any {
  switch (gameId) {
    case "ttt":      return tttEmpty();
    case "connect4": return c4Empty();
    case "hangman":  return { word: pickHangmanWord(), guessed: [] as string[], wrong: 0 };
    case "memory":   return { deck: memoryDeck(MEMORY_PAIRS_ONLINE), flipped: [] as number[], scores: [0, 0] as [number, number] };
    case "checkers": return checkersInit();
    case "chess":    return chessInit();
    case "trash":    return trashInit();
    default:         return tttEmpty();
  }
}

/**
 * Apply one online move. Returns the next { board, turn, winner } patch, or null
 * if the move is illegal/ignored. `turn` is the seat to move NEXT; `winner` is
 * 0 | 1 | "draw" | null. The board is whatever engine-state that game uses.
 */
function ogApply(session: any, seat: 0 | 1, move: any): { board: any; turn: 0 | 1; winner: 0 | 1 | "draw" | null } | null {
  const flip = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
  switch (session.gameId) {
    case "ttt": {
      const idx = typeof move === "number" ? move : move?.index;
      const board = (session.board as any[]).slice();
      if (board[idx] != null) return null;
      board[idx] = tttMarkForSeat(seat);
      const win = tttWinner(board);
      const winner = win ? seat : (tttFull(board) ? "draw" : null);
      return { board, turn: winner != null ? seat : flip(seat), winner };
    }
    case "connect4": {
      const col = typeof move === "number" ? move : move?.col;
      const dropped = c4Drop(session.board, col, seat);
      if (!dropped) return null;
      const win = c4Winner(dropped.board);
      const winner = win ? seat : (c4Full(dropped.board) ? "draw" : null);
      return { board: dropped.board, turn: winner != null ? seat : flip(seat), winner };
    }
    case "hangman": {
      const letter: string = (typeof move === "string" ? move : move?.letter ?? "").toUpperCase();
      if (!letter) return null;
      const b = session.board as { word: string; guessed: string[]; wrong: number };
      if (b.guessed.includes(letter)) return null;
      const guessed = [...b.guessed, letter];
      const gset = new Set(guessed);
      if (b.word.includes(letter)) {
        if (hangmanSolved(b.word, gset)) {
          return { board: { ...b, guessed }, turn: seat, winner: seat }; // solver wins
        }
        return { board: { ...b, guessed }, turn: flip(seat), winner: null };
      } else {
        const wrong = b.wrong + 1;
        if (wrong >= HANGMAN_MAX_WRONG) {
          return { board: { ...b, guessed, wrong }, turn: seat, winner: "draw" }; // word survives
        }
        return { board: { ...b, guessed, wrong }, turn: flip(seat), winner: null };
      }
    }
    case "memory": {
      const b = session.board as { deck: MemoryCard[]; flipped: number[]; scores: [number, number] };
      // Special "clear" move: hide the two mismatched cards and pass turn.
      if (move?.clear) {
        return { board: { ...b, flipped: [] }, turn: flip(seat), winner: null };
      }
      const idx = typeof move === "number" ? move : move?.index;
      if (idx == null) return null;
      if (b.flipped.length >= 2) return null;                 // waiting for clear
      const card = b.deck[idx];
      if (!card || card.matched || b.flipped.includes(idx)) return null;
      const flipped = [...b.flipped, idx];
      if (flipped.length < 2) {
        return { board: { ...b, flipped }, turn: seat, winner: null }; // first card — same player
      }
      const [a, c] = flipped;
      if (b.deck[a].emoji === b.deck[c].emoji) {
        const deck = b.deck.map((cc, i) => (i === a || i === c ? { ...cc, matched: true } : cc));
        const scores: [number, number] = seat === 0 ? [b.scores[0] + 1, b.scores[1]] : [b.scores[0], b.scores[1] + 1];
        const done = deck.every(cc => cc.matched);
        const winner = done ? (scores[0] === scores[1] ? "draw" : scores[0] > scores[1] ? 0 : 1) : null;
        // Match → same player goes again; board clears the flipped pair immediately.
        return { board: { deck, flipped: [], scores }, turn: seat, winner };
      }
      // Mismatch → keep both shown; the acting device will dispatch {clear:true}.
      return { board: { ...b, flipped }, turn: seat, winner: null };
    }
    case "checkers": {
      const from = move?.from, to = move?.to;
      if (!from || !to) return null;
      const legal = checkersMoves(session.board, seat);
      const m = legal.find((x: any) => x.from[0] === from[0] && x.from[1] === from[1] && x.to[0] === to[0] && x.to[1] === to[1]);
      if (!m) return null;
      const board = checkersApply(session.board, m);
      const next = flip(seat);
      const w = checkersWinner(board, next);
      return { board, turn: next, winner: w === null ? null : (w as 0 | 1) };
    }
    case "chess": {
      const st = session.board as ChessState;
      const from = move?.from, to = move?.to;
      if (!from || !to) return null;
      const legal = chessLegalMoves(st, seat);
      const m = legal.find((x) => x.from[0] === from[0] && x.from[1] === from[1] && x.to[0] === to[0] && x.to[1] === to[1]);
      if (!m) return null;
      const board = chessApply(st, m);
      const status = chessStatus(board);
      if (status === "checkmate") return { board, turn: board.turn, winner: seat };
      if (status === "stalemate") return { board, turn: board.turn, winner: "draw" };
      return { board, turn: board.turn, winner: null };
    }
    case "trash": {
      const source: "stock" | "discard" = move?.source === "discard" ? "discard" : "stock";
      const res = trashTurn(session.board as TrashState, seat, source);
      return { board: res.state, turn: res.state.turn as 0 | 1, winner: res.winner === null ? null : (res.winner as 0 | 1) };
    }
    default:
      return null;
  }
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ── Online (cross-device) Game Night ─────────────────────────────────────
    case "OGAME_CREATE":
      return { ...state, onlineGame: action.session };
    case "OGAME_JOIN": {
      const g = state.onlineGame;
      if (!g || g.status !== "waiting") return state;
      if (g.players.some(p => p.id === action.playerId)) return state; // already in
      if (g.players.length >= 2) return state;
      return {
        ...state,
        gameInvites: (state.gameInvites ?? []).filter(i => i.toId !== action.playerId),
        onlineGame: {
          ...g,
          players: [...g.players, { id: action.playerId, name: action.playerName, seat: 1 }],
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case "OGAME_START": {
      const g = state.onlineGame;
      if (!g) return state; // can start solo (1 player) or multiplayer (2)
      return { ...state, onlineGame: { ...g, status: "playing", turn: 0, updatedAt: new Date().toISOString() } };
    }
    case "OGAME_MOVE": {
      const g = state.onlineGame;
      if (!g || g.status !== "playing" || g.turn !== action.seat) return state;
      const res = ogApply(g, action.seat, action.move);
      if (!res) return state; // illegal move
      return {
        ...state,
        onlineGame: {
          ...g,
          board: res.board,
          winner: res.winner,
          status: res.winner != null ? "finished" : "playing",
          turn: res.turn,
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case "OGAME_RESET": {
      const g = state.onlineGame;
      if (!g) return state;
      return {
        ...state,
        onlineGame: { ...g, board: ogInitBoard(g.gameId), winner: null, status: "playing", turn: 0, updatedAt: new Date().toISOString() },
      };
    }
    case "OGAME_END":
      return { ...state, onlineGame: null, gameInvites: [] };
    case "OGAME_INVITE": {
      const others = (state.gameInvites ?? []).filter(i => i.toId !== action.invite.toId);
      return { ...state, gameInvites: [...others, action.invite] };
    }
    case "OGAME_INVITE_CLEAR":
      return { ...state, gameInvites: (state.gameInvites ?? []).filter(i => i.toId !== action.toId) };

    case "SETUP_COMPLETE":
      return { ...state, setupDone: true };
    case "SET_DEVICE_ROLE":
      return { ...state, deviceRole: action.role };
    case "SET_PARENT_SETTINGS":
      return { ...state, parentSettings: { ...state.parentSettings, ...action.payload } };
    case "SET_PARENT_APPLE":
      return { ...state, parentSettings: { ...state.parentSettings, appleUserId: action.userId, appleEmail: action.email, appleFullName: action.fullName } };
    case "CLEAR_PARENT_APPLE":
      return { ...state, parentSettings: { ...state.parentSettings, appleUserId: undefined, appleEmail: undefined, appleFullName: undefined } };
    case "SET_LAST_BACKUP":
      return { ...state, parentSettings: { ...state.parentSettings, lastBackupAt: action.timestamp } };
    case "SET_PARENT_PROFILE":
      return { ...state, parent: { ...state.parent, ...action.payload } };
    case "SET_PARENT_MEMBERSHIP":
      return { ...state, parentMembership: action.payload };

    case "ADD_KID":
      // Idempotent by profile id: multiple sync paths (app-start sync, onboarding
      // poll, P2P echo) can dispatch ADD_KID for the same child with the same
      // Supabase userId. Each caller dedups against a possibly-stale state.kids
      // snapshot, so guard here too — never add the same kid twice.
      if (state.kids.some(k => k.profile.id === action.payload.id)) return state;
      return { ...state, kids: [...state.kids, newKidState(action.payload)] };
    case "RELINK_KID_ID": {
      // A locally-added placeholder kid (random id) is being matched to its real
      // Supabase userId once the child links. Rekey the placeholder so targeted
      // actions reach the right device — or, if the canonical kid already exists,
      // drop the placeholder to avoid a duplicate.
      if (action.oldId === action.newId) return state;
      const hasCanonical = state.kids.some(k => k.profile.id === action.newId);
      if (hasCanonical) {
        return { ...state, kids: state.kids.filter(k => k.profile.id !== action.oldId) };
      }
      return {
        ...state,
        kids: state.kids.map(k =>
          k.profile.id === action.oldId
            ? { ...k, profile: { ...k.profile, id: action.newId } }
            : k
        ),
      };
    }
    case "UPDATE_KID":
      return updateKid(state, action.kidId, k => ({ ...k, profile: { ...k.profile, ...action.payload } }));
    case "REMOVE_KID":
      return { ...state, kids: state.kids.filter(k => k.profile.id !== action.kidId) };

    case "UPDATE_RULES":
      return updateKid(state, action.kidId, k => ({ ...k, rules: { ...k.rules, ...action.payload } }));
    case "SET_APP_RULE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          appRules: k.rules.appRules.some(r => r.appId === action.rule.appId)
            ? k.rules.appRules.map(r => r.appId === action.rule.appId ? action.rule : r)
            : [...k.rules.appRules, action.rule],
        },
      }));
    case "INSTALL_APP":
      return updateKid(state, action.kidId, k => {
        const installed = k.rules.installedApps ?? [];
        const appRules  = k.rules.appRules ?? [];
        return {
          ...k,
          rules: {
            ...k.rules,
            installedApps: installed.includes(action.appId)
              ? installed
              : [...installed, action.appId],
            appRules: appRules.some(r => r.appId === action.appId)
              ? appRules
              : [...appRules, {
                  appId: action.appId,
                  appName: action.appName ?? action.appId,
                  mode: "block" as const,
                  scheduleEnabled: false,
                  schedules: [],
                }],
          },
        };
      });
    case "REMOVE_APP":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          installedApps: (k.rules.installedApps ?? []).filter(id => id !== action.appId),
          appRules: (k.rules.appRules ?? []).filter(r => r.appId !== action.appId),
        },
      }));
    case "SYNC_INSTALLED_APPS":
      return updateKid(state, action.kidId, k => {
        const known = k.knownPackages ?? [];
        const allPkgs = action.apps.map(a => a.packageName);
        // Always store the full app list so the parent App Rules screen can show
        // the apps that are actually on the KID's device.
        // First sync (no baseline yet): record everything, don't flag existing apps.
        if (known.length === 0) {
          return { ...k, knownPackages: allPkgs, deviceApps: action.apps };
        }
        const knownSet = new Set(known);
        const existingAlerts = new Set((k.installAlerts ?? []).map(a => a.packageName));
        const now = new Date().toISOString();
        const newAlerts = action.apps
          .filter(a => !knownSet.has(a.packageName) && !existingAlerts.has(a.packageName))
          .map(a => ({ packageName: a.packageName, appName: a.appName, detectedAt: now }));
        return {
          ...k,
          deviceApps: action.apps,
          knownPackages: Array.from(new Set([...known, ...allPkgs])),
          installAlerts: newAlerts.length === 0
            ? (k.installAlerts ?? [])
            : [...newAlerts, ...(k.installAlerts ?? [])].slice(0, 50),
        };
      });
    case "DISMISS_INSTALL_ALERT":
      return updateKid(state, action.kidId, k => ({
        ...k,
        installAlerts: (k.installAlerts ?? []).filter(a => a.packageName !== action.packageName),
      }));
    case "SET_APP_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          appRules: k.rules.appRules.map(r => r.appId !== action.appId ? r : {
            ...r,
            schedules: r.schedules?.some(s => s.id === action.schedule.id)
              ? r.schedules.map(s => s.id === action.schedule.id ? action.schedule : s)
              : [...(r.schedules ?? []), action.schedule],
          }),
        },
      }));
    case "REMOVE_APP_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          appRules: k.rules.appRules.map(r => r.appId !== action.appId ? r : {
            ...r,
            schedules: (r.schedules ?? []).filter(s => s.id !== action.scheduleId),
          }),
        },
      }));
    case "SET_APP_SCHEDULE_ENABLED":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          appRules: k.rules.appRules.map(r => r.appId !== action.appId ? r : {
            ...r,
            scheduleEnabled: action.enabled,
            // when enabling schedule mode, don't change the manual mode
          }),
        },
      }));
    case "SET_INSTANT_LOCK":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, instantLocked: action.locked, lockMessage: action.message, lockUntil: action.until },
      }));
    case "SET_DEAD_PHONE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, deadPhone: action.on },
      }));
    case "SET_LOCKDOWN_TIMER":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, lockdownTimer: action.timer },
      }));
    case "SET_FUN_LOCK":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, funLock: { ...k.rules.funLock, ...action.payload } },
      }));
    case "ADD_DOWNTIME":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, downtimeWindows: [...k.rules.downtimeWindows, action.window] },
      }));
    case "UPDATE_DOWNTIME":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: {
          ...k.rules,
          downtimeWindows: k.rules.downtimeWindows.map(w => w.id === action.windowId ? { ...w, ...action.payload } : w),
        },
      }));
    case "REMOVE_DOWNTIME":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, downtimeWindows: k.rules.downtimeWindows.filter(w => w.id !== action.windowId) },
      }));
    case "ADD_WEBSITE_RULE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, webAllowlist: [...k.rules.webAllowlist, action.rule] },
      }));
    case "UPDATE_WEBSITE_RULE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: {
          ...k.rules,
          webAllowlist: k.rules.webAllowlist.map(r => r.id === action.ruleId ? { ...r, ...action.payload } : r),
        },
      }));
    case "REMOVE_WEBSITE_RULE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, webAllowlist: k.rules.webAllowlist.filter(r => r.id !== action.ruleId) },
      }));

    case "ADD_USAGE":
      return updateKid(state, action.kidId, k => {
        const today = new Date().toISOString().split("T")[0];
        const hour = new Date().getHours();
        const existing = k.usage.find(u => u.date === today);
        if (existing) {
          const byApp = existing.byApp.some(a => a.appId === action.appId)
            ? existing.byApp.map(a => a.appId === action.appId
                ? { ...a, minutes: a.minutes + action.minutes, appEmoji: action.appEmoji ?? a.appEmoji, sessions: (a.sessions ?? 0) + (action.sessions ?? 1) }
                : a)
            : [...existing.byApp, { appId: action.appId, appName: action.appName, appEmoji: action.appEmoji, minutes: action.minutes, sessions: action.sessions ?? 1 }];
          const hourlyMinutes = [...(existing.hourlyMinutes ?? new Array(24).fill(0))];
          hourlyMinutes[hour] = (hourlyMinutes[hour] ?? 0) + action.minutes;
          return { ...k, usage: k.usage.map(u => u.date === today ? { ...u, totalMinutes: u.totalMinutes + action.minutes, byApp, hourlyMinutes } : u) };
        }
        const hourlyMinutes = new Array(24).fill(0);
        hourlyMinutes[hour] = action.minutes;
        return { ...k, usage: [...k.usage, { date: today, totalMinutes: action.minutes, byApp: [{ appId: action.appId, appName: action.appName, appEmoji: action.appEmoji, minutes: action.minutes, sessions: action.sessions ?? 1 }], visitedUrls: [], featureTaps: [], hourlyMinutes }] };
      });
    case "ADD_VISIT":
      return updateKid(state, action.kidId, k => {
        const today = new Date().toISOString().split("T")[0];
        const visit = { url: action.url, title: action.title, visitedAt: new Date().toISOString(), durationSeconds: action.seconds };
        const existing = k.usage.find(u => u.date === today);
        if (existing) {
          return { ...k, usage: k.usage.map(u => u.date === today ? { ...u, visitedUrls: [...(u.visitedUrls ?? []), visit] } : u) };
        }
        return { ...k, usage: [...k.usage, { date: today, totalMinutes: 0, byApp: [], visitedUrls: [visit], featureTaps: [] }] };
      });
    case "TAP_FEATURE":
      return updateKid(state, action.kidId, k => {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date().toISOString();
        const tap = { featureId: action.featureId, featureName: action.featureName, featureEmoji: action.featureEmoji, count: 1, lastUsed: now };
        const existing = k.usage.find(u => u.date === today);
        if (existing) {
          const featureTaps = (existing.featureTaps ?? []).some(t => t.featureId === action.featureId)
            ? (existing.featureTaps ?? []).map(t => t.featureId === action.featureId ? { ...t, count: t.count + 1, lastUsed: now } : t)
            : [...(existing.featureTaps ?? []), tap];
          return { ...k, usage: k.usage.map(u => u.date === today ? { ...u, featureTaps } : u) };
        }
        return { ...k, usage: [...k.usage, { date: today, totalMinutes: 0, byApp: [], visitedUrls: [], featureTaps: [tap] }] };
      });
    case "BANK_DELTA":
      return updateKid(state, action.kidId, k => ({
        ...k,
        bank: [...k.bank, { id: uid(), delta: action.delta, reason: action.reason, timestamp: new Date().toISOString() }].slice(0, 200),
      }));
    case "SET_TIMER":
      return updateKid(state, action.kidId, k => ({ ...k, timer: action.session }));

    case "ADD_JOURNAL":
      return updateKid(state, action.kidId, k => ({ ...k, journal: [action.entry, ...k.journal] }));
    case "EDIT_JOURNAL":
      return updateKid(state, action.kidId, k => ({
        ...k,
        journal: k.journal.map(e => e.id === action.entry.id ? { ...action.entry, updatedAt: new Date().toISOString() } : e),
      }));
    case "REMOVE_JOURNAL":
      return updateKid(state, action.kidId, k => ({ ...k, journal: k.journal.filter(e => e.id !== action.entryId) }));
    case "ADD_DRAWING":
      return updateKid(state, action.kidId, k => ({ ...k, drawings: [action.drawing, ...k.drawings] }));
    case "UPDATE_DRAWING":
      return updateKid(state, action.kidId, k => ({
        ...k, drawings: k.drawings.map(d => d.id === action.drawingId ? { ...d, ...action.payload } : d),
      }));
    case "REMOVE_DRAWING":
      return updateKid(state, action.kidId, k => ({ ...k, drawings: k.drawings.filter(d => d.id !== action.drawingId) }));
    case "TOGGLE_TODO":
      return updateKid(state, action.kidId, k => ({
        ...k, todos: k.todos.map(t => t.id === action.todoId ? { ...t, done: !t.done } : t),
      }));
    case "ADD_TODO":
      return updateKid(state, action.kidId, k => ({ ...k, todos: [...k.todos, action.item] }));
    case "REMOVE_TODO":
      return updateKid(state, action.kidId, k => ({ ...k, todos: k.todos.filter(t => t.id !== action.todoId) }));
    case "ADD_STOP_MOTION":
      return updateKid(state, action.kidId, k => ({ ...k, stopMotionProjects: [action.project, ...k.stopMotionProjects] }));
    case "UPDATE_STOP_MOTION":
      return updateKid(state, action.kidId, k => ({
        ...k, stopMotionProjects: k.stopMotionProjects.map(p => p.id === action.projectId ? { ...p, ...action.payload } : p),
      }));
    case "REMOVE_STOP_MOTION":
      return updateKid(state, action.kidId, k => ({ ...k, stopMotionProjects: k.stopMotionProjects.filter(p => p.id !== action.projectId) }));
    case "FLIPBOOK_SUBMIT":
      return updateKid(state, action.kidId, k => ({
        ...k,
        stopMotionProjects: k.stopMotionProjects.map(p =>
          p.id === action.projectId ? { ...p, submittedAt: new Date().toISOString(), parentApproved: null } : p
        ),
      }));
    case "FLIPBOOK_APPROVE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        stopMotionProjects: k.stopMotionProjects.map(p =>
          p.id === action.projectId ? { ...p, parentApproved: true, pointsAwarded: action.points } : p
        ),
        bank: [...k.bank, { id: uid(), delta: action.points, reason: "Flipbook approved", timestamp: new Date().toISOString() }].slice(0, 200),
      }));
    case "ADD_BOOK":
      return updateKid(state, action.kidId, k => ({ ...k, books: [action.book, ...k.books] }));
    case "UPDATE_BOOK":
      return updateKid(state, action.kidId, k => ({
        ...k, books: k.books.map(b => b.id === action.bookId ? { ...b, ...action.payload } : b),
      }));
    case "READING_BOOK_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, readingBooks: [action.book, ...(k.readingBooks ?? [])] }));
    case "READING_BOOK_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, readingBooks: (k.readingBooks ?? []).map(b => b.id === action.bookId ? { ...b, ...action.payload } : b),
      }));
    case "READING_BOOK_REMOVE":
      return updateKid(state, action.kidId, k => ({
        ...k, readingBooks: (k.readingBooks ?? []).filter(b => b.id !== action.bookId),
      }));
    case "ADD_IDEA":
      return updateKid(state, action.kidId, k => ({ ...k, ideas: [action.idea, ...k.ideas] }));
    case "UPDATE_IDEA":
      return updateKid(state, action.kidId, k => ({
        ...k, ideas: k.ideas.map(i => i.id === action.ideaId ? { ...i, ...action.payload } : i),
      }));
    case "DELETE_IDEA":
      return updateKid(state, action.kidId, k => ({ ...k, ideas: k.ideas.filter(i => i.id !== action.ideaId) }));

    case "ADD_CHORE": {
      const choreKids = action.chore.assignedKids;
      let newState = state;
      choreKids.forEach(kidId => {
        newState = updateKid(newState, kidId, k => ({ ...k, chores: [...k.chores, action.chore] }));
      });
      return newState;
    }
    case "UPDATE_CHORE":
      return {
        ...state,
        kids: state.kids.map(k => ({
          ...k,
          chores: k.chores.map(c => c.id === action.choreId ? { ...c, ...action.payload } : c),
        })),
      };
    case "REMOVE_CHORE":
      return {
        ...state,
        kids: state.kids.map(k => ({ ...k, chores: k.chores.filter(c => c.id !== action.choreId) })),
      };
    case "CHORE_SUBMIT_PROOF":
      return {
        ...state,
        // Only mutate the kid who actually submitted the proof
        kids: state.kids.map(k => {
          if (k.profile.id !== action.proof.kidId) return k;
          return {
            ...k,
            chores: k.chores.map(c =>
              c.id === action.choreId
                ? { ...c, status: "submitted", proofs: [...c.proofs, action.proof] }
                : c
            ),
          };
        }),
      };
    case "CHORE_APPROVE": {
      const targetKidId = action.approval.kidId;
      const ownerKid = state.kids.find(k => k.profile.id === targetKidId);
      if (!ownerKid) return state;
      const chore = ownerKid.chores.find(c => c.id === action.choreId);
      if (!chore) return state;
      const toUnlock = action.approval.approved ? (chore.unlocksFeatures ?? []) : [];
      // Auto-grant bonus screen time when chore is approved and setting is enabled
      const earnedMins = action.approval.approved
        ? (action.approval.awardedMinutes > 0
            ? action.approval.awardedMinutes
            : ownerKid.rules.screenTimePerChoreMinutes ?? 0)
        : 0;
      return {
        ...state,
        kids: state.kids.map(k => {
          if (k.profile.id !== targetKidId) return k;
          const updatedChores = k.chores.map(c =>
            c.id === action.choreId
              ? { ...c, status: (action.approval.approved ? "approved" : "rejected") as "approved" | "rejected", approvals: [...c.approvals, action.approval] }
              : c
          );
          const updatedLocked = toUnlock.length > 0
            ? k.rules.lockedFeatures.filter(f => !toUnlock.includes(f))
            : k.rules.lockedFeatures;
          const updatedBonus = earnedMins > 0
            ? (k.rules.bonusScreenTimeMinutes ?? 0) + earnedMins
            : (k.rules.bonusScreenTimeMinutes ?? 0);
          return {
            ...k,
            chores: updatedChores,
            rules: { ...k.rules, lockedFeatures: updatedLocked, bonusScreenTimeMinutes: updatedBonus },
          };
        }),
      };
    }
    case "SET_FEATURE_LOCK":
      // Never lock features that are not in LOCKABLE_FEATURES (safety/emergency features)
      if (action.locked && !LOCKABLE_FEATURES.includes(action.featureId as any)) return state;
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          lockedFeatures: action.locked
            ? k.rules.lockedFeatures.includes(action.featureId)
              ? k.rules.lockedFeatures
              : [...k.rules.lockedFeatures, action.featureId]
            : k.rules.lockedFeatures.filter(f => f !== action.featureId),
        },
      }));
    case "LOCK_ALL_FEATURES":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, lockedFeatures: [...LOCKABLE_FEATURES] },
      }));
    case "UNLOCK_ALL_FEATURES":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, lockedFeatures: [] },
      }));
    case "SET_FREE_MODE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: { ...k.rules, freeMode: action.enabled },
      }));
    case "ADD_FUNNY_SOUND":
      return updateKid(state, action.kidId, k => ({
        ...k,
        funnySounds: [action.msg, ...k.funnySounds],
      }));
    case "MARK_FUNNY_SOUND_PLAYED":
      return updateKid(state, action.kidId, k => ({
        ...k,
        funnySounds: k.funnySounds.map(m => m.id === action.msgId ? { ...m, played: true } : m),
      }));

    case "CHORE_APPLY_PENALTY":
      return {
        ...state,
        kids: state.kids.map(k => {
          const hasKid = k.chores.some(c => c.id === action.choreId && c.assignedKids.includes(action.kidId));
          if (!hasKid) return k;
          return {
            ...k,
            chores: k.chores.map(c => c.id === action.choreId
              ? { ...c, penaltyAppliedDates: [...(c.penaltyAppliedDates ?? []), action.date] }
              : c),
            behavior: {
              totalPoints: Math.max(0, k.behavior.totalPoints - action.penaltyPoints),
              events: [
                {
                  id: `penalty-${action.choreId}-${action.date}`,
                  points: -action.penaltyPoints,
                  reason: `Missed chore deadline`,
                  date: action.date,
                },
                ...k.behavior.events,
              ],
            },
          };
        }),
      };

    case "FAMILY_CHAT_PUSH":
      return { ...state, familyMessages: [...state.familyMessages, action.message] };
    case "FAMILY_CHAT_MARK_READ":
      return {
        ...state,
        familyMessages: state.familyMessages.map(m =>
          m.readBy.includes(action.viewerId) ? m : { ...m, readBy: [...m.readBy, action.viewerId] }),
      };
    case "ALBUM_ADD":
      return { ...state, sharedAlbum: [action.item, ...state.sharedAlbum] };
    case "ALBUM_ADD_KID":
      return updateKid(state, action.kidId, k => ({ ...k, album: [action.item, ...k.album] }));

    case "MEMORY_ADD":
      return { ...state, memories: [action.memory, ...state.memories] };
    case "MEMORY_UPDATE":
      return { ...state, memories: state.memories.map(m => m.id === action.memoryId ? { ...m, ...action.payload } : m) };
    case "MEMORY_REMOVE":
      return { ...state, memories: state.memories.filter(m => m.id !== action.memoryId) };

    case "VAULT_ADD": {
      // Strip password — it lives in SecureStore (saved by secureDispatch)
      const { password: _pw, ...meta } = action.entry;
      return updateKid(state, action.kidId, k => ({ ...k, vault: [...k.vault, meta] }));
    }
    case "VAULT_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, vault: k.vault.filter(v => v.id !== action.entryId) }));
    case "CONTACT_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, contacts: [...k.contacts, action.contact] }));
    case "CONTACT_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, contacts: k.contacts.filter(c => c.id !== action.contactId) }));

    case "MONEY_TRANSACT":
      return updateKid(state, action.kidId, k => ({
        ...k,
        money: {
          ...k.money,
          balance: k.money.balance + (action.tx.type === "spend" ? -action.tx.amount : action.tx.amount),
          transactions: [action.tx, ...k.money.transactions],
        },
      }));
    case "MONEY_ADD_GOAL":
      return updateKid(state, action.kidId, k => ({
        ...k, money: { ...k.money, goals: [...k.money.goals, action.goal] },
      }));
    case "MONEY_UPDATE_GOAL":
      return updateKid(state, action.kidId, k => ({
        ...k, money: {
          ...k.money,
          goals: k.money.goals.map(g => g.id === action.goalId ? { ...g, ...action.payload } : g),
        },
      }));
    case "MONEY_REMOVE_GOAL":
      return updateKid(state, action.kidId, k => ({
        ...k, money: { ...k.money, goals: k.money.goals.filter(g => g.id !== action.goalId) },
      }));
    case "MONEY_ADD_DEBT":
      return updateKid(state, action.kidId, k => ({
        ...k, money: { ...k.money, debts: [...k.money.debts, action.debt] },
      }));
    case "MONEY_PAY_DEBT":
      return updateKid(state, action.kidId, k => ({
        ...k, money: { ...k.money, debts: k.money.debts.map(d => d.id === action.debtId ? { ...d, paid: true } : d) },
      }));
    case "MONEY_ADD_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k, money: { ...k.money, earnSchedules: [...(k.money.earnSchedules ?? []), action.schedule] },
      }));
    case "MONEY_UPDATE_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k, money: {
          ...k.money,
          earnSchedules: (k.money.earnSchedules ?? []).map(s =>
            s.id === action.scheduleId ? { ...s, ...action.payload } : s
          ),
        },
      }));
    case "MONEY_REMOVE_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k, money: {
          ...k.money,
          earnSchedules: (k.money.earnSchedules ?? []).filter(s => s.id !== action.scheduleId),
        },
      }));
    case "MONEY_APPLY_AUTO_EARN":
      return updateKid(state, action.kidId, k => ({
        ...k,
        money: {
          ...k.money,
          balance: k.money.balance + action.tx.amount,
          transactions: [action.tx, ...k.money.transactions],
          earnSchedules: (k.money.earnSchedules ?? []).map(s =>
            s.id === action.scheduleId ? { ...s, lastAppliedDate: action.date } : s
          ),
        },
      }));

    case "GRADE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, grades: [action.grade, ...k.grades] }));
    case "GRADE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, grades: k.grades.map(g => g.id === action.gradeId ? { ...g, ...action.payload } : g),
      }));
    case "GRADE_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, grades: k.grades.filter(g => g.id !== action.gradeId) }));

    case "ASSIGNMENT_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, assignments: [action.assignment, ...k.assignments] }));
    case "ASSIGNMENT_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, assignments: k.assignments.map(a => a.id === action.assignmentId ? { ...a, ...action.payload } : a),
      }));
    case "ASSIGNMENT_REMOVE":
      return updateKid(state, action.kidId, k => ({
        ...k, assignments: k.assignments.filter(a => a.id !== action.assignmentId),
      }));
    case "SCHEDULE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, schedule: [...k.schedule, action.event] }));
    case "SCHEDULE_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, schedule: k.schedule.filter(e => e.id !== action.eventId) }));
    case "ALARM_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, alarms: [...k.alarms, action.alarm] }));
    case "ALARM_TOGGLE":
      return updateKid(state, action.kidId, k => ({
        ...k, alarms: k.alarms.map(a => a.id === action.alarmId ? { ...a, enabled: !a.enabled } : a),
      }));
    case "ALARM_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, alarms: k.alarms.filter(a => a.id !== action.alarmId) }));
    case "BEHAVIOR_ADD_EVENT":
      return updateKid(state, action.kidId, k => ({
        ...k,
        behavior: {
          totalPoints: k.behavior.totalPoints + action.event.points,
          events: [action.event, ...k.behavior.events].slice(0, 500),
        },
      }));
    case "INCIDENT_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, incidents: [action.incident, ...k.incidents] }));

    case "SAFE_ZONE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, safeZones: [...k.safeZones, action.zone] }));
    case "SAFE_ZONE_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, safeZones: k.safeZones.filter(z => z.id !== action.zoneId) }));
    case "LOCATION_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        lastLocation: action.location,
        locationHistory: [action.location, ...(k.locationHistory ?? [])].slice(0, 1440),
      }));
    case "LOCATION_HISTORY_CLEAR":
      return updateKid(state, action.kidId, k => ({ ...k, locationHistory: [] }));

    case "COLORING_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, coloringPages: [action.page, ...k.coloringPages] }));
    case "COLORING_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, coloringPages: k.coloringPages.map(p => p.id === action.pageId ? { ...p, ...action.payload } : p),
      }));
    case "VIDEO_MESSAGE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, videoMessages: [action.message, ...k.videoMessages] }));
    case "VIDEO_MESSAGE_READ":
      return updateKid(state, action.kidId, k => ({
        ...k, videoMessages: k.videoMessages.map(m => m.id === action.messageId ? { ...m, read: true } : m),
      }));
    case "VIDEO_MESSAGE_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, videoMessages: k.videoMessages.filter(m => m.id !== action.messageId),
      }));

    case "BUDDY_MESSAGE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, buddyMessages: [...k.buddyMessages, action.message] }));
    case "BUDDY_MESSAGES_CLEAR":
      return updateKid(state, action.kidId, k => ({ ...k, buddyMessages: [] }));
    case "AGENT_MESSAGE_ADD":
      return { ...state, agentMessages: [...state.agentMessages, action.message] };
    case "AGENT_MESSAGES_CLEAR":
      return { ...state, agentMessages: [] };

    // ── AI Results (parent-level) ───────────────────────────────────────────
    case "AI_RESULT_ADD":
      return { ...state, aiResults: [action.result, ...(state.aiResults ?? [])].slice(0, 500) };
    case "AI_RESULT_DELETE":
      return { ...state, aiResults: (state.aiResults ?? []).filter(r => r.id !== action.resultId) };
    case "AI_RESULT_UPDATE":
      return { ...state, aiResults: (state.aiResults ?? []).map(r => r.id === action.resultId ? { ...r, ...action.payload } : r) };

    // ── AI Results (kid-level) ─────────────────────────────────────────────
    case "KID_AI_RESULT_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, aiResults: [action.result, ...(k.aiResults ?? [])].slice(0, 200) }));
    case "KID_AI_RESULT_DELETE":
      return updateKid(state, action.kidId, k => ({ ...k, aiResults: (k.aiResults ?? []).filter(r => r.id !== action.resultId) }));
    case "KID_AI_RESULT_UPDATE":
      return updateKid(state, action.kidId, k => ({ ...k, aiResults: (k.aiResults ?? []).map(r => r.id === action.resultId ? { ...r, ...action.payload } : r) }));
    case "NOTIFICATION_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, notifications: [action.notification, ...k.notifications] }));
    case "NOTIFICATION_READ":
      return updateKid(state, action.kidId, k => ({
        ...k, notifications: k.notifications.map(n => n.id === action.notifId ? { ...n, read: true } : n),
      }));
    case "NOTIFICATIONS_MARK_FEATURE_READ":
      return updateKid(state, action.kidId, k => ({
        ...k, notifications: k.notifications.map(n =>
          !n.read && notificationFeature(n) === action.feature ? { ...n, read: true } : n
        ),
      }));
    case "NOTIFICATION_ACKNOWLEDGE":
      return updateKid(state, action.kidId, k => ({
        ...k, notifications: k.notifications.map(n =>
          n.id === action.notifId ? { ...n, read: true, acknowledged: true } : n
        ),
      }));
    case "NOTIFICATION_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, notifications: k.notifications.filter(n => n.id !== action.notifId),
      }));
    case "NOTIFICATION_CLEAR_ALL":
      return updateKid(state, action.kidId, k => ({ ...k, notifications: [] }));
    case "FAVORITE_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, favorites: [action.item, ...(k.favorites ?? [])] }));
    case "FAVORITE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, favorites: (k.favorites ?? []).map(f => f.id === action.itemId ? { ...f, ...action.payload } : f),
      }));
    case "FAVORITE_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, favorites: (k.favorites ?? []).filter(f => f.id !== action.itemId) }));
    case "WISH_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, wishes: [action.wish, ...k.wishes] }));
    case "WISH_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, wishes: k.wishes.filter(w => w.id !== action.wishId) }));
    case "GADGET_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, gadgets: [action.item, ...(k.gadgets ?? [])] }));
    case "GADGET_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, gadgets: (k.gadgets ?? []).filter(g => g.id !== action.itemId) }));
    case "ACHIEVEMENT_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, achievements: [action.achievement, ...(k.achievements ?? [])] }));
    case "ACHIEVEMENT_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, achievements: (k.achievements ?? []).filter(a => a.id !== action.achievementId) }));
    case "DISCOVERY_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, discoveries: [action.discovery, ...(k.discoveries ?? [])] }));
    case "DISCOVERY_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, discoveries: (k.discoveries ?? []).filter(d => d.id !== action.discoveryId) }));
    case "KID_STORY_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, myStories: [action.story, ...(k.myStories ?? [])] }));
    case "KID_STORY_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, myStories: (k.myStories ?? []).filter(s => s.id !== action.storyId) }));
    case "WORKOUT_PLAN_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, workoutPlans: [action.plan, ...(k.workoutPlans ?? [])] }));
    case "WORKOUT_PLAN_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, workoutPlans: (k.workoutPlans ?? []).filter(p => p.id !== action.planId) }));
    case "WORKOUT_LOG_SUBMIT":
      return updateKid(state, action.kidId, k => ({ ...k, workoutLogs: [action.log, ...(k.workoutLogs ?? [])] }));
    case "WORKOUT_LOG_APPROVE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        workoutLogs: (k.workoutLogs ?? []).map(l =>
          l.id === action.logId
            ? { ...l, pointsAwarded: action.points, parentApproved: true, parentComment: action.comment, approvedAt: new Date().toISOString() }
            : l
        ),
        behavior: {
          totalPoints: k.behavior.totalPoints + action.points,
          events: [...k.behavior.events, { id: uid(), points: action.points, reason: "Workout completed", date: new Date().toISOString() }].slice(0, 500),
        },
      }));
    case "MEAL_PLAN_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, mealPlans: [action.plan, ...(k.mealPlans ?? [])] }));
    case "MEAL_PLAN_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, mealPlans: (k.mealPlans ?? []).filter(p => p.id !== action.planId) }));
    case "MEAL_PLAN_SET_ACTIVE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        mealPlans: (k.mealPlans ?? []).map(p => ({ ...p, active: p.id === action.planId })),
      }));
    case "MEAL_LOG_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, mealLogs: [action.log, ...(k.mealLogs ?? [])] }));
    case "MEAL_LOG_REMOVE":
      return updateKid(state, action.kidId, k => ({ ...k, mealLogs: (k.mealLogs ?? []).filter(l => l.id !== action.logId) }));
    case "ACHIEVEMENT_AWARD_POINTS":
      return updateKid(state, action.kidId, k => ({
        ...k,
        achievements: (k.achievements ?? []).map(a =>
          a.id === action.achievementId
            ? { ...a, pointsAwarded: action.points, parentComment: action.comment, awardedAt: new Date().toISOString() }
            : a
        ),
        behavior: {
          totalPoints: k.behavior.totalPoints + action.points,
          events: [...k.behavior.events, { id: uid(), points: action.points, reason: `Achievement reward`, date: new Date().toISOString() }].slice(0, 500),
        },
      }));
    case "IMPORTANT_INFO_UPDATE":
      return { ...state, importantInfo: { ...(state.importantInfo ?? defaultImportantInfo), ...action.payload } };
    case "WISH_DECIDE":
      return updateKid(state, action.kidId, k => ({
        ...k, wishes: k.wishes.map(w => w.id === action.wishId
          ? { ...w, decision: action.decision, parentComment: action.comment, decidedAt: new Date().toISOString() }
          : w),
      }));
    case "SITE_REQUEST_ADD":
      return updateKid(state, action.kidId, k => ({ ...k, siteRequests: [action.request, ...k.siteRequests] }));
    case "SITE_REQUEST_DECIDE":
      return updateKid(state, action.kidId, k => ({
        ...k, siteRequests: k.siteRequests.map(r => r.id === action.requestId
          ? { ...r, status: action.approved ? "approved" : "denied", decidedAt: new Date().toISOString() }
          : r),
      }));

    case "STORY_ADD":
      return { ...state, stories: [action.story, ...state.stories] };
    case "STORY_DELETE":
      return { ...state, stories: state.stories.filter(s => s.id !== action.storyId) };
    case "STORY_MEDIA_ADD":
      return { ...state, storyMedia: [action.media, ...(state.storyMedia ?? [])] };
    case "STORY_MEDIA_REMOVE":
      return { ...state, storyMedia: (state.storyMedia ?? []).filter(m => m.id !== action.mediaId) };
    case "STORY_READ":
      return {
        ...state,
        stories: state.stories.map(s => s.id === action.storyId && !s.readBy.includes(action.kidId)
          ? { ...s, readBy: [...s.readBy, action.kidId] }
          : s),
      };
    case "VOICE_SAMPLE_ADD":
      return { ...state, voiceSamples: [action.sample, ...(state.voiceSamples ?? [])] };
    case "VOICE_SAMPLE_DELETE":
      return { ...state, voiceSamples: (state.voiceSamples ?? []).filter(s => s.id !== action.sampleId) };
    case "ADVICE_ADD":
      return { ...state, advice: [action.advice, ...state.advice] };
    case "ADVICE_REMOVE":
      return { ...state, advice: state.advice.filter(a => a.id !== action.adviceId) };
    case "ADVICE_CATEGORY_ADD":
      return { ...state, adviceCategories: [action.category, ...(state.adviceCategories ?? [])] };
    case "ADVICE_CATEGORY_REMOVE":
      // Remove the category and any advice that belonged to it.
      return {
        ...state,
        adviceCategories: (state.adviceCategories ?? []).filter(c => c.id !== action.categoryId),
        advice: state.advice.filter(a => a.categoryId !== action.categoryId),
      };
    case "ADVICE_READ":
      return {
        ...state,
        advice: state.advice.map(a => a.id === action.adviceId && !a.readBy.includes(action.kidId)
          ? { ...a, readBy: [...a.readBy, action.kidId] }
          : a),
      };

    case "PERMISSION_SET":
      return { ...state, permissions: { ...state.permissions, statuses: { ...state.permissions.statuses, ...action.payload } } };
    case "PERMISSION_ONBOARDING_DONE":
      return { ...state, permissions: { ...state.permissions, onboardingDone: true } };
    case "CLOUD_BACKUP_UPDATE":
      return { ...state, cloudBackup: { ...state.cloudBackup, ...action.payload } };
    case "FAMILY_FILTER_UPDATE":
      return { ...state, familyFilter: { ...state.familyFilter, ...action.payload } };
    case "VIDEO_ROOM_SET":
      return { ...state, activeVideoRoom: action.room };

    case "SET_BEDTIME_SOFT_LOCK":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rules: {
          ...k.rules,
          bedtimeSoftLock: { ...(k.rules.bedtimeSoftLock ?? defaultBedtimeSoftLock), ...action.payload },
        },
      }));

    // Call & Text Guard
    case "COMM_GUARD_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        commGuard: { ...(k.commGuard ?? defaultCommGuard), ...action.payload },
      }));
    case "COMM_WHITELIST_ADD":
      return updateKid(state, action.kidId, k => {
        const guard = k.commGuard ?? defaultCommGuard;
        if (guard.allowedNumbers.includes(action.number)) return k;
        return { ...k, commGuard: { ...guard, allowedNumbers: [...guard.allowedNumbers, action.number] } };
      });
    case "COMM_WHITELIST_REMOVE":
      return updateKid(state, action.kidId, k => ({
        ...k,
        commGuard: {
          ...(k.commGuard ?? defaultCommGuard),
          allowedNumbers: (k.commGuard?.allowedNumbers ?? []).filter(n => n !== action.number),
        },
      }));
    case "BLOCKED_LOG_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k,
        blockedLog: [action.entry, ...(k.blockedLog ?? [])].slice(0, 200),
      }));
    case "BLOCKED_LOG_CLEAR":
      return updateKid(state, action.kidId, k => ({ ...k, blockedLog: [] }));
    case "COMM_EMERGENCY_ACTIVATE":
      return updateKid(state, action.kidId, k => ({
        ...k, commGuard: { ...k.commGuard, emergencyUnlockExpiresAt: action.expiresAt },
      }));
    case "COMM_EMERGENCY_DEACTIVATE":
      return updateKid(state, action.kidId, k => ({
        ...k, commGuard: { ...k.commGuard, emergencyUnlockExpiresAt: undefined },
      }));

    // App reward rules
    case "APP_REWARD_RULE_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, appRewardRules: [...(k.rules.appRewardRules ?? []), action.rule] },
      }));
    case "APP_REWARD_RULE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: {
          ...k.rules,
          appRewardRules: (k.rules.appRewardRules ?? []).map(r =>
            r.id === action.ruleId ? { ...r, ...action.payload } : r
          ),
        },
      }));
    case "APP_REWARD_RULE_REMOVE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: {
          ...k.rules,
          appRewardRules: (k.rules.appRewardRules ?? []).filter(r => r.id !== action.ruleId),
        },
      }));

    // App unlock sessions
    case "APP_UNLOCK_START":
      return updateKid(state, action.kidId, k => ({
        ...k, appUnlockSessions: [...(k.appUnlockSessions ?? []), action.session],
      }));
    case "APP_UNLOCK_TICK":
      return updateKid(state, action.kidId, k => ({
        ...k,
        appUnlockSessions: (k.appUnlockSessions ?? []).map(s => {
          if (s.id !== action.sessionId || !s.active) return s;
          const remaining = s.secondsRemaining - action.secondsDelta;
          return { ...s, secondsRemaining: Math.max(0, remaining), active: remaining > 0 };
        }),
      }));
    case "APP_UNLOCK_END":
      return updateKid(state, action.kidId, k => ({
        ...k,
        appUnlockSessions: (k.appUnlockSessions ?? []).map(s =>
          s.id === action.sessionId ? { ...s, active: false, secondsRemaining: 0 } : s
        ),
      }));

    // ── Study Mode ────────────────────────────────────────────────────────────
    case "SET_STUDY_MODE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, studyMode: action.enabled },
      }));
    case "SET_STUDY_MODE_SCHEDULE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, studyModeStart: action.start, studyModeEnd: action.end, studyModeDays: action.days },
      }));
    case "SET_BLOCKED_PACKAGES":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, blockedPackages: action.packages },
      }));
    case "SET_STUDY_BLOCKED_PACKAGES":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, studyBlockedPackages: action.packages },
      }));
    case "SET_STUDY_MODE_BREAK":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, studyModeBreakUntil: action.until },
      }));
    case "SCHOOL_TIME_CONTACT_ADD":
      return updateKid(state, action.kidId, k => {
        const guard = k.commGuard ?? defaultCommGuard;
        const existing = guard.schoolTimeContacts ?? [];
        if (existing.includes(action.contact)) return k;
        return { ...k, commGuard: { ...guard, schoolTimeContacts: [...existing, action.contact] } };
      });
    case "SCHOOL_TIME_CONTACT_REMOVE":
      return updateKid(state, action.kidId, k => {
        const guard = k.commGuard ?? defaultCommGuard;
        return { ...k, commGuard: { ...guard, schoolTimeContacts: (guard.schoolTimeContacts ?? []).filter(c => c !== action.contact) } };
      });

    // ── Streaks ───────────────────────────────────────────────────────────────
    case "STREAK_TICK": {
      return updateKid(state, action.kidId, k => {
        const s = k.streak ?? { currentDays: 0, longestDays: 0, lastCompletedDate: "", totalChoresDone: 0 };
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const ymd = yesterday.toISOString().split("T")[0];

        // Same day as last completion — just tally the chore, don't re-increment streak
        if (s.lastCompletedDate === action.date) {
          return { ...k, streak: { ...s, totalChoresDone: s.totalChoresDone + 1 } };
        }

        // Yesterday was the last completion → streak continues; anything older → reset to 1
        const isConsecutive = s.lastCompletedDate === ymd;
        const newCurrent = isConsecutive ? s.currentDays + 1 : 1;

        // Streak milestone rewards: 7 / 14 / 21 / 30 days → bonus points + notification
        const MILESTONES: Record<number, { points: number; label: string }> = {
          7:  { points: 50,  label: "7-day streak! 🔥" },
          14: { points: 100, label: "2-week streak! 🏆" },
          21: { points: 150, label: "3-week streak! 💎" },
          30: { points: 250, label: "30-day streak! 👑" },
        };
        const milestone = MILESTONES[newCurrent];
        const extraBank = milestone
          ? [...k.bank, { id: uid(), delta: milestone.points, reason: `🔥 Streak reward: ${milestone.label}`, timestamp: new Date().toISOString() }].slice(0, 200)
          : k.bank;
        const extraNotifs = milestone
          ? [...k.notifications, { id: uid(), kidId: k.profile.id, kind: "ping" as const, title: `🔥 ${milestone.label}`, body: `Amazing! You earned ${milestone.points} bonus points for your chore streak!`, read: false, createdAt: new Date().toISOString() }]
          : k.notifications;

        return {
          ...k,
          bank: extraBank,
          notifications: extraNotifs,
          streak: {
            currentDays: newCurrent,
            longestDays: Math.max(newCurrent, s.longestDays),
            lastCompletedDate: action.date,
            totalChoresDone: s.totalChoresDone + 1,
          },
        };
      });
    }

    // ── Reward Shop ───────────────────────────────────────────────────────────
    case "REWARD_SHOP_ADD": {
      // Validate shop item values to prevent free rewards or negative screen time
      const item = action.item;
      if ((item.pointCost ?? 0) < 0) return state; // reject negative cost
      if (item.minutesGranted !== undefined && item.minutesGranted < 0) return state; // reject negative minutes
      return { ...state, rewardShop: [{ ...item, pointCost: Math.max(0, item.pointCost ?? 0) }, ...(state.rewardShop ?? [])] };
    }
    case "REWARD_SHOP_UPDATE":
      return { ...state, rewardShop: (state.rewardShop ?? []).map(i => i.id === action.itemId ? { ...i, ...action.payload } : i) };
    case "REWARD_SHOP_REMOVE":
      return { ...state, rewardShop: (state.rewardShop ?? []).filter(i => i.id !== action.itemId) };
    case "REWARD_REDEEM":
      return updateKid(state, action.kidId, k => ({
        ...k,
        rewardRedemptions: [action.redemption, ...(k.rewardRedemptions ?? [])],
        behavior: {
          ...k.behavior,
          totalPoints: Math.max(0, (k.behavior.totalPoints ?? 0) - action.redemption.pointsSpent),
          events: [
            { id: action.redemption.id + "-spend", points: -action.redemption.pointsSpent, reason: `Shop: ${action.redemption.itemTitle}`, date: new Date().toISOString().slice(0, 10) },
            ...(k.behavior.events ?? []),
          ],
        },
      }));
    case "REWARD_DECIDE": {
      const redemption = state.kids.find(k => k.profile.id === action.kidId)
        ?.rewardRedemptions?.find(r => r.id === action.redemptionId);
      return updateKid(state, action.kidId, k => {
        const base = {
          ...k,
          rewardRedemptions: (k.rewardRedemptions ?? []).map(r =>
            r.id === action.redemptionId
              ? { ...r, status: action.status }
              : r
          ),
        };
        if (action.status === "denied" && redemption) {
          return {
            ...base,
            behavior: {
              ...base.behavior,
              totalPoints: (base.behavior.totalPoints ?? 0) + redemption.pointsSpent,
              events: [{ id: redemption.id + "-refund", points: redemption.pointsSpent, reason: `Refund: ${redemption.itemTitle}`, date: new Date().toISOString().slice(0, 10) }, ...(base.behavior.events ?? [])],
            },
          };
        }
        if (action.status === "fulfilled" && redemption?.minutesGranted) {
          return { ...base, bank: [...(base.bank ?? []), { id: redemption.id + "-grant", delta: redemption.minutesGranted, reason: `Reward: ${redemption.itemTitle}`, timestamp: new Date().toISOString() }].slice(0, 200) };
        }
        return base;
      });
    }

    // ── Co-parents ────────────────────────────────────────────────────────────
    case "CO_PARENT_ADD":
      return { ...state, coParents: [...(state.coParents ?? []), action.coParent] };
    case "CO_PARENT_UPDATE":
      return { ...state, coParents: (state.coParents ?? []).map(p => p.id === action.id ? { ...p, ...action.payload } : p) };
    case "CO_PARENT_REMOVE":
      return { ...state, coParents: (state.coParents ?? []).filter(p => p.id !== action.id) };

    // ── SOS ───────────────────────────────────────────────────────────────────
    case "SOS_ALERT":
      return { ...state, sosAlerts: [action.alert, ...(state.sosAlerts ?? [])] };
    case "SOS_ACK":
      return { ...state, sosAlerts: (state.sosAlerts ?? []).map(a => a.id === action.alertId ? { ...a, acknowledged: true } : a) };

    // ── Social monitoring ─────────────────────────────────────────────────────
    case "SOCIAL_ALERT_ADD":
      return { ...state, socialAlerts: [action.alert, ...(state.socialAlerts ?? [])].slice(0, 100) };
    case "SOCIAL_ALERT_ACK":
      return { ...state, socialAlerts: (state.socialAlerts ?? []).map(a => a.id === action.alertId ? { ...a, acknowledged: true } : a) };
    case "SOCIAL_ALERT_CLEAR_ALL":
      return { ...state, socialAlerts: [] };

    // ── Web / DNS filter ──────────────────────────────────────────────────────
    case "WEB_FILTER_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, webFilter: { ...(k.rules.webFilter ?? defaultWebFilter), ...action.payload } },
      }));

    // ── Screen-time grant (manual or chore reward) ────────────────────────────
    case "SCREEN_TIME_GRANT":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, bonusScreenTimeMinutes: (k.rules.bonusScreenTimeMinutes ?? 0) + action.minutes },
      }));

    // ── Pause all devices ─────────────────────────────────────────────────────
    case "PAUSE_ALL_DEVICES":
      return {
        ...state,
        kids: state.kids.map(k => ({
          ...k, rules: { ...k.rules, instantLocked: action.locked, lockMessage: action.locked ? (action.message ?? "Device paused by parent") : undefined },
        })),
      };

    // ── Check-in ──────────────────────────────────────────────────────────────
    case "CHECK_IN_REQUEST":
      return updateKid(state, action.kidId, k => ({
        ...k, checkInRequests: [action.request, ...(k.checkInRequests ?? [])].slice(0, 20),
      }));
    case "CHECK_IN_RESPOND":
      return updateKid(state, action.kidId, k => ({
        ...k,
        checkInRequests: (k.checkInRequests ?? []).map(r =>
          r.id === action.requestId
            ? { ...r, status: action.status, respondedAt: new Date().toISOString(), kidLat: action.lat, kidLng: action.lng }
            : r
        ),
      }));

    // ── Age Presets ───────────────────────────────────────────────────────────
    case "APPLY_AGE_PRESET": {
      const presets: Record<string, Partial<any>> = {
        young_child: {
          dailyLimitMinutes: 60,
          screenTimeSchedule: { dailyLimitMinutes: 60, entertainmentLimitMinutes: 30, educationalAppsExempt: true, bedtimeEnabled: true, bedtimeStart: "19:30", bedtimeEnd: "07:00", bedtimeDays: [0,1,2,3,4,5,6], weekendLimitMinutes: 90, weekendOverrideEnabled: true },
          contentFilter: { blockExplicit: true, blockViolence: true, blockHateSpeech: true, blockGambling: true, blockDrugsAlcohol: true },
          webFilterLevel: "strict",
          purchaseApprovalRequired: true,
          downloadApprovalRequired: true,
          blockPrivateBrowsing: true,
        },
        preteen: {
          dailyLimitMinutes: 120,
          screenTimeSchedule: { dailyLimitMinutes: 120, entertainmentLimitMinutes: 60, educationalAppsExempt: true, bedtimeEnabled: true, bedtimeStart: "20:30", bedtimeEnd: "07:00", bedtimeDays: [0,1,2,3,4,5,6], weekendLimitMinutes: 180, weekendOverrideEnabled: true },
          contentFilter: { blockExplicit: true, blockViolence: true, blockHateSpeech: true, blockGambling: true, blockDrugsAlcohol: true },
          webFilterLevel: "strict",
          purchaseApprovalRequired: true,
          downloadApprovalRequired: true,
          blockPrivateBrowsing: true,
        },
        teen: {
          dailyLimitMinutes: 180,
          screenTimeSchedule: { dailyLimitMinutes: 180, entertainmentLimitMinutes: 90, educationalAppsExempt: true, bedtimeEnabled: true, bedtimeStart: "22:00", bedtimeEnd: "07:00", bedtimeDays: [0,1,2,3,4,5,6], weekendLimitMinutes: 240, weekendOverrideEnabled: true },
          contentFilter: { blockExplicit: true, blockViolence: false, blockHateSpeech: true, blockGambling: true, blockDrugsAlcohol: true },
          webFilterLevel: "auto",
          purchaseApprovalRequired: true,
          downloadApprovalRequired: false,
          blockPrivateBrowsing: false,
          drivingModeEnabled: true,
          drivingSpeedThresholdKmh: 25,
          drivingBlockApps: true,
        },
        older_teen: {
          dailyLimitMinutes: 300,
          screenTimeSchedule: { dailyLimitMinutes: 300, entertainmentLimitMinutes: 150, educationalAppsExempt: true, bedtimeEnabled: true, bedtimeStart: "23:00", bedtimeEnd: "07:00", bedtimeDays: [0,1,2,3,4,5,6], weekendLimitMinutes: 360, weekendOverrideEnabled: false },
          contentFilter: { blockExplicit: true, blockViolence: false, blockHateSpeech: false, blockGambling: true, blockDrugsAlcohol: false },
          webFilterLevel: "auto",
          purchaseApprovalRequired: false,
          downloadApprovalRequired: false,
          blockPrivateBrowsing: false,
          drivingModeEnabled: true,
          drivingSpeedThresholdKmh: 25,
          drivingBlockApps: true,
        },
      };
      const patch = presets[action.preset] ?? {};
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, ...patch },
      }));
    }

    // ── PIN recovery ──────────────────────────────────────────────────────────
    // Recovery code is stored in SecureStore only (via secureDispatch), not in state
    case "SET_PIN_RECOVERY_CODE":
      return state;

    // ── Voice Notes ───────────────────────────────────────────────────────────
    case "VOICE_NOTE_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, voiceNotes: [action.note, ...(k.voiceNotes ?? [])],
      }));
    case "VOICE_NOTE_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, voiceNotes: (k.voiceNotes ?? []).filter(n => n.id !== action.noteId),
      }));
    case "VOICE_NOTE_LISTENED":
      return updateKid(state, action.kidId, k => ({
        ...k, voiceNotes: (k.voiceNotes ?? []).map(n =>
          n.id === action.noteId ? { ...n, listenedAt: new Date().toISOString() } : n
        ),
      }));

    // ── Voice Changer saved recordings ─────────────────────────────────────────
    case "VOICE_RECORDING_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, voiceRecordings: [action.recording, ...(k.voiceRecordings ?? [])].slice(0, 50),
      }));
    case "VOICE_RECORDING_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, voiceRecordings: (k.voiceRecordings ?? []).filter(r => r.id !== action.recordingId),
      }));

    // ── Kid Notes ─────────────────────────────────────────────────────────────
    case "KID_NOTE_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, kidNotes: [action.note, ...(k.kidNotes ?? [])],
      }));
    case "KID_NOTE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, kidNotes: (k.kidNotes ?? []).map(n =>
          n.id === action.noteId ? { ...n, ...action.payload, updatedAt: new Date().toISOString() } : n
        ),
      }));
    case "KID_NOTE_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, kidNotes: (k.kidNotes ?? []).filter(n => n.id !== action.noteId),
      }));

    // ── Parent Notes ──────────────────────────────────────────────────────────
    case "PARENT_NOTE_ADD":
      return { ...state, parentNotes: [action.note, ...(state.parentNotes ?? [])] };
    case "PARENT_NOTE_UPDATE":
      return {
        ...state,
        parentNotes: (state.parentNotes ?? []).map(n =>
          n.id === action.noteId ? { ...n, ...action.payload, updatedAt: new Date().toISOString() } : n
        ),
      };
    case "PARENT_NOTE_DELETE":
      return { ...state, parentNotes: (state.parentNotes ?? []).filter(n => n.id !== action.noteId) };

    // ── Parent To-Do ──────────────────────────────────────────────────────────
    case "PARENT_TODO_ADD":
      return { ...state, parentTodos: [...(state.parentTodos ?? []), action.item] };
    case "PARENT_TODO_TOGGLE":
      return { ...state, parentTodos: (state.parentTodos ?? []).map(t => t.id === action.todoId ? { ...t, done: !t.done } : t) };
    case "PARENT_TODO_UPDATE":
      return { ...state, parentTodos: (state.parentTodos ?? []).map(t => t.id === action.todoId ? { ...t, ...action.payload } : t) };
    case "PARENT_TODO_DELETE":
      return { ...state, parentTodos: (state.parentTodos ?? []).filter(t => t.id !== action.todoId) };

    // ── Morning Routine ───────────────────────────────────────────────────────
    case "MORNING_ROUTINE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, morningRoutine: { ...(k.rules.morningRoutine ?? { enabled: false, items: [], resetHour: 4 }), ...action.routine } },
      }));
    case "MORNING_ITEM_TOGGLE": {
      const today = new Date().toISOString().split("T")[0];
      return updateKid(state, action.kidId, k => {
        const already = (k.morningCompletedItems ?? []).includes(action.itemId);
        return {
          ...k,
          morningLastReset: today,
          morningCompletedItems: already
            ? (k.morningCompletedItems ?? []).filter(id => id !== action.itemId)
            : [...(k.morningCompletedItems ?? []), action.itemId],
        };
      });
    }
    case "MORNING_RESET":
      return updateKid(state, action.kidId, k => ({ ...k, morningCompletedItems: [], morningLastReset: new Date().toISOString().split("T")[0] }));

    // ── Screen Time Borrowing ─────────────────────────────────────────────────
    case "BORROW_REQUEST":
      return updateKid(state, action.kidId, k => ({
        ...k, borrowRequests: [action.request, ...(k.borrowRequests ?? [])].slice(0, 50),
      }));
    case "BORROW_DECIDE":
      return updateKid(state, action.kidId, k => ({
        ...k, borrowRequests: (k.borrowRequests ?? []).map(r =>
          r.id === action.requestId
            ? { ...r, status: action.status, parentNote: action.parentNote, decidedAt: new Date().toISOString() }
            : r
        ),
      }));

    // ── Family Calendar ───────────────────────────────────────────────────────
    case "CALENDAR_ADD":
      return { ...state, familyCalendar: [action.event, ...(state.familyCalendar ?? [])] };
    case "CALENDAR_UPDATE":
      return { ...state, familyCalendar: (state.familyCalendar ?? []).map(e => e.id === action.eventId ? { ...e, ...action.payload } : e) };
    case "CALENDAR_DELETE":
      return { ...state, familyCalendar: (state.familyCalendar ?? []).filter(e => e.id !== action.eventId) };

    // ── Allowance Automation ──────────────────────────────────────────────────
    case "ALLOWANCE_SCHEDULE_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, allowanceSchedules: [...(k.allowanceSchedules ?? []), action.schedule],
      }));
    case "ALLOWANCE_SCHEDULE_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, allowanceSchedules: (k.allowanceSchedules ?? []).map(s =>
          s.id === action.scheduleId ? { ...s, ...action.payload } : s
        ),
      }));
    case "ALLOWANCE_SCHEDULE_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, allowanceSchedules: (k.allowanceSchedules ?? []).filter(s => s.id !== action.scheduleId),
      }));
    case "ALLOWANCE_PAY":
      return updateKid(state, action.kidId, k => ({
        ...k,
        money: {
          ...k.money,
          balance: (k.money.balance ?? 0) + action.amount,
          transactions: [
            { id: uid(), type: "earn" as const, amount: action.amount, description: action.label, date: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString() },
            ...k.money.transactions,
          ],
        },
        allowanceSchedules: (k.allowanceSchedules ?? []).map(s =>
          s.id === action.scheduleId ? { ...s, lastPaidAt: new Date().toISOString() } : s
        ),
        bank: [...(k.bank ?? []), { id: uid(), delta: action.amount, reason: action.label, timestamp: new Date().toISOString() }].slice(0, 200),
      }));

    case "POINT_PAYOUT": {
      const p = action.payout;
      return updateKid(state, action.kidId, k => ({
        ...k,
        behavior: { ...k.behavior, totalPoints: Math.max(0, (k.behavior?.totalPoints ?? 0) - p.points) },
        ...(p.method === "piggy_bank" ? {
          money: {
            ...k.money,
            balance: (k.money?.balance ?? 0) + p.amount,
            transactions: [
              { id: uid(), type: "earn" as const, amount: p.amount, description: `⭐ Points payout (${p.points} pts)`, date: p.date, createdAt: p.createdAt },
              ...(k.money?.transactions ?? []),
            ],
          },
          bank: [...(k.bank ?? []), { id: uid(), delta: p.amount, reason: `⭐ Points payout (${p.points} pts)`, timestamp: p.createdAt }].slice(0, 200),
        } : {}),
        pointPayouts: [p, ...(k.pointPayouts ?? [])].slice(0, 500),
      }));
    }

    case "SET_KID_PAYMENT_HANDLE":
      return updateKid(state, action.kidId, k => ({ ...k, paymentHandle: action.handle }));

    case "PAYMENT_REQUEST_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, paymentRequests: [action.request, ...(k.paymentRequests ?? [])].slice(0, 100),
      }));

    case "PAYMENT_REQUEST_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, paymentRequests: (k.paymentRequests ?? []).map(r =>
          r.id === action.requestId ? { ...r, ...action.payload } : r
        ),
      }));

    // ── Mood Check-in ─────────────────────────────────────────────────────────
    case "MOOD_LOG":
      return updateKid(state, action.kidId, k => ({
        ...k, moodEntries: [action.entry, ...(k.moodEntries ?? [])].slice(0, 365),
      }));
    case "MOOD_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, moodEntries: (k.moodEntries ?? []).filter(e => e.id !== action.entryId),
      }));

    // ── Kid-to-Parent Requests ────────────────────────────────────────────────
    case "KID_REQUEST_SEND":
      return updateKid(state, action.kidId, k => ({
        ...k, kidRequests: [action.request, ...(k.kidRequests ?? [])].slice(0, 100),
      }));
    case "KID_REQUEST_DECIDE":
      return updateKid(state, action.kidId, k => ({
        ...k, kidRequests: (k.kidRequests ?? []).map(r =>
          r.id === action.requestId
            ? { ...r, status: action.status, parentNote: action.parentNote, decidedAt: new Date().toISOString() }
            : r
        ),
      }));
    case "KID_REQUEST_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, kidRequests: (k.kidRequests ?? []).filter(r => r.id !== action.requestId),
      }));

    // ── Teen Mode ─────────────────────────────────────────────────────────────
    case "SET_TEEN_MODE":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, teenMode: action.enabled },
      }));

    // ── Story Character ───────────────────────────────────────────────────────
    case "SET_STORY_CHARACTER":
      return updateKid(state, action.kidId, k => ({
        ...k, rules: { ...k.rules, storyCharacter: action.character },
      }));

    // ── Digest Settings ───────────────────────────────────────────────────────
    case "SET_DIGEST_SETTINGS":
      return { ...state, parentSettings: { ...state.parentSettings, digestEmail: action.email, digestEnabled: action.enabled } };
    case "DIGEST_SENT":
      return { ...state, parentSettings: { ...state.parentSettings, digestLastSentAt: action.timestamp } };

    // ── Co-parenting schedule ─────────────────────────────────────────────────
    case "CO_SCHEDULE_ADD":
      return { ...state, coParentSchedule: [action.event, ...(state.coParentSchedule ?? [])] };
    case "CO_SCHEDULE_UPDATE":
      return { ...state, coParentSchedule: (state.coParentSchedule ?? []).map(e => e.id === action.eventId ? { ...e, ...action.payload } : e) };
    case "CO_SCHEDULE_DELETE":
      return { ...state, coParentSchedule: (state.coParentSchedule ?? []).filter(e => e.id !== action.eventId) };

    // ── Cannot pickup alerts ──────────────────────────────────────────────────
    case "CANNOT_PICKUP_ADD":
      return { ...state, cannotPickupAlerts: [action.alert, ...(state.cannotPickupAlerts ?? [])] };
    case "CANNOT_PICKUP_UPDATE":
      return { ...state, cannotPickupAlerts: (state.cannotPickupAlerts ?? []).map(a => a.id === action.alertId ? { ...a, ...action.payload } : a) };
    case "CANNOT_PICKUP_DELETE":
      return { ...state, cannotPickupAlerts: (state.cannotPickupAlerts ?? []).filter(a => a.id !== action.alertId) };

    // ── Shared expenses ───────────────────────────────────────────────────────
    case "SHARED_EXPENSE_ADD":
      return { ...state, sharedExpenses: [action.expense, ...(state.sharedExpenses ?? [])] };
    case "SHARED_EXPENSE_UPDATE":
      return { ...state, sharedExpenses: (state.sharedExpenses ?? []).map(e => e.id === action.expenseId ? { ...e, ...action.payload } : e) };
    case "SHARED_EXPENSE_DELETE":
      return { ...state, sharedExpenses: (state.sharedExpenses ?? []).filter(e => e.id !== action.expenseId) };

    // ── Document vault — insurance ────────────────────────────────────────────
    case "VAULT_INSURANCE_ADD":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), insurance: [...(state.documentVault?.insurance ?? []), action.doc] } };
    case "VAULT_INSURANCE_UPDATE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), insurance: (state.documentVault?.insurance ?? []).map(d => d.id === action.docId ? { ...d, ...action.payload } : d) } };
    case "VAULT_INSURANCE_DELETE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), insurance: (state.documentVault?.insurance ?? []).filter(d => d.id !== action.docId) } };

    // ── Document vault — identity ─────────────────────────────────────────────
    case "VAULT_IDENTITY_ADD":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), identity: [...(state.documentVault?.identity ?? []), action.doc] } };
    case "VAULT_IDENTITY_UPDATE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), identity: (state.documentVault?.identity ?? []).map(d => d.id === action.docId ? { ...d, ...action.payload } : d) } };
    case "VAULT_IDENTITY_DELETE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), identity: (state.documentVault?.identity ?? []).filter(d => d.id !== action.docId) } };

    // ── Document vault — medical ──────────────────────────────────────────────
    case "VAULT_MEDICAL_UPDATE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), ...action.payload } } };
    case "VAULT_VACCINATION_ADD":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), vaccinations: [...(state.documentVault?.medical?.vaccinations ?? []), action.record] } } };
    case "VAULT_VACCINATION_DELETE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), vaccinations: (state.documentVault?.medical?.vaccinations ?? []).filter(v => v.id !== action.recordId) } } };
    case "VAULT_PRESCRIPTION_ADD":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), prescriptions: [...(state.documentVault?.medical?.prescriptions ?? []), action.rx] } } };
    case "VAULT_PRESCRIPTION_UPDATE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), prescriptions: (state.documentVault?.medical?.prescriptions ?? []).map(r => r.id === action.rxId ? { ...r, ...action.payload } : r) } } };
    case "VAULT_PRESCRIPTION_DELETE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), medical: { ...(state.documentVault?.medical ?? defaultMedical), prescriptions: (state.documentVault?.medical?.prescriptions ?? []).filter(r => r.id !== action.rxId) } } };

    // ── Document vault — other docs ───────────────────────────────────────────
    case "VAULT_OTHER_ADD":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), other: [...(state.documentVault?.other ?? []), action.doc] } };
    case "VAULT_OTHER_UPDATE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), other: (state.documentVault?.other ?? []).map(d => d.id === action.docId ? { ...d, ...action.payload } : d) } };
    case "VAULT_OTHER_DELETE":
      return { ...state, documentVault: { ...(state.documentVault ?? defaultDocumentVault), other: (state.documentVault?.other ?? []).filter(d => d.id !== action.docId) } };

    // ── Family Tree ───────────────────────────────────────────────────────────
    case "FAMILY_TREE_ADD":
      return { ...state, familyTree: [...(state.familyTree ?? []), action.member] };
    case "FAMILY_TREE_UPDATE":
      return { ...state, familyTree: (state.familyTree ?? []).map(m => m.id === action.memberId ? { ...m, ...action.payload } : m) };
    case "FAMILY_TREE_DELETE":
      return { ...state, familyTree: (state.familyTree ?? []).filter(m => m.id !== action.memberId) };

    // ── Monetisation ─────────────────────────────────────────────────────────
    case "AD_DISCLOSURE_SEEN":
      return { ...state, parentSettings: { ...state.parentSettings, hasSeenAdDisclosure: true } };
    case "SET_AD_FREE":
      return { ...state, parentSettings: { ...state.parentSettings, adFree: true, adFreePurchasedAt: action.purchasedAt } };
    case "CLEAR_AD_FREE":
      return { ...state, parentSettings: { ...state.parentSettings, adFree: false, adFreePurchasedAt: undefined } };

    case "RESET_APP":
      return { ...initialState };

    // ── Call contacts & incoming calls ────────────────────────────────────────
    case "SET_CALL_CONTACTS":
      return updateKid(state, action.kidId, k => ({ ...k, callContacts: action.contacts }));
    case "CALL_REQUEST":
      return { ...state, incomingCalls: [action.call, ...(state.incomingCalls ?? []).slice(0, 49)] };
    case "CALL_RESPOND":
      return {
        ...state,
        incomingCalls: (state.incomingCalls ?? []).map(c =>
          c.id === action.callId ? { ...c, status: action.status } : c
        ),
      };

    // ── Apology / Explain Yourself ────────────────────────────────────────────
    case "APOLOGY_SEND":
      return updateKid(state, action.kidId, k => ({
        ...k, apologies: [action.note, ...(k.apologies ?? [])],
      }));
    case "APOLOGY_READ":
      return updateKid(state, action.kidId, k => ({
        ...k, apologies: (k.apologies ?? []).map(n =>
          n.id === action.apologyId ? { ...n, readAt: new Date().toISOString() } : n
        ),
      }));
    case "APOLOGY_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, apologies: (k.apologies ?? []).filter(n => n.id !== action.apologyId),
      }));

    // ── Forced Quiz ───────────────────────────────────────────────────────────
    case "QUIZ_SEND":
      return updateKid(state, action.quiz.kidId, k => ({
        ...k, quizzes: [action.quiz, ...(k.quizzes ?? [])],
      }));
    case "QUIZ_UPDATE":
      return updateKid(state, action.kidId, k => ({
        ...k, quizzes: (k.quizzes ?? []).map(q =>
          q.id === action.quizId ? { ...q, ...action.patch } : q
        ),
      }));
    case "QUIZ_DELETE":
      return updateKid(state, action.kidId, k => ({
        ...k, quizzes: (k.quizzes ?? []).filter(q => q.id !== action.quizId),
      }));

    // ── Emotional Well-Being ──────────────────────────────────────────────────
    case "WELLBEING_CATEGORY_ADD":
      return { ...state, wellBeingCategories: [action.category, ...(state.wellBeingCategories ?? [])] };
    case "WELLBEING_CATEGORY_UPDATE":
      return {
        ...state,
        wellBeingCategories: (state.wellBeingCategories ?? []).map(c =>
          c.id === action.categoryId ? { ...c, ...action.payload } : c
        ),
      };
    case "WELLBEING_CATEGORY_DELETE":
      return {
        ...state,
        wellBeingCategories: (state.wellBeingCategories ?? []).filter(c => c.id !== action.categoryId),
        wellBeingEntries: (state.wellBeingEntries ?? []).filter(e => e.categoryId !== action.categoryId),
      };
    case "WELLBEING_ENTRY_ADD":
      return { ...state, wellBeingEntries: [action.entry, ...(state.wellBeingEntries ?? [])] };
    case "WELLBEING_ENTRY_UPDATE":
      return {
        ...state,
        wellBeingEntries: (state.wellBeingEntries ?? []).map(e =>
          e.id === action.entryId ? { ...e, ...action.payload, updatedAt: new Date().toISOString() } : e
        ),
      };
    case "WELLBEING_ENTRY_DELETE":
      return { ...state, wellBeingEntries: (state.wellBeingEntries ?? []).filter(e => e.id !== action.entryId) };

    // ── Ambient Listen ────────────────────────────────────────────────────────
    case "AMBIENT_LISTEN_REQUEST":
      return updateKid(state, action.kidId, k => ({
        ...k, ambientListenRequest: action.request,
      }));
    case "AMBIENT_LISTEN_CLEAR":
      return updateKid(state, action.kidId, k => ({
        ...k, ambientListenRequest: undefined,
      }));
    case "AMBIENT_RECORDING_ADD":
      return updateKid(state, action.kidId, k => ({
        ...k, ambientRecordings: [action.recording, ...(k.ambientRecordings ?? [])].slice(0, 20),
        ambientListenRequest: undefined, // fulfilled — clear request
      }));
    case "AMBIENT_RECORDING_LISTEN":
      return updateKid(state, action.kidId, k => ({
        ...k, ambientRecordings: (k.ambientRecordings ?? []).map(r =>
          r.id === action.recordingId ? { ...r, listenedAt: new Date().toISOString() } : r
        ),
      }));

    // ── Family Social ─────────────────────────────────────────────────────────
    case "SOCIAL_POST_ADD":
      return { ...state, familySocialPosts: [action.post, ...(state.familySocialPosts ?? [])] };
    case "SOCIAL_POST_DELETE":
      return { ...state, familySocialPosts: (state.familySocialPosts ?? []).filter(p => p.id !== action.postId) };
    case "SOCIAL_POST_LIKE":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : { ...p, likes: p.likes.includes(action.authorId) ? p.likes : [...p.likes, action.authorId] }
        ),
      };
    case "SOCIAL_POST_UNLIKE":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : { ...p, likes: p.likes.filter(l => l !== action.authorId) }
        ),
      };
    case "SOCIAL_COMMENT_ADD":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : { ...p, comments: [...p.comments, action.comment] }
        ),
      };
    case "SOCIAL_COMMENT_DELETE":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : { ...p, comments: p.comments.filter(c => c.id !== action.commentId) }
        ),
      };
    case "SOCIAL_POST_VIEW":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : {
            ...p, viewedBy: p.viewedBy.includes(action.viewerId) ? p.viewedBy : [...p.viewedBy, action.viewerId],
          }
        ),
      };
    case "SOCIAL_MARK_SEEN": {
      // Snapshot the viewer's current "unseen" baseline: now (for posts/comments)
      // and the total likes on their own posts (for the likes badge).
      const posts = state.familySocialPosts ?? [];
      const likeTotal = posts
        .filter(p => p.authorId === action.viewerId)
        .reduce((sum, p) => sum + p.likes.filter(a => a !== action.viewerId).length, 0);
      return {
        ...state,
        socialSeenAt: { ...(state.socialSeenAt ?? {}), [action.viewerId]: new Date().toISOString() },
        socialSeenLikes: { ...(state.socialSeenLikes ?? {}), [action.viewerId]: likeTotal },
      };
    }
    case "SOCIAL_POST_PIN":
      return {
        ...state,
        familySocialPosts: (state.familySocialPosts ?? []).map(p =>
          p.id !== action.postId ? p : { ...p, pinned: action.pinned }
        ),
      };

    // ── Family Vote / Discussion ───────────────────────────────────────────────
    case "VOTE_TOPIC_ADD":
      return { ...state, familyVoteTopics: [action.topic, ...(state.familyVoteTopics ?? [])] };
    case "VOTE_TOPIC_UPDATE":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id === action.topicId ? { ...t, ...action.payload } : t
        ),
      };
    case "VOTE_TOPIC_DELETE":
      return { ...state, familyVoteTopics: (state.familyVoteTopics ?? []).filter(t => t.id !== action.topicId) };
    case "VOTE_CAST":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : {
            ...t,
            options: t.options.map(o =>
              o.id !== action.optionId ? o : {
                ...o, votes: o.votes.includes(action.voterId) ? o.votes : [...o.votes, action.voterId],
              }
            ),
          }
        ),
      };
    case "VOTE_RETRACT":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : {
            ...t,
            options: t.options.map(o =>
              o.id !== action.optionId ? o : { ...o, votes: o.votes.filter(v => v !== action.voterId) }
            ),
          }
        ),
      };
    case "VOTE_ADD_OPTION":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : { ...t, options: [...t.options, action.option] }
        ),
      };
    case "VOTE_REMOVE_OPTION":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : { ...t, options: t.options.filter(o => o.id !== action.optionId) }
        ),
      };
    case "VOTE_ADD_LINK":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : { ...t, links: [...(t.links ?? []), action.link] }
        ),
      };
    case "VOTE_REMOVE_LINK":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : { ...t, links: (t.links ?? []).filter(l => l.id !== action.linkId) }
        ),
      };
    case "VOTE_ADD_COMMENT":
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : { ...t, comments: [...(t.comments ?? []), action.comment] }
        ),
      };
    case "VOTE_CLOSE": {
      const topic = (state.familyVoteTopics ?? []).find(t => t.id === action.topicId);
      if (!topic) return state;
      const winner = [...topic.options].sort((a, b) => b.votes.length - a.votes.length)[0];
      return {
        ...state,
        familyVoteTopics: (state.familyVoteTopics ?? []).map(t =>
          t.id !== action.topicId ? t : {
            ...t, status: "closed", closedAt: new Date().toISOString(),
            winnerId: winner?.id,
          }
        ),
      };
    }

    // ── Location Reminders ────────────────────────────────────────────────────
    case "LOCATION_REMINDER_ADD":
      return { ...state, locationReminders: [action.reminder, ...(state.locationReminders ?? [])] };
    case "LOCATION_REMINDER_UPDATE":
      return {
        ...state,
        locationReminders: (state.locationReminders ?? []).map(r =>
          r.id === action.reminderId ? { ...r, ...action.payload } : r
        ),
      };
    case "LOCATION_REMINDER_DELETE":
      return { ...state, locationReminders: (state.locationReminders ?? []).filter(r => r.id !== action.reminderId) };
    case "LOCATION_REMINDER_TRIGGER":
      return {
        ...state,
        locationReminders: (state.locationReminders ?? []).map(r =>
          r.id === action.reminderId ? { ...r, lastTriggeredAt: new Date().toISOString() } : r
        ),
      };

    // ── Speed Alerts ──────────────────────────────────────────────────────────
    case "SPEED_ALERT_SETTINGS_UPDATE":
      return { ...state, speedAlertSettings: { ...(state.speedAlertSettings ?? {}), ...action.payload } as any };
    case "SPEED_EVENT_ADD":
      return updateKid(state, action.event.kidId, k => ({
        ...k, speedEvents: [action.event, ...(k.speedEvents ?? [])].slice(0, 100),
      }));
    case "SPEED_EVENT_ACK":
      return updateKid(state, action.kidId, k => ({
        ...k, speedEvents: (k.speedEvents ?? []).map(e => e.id === action.eventId ? { ...e, acknowledged: true } : e),
      }));
    case "SPEED_EVENTS_CLEAR":
      return updateKid(state, action.kidId, k => ({ ...k, speedEvents: [] }));

    // ── Phone / GPS Off Events ────────────────────────────────────────────────
    case "PHONE_OFF_EVENT_ADD":
      return updateKid(state, action.event.kidId, k => ({
        ...k, phoneOffEvents: [action.event, ...(k.phoneOffEvents ?? [])].slice(0, 100),
      }));
    case "PHONE_OFF_EVENT_RESOLVE":
      return updateKid(state, action.kidId, k => ({
        ...k, phoneOffEvents: (k.phoneOffEvents ?? []).map(e =>
          e.id === action.eventId ? { ...e, resolvedAt: new Date().toISOString() } : e
        ),
      }));
    case "PHONE_OFF_EVENT_ACK":
      return updateKid(state, action.kidId, k => ({
        ...k, phoneOffEvents: (k.phoneOffEvents ?? []).map(e =>
          e.id === action.eventId ? { ...e, acknowledged: true } : e
        ),
      }));
    case "PHONE_OFF_EVENTS_CLEAR":
      return updateKid(state, action.kidId, k => ({ ...k, phoneOffEvents: [] }));

    // ── Medications ───────────────────────────────────────────────────────────
    case "MED_ADD":
      return { ...state, medications: [action.med, ...(state.medications ?? [])] };
    case "MED_UPDATE":
      return { ...state, medications: (state.medications ?? []).map(m => m.id === action.medId ? { ...m, ...action.payload } : m) };
    case "MED_DELETE":
      return { ...state, medications: (state.medications ?? []).filter(m => m.id !== action.medId) };
    case "DOSE_LOG_ADD":
      return { ...state, doseLogs: [action.log, ...(state.doseLogs ?? [])].slice(0, 2000) };
    case "DOSE_LOG_UPDATE":
      return { ...state, doseLogs: (state.doseLogs ?? []).map(l => l.id === action.logId ? { ...l, ...action.payload } : l) };
    case "MED_HANDOFF_ADD":
      return { ...state, medHandoffs: [action.handoff, ...(state.medHandoffs ?? [])] };
    case "MED_HANDOFF_UPDATE":
      return { ...state, medHandoffs: (state.medHandoffs ?? []).map(h => h.id === action.handoffId ? { ...h, ...action.payload } : h) };
    case "MED_HANDOFF_DELETE":
      return { ...state, medHandoffs: (state.medHandoffs ?? []).filter(h => h.id !== action.handoffId) };
    case "MED_FRIEND_ADD":
      return { ...state, medFriends: [action.friend, ...(state.medFriends ?? [])] };
    case "MED_FRIEND_UPDATE":
      return { ...state, medFriends: (state.medFriends ?? []).map(f => f.id === action.friendId ? { ...f, ...action.payload } : f) };
    case "MED_FRIEND_DELETE":
      return { ...state, medFriends: (state.medFriends ?? []).filter(f => f.id !== action.friendId) };

    // ── Feature 15: Family Tech Agreements ───────────────────────────────────
    case "AGREEMENT_ADD":
      return { ...state, familyAgreements: [action.agreement, ...(state.familyAgreements ?? [])] };
    case "AGREEMENT_UPDATE":
      return { ...state, familyAgreements: (state.familyAgreements ?? []).map(a => a.id === action.agreementId ? { ...a, ...action.payload } : a) };
    case "AGREEMENT_DELETE":
      return { ...state, familyAgreements: (state.familyAgreements ?? []).filter(a => a.id !== action.agreementId) };
    case "AGREEMENT_KID_SIGN":
      return { ...state, familyAgreements: (state.familyAgreements ?? []).map(a => a.id === action.agreementId ? { ...a, kidsSigned: [...new Set([...(a.kidsSigned ?? []), action.kidId])] } : a) };

    // ── Feature 16: Stranger Alerts ───────────────────────────────────────────
    case "STRANGER_ALERT_ADD": {
      const contactLabel = action.alert.contactType === "call" ? "call" : "text";
      const newStrangerNotif: import("./types").KidNotification = {
        id: action.alert.id + "_notif",
        kidId: action.alert.kidId,
        kind: "stranger_alert",
        title: `🚨 Unknown ${contactLabel} for ${action.alert.kidName}`,
        body: `${action.alert.numberMasked} — open Stranger Alert to review.`,
        read: false,
        createdAt: action.alert.detectedAt,
      };
      const stateWithAlert = { ...state, strangerAlerts: [action.alert, ...(state.strangerAlerts ?? [])].slice(0, 100) };
      return updateKid(stateWithAlert, action.alert.kidId, k => ({
        ...k,
        notifications: [newStrangerNotif, ...k.notifications],
      }));
    }
    case "STRANGER_ALERT_ACK":
      return { ...state, strangerAlerts: (state.strangerAlerts ?? []).map(a => a.id === action.alertId ? { ...a, acknowledged: true } : a) };
    case "STRANGER_ALERT_CLEAR_ALL":
      return { ...state, strangerAlerts: [] };

    case "BADWORD_ALERT_ADD": {
      // de-dupe: same kid+app+word within 30s is one alert
      const recent = (state.badWordAlerts ?? []).some(a =>
        a.kidId === action.alert.kidId && a.appPackage === action.alert.appPackage &&
        a.word === action.alert.word &&
        Math.abs(new Date(a.detectedAt).getTime() - new Date(action.alert.detectedAt).getTime()) < 30_000
      );
      if (recent) return state;
      return { ...state, badWordAlerts: [action.alert, ...(state.badWordAlerts ?? [])].slice(0, 100) };
    }
    case "BADWORD_ALERT_ACK":
      return { ...state, badWordAlerts: (state.badWordAlerts ?? []).map(a => a.id === action.alertId ? { ...a, acknowledged: true } : a) };

    case "TAMPER_ALERT_ADD": {
      // collapse repeats of the same kid+kind within 60s
      const dup = (state.tamperAlerts ?? []).some(a =>
        a.kidId === action.alert.kidId && a.kind === action.alert.kind &&
        Math.abs(new Date(a.detectedAt).getTime() - new Date(action.alert.detectedAt).getTime()) < 60_000
      );
      if (dup) return state;
      return { ...state, tamperAlerts: [action.alert, ...(state.tamperAlerts ?? [])].slice(0, 100) };
    }
    case "TAMPER_ALERT_ACK":
      return { ...state, tamperAlerts: (state.tamperAlerts ?? []).map(a => a.id === action.alertId ? { ...a, acknowledged: true } : a) };

    // ── Feature 17: Smart Screen Time Rules ───────────────────────────────────
    case "SMART_RULE_ADD":
      return { ...state, smartScreenTimeRules: [...(state.smartScreenTimeRules ?? []), action.rule] };
    case "SMART_RULE_UPDATE":
      return { ...state, smartScreenTimeRules: (state.smartScreenTimeRules ?? []).map(r => r.id === action.ruleId ? { ...r, ...action.payload } : r) };
    case "SMART_RULE_DELETE":
      return { ...state, smartScreenTimeRules: (state.smartScreenTimeRules ?? []).filter(r => r.id !== action.ruleId) };

    // ── Family Movies ─────────────────────────────────────────────────────────
    case "FAMILY_MOVIE_ADD":
      return { ...state, familyMovies: [action.movie, ...(state.familyMovies ?? [])] };
    case "FAMILY_MOVIE_DELETE":
      return { ...state, familyMovies: (state.familyMovies ?? []).filter(m => m.id !== action.movieId) };

    // ── Family Music ─────────────────────────────────────────────────────────
    case "FAMILY_MUSIC_ADD":
      return { ...state, familyMusic: [action.track, ...(state.familyMusic ?? [])] };
    case "FAMILY_MUSIC_DELETE":
      return { ...state, familyMusic: (state.familyMusic ?? []).filter(t => t.id !== action.trackId) };

    // ── Family Books ─────────────────────────────────────────────────────────
    case "FAMILY_BOOK_ADD":
      return { ...state, familyBooks: [action.book, ...(state.familyBooks ?? [])] };
    case "FAMILY_BOOK_DELETE":
      return { ...state, familyBooks: (state.familyBooks ?? []).filter(b => b.id !== action.bookId) };

    // ── Find Phone ───────────────────────────────────────────────────────────
    case "FIND_PHONE_TRIGGER_PARENT":
      return { ...state, parentSettings: { ...state.parentSettings, findPhoneActive: true, findPhoneFromKidId: action.kidId, findPhoneFromKidName: action.kidName, findPhoneTriggeredAt: new Date().toISOString() } };
    case "FIND_PHONE_DISMISS_PARENT":
      return { ...state, parentSettings: { ...state.parentSettings, findPhoneActive: false, findPhoneFromKidId: undefined, findPhoneFromKidName: undefined, findPhoneTriggeredAt: undefined } };

    default:
      return state;
  }
}

interface DataContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  hydrated: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

type HydrateAction = { type: "@@HYDRATE"; payload: AppState };

function hydratingReducer(state: AppState, action: AppAction | HydrateAction): AppState {
  if ((action as HydrateAction).type === "@@HYDRATE") {
    return { ...initialState, ...(action as HydrateAction).payload };
  }
  return reducer(state, action as AppAction);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(hydratingReducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as AppState;

          // Migrate plaintext recovery code from state to SecureStore, then strip
          if (saved.pinRecoveryCode) {
            await saveRecoveryCode(saved.pinRecoveryCode).catch(() => {});
          }

          // Forward-fill new kid fields and apply array caps
          const migrated: AppState = {
            ...initialState,
            ...saved,
            pinRecoveryCode: undefined,   // strip from state — lives in SecureStore now
            familyCalendar: saved.familyCalendar ?? [],
            parentTodos: saved.parentTodos ?? [],
            medications: saved.medications ?? [],
            doseLogs: saved.doseLogs ?? [],
            medHandoffs: saved.medHandoffs ?? [],
            medFriends: saved.medFriends ?? [],
            aiResults: saved.aiResults ?? [],
            familyAgreements: saved.familyAgreements ?? [],
            strangerAlerts: saved.strangerAlerts ?? [],
            badWordAlerts: saved.badWordAlerts ?? [],
            tamperAlerts: saved.tamperAlerts ?? [],
            smartScreenTimeRules: saved.smartScreenTimeRules ?? [],
            kids: (saved.kids ?? []).map(k => ({
              ...newKidState(k.profile),
              ...k,
              profile: { ...newKidState(k.profile).profile, ...k.profile },
              rules: { ...newKidState(k.profile).rules, ...k.rules },
              // Apply size caps during hydration (fix #9, #15)
              behavior: { ...k.behavior, events: (k.behavior?.events ?? []).slice(0, 500) },
              bank: (k.bank ?? []).slice(0, 200),
              locationHistory: (k.locationHistory ?? []).slice(0, 1440),
              // Forward-fill new arrays for users upgrading from older app versions
              borrowRequests: k.borrowRequests ?? [],
              moodEntries: k.moodEntries ?? [],
              kidRequests: k.kidRequests ?? [],
              allowanceSchedules: k.allowanceSchedules ?? [],
              pointPayouts: k.pointPayouts ?? [],
              paymentRequests: k.paymentRequests ?? [],
              morningCompletedItems: k.morningCompletedItems ?? [],
              aiResults: k.aiResults ?? [],
              knownPackages: k.knownPackages ?? [],
              installAlerts: k.installAlerts ?? [],
            })),
          };
          (dispatch as React.Dispatch<any>)({ type: "@@HYDRATE", payload: migrated });
        } catch {}
      }
      setHydrated(true);
    });
  }, []);

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  // Cross-device state sync (Piece 1). Relays reducer actions over the P2P
  // transport so the family state converges across the parent + kid devices.
  // `dispatch` (raw reducer) is passed so REMOTE actions apply without
  // re-broadcasting. Degrades to a no-op when the P2P swarm is unavailable.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Per-family P2P sync room. Null until the device is signed into a family;
  // when null `useFamilySync` joins no swarm at all (no cross-family leak).
  // Recomputed on Supabase auth changes so signing in / joining a family on the
  // account screen wires up sync live, without an app restart.
  const [syncRoomId, setSyncRoomId] = React.useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let authSub: { subscription?: { unsubscribe: () => void } } | null = null;
    // Load the Supabase-backed account layer lazily so a backend/SDK init
    // failure can never crash app startup (the whole app mounts DataProvider).
    (async () => {
      try {
        const { getMembership, familyRoomId } = await import("../family-account");
        const { supabase } = await import("../supabase");
        const recompute = () => {
          getMembership()
            .then(m => { if (!cancelled) setSyncRoomId(m ? familyRoomId(m.familyId) : null); })
            .catch(() => { if (!cancelled) setSyncRoomId(null); });
        };
        recompute();
        const res = supabase.auth.onAuthStateChange(() => recompute());
        authSub = res.data;
      } catch {
        if (!cancelled) setSyncRoomId(null);
      }
    })();
    return () => { cancelled = true; authSub?.subscription?.unsubscribe(); };
  }, []);

  const sync = useFamilySync(dispatch, () => stateRef.current, hydrated, syncRoomId);
  const broadcastRef = React.useRef(sync.broadcast);
  broadcastRef.current = sync.broadcast;

  const batchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChoreKidsRef = React.useRef<Set<string>>(new Set());

  // Wrap dispatch so sensitive data is mirrored to SecureStore instead of AsyncStorage.
  const secureDispatch = useCallback((action: AppAction) => {
    dispatch(action);

    // Relay this locally-applied action to the other device(s). Secrets are
    // denylisted inside the bridge; no-op when the P2P swarm isn't connected.
    broadcastRef.current(action);

    // Notification batching: collect chore submissions and fire one grouped notification after 90s
    if (action.type === "CHORE_SUBMIT_PROOF") {
      // Find which kid owns this chore (pre-dispatch state; chore is still there, just proofs being added)
      const kidId = state.kids.find(k => k.chores.some(c => c.id === action.choreId))?.profile.id;
      const kidName = state.kids.find(k => k.profile.id === kidId)?.profile.name;
      if (kidId && kidName) {
        pendingChoreKidsRef.current.add(kidId);
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
        batchTimerRef.current = setTimeout(() => {
          const kidIds = [...pendingChoreKidsRef.current];
          pendingChoreKidsRef.current.clear();
          batchTimerRef.current = null;
          if (kidIds.length === 0) return;
          // Group: fire one notification per kid that submitted
          kidIds.forEach(kId => {
            dispatch({
              type: "NOTIFICATION_ADD",
              kidId: kId,
              notification: {
                id: uid(),
                kidId: kId,
                kind: "ping" as const,
                title: `✅ Chores submitted for review`,
                body: "Your kid submitted chores — tap to review and approve.",
                read: false,
                createdAt: new Date().toISOString(),
              },
            });
          });
        }, 90_000); // 90 second batch window
      }
    }
    if (action.type === "VAULT_ADD") {
      if (action.entry.password) {
        saveVaultPassword(action.entry.id, action.entry.password).catch(() => {});
      }
    } else if (action.type === "VAULT_REMOVE") {
      deleteVaultPassword(action.entryId).catch(() => {});
    } else if (action.type === "SET_PIN_RECOVERY_CODE") {
      saveRecoveryCode(action.code).catch(() => {});
    }
  }, [dispatch, state]);

  return (
    <DataContext.Provider value={{ state, dispatch: secureDispatch, hydrated }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

export function useKid(kidId: string) {
  const { state } = useData();
  return state.kids.find(k => k.profile.id === kidId);
}
