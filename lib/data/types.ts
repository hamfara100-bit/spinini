// ─── Mascots & Colors ───────────────────────────────────────────────────────
export type MascotType = "fox" | "panda" | "bunny" | "dino" | "owl" | "cat" | "bear" | "frog";
export type PastelColor = "pink" | "blue" | "green" | "yellow" | "purple" | "orange" | "sky" | "rose";

export const PASTEL_COLORS: Record<PastelColor, string> = {
  pink: "#FFD6E0",
  blue: "#C6F1FF",
  green: "#D9F7C5",
  yellow: "#FFE7A8",
  purple: "#E2D5FF",
  orange: "#FFD0B0",
  sky: "#B8E6FF",
  rose: "#FFC1E3",
};

// ─── Kid & Parent Profiles ──────────────────────────────────────────────────
export interface KidProfile {
  id: string;
  name: string;
  age: number;
  mascot: MascotType;
  color: PastelColor;
  photoUri?: string;
  pin?: string;
  sound?: string;
  createdAt: string;
}

export interface ParentProfile {
  id: string;
  name: string;
  mascot: MascotType;
  color: string;
  emoji?: string;
}

export interface ParentMembership {
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type CallMode = "app" | "native" | "smart";

export interface ParentSettings {
  pin: string;
  name: string;
  emoji?: string;      // avatar emoji for call contacts
  phone?: string;      // phone number shown to kids for audio calls
  callMode?: CallMode; // global default: app | native | smart
  uninstallProtection: boolean;
  emailDigest: boolean;
  lastBackupAt?: string;
  backupEnabled: boolean;
  // Consent & legal
  consentGiven?: boolean;
  consentDate?: string;
  marketingOptIn?: boolean;
  // Subscription
  subscriptionTier?: "free" | "family" | "premium";
  subscriptionExpiresAt?: string;
  // Apple Sign In
  appleUserId?: string;
  appleEmail?: string;
  appleFullName?: string;
  // Weekly digest email
  digestEmail?: string;
  digestEnabled?: boolean;
  digestLastSentAt?: string;
  // Notification batching
  pendingChoreNotifKids?: string[]; // kidIds with queued chore-submission notifs
  pendingChoreNotifTimer?: number;  // timestamp when batch will fire
  // Co-parenting
  shareScheduleWithKids?: boolean;
  // Monetisation
  hasSeenAdDisclosure?: boolean;   // true after the first-launch full-screen shown
  adFree?: boolean;                // true if user has purchased the one-time ad-free upgrade
  adFreePurchasedAt?: string;      // ISO timestamp of purchase
  // Find Phone — kid-initiated alarm on parent's device
  findPhoneActive?: boolean;
  findPhoneFromKidId?: string;
  findPhoneFromKidName?: string;
  findPhoneTriggeredAt?: string;
}

// ─── Rules & Controls ───────────────────────────────────────────────────────
export type AppRuleMode = "allow" | "limit" | "block" | "earned";
export type WebFilterLevel = "auto" | "strict" | "off";

export interface AppSchedule {
  id: string;
  label: string;
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  days: number[];     // 0=Sun … 6=Sat
  enabled: boolean;
}

export interface AppRule {
  appId: string;
  appName: string;
  icon?: string;
  mode: AppRuleMode;           // current enforced mode
  limitMinutes?: number;       // daily time cap when allowed
  schedules?: AppSchedule[];   // recurring on/off windows
  scheduleEnabled: boolean;    // use schedules instead of manual mode
}

export interface DowntimeWindow {
  id: string;
  label: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  days: number[];    // 0=Sun … 6=Sat
  enabled: boolean;
}

export interface WebsiteRule {
  id: string;
  url: string;
  label: string;
  emoji?: string;
  allowed: boolean;
  dailyCapMinutes?: number;
  addedAt: string;
}

export interface ContentFilterSettings {
  blockExplicit: boolean;
  blockViolence: boolean;
  blockHateSpeech: boolean;
  blockGambling: boolean;
  blockDrugsAlcohol: boolean;
}

export interface ScreenTimeSchedule {
  dailyLimitMinutes: number;
  entertainmentLimitMinutes: number; // separate cap for games/social/video
  educationalAppsExempt: boolean;    // edu apps don't count toward limit
  bedtimeEnabled: boolean;
  bedtimeStart: string; // "HH:MM"
  bedtimeEnd: string;   // "HH:MM"
  bedtimeDays: number[];
  weekendLimitMinutes: number;       // override on weekends
  weekendOverrideEnabled: boolean;
}

export interface SafeSearchSettings {
  googleSafeSearch: boolean;
  bingSafeSearch: boolean;
  youtubeRestricted: boolean;
  youtubeSafeSearch: boolean;
}

export interface BedtimeSoftLock {
  enabled: boolean;
  start: string;     // "HH:MM" — when bedtime mode begins
  end: string;       // "HH:MM" — when normal access resumes
  days: number[];    // 0=Sun … 6=Sat
  message: string;   // shown to kid on bedtime home screen
}

export interface FunLock {
  enabled: boolean;
  imageUri?: string;   // funny photo to show on lock screen
  soundUri?: string;   // recorded parent voice/sound
  scheduledTime?: string; // "HH:MM" — auto-lock at this time
  scheduledDays?: number[]; // 0=Sun…6=Sat
  message?: string;    // optional caption
}

// Remote lockdown countdown — parent sends a warning timer to the kid device.
// While the countdown runs the kid can keep using the phone; when it expires
// the device locks automatically.
export interface LockdownTimer {
  message: string;     // big popup message, e.g. "Mom set a timer — 30 min left!"
  imageUri?: string;   // nice image shown alongside the message
  startedAt: string;   // ISO timestamp when the parent started the countdown
  minutes: number;     // countdown length in minutes
}

// A parent-defined rule: spend X points → unlock app(s) for Y minutes
export interface AppRewardRule {
  id: string;
  label: string;        // e.g. "Gaming Time", "YouTube Break"
  appIds: string[];     // app catalog keys that unlock
  pointCost: number;    // points to spend per unlock
  minutesGranted: number; // minutes of access per unlock
  active: boolean;
  createdAt: string;
}

// Active unlock session created when kid spends points
export interface AppUnlockSession {
  id: string;
  ruleId: string;
  ruleName: string;
  appIds: string[];
  pointsSpent: number;
  minutesGranted: number;
  secondsRemaining: number; // counts down while in use
  startedAt: string;        // ISO
  active: boolean;          // false = expired
}

export interface KidRules {
  dailyLimitMinutes: number;
  downtimeWindows: DowntimeWindow[];
  appRules: AppRule[];
  appRewardRules: AppRewardRule[];
  installedApps: string[];
  webFilterLevel: WebFilterLevel;
  webAllowlist: WebsiteRule[];
  instantLocked: boolean;
  lockMessage?: string;
  lockUntil?: string;
  lockAllowedApps?: string[];      // external app packages still usable while locked
  lockAllowedFeatures?: string[];  // in-app feature keys still usable while locked (see LOCK_FEATURES)
  lockSettings?: boolean;          // anti-tamper: block the Settings/installer app so the kid can't force-stop/uninstall/disable accessibility
  deadPhone?: boolean;          // fake "dead" phone — kid sees a black, powered-off screen
  lockdownTimer?: LockdownTimer | null; // remote countdown → auto-lock when it expires
  contentFilter: ContentFilterSettings;
  purchaseApprovalRequired: boolean;
  downloadApprovalRequired: boolean;
  screenTimeSchedule: ScreenTimeSchedule;
  safeSearch: SafeSearchSettings;
  bedtimeSoftLock: BedtimeSoftLock;
  funLock: FunLock;
  lockedFeatures: string[]; // feature IDs currently locked — kid sees lock overlay
  freeMode: boolean;        // all restrictions lifted — monitoring only
  studyMode: boolean;       // entertainment/game apps blocked, school/educational only
  studyModeStart?: string;  // "HH:MM" auto-enable
  studyModeEnd?: string;    // "HH:MM" auto-disable
  studyModeDays?: number[]; // 0=Sun…6=Sat
  blockedPackages: string[]; // real Android package names that are blocked
  studyBlockedPackages: string[]; // blocked only during Study Mode
  studyModeBreakUntil?: string;  // ISO — when active, study-mode restrictions are lifted until this time
  blockPrivateBrowsing: boolean; // prevent incognito/private browsing mode
  drivingModeEnabled: boolean;   // restrict phone use when moving fast (driving detection)
  drivingSpeedThresholdKmh: number; // speed above which driving mode activates
  drivingBlockApps: boolean;     // block non-essential apps while driving
  // New features
  morningRoutine?: MorningRoutine;
  teenMode?: boolean;             // softer controls for 13-17: transparency over hard locks
  storyCharacter?: string;        // persistent AI story character preference
  // Screen time earned from chores (auto-granted bonus minutes on chore approval)
  screenTimePerChoreMinutes: number;  // default 0 = disabled; set >0 to auto-grant
  // Earned bonus screen time accumulator (extra minutes above daily limit)
  bonusScreenTimeMinutes: number;
  // Per-kid web/DNS filter config
  webFilter: WebFilterConfig;
  // Smart Screen Time — daily override computed from smartScreenTimeRules
  smartDeltaMinutes: number;   // net adjustment applied today (+extend / −reduce)
  smartDeltaDate: string;      // "YYYY-MM-DD" the delta was last computed
  // Mood alert tracking — date of last low-mood push notification per parent
  lastMoodAlertDate: string;   // "YYYY-MM-DD" — prevents duplicate daily alerts
}

// ─── Usage & Banking ────────────────────────────────────────────────────────
export interface AppUsage {
  appId: string;
  appName: string;
  appEmoji?: string;
  minutes: number;
  sessions?: number;    // number of times opened
}

export interface UrlVisit {
  url: string;
  title?: string;
  visitedAt: string;
  durationSeconds: number;
}

export interface FeatureTap {
  featureId: string;
  featureName: string;
  featureEmoji: string;
  count: number;
  lastUsed: string; // ISO
}

// A newly-detected app install on the kid's device, awaiting parent review.
export interface InstallAlert {
  packageName: string;
  appName: string;
  detectedAt: string; // ISO
}

export interface UsageDay {
  date: string; // "YYYY-MM-DD"
  totalMinutes: number;
  byApp: AppUsage[];
  visitedUrls: UrlVisit[];
  featureTaps: FeatureTap[]; // which features/buttons kid tapped
  hourlyMinutes?: number[]; // 24 buckets — minutes of activity per hour of the day (0–23)
}

export interface BankEntry {
  id: string;
  delta: number; // positive = earned, negative = spent
  reason: string;
  timestamp: string;
}

export interface TimerSessionState {
  active: boolean;
  label: string;
  durationMinutes: number;
  endTime?: string;
  pausedAt?: string;
  isPaused: boolean;
}

// ─── Chores & Rewards ───────────────────────────────────────────────────────
export type ChoreStatus = "open" | "submitted" | "approved" | "rejected";

export interface ChoreProof {
  kidId: string;
  photoUri?: string;
  note?: string;
  submittedAt: string;
}

export interface ChoreApproval {
  kidId: string;
  approved: boolean;
  awardedPoints: number;
  awardedMinutes: number;
  awardedCash?: number;
  rejectionReason?: string;
  reviewedAt: string;
}

// Feature IDs that are safe to lock (never include: chores, help, incident, important-info, contacts)
export const LOCKABLE_FEATURES = [
  "buddy","stories","sounds","advice",
  "create","journal","books","ideas","gadgets","discoveries",
  "school","browser","calculator","reading-list",
  "fitness","rewards","wishes","money",
  "apps","alarms","vault",
  "communicate","album","remote-session",
  "favorites","achievements",
] as const;

export const FEATURE_LABELS: Record<string, string> = {
  buddy: "AI Buddy", stories: "Bedtime Stories", sounds: "Sleep Sounds", advice: "Parent Advice",
  create: "Create", journal: "My Journal", books: "My Books", ideas: "Ideas",
  gadgets: "Cool Things", discoveries: "Discoveries", school: "School",
  browser: "Safe Browser", calculator: "Calculator", "reading-list": "Books I Read",
  fitness: "Fitness & Meals", rewards: "Rewards", wishes: "Wish List", money: "Piggy Bank",
  apps: "My Apps", alarms: "Alarms & Timer", vault: "Passwords",
  communicate: "Call & Chat", album: "Memories", "remote-session": "Parent View",
  favorites: "My Favorites", achievements: "Achievements",
};

export interface Chore {
  id: string;
  title: string;
  description?: string;
  assignedKids: string[];
  points: number;
  cashReward?: number;
  dueDate?: string;
  status: ChoreStatus;
  proofs: ChoreProof[];
  approvals: ChoreApproval[];
  createdAt: string;
  createdBy: string;
  // Auto-chore / recurring fields
  autoChore?: boolean;          // true = recurring template
  recurringDays?: number[];     // 0=Sun…6=Sat
  deadlineTime?: string;        // "HH:MM" — must complete by this time or lose points
  penaltyPoints?: number;       // behavior points deducted if missed
  penaltyAppliedDates?: string[]; // "YYYY-MM-DD" dates penalty was already applied
  unlocksFeatures?: string[];    // feature IDs unlocked when this chore is approved
  unlockMessage?: string;        // shown on locked feature card (e.g. "Clean your room first!")
}

// ─── Journal & Drawing ──────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  kidId: string;
  text: string;
  photoUri?: string;
  mediaType?: "photo" | "video";
  mood?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DrawingPath {
  points: string;
  color: string;
  width: number;
  glow?: boolean;
  highlight?: boolean;  // marker/highlighter — semi-transparent thick stroke
  sketch?: boolean;     // pencil/sketch — rough textured strokes
}

export interface DrawingSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  // Vehicle / SVG stickers
  vehicleType?: string;   // "car" | "tank" | "airplane" etc. — renders as SVG shape
  fillColor?: string;     // paint fill color chosen by kid
  accentColor?: string;   // secondary color (windows, highlights)
}

export interface DrawingDraft {
  kidId: string;
  paths: DrawingPath[];
  stickers: DrawingSticker[];
  savedAt: string;
}

// ─── Notes ───────────────────────────────────────────────────────────────────
export type NoteHighlightColor = "yellow" | "pink" | "green" | "blue" | "orange" | "none";
export type NoteFontStyle = "normal" | "serif" | "mono";
export type NoteFontSize = "sm" | "md" | "lg";

export interface KidNote {
  id: string;
  kidId: string;
  title: string;
  content: string;
  photos: string[];
  highlightColor: NoteHighlightColor;
  fontStyle: NoteFontStyle;
  fontSize: NoteFontSize;
  bold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParentNote {
  id: string;
  title: string;
  content: string;
  color: string;           // card accent color
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Drawing {
  id: string;
  kidId: string;
  paths: DrawingPath[];
  stickers?: DrawingSticker[];
  title?: string;
  imageUri?: string;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  dueDate?: string; // "YYYY-MM-DD"
}

export interface StopMotionFrame {
  uri: string;
  capturedAt: string;
}

export interface StopMotionProject {
  id: string;
  kidId: string;
  title: string;
  frames: StopMotionFrame[];
  fps: number;
  createdAt: string;
  submittedAt?: string;         // when kid submitted for points
  parentApproved?: boolean | null; // null = pending, true = approved, false = rejected
  pointsAwarded?: number;
}

// ─── Books & Ideas ──────────────────────────────────────────────────────────
export interface BookPage {
  pageNumber: number;
  text: string;
  photoUri?: string;
}

export interface BookEntry {
  id: string;
  kidId: string;
  title: string;
  coverEmoji: string;
  pages: BookPage[];
  createdAt: string;
}

export interface IdeaPaper {
  id: string;
  kidId: string;
  title: string;
  description: string;
  sketches: DrawingPath[];
  photos?: string[];       // photo URIs attached to this idea
  createdAt: string;
}

export interface ReadingBook {
  id: string;
  title: string;
  author?: string;
  coverUri?: string;
  rating: number; // 1-5
  review?: string;
  dateFinished: string;
  parentPoints?: number;
  parentMessage?: string;
}

// ─── Family Communication ────────────────────────────────────────────────────
export interface AlbumItem {
  id: string;
  uri: string;
  type: "photo" | "video" | "note";
  caption?: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ─── Memories ────────────────────────────────────────────────────────────────
export type MemoryMood = "❤️" | "😂" | "🥹" | "🤩" | "😍" | "🎉" | "😮" | "🌟";

export interface Memory {
  id: string;
  title: string;          // "Emma's First Bike Ride"
  date: string;           // "YYYY-MM-DD" — the actual day it happened
  story: string;          // the written note about the day
  photoUris: string[];    // up to 5 photos
  mood: MemoryMood;       // mood/emotion emoji
  forKids: string[];      // kid IDs who can see this, or [] = everyone
  addedBy: string;        // parent name
  addedAt: string;        // ISO timestamp when added to app
}

export interface FamilyMessage {
  id: string;
  text?: string;
  imageUri?: string;   // a shared photo
  audioUri?: string;   // a shared voice/audio clip
  sticker?: string;    // an emoji sticker
  authorId: string;
  authorName: string;
  recipients: string[];
  sentAt: string;
  readBy: string[];
}

export interface VaultEntry {
  id: string;
  kidId: string;
  label: string;
  username: string;
  password?: string;  // stored in SecureStore, not in AsyncStorage state
  url?: string;
  createdAt: string;
}

// ─── Money & Contacts ────────────────────────────────────────────────────────
export interface MoneyTransaction {
  id: string;
  amount: number;
  type: "earn" | "spend" | "save" | "debt" | "auto-earn";
  description: string;
  date: string;
  scheduleId?: string; // links back to the earn schedule that generated it
}

export interface SavingsGoal {
  id: string;
  label: string;
  targetAmount: number;
  currentAmount: number;
  emoji?: string;
}

export interface MoneyDebt {
  id: string;
  debtorName: string;
  amount: number;
  reason: string;
  dueDate?: string;
  paid: boolean;
}

// Days: 0 = Sunday … 6 = Saturday (matches Date.getDay())
export interface EarnScheduleEntry {
  id: string;
  label: string;       // job/chore description
  amount: number;      // $ per occurrence
  days: number[];      // weekdays this applies (0-6)
  active: boolean;
  createdAt: string;
  lastAppliedDate?: string; // "YYYY-MM-DD" — prevents double-earning same day
}

export interface MoneyState {
  currency: string;
  balance: number;
  transactions: MoneyTransaction[];
  goals: SavingsGoal[];
  debts: MoneyDebt[];
  earnSchedules: EarnScheduleEntry[];
}

export interface KidContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  canCall: boolean;
  canText: boolean;
  isEmergency: boolean;
  photoUri?: string;
}

// ─── Grades ──────────────────────────────────────────────────────────────────
export type GradeValue = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";

export const GRADE_POINTS: Record<GradeValue, number> = {
  "A+": 100, "A": 95, "A-": 92,
  "B+": 88,  "B": 85, "B-": 82,
  "C+": 78,  "C": 75, "C-": 72,
  "D": 65,   "F": 50,
};

export const GRADE_COLOR: Record<GradeValue, string> = {
  "A+": "#059669", "A": "#10B981", "A-": "#34D399",
  "B+": "#2563EB", "B": "#3B82F6", "B-": "#60A5FA",
  "C+": "#D97706", "C": "#F59E0B", "C-": "#FCD34D",
  "D":  "#DC2626", "F": "#991B1B",
};

export interface ClassGrade {
  id: string;
  kidId: string;
  subject: string;
  teacher?: string;
  period: string;        // "Q1 2025", "Spring Semester", etc.
  grade: GradeValue;
  percentage?: number;
  notes?: string;
  addedBy: "kid" | "parent";
  addedAt: string;
  rewardSent?: boolean;  // parent already sent a reward for this grade
}

// ─── School & Behavior ───────────────────────────────────────────────────────
export type AssignmentStatus = "pending" | "done" | "missing" | "late";
export type IncidentCategory = "bullying" | "praise" | "fight" | "lost_item" | "stranger" | "unsafe_area" | "other";

export interface Assignment {
  id: string;
  kidId: string;
  subject: string;
  title: string;
  description?: string;
  photoUri?: string;   // optional photo of the assignment/board
  dueDate: string;     // "YYYY-MM-DD" or "" if no due date
  status: AssignmentStatus;
  proofUris: string[];
  bonusPoints: number;
  createdAt: string;
}

export interface ScheduleEvent {
  id: string;
  kidId: string;
  title: string;
  startTime: string;
  endTime?: string;
  category: "school" | "activity" | "family";
  reminder: boolean;
  date: string;
}

export interface Alarm {
  id: string;
  kidId: string;
  time: string; // "HH:MM"
  label: string;
  sound?: string;
  recurringDays: number[];
  enabled: boolean;
}

export interface BehaviorEvent {
  id: string;
  points: number;
  reason: string;
  date: string;
}

export interface BehaviorScoreState {
  totalPoints: number;
  events: BehaviorEvent[];
}

export interface SchoolIncident {
  id: string;
  kidId: string;
  category: IncidentCategory;
  description: string;
  feeling?: string;
  photoUri?: string;
  videoUri?: string;
  sharedToParent: boolean;
  date: string;
}

// ─── Location & Permissions ──────────────────────────────────────────────────
export interface SafeZone {
  id: string;
  name: string;
  emoji?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt?: string;
}

export interface LocationSnapshot {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
}

export interface PermissionStatus {
  camera: boolean;
  microphone: boolean;
  location: boolean;
  locationBackground: boolean;
  contacts: boolean;
  notifications: boolean;
  photoLibrary: boolean;
}

export interface PermissionLedger {
  statuses: PermissionStatus;
  onboardingDone: boolean;
  lastChecked?: string;
}

export interface FamilyFilterStatus {
  iosEnabled: boolean;
  androidEnabled: boolean;
  provider?: string;
}

// ─── Media & Video ────────────────────────────────────────────────────────────
export interface VideoRoom {
  id: string;
  participants: string[];
  hostId: string;
  active: boolean;
  startedAt: string;
}

export interface VideoMessage {
  id: string;
  authorId: string;
  authorName: string;
  kind: "video" | "voice";
  mediaUri: string;        // audio or video URI
  thumbUri?: string;
  text?: string;
  durationSeconds: number;
  sentAt: string;
  read: boolean;
}

export interface ColoringPage {
  id: string;
  kidId: string;
  prompt: string;
  outlineUri?: string;
  outlineSvg?: string;
  coloredUri?: string;
  paths?: DrawingPath[];
  stickers?: DrawingSticker[];
  fromParent: boolean;
  createdAt: string;
}

// ─── AI Results ──────────────────────────────────────────────────────────────
export type AIResultFormat = "report" | "csv" | "pdf" | "form" | "note";
export type AIResultCreator = "parent" | "kid";

export interface AIResult {
  id: string;
  title: string;
  format: AIResultFormat;
  content: string;       // markdown / CSV / HTML content
  createdAt: string;
  createdBy: AIResultCreator;
  kidId?: string;        // set when kid created it
  prompt?: string;       // the original user request
}

// ─── AI & Communication ──────────────────────────────────────────────────────
export type AgentRole = "user" | "assistant";

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  imageUri?: string;
  timestamp: string;
}

export interface AdviceCategory {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
}

export interface LifeAdvice {
  id: string;
  title?: string;          // short headline shown in the list
  text: string;            // the full advice body, revealed when tapped
  emoji?: string;
  categoryId?: string;     // which AdviceCategory this belongs to
  photoUri?: string;
  targetKids: string[];
  readBy: string[];
  createdAt: string;
}

/** How the story content was created/delivered */
export type StoryRecordingType =
  | "ai-text"        // AI-generated text, read aloud with TTS + word highlighting
  | "voice-audio"    // Parent recorded voice reading (audio only)
  | "voice-video"    // Parent recorded themselves on camera
  | "ai-voice-clone";// AI-generated text, intended for voice-clone narration (TTS fallback)

export interface StoryItem {
  id: string;
  title: string;
  text: string;
  recordingType?: StoryRecordingType; // undefined treated as "ai-text"
  audioUri?: string;     // local file URI for voice-audio or ai-voice-clone output
  videoUri?: string;     // local file URI for voice-video
  coverEmoji?: string;   // optional decorative emoji shown on card
  duration?: number;     // recording duration in seconds
  narrationUri?: string;
  authorId: string;
  authorName: string;
  targetKids: string[];
  readBy: string[];
  aiGenerated: boolean;
  createdAt: string;
}

/** Voice sample uploaded/recorded by parent for AI voice-clone stories */
export interface VoiceSample {
  id: string;
  name: string;         // user-given label e.g. "My calm voice"
  uri: string;          // local file URI
  durationSec: number;
  createdAt: string;
}

// ─── Story Media (YouTube / video / audio sent by parent) ─────────────────────
export type StoryMediaKind = "youtube" | "video" | "audio";

export interface StoryMedia {
  id: string;
  kind: StoryMediaKind;
  title: string;
  description?: string;
  url: string;            // YouTube URL, direct MP4/MP3 URL, etc.
  thumbnailUrl?: string;  // auto-filled for YouTube
  fromParentName: string;
  targetKids: string[];   // empty = all kids
  addedAt: string;
}

export interface KidNotification {
  id: string;
  kidId: string;
  kind: "chore_approved" | "chore_rejected" | "story" | "advice" | "ping" | "lock" | "wish_decision" | "achievement_awarded" | "workout_approved" | "stranger_alert" | "smart_screen_time";
  title: string;
  body: string;
  emoji?: string;
  route?: string;
  read: boolean;
  createdAt: string;
  // Alarm ping fields
  alarmMode?: boolean;          // true = full-screen alarm until acknowledged
  soundLevel?: "normal" | "high"; // volume/pattern intensity
  forceVibrate?: boolean;       // loop vibration pattern
  acknowledged?: boolean;       // kid has tapped "I got it"
  requestLocation?: boolean;    // alarm asks the kid to SEND their location to stop it
}

// ─── Fitness & Meal Plans ────────────────────────────────────────────────────
export interface WorkoutExercise {
  id: string;
  name: string;
  emoji: string;
  sets?: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  kidId: string;
  title: string;
  description?: string;
  exercises: WorkoutExercise[];
  scheduledDays: number[];   // 0=Sun … 6=Sat
  scheduledTime?: string;    // "HH:MM" for reminder
  reminderEnabled: boolean;
  createdBy: "parent" | "kid";
  color: string;
  createdAt: string;
}

export interface WorkoutLog {
  id: string;
  kidId: string;
  planId: string;
  planTitle: string;
  date: string;              // "YYYY-MM-DD"
  note?: string;
  photoUri?: string;
  pointsAwarded?: number;
  parentApproved?: boolean;
  parentComment?: string;
  submittedAt: string;
  approvedAt?: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface PlannedMeal {
  id: string;
  type: MealType;
  name: string;
  description?: string;
  emoji?: string;
  calories?: number;
  day?: number;              // 0=Sun … 6=Sat, undefined = every day
}

export interface MealPlan {
  id: string;
  kidId: string;
  title: string;
  meals: PlannedMeal[];
  createdBy: "parent" | "kid";
  active: boolean;
  createdAt: string;
}

export interface MealLog {
  id: string;
  kidId: string;
  mealType: MealType;
  mealName: string;
  photoUri?: string;
  note?: string;
  loggedAt: string;          // ISO date
}

// ─── Kid-Authored Stories ─────────────────────────────────────────────────────
export interface KidStory {
  id: string;
  kidId: string;
  title: string;
  text: string;
  voiceUri?: string;   // optional recorded narration
  createdAt: string;
}

// ─── Discoveries ─────────────────────────────────────────────────────────────
export type DiscoveryCategory =
  | "nature" | "science" | "health" | "animals" | "history" | "food" | "space" | "people" | "random";

export interface Discovery {
  id: string;
  kidId: string;
  title: string;      // the thing they learned, short
  note?: string;      // longer explanation
  photoUri?: string;
  category: DiscoveryCategory;
  createdAt: string;
}

// ─── Achievements ─────────────────────────────────────────────────────────────
export type AchievementCategory =
  | "sports" | "academic" | "creative" | "financial" | "personal" | "milestone" | "other";

export interface Achievement {
  id: string;
  kidId: string;
  title: string;
  note?: string;
  photoUri?: string;
  category: AchievementCategory;
  pointsAwarded?: number;
  parentComment?: string;
  createdAt: string;
  awardedAt?: string;
}

export interface GadgetItem {
  id: string;
  kidId: string;
  title: string;
  note?: string;
  photoUri?: string;
  createdAt: string;
}

export interface WishItem {
  id: string;
  kidId: string;
  title: string;
  note?: string;
  photoUri?: string;
  category: string;
  moodEmoji?: string;
  decision: "pending" | "approved" | "denied";
  parentComment?: string;
  createdAt: string;
  decidedAt?: string;
}

// ─── Favorites ───────────────────────────────────────────────────────────────
export type FavoriteCategory = "food" | "places" | "activities" | "recipes";

export interface FavoriteItem {
  id: string;
  kidId: string;
  category: FavoriteCategory;
  name: string;
  description?: string;
  photoUri?: string;      // legacy single photo (kept for backward compat)
  photos?: string[];      // multiple photo URIs
  // Recipe-only fields
  ingredients?: string[];
  steps?: string[];
  cookTime?: string;
  createdAt: string;
}

// ─── Call & Text Guard ────────────────────────────────────────────────────────
export interface CommGuardSettings {
  blockUnknownCalls: boolean;
  blockUnknownTexts: boolean;
  allowedNumbers: string[];        // e.g. ["0412345678", "+61412345678"]
  schoolTimeContacts?: string[];   // contacts that bypass school/study-mode restrictions (name or number)
  emergencyUnlockCode?: string;    // secret SMS text (≤20 chars) — any number can send this to unlock for 24h
  emergencyUnlockExpiresAt?: string; // ISO — while in future, all calls/texts are allowed
}

export type BlockedContactType = "call" | "text";

export interface BlockedContactEntry {
  id: string;
  type: BlockedContactType;
  numberMasked: string;            // e.g. "***-***-1234" or "Unknown"
  timestamp: string;               // ISO
}

// ─── Funny Sound Messages ─────────────────────────────────────────────────────
export interface FunnySoundMessage {
  id: string;
  kidId: string;
  fromName: string;         // parent name / "Mom" / "Dad"
  presetId?: string;        // ID from FUNNY_PRESETS — played via TTS
  soundUri?: string;        // recorded audio URI
  videoUri?: string;        // recorded/picked video URI
  message?: string;         // optional caption shown in popup
  sentAt: string;
  played: boolean;
}

// ─── Streak ──────────────────────────────────────────────────────────────────
export interface StreakState {
  currentDays: number;        // consecutive days with all chores done
  longestDays: number;        // all-time best
  lastCompletedDate: string;  // "YYYY-MM-DD"
  totalChoresDone: number;
}

// ─── Reward Shop ─────────────────────────────────────────────────────────────
export type RewardItemKind = "screen_time" | "real_world" | "digital";

export interface RewardShopItem {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  kind: RewardItemKind;
  pointCost: number;
  minutesGranted?: number;  // for screen_time kind
  available: boolean;
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  kidId: string;
  itemId: string;
  itemTitle: string;
  pointsSpent: number;
  minutesGranted?: number;
  status: "pending" | "fulfilled" | "denied";
  requestedAt: string;
  decidedAt?: string;
  parentNote?: string;
}

// ─── Call Contacts & Incoming Calls ──────────────────────────────────────────

export interface CallContact {
  id: string;
  name: string;
  role: string;       // "Mom", "Dad", "Grandpa" …
  emoji: string;      // avatar emoji
  color: string;      // card background color
  phone?: string;     // for native audio calls
  callMode?: CallMode; // override global setting; undefined = use global
}

export interface IncomingCall {
  id: string;
  kidId: string;
  kidName: string;
  contactId: string;
  contactName: string;
  callType: "video" | "audio";
  timestamp: string;
  status: "ringing" | "accepted" | "declined" | "callback" | "missed";
  roomId: string;   // Jitsi room ID (used for video)
}

// ─── Multi-parent ─────────────────────────────────────────────────────────────
export type CoParentRole = "admin" | "coparent" | "viewer";

export interface CoParent {
  id: string;
  name: string;
  emoji: string;
  pin: string;
  role: CoParentRole;
  createdAt: string;
}

// ─── Voice Notes (parent → kid) ──────────────────────────────────────────────
export interface VoiceNote {
  id: string;
  title: string;        // label the parent gives this message
  uri: string;          // local file URI from expo-audio recording
  durationSecs: number;
  createdAt: string;
  from: string;         // parent display name
  listenedAt?: string;  // set when kid plays it
}

// A recording the kid made in the Voice Changer, saved so it can be replayed
// (with its sound effect) and shared to the family chat at any time.
export interface SavedVoiceRecording {
  id: string;
  uri: string;          // local file URI from expo-audio recording
  durationSecs: number;
  createdAt: string;
  fxId: string;         // selected sound effect id
  fxLabel: string;      // e.g. "Chipmunk"
  fxEmoji: string;      // e.g. "🐿️"
  fxRate: number;       // playback rate for the effect
  title?: string;       // optional label the kid gives it
}

// ─── Check-in Request ────────────────────────────────────────────────────────
export type CheckInStatus = "pending" | "safe" | "help_needed";

export interface CheckInRequest {
  id: string;
  kidId: string;
  requestedAt: string;       // ISO — when parent sent the request
  respondedAt?: string;      // ISO — when kid responded
  status: CheckInStatus;
  kidLat?: number;
  kidLng?: number;
}

// ─── Age Preset ──────────────────────────────────────────────────────────────
export type AgePreset = "young_child" | "preteen" | "teen" | "older_teen";

// ─── SOS ─────────────────────────────────────────────────────────────────────
export interface SosAlert {
  id: string;
  kidId: string;
  kidName: string;
  lat?: number;
  lng?: number;
  timestamp: string;
  acknowledged: boolean;
}

// ─── Social Media Monitoring ─────────────────────────────────────────────────
export type SocialAlertSeverity = "warning" | "danger" | "critical";

export interface SocialAlert {
  id: string;
  kidId: string;
  kidName: string;
  appPackage: string;   // e.g. "com.instagram.android"
  appName: string;      // e.g. "Instagram"
  matchedKeyword: string;
  context: string;      // redacted surrounding text (≤ 100 chars)
  severity: SocialAlertSeverity;
  timestamp: string;
  acknowledged: boolean;
}

// ─── Web/DNS Filter Config ────────────────────────────────────────────────────
export interface WebFilterConfig {
  enabled: boolean;
  blockAdult: boolean;
  blockGambling: boolean;
  blockViolence: boolean;
  blockDrugs: boolean;
  blockSocialMedia: boolean;
  blockGaming: boolean;
  customBlocklist: string[];   // extra domains to block
  customAllowlist: string[];   // domains to always allow
  safeModeSearch: boolean;     // force safe-search via DNS
  vpnStarted: boolean;         // reflects native VPN state
}

// ─── Cloud & Site Requests ────────────────────────────────────────────────────
export type CloudProvider = "google_drive" | "custom_https";

export interface CloudBackupConfig {
  provider?: CloudProvider;
  enabled: boolean;
  autoBackup: boolean;
  folderId?: string;
  endpoint?: string;
  lastBackupAt?: string;
}

export interface SiteRequest {
  id: string;
  kidId: string;
  url: string;
  title?: string;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  decidedAt?: string;
}

// ─── Explain Yourself / Apology ──────────────────────────────────────────────
export type ApologyFrom = "parent" | "kid";
export type ApologyReason =
  | "yelled" | "grounded" | "banned_tv" | "took_device" | "unfair_rule"
  | "missed_event" | "forgot_promise" | "was_wrong" | "other";

export const APOLOGY_REASON_LABELS: Record<ApologyReason, string> = {
  yelled:          "😤 I yelled at you",
  grounded:        "🏠 I grounded you",
  banned_tv:       "📺 I banned TV/games",
  took_device:     "📵 I took your device",
  unfair_rule:     "📜 I set an unfair rule",
  missed_event:    "🎉 I missed your event",
  forgot_promise:  "🤞 I forgot a promise",
  was_wrong:       "❌ I was wrong about something",
  other:           "💬 Other reason",
};

export interface ApologyNote {
  id: string;
  from: ApologyFrom;
  kidId: string;
  reason: ApologyReason | string;
  message: string;
  pointsGiven?: number;
  voiceNoteUri?: string;
  voiceNoteDurationSecs?: number;
  createdAt: string;
  readAt?: string;
}

// ─── Forced Quiz ─────────────────────────────────────────────────────────────
export type QuizQuestionType = "multiple_choice" | "text";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];        // for multiple_choice — 2-4 options
  correctAnswer: string;     // option index ("0"-"3") for MC, text for typed
  imageUri?: string;         // optional question image
  hint?: string;             // optional hint shown on "go back to read"
}

export type QuizStatus = "pending" | "in_progress" | "passed" | "failed";
export type QuizRewardType = "time" | "points";

export interface ForcedQuiz {
  id: string;
  kidId: string;
  title: string;
  parentNote?: string;       // parent's message explaining why
  readingMaterial: string;   // text to read before answering
  questions: QuizQuestion[];
  passingPct: number;        // 0.0–1.0 (default 0.8 = 80%)
  rewardType: QuizRewardType;
  rewardValue: number;       // minutes or points
  status: QuizStatus;
  createdAt: string;
  completedAt?: string;
  lastScore?: number;        // 0.0–1.0
  attemptCount: number;
  currentQuestionIndex?: number; // saves progress mid-quiz
  kidAnswers?: Record<string, string>; // questionId → answer given
}

// ─── Emotional Well-Being ─────────────────────────────────────────────────────
export interface WellBeingCategory {
  id: string;
  title: string;
  emoji: string;
  color: string;
  description?: string;
  createdAt: string;
}

export type WellBeingFontStyle = "normal" | "serif" | "handwriting";

export interface WellBeingEntry {
  id: string;
  categoryId: string;
  title: string;
  bodyText: string;
  videoUrls: string[];       // YouTube / TikTok embed URLs
  images: string[];          // local photo URIs
  fontStyle: WellBeingFontStyle;
  highlightColor?: string;   // hex — background tint on entry card
  createdAt: string;
  updatedAt: string;
}

// ─── Ambient Listen (Listen to Surroundings) ──────────────────────────────────
export interface AmbientListenRequest {
  requestedAt: string;       // ISO — when parent requested it
  durationSecs: number;      // how many seconds to record (default 30)
  fulfilled: boolean;        // true when kid's device completed recording
}

export interface AmbientRecording {
  id: string;
  uri: string;               // local audio file URI
  durationSecs: number;
  requestedAt: string;
  recordedAt: string;
  listenedAt?: string;       // when parent played it
}

// ─── Family Social (TikTok-style private feed) ───────────────────────────────
export type SocialPostType = "video" | "photo" | "multi_photo" | "text" | "gif" | "meme" | "sticker";

export interface FamilySocialComment {
  id: string;
  authorId: string; // "parent" | kidId
  text: string;
  createdAt: string;
  parentCommentId?: string; // set when this comment is a reply to another comment
}

/** A song attached to a social post — a 30s preview from the free music search. */
export interface SocialMusic {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;   // 30-second preview mp3/m4a
  artworkUrl?: string;
}

export interface FamilySocialPost {
  id: string;
  authorId: string; // "parent" | kidId
  type: SocialPostType;
  mediaUris: string[]; // local file URIs
  thumbnailUri?: string; // video thumbnail
  caption: string;
  music?: SocialMusic;   // optional background song (plays while the post is shown)
  likes: string[]; // authorIds who liked
  comments: FamilySocialComment[];
  viewedBy: string[]; // who has viewed
  pinned: boolean;
  createdAt: string;
}

// ─── Family Vote / Discussion ─────────────────────────────────────────────────
export type VoteTopicType = "movie" | "vacation" | "food" | "weekend" | "holiday" | "discussion" | "custom";

export const VOTE_TOPIC_META: Record<VoteTopicType, { emoji: string; label: string; hint: string }> = {
  movie:      { emoji: "🎬", label: "Movie Night",       hint: "Vote on which movie to watch together" },
  vacation:   { emoji: "✈️", label: "Vacation Plans",    hint: "Plan and vote on holiday destinations" },
  food:       { emoji: "🍕", label: "Dinner / Food",     hint: "Vote on what to eat tonight" },
  weekend:    { emoji: "🌤️", label: "Weekend Activity",  hint: "Decide what to do this weekend" },
  holiday:    { emoji: "🎄", label: "Holiday Fun",       hint: "Plan holiday activities and traditions" },
  discussion: { emoji: "💬", label: "Share & Discuss",   hint: "Share an article, video or link and discuss it" },
  custom:     { emoji: "🗳️", label: "Custom Poll",       hint: "Create any family vote you like" },
};

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
  imageUri?: string;
  videoUrl?: string;
  addedBy: string; // "parent" | kidId
  votes: string[]; // voter IDs: "parent" | kidId
}

export interface FamilyDiscussionLink {
  id: string;
  url: string;
  title?: string;
  addedBy: string;
  comment?: string;
  createdAt: string;
}

export interface FamilyVoteComment {
  id: string;
  authorId: string; // "parent" | kidId
  text: string;
  createdAt: string;
}

export interface FamilyVoteTopic {
  id: string;
  type: VoteTopicType;
  title: string;
  description?: string;
  emoji?: string;
  snacks?: string; // for movie night: snack list
  createdBy: string; // "parent" | kidId
  allowedVoters: string[]; // kidIds + "parent" = all
  listCreatorId?: string; // who can add options; undefined = everyone
  maxOptionsPerPerson: number; // default 3
  options: VoteOption[];
  links: FamilyDiscussionLink[];
  comments: FamilyVoteComment[];
  status: "open" | "closed";
  winnerId?: string;
  createdAt: string;
  closedAt?: string;
}

// ─── Location Reminders ───────────────────────────────────────────────────────
export interface LocationReminder {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  radiusMeters: number;
  reminderText: string;
  emoji: string;
  triggerOn: "enter" | "exit" | "both";
  appliesTo: string[]; // kidIds + "parent"; empty = all
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

// ─── Speed / Driving Alerts ───────────────────────────────────────────────────
export interface SpeedAlertSettings {
  enabled: boolean;
  limitKmh: number;           // e.g. 80
  aggressiveDeltaKmh: number; // how much over limit to flag, e.g. 20
  pointsPerViolation: number; // e.g. 10
  alertParent: boolean;
}

export interface SpeedEvent {
  id: string;
  kidId: string;
  detectedSpeedKmh: number;
  limitKmh: number;
  lat?: number;
  lng?: number;
  recordedAt: string;
  pointsDeducted: number;
  acknowledged: boolean;
}

// ─── Morning Unlock Routine ──────────────────────────────────────────────────
export interface MorningChecklistItem {
  id: string;
  label: string;
  emoji: string;
}

export interface MorningRoutine {
  enabled: boolean;
  items: MorningChecklistItem[];
  resetHour: number; // hour (0-23) when checklist resets; default 4 (4am)
}

// ─── Screen Time Borrowing ────────────────────────────────────────────────────
export interface BorrowRequest {
  id: string;
  kidId: string;
  minutes: number;
  reason: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied";
  parentNote?: string;
  decidedAt?: string;
}

// ─── Family Calendar ──────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;   // "YYYY-MM-DD"
  time?: string;  // "HH:MM"
  emoji?: string;
  color?: string;
  note?: string;
  kidIds?: string[]; // undefined/empty = visible to all kids
  createdBy: string;
  createdAt: string;
  visibility?: "all" | "parents-only"; // default "all"
  alarmKidIds?: string[]; // kid IDs to ping with alarm for this event
}

// ─── Allowance Automation ─────────────────────────────────────────────────────
export interface AllowanceSchedule {
  id: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "biweekly" | "monthly";
  dayOfWeek?: number;   // 0=Sun … 6=Sat for weekly/biweekly
  dayOfMonth?: number;  // 1-31 for monthly
  label: string;
  lastPaidAt?: string;
  enabled: boolean;
}

// ─── Point Payout ─────────────────────────────────────────────────────────────
export type PayoutMethod = "cash" | "piggy_bank" | "sent" | "venmo" | "cashapp";

export interface PointPayout {
  id: string;
  points: number;
  amount: number;       // dollar value at time of payout
  method: PayoutMethod;
  note?: string;
  paidBy?: string;      // parent name who made the payment
  date: string;         // YYYY-MM-DD
  createdAt: string;
}

// ─── Payment Handles & Requests ───────────────────────────────────────────────
export interface KidPaymentHandle {
  venmoUsername?: string;
  cashappTag?: string;  // without the $
}

export type PaymentRequestType   = "points" | "allowance" | "both";
export type PaymentRequestStatus = "pending" | "paid" | "declined";

export interface PaymentRequest {
  id: string;
  type: PaymentRequestType;
  pointsAmount?: number;     // pts to cash out (for "points" / "both")
  allowanceAmount?: number;  // $ amount (for "allowance" / "both")
  message?: string;
  status: PaymentRequestStatus;
  requestedAt: string;
  respondedAt?: string;
  respondedBy?: string;      // parent name
  responseNote?: string;
}

// ─── Mood Check-in ────────────────────────────────────────────────────────────
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<MoodLevel, { emoji: string; label: string; color: string }> = {
  1: { emoji: "😢", label: "Awful",   color: "#EF4444" },
  2: { emoji: "😕", label: "Bad",     color: "#F97316" },
  3: { emoji: "😐", label: "Okay",    color: "#EAB308" },
  4: { emoji: "😊", label: "Good",    color: "#22C55E" },
  5: { emoji: "🤩", label: "Amazing", color: "#8B5CF6" },
};

export interface MoodEntry {
  id: string;
  date: string;    // "YYYY-MM-DD"
  mood: MoodLevel;
  note?: string;
  loggedAt: string;
}

// ─── Kid-to-Parent Request ────────────────────────────────────────────────────
export interface KidRequest {
  id: string;
  subject: string;
  body: string;
  emoji: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied";
  parentNote?: string;
  decidedAt?: string;
}

// ─── GPS / Phone Off Alerts ───────────────────────────────────────────────────
export type PhoneOffType = "phone_off" | "gps_off" | "app_closed";

export interface PhoneOffEvent {
  id: string;
  kidId: string;
  eventType: PhoneOffType;
  detectedAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
}

// ─── Medications ──────────────────────────────────────────────────────────────
export type MedForm = "pill" | "liquid" | "injection" | "patch" | "inhaler" | "drops" | "cream" | "other";
export type DoseUnit = "mg" | "ml" | "tablet" | "capsule" | "drop" | "puff" | "unit";

export interface DoseScheduleEntry {
  id: string;
  time: string;        // "HH:MM"
  days: number[];      // 0=Sun…6=Sat; empty array = every day
  alertKid: boolean;
  alertAllParents: boolean;
  enabled: boolean;
}

export interface MedicationEntry {
  id: string;
  kidId: string;
  name: string;
  form: MedForm;
  dosageAmount: string;
  unit: DoseUnit;
  prescribingDoctor: string;
  pharmacy: string;
  pharmacyPhone?: string;
  rxNumber?: string;
  startDate?: string;
  endDate?: string;
  currentCount?: number;
  refillAt?: number;
  nextRefillDate?: string;
  notes?: string;
  active: boolean;
  interactions: string[];      // names of meds that interact
  schedules: DoseScheduleEntry[];
  createdAt: string;
}

export type DoseStatus = "taken" | "skipped" | "missed" | "pending";

export interface DoseLog {
  id: string;
  medId: string;
  kidId: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: string;
  takenBy: string;
  status: DoseStatus;
  note?: string;
  measuredAmount?: string;
}

export interface MedHandoff {
  id: string;
  medId: string;
  medName: string;
  kidId: string;
  fromParentName: string;
  message: string;
  doseTime?: string;
  status: "pending" | "accepted" | "declined";
  responseNote?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface MedFriend {
  id: string;
  name: string;
  relation: string;
  phone?: string;
  email?: string;
  canViewSchedule: boolean;
  canLogDoses: boolean;
  alertOnMissed: boolean;
  linkedKidIds: string[];
  createdAt: string;
}

// ─── Root State ───────────────────────────────────────────────────────────────
export interface KidState {
  profile: KidProfile;
  rules: KidRules;
  /** Last time this kid's device checked in (ISO). Used for offline detection. */
  lastSeen?: string;
  usage: UsageDay[];
  bank: BankEntry[];
  timer: TimerSessionState;
  chores: Chore[];
  journal: JournalEntry[];
  drawings: Drawing[];
  todos: TodoItem[];
  stopMotionProjects: StopMotionProject[];
  books: BookEntry[];
  readingBooks: ReadingBook[];
  ideas: IdeaPaper[];
  album: AlbumItem[];
  vault: VaultEntry[];
  money: MoneyState;
  contacts: KidContact[];
  grades: ClassGrade[];
  assignments: Assignment[];
  schedule: ScheduleEvent[];
  alarms: Alarm[];
  behavior: BehaviorScoreState;
  incidents: SchoolIncident[];
  safeZones: SafeZone[];
  lastLocation?: LocationSnapshot;
  locationHistory: LocationSnapshot[]; // rolling history for parent reports
  coloringPages: ColoringPage[];
  buddyMessages: AgentMessage[];
  notifications: KidNotification[];
  wishes: WishItem[];
  siteRequests: SiteRequest[];
  videoMessages: VideoMessage[];
  favorites: FavoriteItem[];
  gadgets: GadgetItem[];
  achievements: Achievement[];
  discoveries: Discovery[];
  myStories: KidStory[];
  workoutPlans: WorkoutPlan[];
  workoutLogs: WorkoutLog[];
  mealPlans: MealPlan[];
  mealLogs: MealLog[];
  commGuard: CommGuardSettings;
  blockedLog: BlockedContactEntry[];
  appUnlockSessions: AppUnlockSession[];
  funnySounds: FunnySoundMessage[];
  streak: StreakState;
  rewardRedemptions: RewardRedemption[];
  callContacts: CallContact[];
  checkInRequests: CheckInRequest[];
  voiceNotes: VoiceNote[];
  voiceRecordings?: SavedVoiceRecording[];  // Voice Changer recordings saved for replay + sharing
  kidNotes: KidNote[];
  apologies: ApologyNote[];
  quizzes: ForcedQuiz[];
  ambientListenRequest?: AmbientListenRequest;
  ambientRecordings: AmbientRecording[];
  speedEvents: SpeedEvent[];
  phoneOffEvents: PhoneOffEvent[];
  // New features
  borrowRequests: BorrowRequest[];
  moodEntries: MoodEntry[];
  kidRequests: KidRequest[];
  allowanceSchedules: AllowanceSchedule[];
  pointPayouts: PointPayout[];
  paymentHandle?: KidPaymentHandle;
  paymentRequests: PaymentRequest[];
  morningCompletedItems: string[];  // item IDs checked today
  morningLastReset?: string;        // "YYYY-MM-DD" of last reset
  aiResults: AIResult[];
  // Install monitoring — snapshot of packages seen on the device + new-install alerts
  knownPackages: string[];          // every package ever seen on the device (baseline)
  installAlerts: InstallAlert[];    // apps detected since last seen, awaiting parent review
  deviceApps?: { packageName: string; appName: string }[];  // ALL apps on the kid's device (reported by the kid, shown in parent App Rules)
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface ImportantInfo {
  emergencyContacts: EmergencyContact[];
  healthInsurance: string;
  lifeInsurance: string;
  doctorName: string;
  doctorPhone: string;
  emergencyPlan: string;
  emergencyLocation: string;
  additionalNotes: string;
}

// ─── Document Vault ──────────────────────────────────────────────────────────
export interface DocumentPhoto {
  uri: string;
  side: "front" | "back";
}

export type InsuranceType = "life" | "health" | "dental" | "vision" | "car" | "home_renters" | "disability";

export interface InsuranceDocument {
  id: string;
  type: InsuranceType;
  provider: string;
  policyNumber: string;
  details: string;
  expiryDate?: string;
  photos: DocumentPhoto[];
  pinLocked: boolean;
  sharedWithCoParent: boolean;
}

export type IdentityDocType = "passport" | "drivers_license" | "birth_certificate" | "social_security" | "green_card_visa";

export interface IdentityDocument {
  id: string;
  type: IdentityDocType;
  holderName: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingCountry?: string;
  state?: string;
  photos: DocumentPhoto[];
  pinLocked: boolean;
  sharedWithCoParent: boolean;
  notes?: string;
}

export interface VaccinationRecord {
  id: string;
  vaccine: string;
  date: string;
  nextDueDate?: string;
  provider?: string;
}

export interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  doctor: string;
  pharmacy: string;
  refillDate?: string;
}

export interface MedicalDocuments {
  vaccinations: VaccinationRecord[];
  vaccineCardPhotoUri?: string;
  prescriptions: Prescription[];
  bloodType?: string;
  allergies: string;
  conditions: string;
  preferredHospital: string;
}

export type OtherDocType = "vehicle_title" | "property_deed" | "will_trust";

export interface OtherDocument {
  id: string;
  type: OtherDocType;
  title: string;
  details: string;
  photos: DocumentPhoto[];
  pinLocked: boolean;
  sharedWithCoParent: boolean;
  attorneyContact?: string;
  physicalLocation?: string;
}

export interface DocumentVault {
  insurance: InsuranceDocument[];
  identity: IdentityDocument[];
  medical: MedicalDocuments;
  other: OtherDocument[];
}

// ─── Family Tree ─────────────────────────────────────────────────────────────
export interface FamilyTreeMember {
  id: string;
  name: string;
  relation: string;       // e.g. "Dad", "Grandma Rose"
  generation: number;     // 0=self, 1=parents, 2=grandparents, 3=great-grandparents
  positionIndex: number;  // 0-based left-to-right within generation
  phone?: string;
  city?: string;
  state?: string;
  photoUri?: string;
  notes?: string;
  addedAt: string;
}

// ─── Co-Parenting ────────────────────────────────────────────────────────────
export type CoScheduleEventType = "pickup" | "dropoff" | "school_drop" | "quality_time" | "work" | "custom";

export interface CoParentScheduleEvent {
  id: string;
  type: CoScheduleEventType;
  customLabel?: string;
  date: string;
  time: string;
  endTime?: string;
  parentId: string;
  kidIds?: string[];
  recurring?: {
    days: number[];
    endDate?: string;
  };
  reminderMinutes?: number;
  remindOtherParent: boolean;
  status: "pending_agreement" | "agreed" | "cancelled";
  proposedBy: string;
  agreedByOther?: boolean;
  shareWithKids: boolean;
  notes?: string;
  createdAt: string;
}

export interface CannotPickupAlert {
  id: string;
  fromParentId: string;
  reason: string;
  status: "pending" | "accepted" | "denied";
  responseMessage?: string;
  respondedAt?: string;
  eventId?: string;
  createdAt: string;
}

export type SharedExpenseCategory = "school_supplies" | "clothing" | "electronics" | "groceries" | "medical" | "activities" | "other";

export interface SharedExpense {
  id: string;
  title: string;
  amount: number;
  category: SharedExpenseCategory;
  addedByParentId: string;
  receiptPhotoUri?: string;
  status: "pending" | "accepted" | "denied";
  responseMessage?: string;
  fulfilled: boolean;
  fulfilledAt?: string;
  date: string;
  notes?: string;
}

export interface AppState {
  kids: KidState[];
  parent: ParentProfile;
  parentSettings: ParentSettings;
  parentMembership?: ParentMembership;
  coParents: CoParent[];
  rewardShop: RewardShopItem[];
  sosAlerts: SosAlert[];
  socialAlerts: SocialAlert[];
  familyMessages: FamilyMessage[];
  sharedAlbum: AlbumItem[];
  memories: Memory[];
  stories: StoryItem[];
  storyMedia: StoryMedia[];
  voiceSamples: VoiceSample[];
  advice: LifeAdvice[];
  adviceCategories: AdviceCategory[];
  agentMessages: AgentMessage[];
  activeVideoRoom?: VideoRoom;
  permissions: PermissionLedger;
  familyFilter: FamilyFilterStatus;
  cloudBackup: CloudBackupConfig;
  importantInfo: ImportantInfo;
  wellBeingCategories: WellBeingCategory[];
  wellBeingEntries: WellBeingEntry[];
  familySocialPosts: FamilySocialPost[];
  // Per-viewer ("parent" | kidId) "last opened the Social feed" markers, used to
  // badge the Family Social button with unseen posts/likes/comments.
  socialSeenAt?: Record<string, string>;     // viewerId → ISO timestamp
  socialSeenLikes?: Record<string, number>;  // viewerId → like count on their posts at last open
  familyVoteTopics: FamilyVoteTopic[];
  locationReminders: LocationReminder[];
  speedAlertSettings: SpeedAlertSettings;
  setupDone: boolean;
  pinRecoveryCode?: string;
  incomingCalls: IncomingCall[];
  parentNotes: ParentNote[];
  parentTodos: TodoItem[];
  aiResults: AIResult[];
  familyCalendar: CalendarEvent[];
  coParentSchedule: CoParentScheduleEvent[];
  cannotPickupAlerts: CannotPickupAlert[];
  sharedExpenses: SharedExpense[];
  documentVault: DocumentVault;
  familyTree: FamilyTreeMember[];
  medications: MedicationEntry[];
  doseLogs: DoseLog[];
  medHandoffs: MedHandoff[];
  medFriends: MedFriend[];
  // Features 15-17
  familyAgreements: FamilyAgreement[];
  strangerAlerts: StrangerAlert[];
  badWordAlerts?: BadWordAlert[];
  tamperAlerts?: TamperAlert[];
  smartScreenTimeRules: SmartScreenTimeRule[];
  // Family Media
  familyMovies: FamilyMovie[];
  familyMusic: FamilyMusicTrack[];
  familyBooks: FamilyBook[];
  version: number;
  /** Whether this physical device is set up as a "parent" or "kid" device.
   *  Set once on first launch and never changed — the device is locked into
   *  one role. Null means the role chooser hasn't been shown yet. */
  deviceRole: "parent" | "kid" | null;

  /** Active cross-device (online) Game Night match. Synced to all family
   *  devices so two people on DIFFERENT phones can play the same board. */
  onlineGame?: OnlineGameSession | null;

  /** Pending Game Night invites. Each targets one family member (kid or parent)
   *  who gets a loud "join the game" alarm on their device until they join or
   *  dismiss. Synced so the alarm reaches the other phone. */
  gameInvites?: OnlineGameInvite[];
}

export interface OnlineGameInvite {
  id: string;
  toId: string;        // "parent" or a kid profile id — who should join
  toName: string;
  fromId: string;
  fromName: string;
  gameId: OnlineGameId;
  gameName: string;
  createdAt: string;
}

// ─── Online (cross-device) Game Night ────────────────────────────────────────
export type OnlineGameId = "ttt" | "connect4" | "hangman" | "memory" | "checkers" | "chess" | "trash" | "uno";

export interface OnlineGamePlayer {
  id: string;          // "parent" or a kid profile id
  name: string;
  seat: 0 | 1;         // seat 0 = host, seat 1 = guest
}

export interface OnlineGameSession {
  id: string;
  gameId: OnlineGameId;
  status: "waiting" | "playing" | "finished";
  hostId: string;
  players: OnlineGamePlayer[];     // 1 while waiting, 2 once joined
  board: any;                      // TTTBoard (9) | C4Board (6x7) — serialized
  turn: 0 | 1;                     // seat whose turn it is
  winner: 0 | 1 | "draw" | null;
  reward: number;                  // ⭐ for the winning kid
  createdAt: string;
  updatedAt: string;
}

// ─── Feature 15: Family Tech Agreement ───────────────────────────────────────
export type AgreementCategory = "screen_time" | "social_media" | "gaming" | "bedtime" | "homework" | "kindness" | "other";

export const AGREEMENT_CATEGORY_LABELS: Record<AgreementCategory, { emoji: string; label: string }> = {
  screen_time:  { emoji: "⏱️", label: "Screen Time" },
  social_media: { emoji: "📱", label: "Social Media" },
  gaming:       { emoji: "🎮", label: "Gaming" },
  bedtime:      { emoji: "🌙", label: "Bedtime" },
  homework:     { emoji: "📚", label: "Homework" },
  kindness:     { emoji: "💛", label: "Kindness Online" },
  other:        { emoji: "📋", label: "Other" },
};

export interface AgreementRule {
  id: string;
  category: AgreementCategory;
  text: string;
}

export interface FamilyAgreement {
  id: string;
  title: string;
  rules: AgreementRule[];
  createdAt: string;
  parentSigned: boolean;
  kidsSigned: string[];  // kid IDs who have "signed"
  pdfGeneratedAt?: string;
}

// ─── Feature 16: Stranger Alert ───────────────────────────────────────────────
export type StrangerContactType = "call" | "text";

export interface StrangerAlert {
  id: string;
  kidId: string;
  kidName: string;
  contactType: StrangerContactType;
  numberMasked: string;  // e.g. "***-***-4321" or "Unknown"
  detectedAt: string;
  acknowledged: boolean;
  note?: string;
}

/** Raised when a child turns OFF a protection permission on their device. */
export type TamperKind = "accessibility" | "overlay" | "usage" | "notif_access" | "battery";
export interface TamperAlert {
  id: string;
  kidId: string;
  kidName: string;
  kind: TamperKind;
  label: string;       // human label of what was disabled
  detectedAt: string;
  acknowledged: boolean;
}

/** A bad word detected in an incoming notification on the kid's device. */
export interface BadWordAlert {
  id: string;
  kidId: string;
  kidName: string;
  appPackage: string;
  appName: string;     // the app that sent the notification
  title: string;       // notification title
  text: string;        // notification body
  word: string;        // the matched bad word
  detectedAt: string;
  acknowledged: boolean;
}

// ─── Feature 17: Smart / Context-Aware Screen Time ────────────────────────────
export type SmartRuleTrigger =
  | "weekend"       // auto-extend on Sat/Sun
  | "holiday"       // auto-extend on holidays
  | "exam_week"     // reduce during exams
  | "after_9pm_schoolnight"  // lock non-edu after 9pm on school nights
  | "always";       // custom / always active

export interface SmartScreenTimeRule {
  id: string;
  kidId: string;
  label: string;
  trigger: SmartRuleTrigger;
  action: "extend" | "reduce" | "lock_non_edu";
  minutesDelta: number;  // positive = extend, negative = reduce (used for extend/reduce)
  enabled: boolean;
  createdAt: string;
}

// ─── Family Media: Movies, Music, Books ──────────────────────────────────────
export type MoviePlatform =
  | "youtube" | "netflix" | "disney_plus" | "prime" | "hbo"
  | "hulu" | "apple_tv" | "file" | "other";

export interface FamilyMovie {
  id: string;
  title: string;
  year?: string;
  description: string;   // why parent recommends it
  platform: MoviePlatform;
  url?: string;          // streaming link
  fileUri?: string;      // local video file
  rating?: string;       // G / PG / PG-13 / R …
  addedAt: string;
  addedByParentId: string;
}

export interface FamilyMusicTrack {
  id: string;
  title: string;
  artist?: string;
  fileUri?: string;      // local audio file
  fileType?: string;     // mp3 / m4a / wav …
  addedAt: string;
  addedByParentId: string;
}

export type BookFormat = "pdf" | "epub" | "url" | "other";

export interface FamilyBook {
  id: string;
  title: string;
  author?: string;
  fileUri?: string;      // local file
  fileType?: BookFormat;
  url?: string;          // online URL
  description?: string;
  addedAt: string;
  addedByParentId: string;
}

// ─── Action Types ────────────────────────────────────────────────────────────
export type AppAction =
  // Online Game Night (cross-device)
  | { type: "OGAME_CREATE"; session: OnlineGameSession }
  | { type: "OGAME_JOIN"; playerId: string; playerName: string }
  | { type: "OGAME_START" }
  | { type: "OGAME_MOVE"; seat: 0 | 1; move: any }   // move shape varies per game (see ogApply)
  | { type: "OGAME_RESET" }
  | { type: "OGAME_END" }
  | { type: "OGAME_INVITE"; invite: OnlineGameInvite }
  | { type: "OGAME_INVITE_CLEAR"; toId: string }
  // Setup
  | { type: "SETUP_COMPLETE" }
  | { type: "SET_DEVICE_ROLE"; role: "parent" | "kid" | null }
  | { type: "SET_PARENT_SETTINGS"; payload: Partial<ParentSettings> }
  | { type: "SET_PARENT_PROFILE"; payload: Partial<ParentProfile> }
  | { type: "SET_PARENT_MEMBERSHIP"; payload: ParentMembership }
  | { type: "SET_PARENT_APPLE"; userId: string; email?: string; fullName?: string }
  | { type: "CLEAR_PARENT_APPLE" }
  | { type: "SET_LAST_BACKUP"; timestamp: string }
  // Kids
  | { type: "ADD_KID"; payload: KidProfile }
  | { type: "RELINK_KID_ID"; oldId: string; newId: string }
  | { type: "UPDATE_KID"; kidId: string; payload: Partial<KidProfile> }
  | { type: "REMOVE_KID"; kidId: string }
  // Rules
  | { type: "UPDATE_RULES"; kidId: string; payload: Partial<KidRules> }
  | { type: "SET_APP_RULE"; kidId: string; rule: AppRule }
  | { type: "INSTALL_APP"; kidId: string; appId: string; appName?: string }
  | { type: "REMOVE_APP"; kidId: string; appId: string }
  | { type: "SYNC_INSTALLED_APPS"; kidId: string; apps: { packageName: string; appName: string }[] }
  | { type: "DISMISS_INSTALL_ALERT"; kidId: string; packageName: string }
  | { type: "SET_APP_SCHEDULE"; kidId: string; appId: string; schedule: AppSchedule }
  | { type: "REMOVE_APP_SCHEDULE"; kidId: string; appId: string; scheduleId: string }
  | { type: "SET_APP_SCHEDULE_ENABLED"; kidId: string; appId: string; enabled: boolean }
  | { type: "SET_INSTANT_LOCK"; kidId: string; locked: boolean; message?: string; until?: string; allowedApps?: string[]; allowedFeatures?: string[] }
  | { type: "SET_LOCK_SETTINGS"; kidId: string; on: boolean }
  | { type: "SET_DEAD_PHONE"; kidId: string; on: boolean }
  | { type: "SET_LOCKDOWN_TIMER"; kidId: string; timer: LockdownTimer | null }
  | { type: "SET_FUN_LOCK"; kidId: string; payload: Partial<FunLock> }
  | { type: "SET_FEATURE_LOCK"; kidId: string; featureId: string; locked: boolean }
  | { type: "LOCK_ALL_FEATURES"; kidId: string }
  | { type: "UNLOCK_ALL_FEATURES"; kidId: string }
  | { type: "SET_FREE_MODE"; kidId: string; enabled: boolean }
  // Funny sounds
  | { type: "ADD_FUNNY_SOUND"; kidId: string; msg: FunnySoundMessage }
  | { type: "MARK_FUNNY_SOUND_PLAYED"; kidId: string; msgId: string }
  | { type: "ADD_DOWNTIME"; kidId: string; window: DowntimeWindow }
  | { type: "UPDATE_DOWNTIME"; kidId: string; windowId: string; payload: Partial<DowntimeWindow> }
  | { type: "REMOVE_DOWNTIME"; kidId: string; windowId: string }
  | { type: "ADD_WEBSITE_RULE"; kidId: string; rule: WebsiteRule }
  | { type: "UPDATE_WEBSITE_RULE"; kidId: string; ruleId: string; payload: Partial<WebsiteRule> }
  | { type: "REMOVE_WEBSITE_RULE"; kidId: string; ruleId: string }
  // Usage
  | { type: "ADD_USAGE"; kidId: string; appId: string; appName: string; appEmoji?: string; minutes: number; sessions?: number }
  | { type: "ADD_VISIT"; kidId: string; url: string; title?: string; seconds: number }
  | { type: "TAP_FEATURE"; kidId: string; featureId: string; featureName: string; featureEmoji: string }
  | { type: "BANK_DELTA"; kidId: string; delta: number; reason: string }
  | { type: "SET_TIMER"; kidId: string; session: TimerSessionState }
  // Content
  | { type: "ADD_JOURNAL"; kidId: string; entry: JournalEntry }
  | { type: "EDIT_JOURNAL"; kidId: string; entry: JournalEntry }
  | { type: "REMOVE_JOURNAL"; kidId: string; entryId: string }
  | { type: "ADD_DRAWING"; kidId: string; drawing: Drawing }
  | { type: "UPDATE_DRAWING"; kidId: string; drawingId: string; payload: Partial<Drawing> }
  | { type: "REMOVE_DRAWING"; kidId: string; drawingId: string }
  | { type: "TOGGLE_TODO"; kidId: string; todoId: string }
  | { type: "ADD_TODO"; kidId: string; item: TodoItem }
  | { type: "REMOVE_TODO"; kidId: string; todoId: string }
  | { type: "ADD_STOP_MOTION"; kidId: string; project: StopMotionProject }
  | { type: "UPDATE_STOP_MOTION"; kidId: string; projectId: string; payload: Partial<StopMotionProject> }
  | { type: "REMOVE_STOP_MOTION"; kidId: string; projectId: string }
  | { type: "FLIPBOOK_SUBMIT"; kidId: string; projectId: string }
  | { type: "FLIPBOOK_APPROVE"; kidId: string; projectId: string; points: number }
  | { type: "ADD_BOOK"; kidId: string; book: BookEntry }
  | { type: "UPDATE_BOOK"; kidId: string; bookId: string; payload: Partial<BookEntry> }
  | { type: "READING_BOOK_ADD"; kidId: string; book: ReadingBook }
  | { type: "READING_BOOK_UPDATE"; kidId: string; bookId: string; payload: Partial<ReadingBook> }
  | { type: "READING_BOOK_REMOVE"; kidId: string; bookId: string }
  | { type: "ADD_IDEA"; kidId: string; idea: IdeaPaper }
  | { type: "UPDATE_IDEA"; kidId: string; ideaId: string; payload: Partial<IdeaPaper> }
  | { type: "DELETE_IDEA"; kidId: string; ideaId: string }
  // Kid Notes
  | { type: "KID_NOTE_ADD"; kidId: string; note: KidNote }
  | { type: "KID_NOTE_UPDATE"; kidId: string; noteId: string; payload: Partial<KidNote> }
  | { type: "KID_NOTE_DELETE"; kidId: string; noteId: string }
  // Parent Notes
  | { type: "PARENT_NOTE_ADD"; note: ParentNote }
  | { type: "PARENT_NOTE_UPDATE"; noteId: string; payload: Partial<ParentNote> }
  | { type: "PARENT_NOTE_DELETE"; noteId: string }
  // Parent To-Do
  | { type: "PARENT_TODO_ADD"; item: TodoItem }
  | { type: "PARENT_TODO_TOGGLE"; todoId: string }
  | { type: "PARENT_TODO_UPDATE"; todoId: string; payload: Partial<TodoItem> }
  | { type: "PARENT_TODO_DELETE"; todoId: string }
  // AI Results (parent)
  | { type: "AI_RESULT_ADD"; result: AIResult }
  | { type: "AI_RESULT_DELETE"; resultId: string }
  | { type: "AI_RESULT_UPDATE"; resultId: string; payload: Partial<AIResult> }
  // AI Results (kid)
  | { type: "KID_AI_RESULT_ADD"; kidId: string; result: AIResult }
  | { type: "KID_AI_RESULT_DELETE"; kidId: string; resultId: string }
  | { type: "KID_AI_RESULT_UPDATE"; kidId: string; resultId: string; payload: Partial<AIResult> }
  // Chores
  | { type: "ADD_CHORE"; chore: Chore }
  | { type: "UPDATE_CHORE"; choreId: string; payload: Partial<Chore> }
  | { type: "REMOVE_CHORE"; choreId: string }
  | { type: "CHORE_SUBMIT_PROOF"; choreId: string; proof: ChoreProof }
  | { type: "CHORE_APPROVE"; choreId: string; approval: ChoreApproval }
  | { type: "CHORE_APPLY_PENALTY"; choreId: string; kidId: string; date: string; penaltyPoints: number }
  // Family
  | { type: "FAMILY_CHAT_PUSH"; message: FamilyMessage }
  | { type: "FAMILY_CHAT_MARK_READ"; viewerId: string }
  | { type: "ALBUM_ADD"; item: AlbumItem }
  | { type: "ALBUM_ADD_KID"; kidId: string; item: AlbumItem }
  | { type: "MEMORY_ADD"; memory: Memory }
  | { type: "MEMORY_UPDATE"; memoryId: string; payload: Partial<Memory> }
  | { type: "MEMORY_REMOVE"; memoryId: string }
  // Vault & Contacts
  | { type: "VAULT_ADD"; kidId: string; entry: VaultEntry }
  | { type: "VAULT_REMOVE"; kidId: string; entryId: string }
  | { type: "CONTACT_ADD"; kidId: string; contact: KidContact }
  | { type: "CONTACT_REMOVE"; kidId: string; contactId: string }
  // Money
  | { type: "MONEY_TRANSACT"; kidId: string; tx: MoneyTransaction }
  | { type: "MONEY_ADD_GOAL"; kidId: string; goal: SavingsGoal }
  | { type: "MONEY_UPDATE_GOAL"; kidId: string; goalId: string; payload: Partial<SavingsGoal> }
  | { type: "MONEY_REMOVE_GOAL"; kidId: string; goalId: string }
  | { type: "MONEY_ADD_DEBT"; kidId: string; debt: MoneyDebt }
  | { type: "MONEY_PAY_DEBT"; kidId: string; debtId: string }
  | { type: "MONEY_ADD_SCHEDULE"; kidId: string; schedule: EarnScheduleEntry }
  | { type: "MONEY_UPDATE_SCHEDULE"; kidId: string; scheduleId: string; payload: Partial<EarnScheduleEntry> }
  | { type: "MONEY_REMOVE_SCHEDULE"; kidId: string; scheduleId: string }
  | { type: "MONEY_APPLY_AUTO_EARN"; kidId: string; scheduleId: string; date: string; tx: MoneyTransaction }
  // School
  | { type: "GRADE_ADD"; kidId: string; grade: ClassGrade }
  | { type: "GRADE_UPDATE"; kidId: string; gradeId: string; payload: Partial<ClassGrade> }
  | { type: "GRADE_REMOVE"; kidId: string; gradeId: string }
  | { type: "ASSIGNMENT_ADD"; kidId: string; assignment: Assignment }
  | { type: "ASSIGNMENT_UPDATE"; kidId: string; assignmentId: string; payload: Partial<Assignment> }
  | { type: "ASSIGNMENT_REMOVE"; kidId: string; assignmentId: string }
  | { type: "SCHEDULE_ADD"; kidId: string; event: ScheduleEvent }
  | { type: "SCHEDULE_REMOVE"; kidId: string; eventId: string }
  | { type: "ALARM_ADD"; kidId: string; alarm: Alarm }
  | { type: "ALARM_TOGGLE"; kidId: string; alarmId: string }
  | { type: "ALARM_REMOVE"; kidId: string; alarmId: string }
  | { type: "BEHAVIOR_ADD_EVENT"; kidId: string; event: BehaviorEvent }
  | { type: "INCIDENT_ADD"; kidId: string; incident: SchoolIncident }
  // Location
  | { type: "SAFE_ZONE_ADD"; kidId: string; zone: SafeZone }
  | { type: "SAFE_ZONE_REMOVE"; kidId: string; zoneId: string }
  | { type: "LOCATION_UPDATE"; kidId: string; location: LocationSnapshot }
  | { type: "LOCATION_HISTORY_CLEAR"; kidId: string }
  // Media
  | { type: "COLORING_ADD"; kidId: string; page: ColoringPage }
  | { type: "COLORING_UPDATE"; kidId: string; pageId: string; payload: Partial<ColoringPage> }
  | { type: "VIDEO_MESSAGE_ADD"; kidId: string; message: VideoMessage }
  | { type: "VIDEO_MESSAGE_READ"; kidId: string; messageId: string }
  | { type: "VIDEO_MESSAGE_DELETE"; kidId: string; messageId: string }
  // AI & Communication
  | { type: "BUDDY_MESSAGE_ADD"; kidId: string; message: AgentMessage }
  | { type: "BUDDY_MESSAGES_CLEAR"; kidId: string }
  | { type: "AGENT_MESSAGE_ADD"; message: AgentMessage }
  | { type: "AGENT_MESSAGES_CLEAR" }
  | { type: "NOTIFICATION_ADD"; kidId: string; notification: KidNotification }
  | { type: "NOTIFICATION_READ"; kidId: string; notifId: string }
  | { type: "NOTIFICATIONS_MARK_FEATURE_READ"; kidId: string; feature: string }
  | { type: "NOTIFICATION_ACKNOWLEDGE"; kidId: string; notifId: string }
  | { type: "NOTIFICATION_DELETE"; kidId: string; notifId: string }
  | { type: "NOTIFICATION_CLEAR_ALL"; kidId: string }
  | { type: "FAVORITE_ADD"; kidId: string; item: FavoriteItem }
  | { type: "FAVORITE_UPDATE"; kidId: string; itemId: string; payload: Partial<FavoriteItem> }
  | { type: "FAVORITE_REMOVE"; kidId: string; itemId: string }
  | { type: "WISH_ADD"; kidId: string; wish: WishItem }
  | { type: "WISH_REMOVE"; kidId: string; wishId: string }
  | { type: "WISH_DECIDE"; kidId: string; wishId: string; decision: "approved" | "denied"; comment?: string }
  | { type: "GADGET_ADD"; kidId: string; item: GadgetItem }
  | { type: "GADGET_REMOVE"; kidId: string; itemId: string }
  | { type: "ACHIEVEMENT_ADD"; kidId: string; achievement: Achievement }
  | { type: "ACHIEVEMENT_REMOVE"; kidId: string; achievementId: string }
  | { type: "ACHIEVEMENT_AWARD_POINTS"; kidId: string; achievementId: string; points: number; comment?: string }
  | { type: "DISCOVERY_ADD"; kidId: string; discovery: Discovery }
  | { type: "DISCOVERY_REMOVE"; kidId: string; discoveryId: string }
  | { type: "KID_STORY_ADD"; kidId: string; story: KidStory }
  | { type: "KID_STORY_REMOVE"; kidId: string; storyId: string }
  // Fitness
  | { type: "WORKOUT_PLAN_ADD"; kidId: string; plan: WorkoutPlan }
  | { type: "WORKOUT_PLAN_REMOVE"; kidId: string; planId: string }
  | { type: "WORKOUT_LOG_SUBMIT"; kidId: string; log: WorkoutLog }
  | { type: "WORKOUT_LOG_APPROVE"; kidId: string; logId: string; points: number; comment?: string }
  | { type: "MEAL_PLAN_ADD"; kidId: string; plan: MealPlan }
  | { type: "MEAL_PLAN_REMOVE"; kidId: string; planId: string }
  | { type: "MEAL_PLAN_SET_ACTIVE"; kidId: string; planId: string }
  | { type: "MEAL_LOG_ADD"; kidId: string; log: MealLog }
  | { type: "MEAL_LOG_REMOVE"; kidId: string; logId: string }
  | { type: "IMPORTANT_INFO_UPDATE"; payload: Partial<ImportantInfo> }
  | { type: "SITE_REQUEST_ADD"; kidId: string; request: SiteRequest }
  | { type: "SITE_REQUEST_DECIDE"; kidId: string; requestId: string; approved: boolean }
  // Stories & Advice
  | { type: "STORY_ADD"; story: StoryItem }
  | { type: "STORY_DELETE"; storyId: string }
  | { type: "STORY_READ"; storyId: string; kidId: string }
  | { type: "STORY_MEDIA_ADD"; media: StoryMedia }
  | { type: "STORY_MEDIA_REMOVE"; mediaId: string }
  | { type: "VOICE_SAMPLE_ADD"; sample: VoiceSample }
  | { type: "VOICE_SAMPLE_DELETE"; sampleId: string }
  | { type: "ADVICE_ADD"; advice: LifeAdvice }
  | { type: "ADVICE_READ"; adviceId: string; kidId: string }
  | { type: "ADVICE_REMOVE"; adviceId: string }
  | { type: "ADVICE_CATEGORY_ADD"; category: AdviceCategory }
  | { type: "ADVICE_CATEGORY_REMOVE"; categoryId: string }
  // Permissions & Cloud
  | { type: "PERMISSION_SET"; payload: Partial<PermissionStatus> }
  | { type: "PERMISSION_ONBOARDING_DONE" }
  | { type: "CLOUD_BACKUP_UPDATE"; payload: Partial<CloudBackupConfig> }
  | { type: "FAMILY_FILTER_UPDATE"; payload: Partial<FamilyFilterStatus> }
  | { type: "VIDEO_ROOM_SET"; room?: VideoRoom }
  | { type: "SET_BEDTIME_SOFT_LOCK"; kidId: string; payload: Partial<BedtimeSoftLock> }
  // Call & Text Guard
  | { type: "COMM_GUARD_UPDATE"; kidId: string; payload: Partial<CommGuardSettings> }
  | { type: "COMM_WHITELIST_ADD"; kidId: string; number: string }
  | { type: "COMM_WHITELIST_REMOVE"; kidId: string; number: string }
  | { type: "BLOCKED_LOG_ADD"; kidId: string; entry: BlockedContactEntry }
  | { type: "BLOCKED_LOG_CLEAR"; kidId: string }
  | { type: "COMM_EMERGENCY_ACTIVATE"; kidId: string; expiresAt: string }
  | { type: "COMM_EMERGENCY_DEACTIVATE"; kidId: string }
  // App reward rules (parent manages)
  | { type: "APP_REWARD_RULE_ADD"; kidId: string; rule: AppRewardRule }
  | { type: "APP_REWARD_RULE_UPDATE"; kidId: string; ruleId: string; payload: Partial<AppRewardRule> }
  | { type: "APP_REWARD_RULE_REMOVE"; kidId: string; ruleId: string }
  // App unlock sessions (kid spends points)
  | { type: "APP_UNLOCK_START"; kidId: string; session: AppUnlockSession }
  | { type: "APP_UNLOCK_TICK"; kidId: string; sessionId: string; secondsDelta: number }
  | { type: "APP_UNLOCK_END"; kidId: string; sessionId: string }
  // Study mode
  | { type: "SET_STUDY_MODE"; kidId: string; enabled: boolean }
  | { type: "SET_STUDY_MODE_SCHEDULE"; kidId: string; start: string; end: string; days: number[] }
  | { type: "SET_BLOCKED_PACKAGES"; kidId: string; packages: string[] }
  | { type: "SET_STUDY_MODE_BREAK"; kidId: string; until: string | undefined }
  // School-time contact bypass
  | { type: "SCHOOL_TIME_CONTACT_ADD"; kidId: string; contact: string }
  | { type: "SCHOOL_TIME_CONTACT_REMOVE"; kidId: string; contact: string }
  | { type: "SET_STUDY_BLOCKED_PACKAGES"; kidId: string; packages: string[] }
  // Streaks
  | { type: "STREAK_TICK"; kidId: string; date: string }
  // Reward shop
  | { type: "REWARD_SHOP_ADD"; item: RewardShopItem }
  | { type: "REWARD_SHOP_UPDATE"; itemId: string; payload: Partial<RewardShopItem> }
  | { type: "REWARD_SHOP_REMOVE"; itemId: string }
  | { type: "REWARD_REDEEM"; kidId: string; redemption: RewardRedemption }
  | { type: "REWARD_DECIDE"; kidId: string; redemptionId: string; status: "fulfilled" | "denied"; note?: string }
  // Co-parents
  | { type: "CO_PARENT_ADD"; coParent: CoParent }
  | { type: "CO_PARENT_UPDATE"; id: string; payload: Partial<CoParent> }
  | { type: "CO_PARENT_REMOVE"; id: string }
  // Call contacts & incoming calls
  | { type: "SET_CALL_CONTACTS"; kidId: string; contacts: CallContact[] }
  | { type: "CALL_REQUEST"; call: IncomingCall }
  | { type: "CALL_RESPOND"; callId: string; status: IncomingCall["status"] }
  // SOS
  | { type: "SOS_ALERT"; alert: SosAlert }
  | { type: "SOS_ACK"; alertId: string }
  // Check-in requests
  | { type: "CHECK_IN_REQUEST"; kidId: string; request: CheckInRequest }
  | { type: "CHECK_IN_RESPOND"; kidId: string; requestId: string; status: "safe" | "help_needed"; lat?: number; lng?: number }
  // Age presets
  | { type: "APPLY_AGE_PRESET"; kidId: string; preset: AgePreset }
  // PIN recovery
  | { type: "SET_PIN_RECOVERY_CODE"; code: string }
  // Voice notes (parent → kid)
  | { type: "VOICE_NOTE_ADD"; kidId: string; note: VoiceNote }
  | { type: "VOICE_NOTE_DELETE"; kidId: string; noteId: string }
  | { type: "VOICE_NOTE_LISTENED"; kidId: string; noteId: string }
  // Voice Changer saved recordings (kid)
  | { type: "VOICE_RECORDING_ADD"; kidId: string; recording: SavedVoiceRecording }
  | { type: "VOICE_RECORDING_DELETE"; kidId: string; recordingId: string }
  // Apology / Explain Yourself
  | { type: "APOLOGY_SEND"; kidId: string; note: ApologyNote }
  | { type: "APOLOGY_READ"; kidId: string; apologyId: string }
  | { type: "APOLOGY_DELETE"; kidId: string; apologyId: string }
  // Forced Quiz
  | { type: "QUIZ_SEND"; quiz: ForcedQuiz }
  | { type: "QUIZ_UPDATE"; kidId: string; quizId: string; patch: Partial<ForcedQuiz> }
  | { type: "QUIZ_DELETE"; kidId: string; quizId: string }
  // Emotional Well-Being
  | { type: "WELLBEING_CATEGORY_ADD"; category: WellBeingCategory }
  | { type: "WELLBEING_CATEGORY_UPDATE"; categoryId: string; payload: Partial<WellBeingCategory> }
  | { type: "WELLBEING_CATEGORY_DELETE"; categoryId: string }
  | { type: "WELLBEING_ENTRY_ADD"; entry: WellBeingEntry }
  | { type: "WELLBEING_ENTRY_UPDATE"; entryId: string; payload: Partial<WellBeingEntry> }
  | { type: "WELLBEING_ENTRY_DELETE"; entryId: string }
  // Ambient Listen (Listen to Surroundings)
  | { type: "AMBIENT_LISTEN_REQUEST"; kidId: string; request: AmbientListenRequest }
  | { type: "AMBIENT_LISTEN_CLEAR"; kidId: string }
  | { type: "AMBIENT_RECORDING_ADD"; kidId: string; recording: AmbientRecording }
  | { type: "AMBIENT_RECORDING_LISTEN"; kidId: string; recordingId: string }
  // Family Vote / Discussion
  | { type: "VOTE_TOPIC_ADD"; topic: FamilyVoteTopic }
  | { type: "VOTE_TOPIC_UPDATE"; topicId: string; payload: Partial<FamilyVoteTopic> }
  | { type: "VOTE_TOPIC_DELETE"; topicId: string }
  | { type: "VOTE_CAST"; topicId: string; optionId: string; voterId: string }
  | { type: "VOTE_RETRACT"; topicId: string; optionId: string; voterId: string }
  | { type: "VOTE_ADD_OPTION"; topicId: string; option: VoteOption }
  | { type: "VOTE_REMOVE_OPTION"; topicId: string; optionId: string }
  | { type: "VOTE_ADD_LINK"; topicId: string; link: FamilyDiscussionLink }
  | { type: "VOTE_REMOVE_LINK"; topicId: string; linkId: string }
  | { type: "VOTE_ADD_COMMENT"; topicId: string; comment: FamilyVoteComment }
  | { type: "VOTE_CLOSE"; topicId: string }
  // Location Reminders
  | { type: "LOCATION_REMINDER_ADD"; reminder: LocationReminder }
  | { type: "LOCATION_REMINDER_UPDATE"; reminderId: string; payload: Partial<LocationReminder> }
  | { type: "LOCATION_REMINDER_DELETE"; reminderId: string }
  | { type: "LOCATION_REMINDER_TRIGGER"; reminderId: string }
  // Speed Alerts
  | { type: "SPEED_ALERT_SETTINGS_UPDATE"; payload: Partial<SpeedAlertSettings> }
  | { type: "SPEED_EVENT_ADD"; event: SpeedEvent }
  | { type: "SPEED_EVENT_ACK"; kidId: string; eventId: string }
  | { type: "SPEED_EVENTS_CLEAR"; kidId: string }
  // Phone / GPS Off events
  | { type: "PHONE_OFF_EVENT_ADD"; event: PhoneOffEvent }
  | { type: "PHONE_OFF_EVENT_RESOLVE"; kidId: string; eventId: string }
  | { type: "PHONE_OFF_EVENT_ACK"; kidId: string; eventId: string }
  | { type: "PHONE_OFF_EVENTS_CLEAR"; kidId: string }
  // Family Social
  | { type: "SOCIAL_POST_ADD"; post: FamilySocialPost }
  | { type: "SOCIAL_POST_DELETE"; postId: string }
  | { type: "SOCIAL_POST_LIKE"; postId: string; authorId: string }
  | { type: "SOCIAL_POST_UNLIKE"; postId: string; authorId: string }
  | { type: "SOCIAL_COMMENT_ADD"; postId: string; comment: FamilySocialComment }
  | { type: "SOCIAL_COMMENT_DELETE"; postId: string; commentId: string }
  | { type: "SOCIAL_POST_VIEW"; postId: string; viewerId: string }
  | { type: "SOCIAL_MARK_SEEN"; viewerId: string }
  | { type: "SOCIAL_POST_PIN"; postId: string; pinned: boolean }
  // Morning Routine
  | { type: "MORNING_ROUTINE_UPDATE"; kidId: string; routine: Partial<MorningRoutine> }
  | { type: "MORNING_ITEM_TOGGLE"; kidId: string; itemId: string }
  | { type: "MORNING_RESET"; kidId: string }
  // Screen Time Borrowing
  | { type: "BORROW_REQUEST"; kidId: string; request: BorrowRequest }
  | { type: "BORROW_DECIDE"; kidId: string; requestId: string; status: "approved" | "denied"; parentNote?: string }
  // Family Calendar
  | { type: "CALENDAR_ADD"; event: CalendarEvent }
  | { type: "CALENDAR_UPDATE"; eventId: string; payload: Partial<CalendarEvent> }
  | { type: "CALENDAR_DELETE"; eventId: string }
  // Allowance Automation
  | { type: "ALLOWANCE_SCHEDULE_ADD"; kidId: string; schedule: AllowanceSchedule }
  | { type: "ALLOWANCE_SCHEDULE_UPDATE"; kidId: string; scheduleId: string; payload: Partial<AllowanceSchedule> }
  | { type: "ALLOWANCE_SCHEDULE_DELETE"; kidId: string; scheduleId: string }
  | { type: "ALLOWANCE_PAY"; kidId: string; scheduleId: string; amount: number; label: string }
  | { type: "POINT_PAYOUT"; kidId: string; payout: PointPayout }
  | { type: "SET_KID_PAYMENT_HANDLE"; kidId: string; handle: KidPaymentHandle }
  | { type: "PAYMENT_REQUEST_ADD"; kidId: string; request: PaymentRequest }
  | { type: "PAYMENT_REQUEST_UPDATE"; kidId: string; requestId: string; payload: Partial<PaymentRequest> }
  // Mood Check-in
  | { type: "MOOD_LOG"; kidId: string; entry: MoodEntry }
  | { type: "MOOD_DELETE"; kidId: string; entryId: string }
  // Kid-to-Parent Requests
  | { type: "KID_REQUEST_SEND"; kidId: string; request: KidRequest }
  | { type: "KID_REQUEST_DECIDE"; kidId: string; requestId: string; status: "approved" | "denied"; parentNote?: string }
  | { type: "KID_REQUEST_DELETE"; kidId: string; requestId: string }
  // Teen Mode
  | { type: "SET_TEEN_MODE"; kidId: string; enabled: boolean }
  // Story character
  | { type: "SET_STORY_CHARACTER"; kidId: string; character: string }
  // Digest email
  | { type: "SET_DIGEST_SETTINGS"; email: string; enabled: boolean }
  | { type: "DIGEST_SENT"; timestamp: string }
  // Co-parenting schedule
  | { type: "CO_SCHEDULE_ADD"; event: CoParentScheduleEvent }
  | { type: "CO_SCHEDULE_UPDATE"; eventId: string; payload: Partial<CoParentScheduleEvent> }
  | { type: "CO_SCHEDULE_DELETE"; eventId: string }
  // Cannot pickup alerts
  | { type: "CANNOT_PICKUP_ADD"; alert: CannotPickupAlert }
  | { type: "CANNOT_PICKUP_UPDATE"; alertId: string; payload: Partial<CannotPickupAlert> }
  | { type: "CANNOT_PICKUP_DELETE"; alertId: string }
  // Shared expenses
  | { type: "SHARED_EXPENSE_ADD"; expense: SharedExpense }
  | { type: "SHARED_EXPENSE_UPDATE"; expenseId: string; payload: Partial<SharedExpense> }
  | { type: "SHARED_EXPENSE_DELETE"; expenseId: string }
  // Document vault — insurance
  | { type: "VAULT_INSURANCE_ADD"; doc: InsuranceDocument }
  | { type: "VAULT_INSURANCE_UPDATE"; docId: string; payload: Partial<InsuranceDocument> }
  | { type: "VAULT_INSURANCE_DELETE"; docId: string }
  // Document vault — identity
  | { type: "VAULT_IDENTITY_ADD"; doc: IdentityDocument }
  | { type: "VAULT_IDENTITY_UPDATE"; docId: string; payload: Partial<IdentityDocument> }
  | { type: "VAULT_IDENTITY_DELETE"; docId: string }
  // Document vault — medical
  | { type: "VAULT_MEDICAL_UPDATE"; payload: Partial<MedicalDocuments> }
  | { type: "VAULT_VACCINATION_ADD"; record: VaccinationRecord }
  | { type: "VAULT_VACCINATION_DELETE"; recordId: string }
  | { type: "VAULT_PRESCRIPTION_ADD"; rx: Prescription }
  | { type: "VAULT_PRESCRIPTION_UPDATE"; rxId: string; payload: Partial<Prescription> }
  | { type: "VAULT_PRESCRIPTION_DELETE"; rxId: string }
  // Document vault — other documents
  | { type: "VAULT_OTHER_ADD"; doc: OtherDocument }
  | { type: "VAULT_OTHER_UPDATE"; docId: string; payload: Partial<OtherDocument> }
  | { type: "VAULT_OTHER_DELETE"; docId: string }
  // Medications
  | { type: "MED_ADD"; med: MedicationEntry }
  | { type: "MED_UPDATE"; medId: string; payload: Partial<MedicationEntry> }
  | { type: "MED_DELETE"; medId: string }
  | { type: "DOSE_LOG_ADD"; log: DoseLog }
  | { type: "DOSE_LOG_UPDATE"; logId: string; payload: Partial<DoseLog> }
  | { type: "MED_HANDOFF_ADD"; handoff: MedHandoff }
  | { type: "MED_HANDOFF_UPDATE"; handoffId: string; payload: Partial<MedHandoff> }
  | { type: "MED_HANDOFF_DELETE"; handoffId: string }
  | { type: "MED_FRIEND_ADD"; friend: MedFriend }
  | { type: "MED_FRIEND_UPDATE"; friendId: string; payload: Partial<MedFriend> }
  | { type: "MED_FRIEND_DELETE"; friendId: string }
  // Family Tree
  | { type: "FAMILY_TREE_ADD"; member: FamilyTreeMember }
  | { type: "FAMILY_TREE_UPDATE"; memberId: string; payload: Partial<FamilyTreeMember> }
  | { type: "FAMILY_TREE_DELETE"; memberId: string }
  // Monetisation
  | { type: "AD_DISCLOSURE_SEEN" }
  | { type: "SET_AD_FREE"; purchasedAt: string }
  | { type: "CLEAR_AD_FREE" }
  // Social monitoring alerts
  | { type: "SOCIAL_ALERT_ADD"; alert: SocialAlert }
  | { type: "SOCIAL_ALERT_ACK"; alertId: string }
  | { type: "SOCIAL_ALERT_CLEAR_ALL" }
  // Web / DNS filter
  | { type: "WEB_FILTER_UPDATE"; kidId: string; payload: Partial<WebFilterConfig> }
  // Screen-time earned (chore bonus override)
  | { type: "SCREEN_TIME_GRANT"; kidId: string; minutes: number; reason: string }
  // Pause all devices
  | { type: "PAUSE_ALL_DEVICES"; locked: boolean; message?: string }
  // Account deletion
  | { type: "RESET_APP" }
  // Feature 15: Family Tech Agreements
  | { type: "AGREEMENT_ADD"; agreement: FamilyAgreement }
  | { type: "AGREEMENT_UPDATE"; agreementId: string; payload: Partial<FamilyAgreement> }
  | { type: "AGREEMENT_DELETE"; agreementId: string }
  | { type: "AGREEMENT_KID_SIGN"; agreementId: string; kidId: string }
  // Feature 16: Stranger Alerts
  | { type: "STRANGER_ALERT_ADD"; alert: StrangerAlert }
  | { type: "STRANGER_ALERT_ACK"; alertId: string }
  | { type: "BADWORD_ALERT_ADD"; alert: BadWordAlert }
  | { type: "BADWORD_ALERT_ACK"; alertId: string }
  | { type: "TAMPER_ALERT_ADD"; alert: TamperAlert }
  | { type: "TAMPER_ALERT_ACK"; alertId: string }
  | { type: "DEVICE_HEARTBEAT"; kidId: string; at: string }
  | { type: "STRANGER_ALERT_CLEAR_ALL" }
  // Feature 17: Smart Screen Time Rules
  | { type: "SMART_RULE_ADD"; rule: SmartScreenTimeRule }
  | { type: "SMART_RULE_UPDATE"; ruleId: string; payload: Partial<SmartScreenTimeRule> }
  | { type: "SMART_RULE_DELETE"; ruleId: string }
  // Family Media
  | { type: "FAMILY_MOVIE_ADD"; movie: FamilyMovie }
  | { type: "FAMILY_MOVIE_DELETE"; movieId: string }
  | { type: "FAMILY_MUSIC_ADD"; track: FamilyMusicTrack }
  | { type: "FAMILY_MUSIC_DELETE"; trackId: string }
  | { type: "FAMILY_BOOK_ADD"; book: FamilyBook }
  | { type: "FAMILY_BOOK_DELETE"; bookId: string }
  // Find Phone
  | { type: "FIND_PHONE_TRIGGER_PARENT"; kidId: string; kidName: string }
  | { type: "FIND_PHONE_DISMISS_PARENT" };
