export const permissions = [
  "event.manage",
  "event.settings.manage",
  "users.read",
  "users.manage",
  "teams.read",
  "teams.manage",
  "teams.bulk_transition",
  "rounds.manage",
  "submissions.read",
  "submissions.evaluate",
  "judging.score",
  "reviews.score",
  "interviews.manage",
  "interviews.reschedule.approve",
  "forms.manage",
  "forms.responses.read",
  "operations.food.manage",
  "operations.transport.manage",
  "operations.accommodation.manage",
  "venue.manage",
  "passes.scan",
  "coupons.scan",
  "exports.create",
  "imports.create",
  "analytics.read",
  "announcements.manage",
  "community.moderate",
  "audit.read",
  "roles.manage"
] as const;

export type Permission = (typeof permissions)[number];

export function hasPermission(granted: Iterable<string>, required: Permission): boolean {
  return new Set(granted).has(required);
}
