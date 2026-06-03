/**
 * Lock allowlist — the in-app features a parent can leave OPEN while the device
 * is otherwise locked ("locked, but you can still draw"). Shared by the parent
 * lock config, the kid lock screen (buttons), and the lock enforcer (which
 * routes the child back to /lock unless they're on an allowed feature).
 */
export interface LockFeature {
  key: string;
  emoji: string;
  label: string;
  /** Substring used to recognise this feature in the current pathname. */
  seg: string;
  /** Build the navigation target. */
  route: (kidId: string, kidName?: string) => string;
}

export const LOCK_FEATURES: LockFeature[] = [
  { key: "create",      emoji: "🎨", label: "Drawing & Create", seg: "/create",      route: (id) => `/kid/${id}/create` },
  { key: "coloring",    emoji: "🖍️", label: "Coloring",         seg: "/coloring",    route: (id) => `/kid/${id}/(more)/coloring` },
  { key: "callchat",    emoji: "📞", label: "Call & Chat",      seg: "/callchat",    route: (id) => `/kid/${id}/callchat` },
  { key: "buddy",       emoji: "🤖", label: "Homework Helper",  seg: "/buddy",       route: (id) => `/kid/${id}/(more)/buddy` },
  { key: "agent",       emoji: "✨", label: "AI Buddy",         seg: "/agent",       route: (id) => `/kid/${id}/agent` },
  { key: "books",       emoji: "📚", label: "Reading",          seg: "/books",       route: (id) => `/kid/${id}/(more)/books` },
  { key: "stories",     emoji: "📖", label: "Stories",          seg: "/stories",     route: (id) => `/kid/${id}/(more)/stories` },
  { key: "online-game", emoji: "🎮", label: "Games",            seg: "/online-game", route: (id, name) => `/online-game?me=${encodeURIComponent(id)}&name=${encodeURIComponent(name ?? "Me")}` },
];

export function lockFeature(key: string): LockFeature | undefined {
  return LOCK_FEATURES.find(f => f.key === key);
}

/** True if `pathname` is the lock screen itself or one of the allowed features. */
export function isAllowedLockRoute(pathname: string, allowedKeys: string[] | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/lock")) return true;
  if (!allowedKeys || allowedKeys.length === 0) return false;
  return LOCK_FEATURES.some(f => allowedKeys.includes(f.key) && pathname.includes(f.seg));
}
