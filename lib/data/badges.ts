/**
 * Unread/activity badge counts for the home-screen feature buttons.
 *
 * Everything is derived from shared state so both devices show the right counts
 * without extra plumbing. "viewer" is the id that identifies this device's user:
 *   - parent: "parent" for the Social feed, "__parent__" for family chat
 *   - kid:    the kid's profile id for both
 */
import type { AppState, KidNotification } from "./types";

/** Unseen Family Social activity for a viewer: new posts by others + new
 *  likes/comments on the viewer's own posts since they last opened the feed. */
export function socialBadgeCount(state: AppState, viewerId: string): number {
  const posts = state.familySocialPosts ?? [];
  const seenAt = state.socialSeenAt?.[viewerId] ?? "1970-01-01T00:00:00.000Z";
  const seenLikes = state.socialSeenLikes?.[viewerId] ?? 0;

  let count = 0;
  let myLikeTotal = 0;
  for (const p of posts) {
    if (p.authorId !== viewerId) {
      if (!p.viewedBy.includes(viewerId)) count++;            // new post from someone else
    } else {
      myLikeTotal += p.likes.filter(a => a !== viewerId).length;
      count += p.comments.filter(c => c.authorId !== viewerId && c.createdAt > seenAt).length;
    }
  }
  count += Math.max(0, myLikeTotal - seenLikes);              // new likes on my posts
  return count;
}

/** Unread family chat messages for a viewer. */
export function chatUnreadCount(state: AppState, viewerId: string): number {
  return (state.familyMessages ?? []).filter(
    m => m.authorId !== viewerId && !m.readBy.includes(viewerId)
  ).length;
}

/** Map a kid notification to the home feature it belongs to, so unread
 *  notifications can badge the matching button. */
export function notificationFeature(n: KidNotification): string | null {
  switch (n.kind) {
    case "chore_approved":
    case "chore_rejected":      return "chores";
    case "story":               return "stories";
    case "advice":              return "advice";
    case "wish_decision":       return "wishes";
    case "achievement_awarded": return "achievements";
    case "workout_approved":    return "fitness";
    case "ping":                return "communicate";
    default:                    return null;
  }
}

/** Per-feature unread counts from a kid's unread notifications. */
export function kidNotificationBadges(notifications: KidNotification[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of notifications) {
    if (n.read) continue;
    const f = notificationFeature(n);
    if (!f) continue;
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}
