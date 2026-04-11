/**
 * ユーザー名の取得
 */
export function getDisplayName(i: {
  user: { username: string };
  member: unknown | null;
}) {
  const m = (i as { member?: unknown }).member as
    | {
        nickname?: string | null;
        nick?: string | null;
        user?: { globalName?: string | null; username?: string };
      }
    | null
    | undefined;
  if (m) {
    const nick =
      m.nickname ??
      m.nick ??
      (m.user && (m.user.globalName ?? m.user.username));
    if (typeof nick === "string" && nick.length > 0) {
      return nick;
    }
  }
  return i.user.username;
}
