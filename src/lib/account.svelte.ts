/**
 * Optional accounts (Supabase): sign in, sync between devices, send to classmates by name, groups.
 * Without ACCOUNT.url everything here stays off and the app never contacts a server.
 * The Supabase client is only downloaded when an account is actually used.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ACCOUNT } from "../config";
import { parseSharedItem, type SharedItem } from "./backup";
import { EMPTY_SYNC, sameContent, syncOnce, type PushRow, type Remote, type RemoteRow, type SyncState } from "./sync";
import type { Snapshot } from "./db";

export const accountsEnabled = Boolean(ACCOUNT.url && ACCOUNT.anonKey);

export interface Profile {
  id: string;
  username: string;
  display_name: string;
}
export interface InboxItem {
  id: string;
  kind: "deck" | "quiz" | "folder";
  title: string;
  from: string;
  created_at: string;
  item: SharedItem | null;
}
export interface Group {
  id: string;
  name: string;
  code: string;
  owner: string;
}
export interface GroupItem {
  id: string;
  kind: "deck" | "quiz" | "folder";
  title: string;
  added_by: string;
  by: string;
  created_at: string;
  item: SharedItem | null;
}

export interface WeekStats {
  answers: number;
  correct: number;
  days: number;
}
export interface RankRow extends WeekStats {
  id: string;
  name: string;
  me: boolean;
}

export const USERNAME = /^[a-z0-9_]{3,20}$/;

let client: SupabaseClient | null = null;
async function sb(): Promise<SupabaseClient> {
  if (!accountsEnabled) throw new Error("Accounts are off");
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(ACCOUNT.url, ACCOUNT.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return client;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** The records table as a sync Remote. */
function remote(c: SupabaseClient, userId: string): Remote {
  return {
    async pull(since: string | null): Promise<RemoteRow[]> {
      const out: RemoteRow[] = [];
      let cursor = since;
      for (;;) {
        let q = c.from("records").select("kind,id,data,deleted,updated_at").eq("user_id", userId).order("updated_at", { ascending: true }).limit(1000);
        if (cursor) q = q.gt("updated_at", cursor);
        const { data, error } = await q;
        fail(error);
        const rows = (data ?? []) as RemoteRow[];
        out.push(...rows);
        if (rows.length < 1000) return out;
        cursor = rows[rows.length - 1]!.updated_at;
      }
    },
    async push(rows: PushRow[]): Promise<RemoteRow[]> {
      const { data, error } = await c
        .from("records")
        .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,kind,id" })
        .select("kind,id,data,deleted,updated_at");
      fail(error);
      return (data ?? []) as RemoteRow[];
    },
  };
}

function loadState(userId: string): SyncState {
  try {
    const raw = localStorage.getItem(`klopt-sync-${userId}`);
    if (raw) {
      const v = JSON.parse(raw) as SyncState;
      if (v && typeof v === "object" && typeof v.hashes === "object") return v;
    }
  } catch {
    // Unreadable: start over; merging makes a full round harmless.
  }
  return EMPTY_SYNC;
}
function saveState(userId: string, state: SyncState): void {
  try {
    localStorage.setItem(`klopt-sync-${userId}`, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the next round redoes the work.
  }
}

class Account {
  user = $state.raw<User | null>(null);
  profile = $state.raw<Profile | null>(null);
  ready = $state(!accountsEnabled);
  syncing = $state(false);
  lastSync = $state<string | null>(null);
  syncError = $state("");
  inboxCount = $state(0);

  /** Restores a session on start. Never contacts the server when no one ever signed in on this device. */
  async init(): Promise<void> {
    if (!accountsEnabled) return;
    try {
      const hasSession = Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const fromLink = /access_token=|type=signup|type=recovery/.test(location.hash) || /[?&]code=/.test(location.search);
      if (!hasSession && !fromLink) return;
      const c = await sb();
      const { data } = await c.auth.getSession();
      this.user = data.session?.user ?? null;
      c.auth.onAuthStateChange((_e, session) => {
        this.user = session?.user ?? null;
        if (!this.user) this.profile = null;
      });
      if (this.user) await this.loadProfile();
    } catch {
      // Offline or the server is unreachable: the app works as before.
    } finally {
      this.ready = true;
    }
  }

  async signUp(email: string, password: string, username: string, displayName: string): Promise<"confirm" | "done"> {
    const c = await sb();
    const { data: taken } = await c.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) throw new Error("username-taken");
    const { data, error } = await c.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName }, emailRedirectTo: location.origin + location.pathname },
    });
    fail(error);
    this.user = data.session?.user ?? null;
    if (!this.user) return "confirm";
    await this.loadProfile();
    return "done";
  }

  async signIn(email: string, password: string): Promise<void> {
    const c = await sb();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    fail(error);
    this.user = data.user;
    await this.loadProfile();
  }

  async resetPassword(email: string): Promise<void> {
    const c = await sb();
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#/account" });
    fail(error);
  }

  async signOut(): Promise<void> {
    const c = await sb();
    await c.auth.signOut();
    this.user = null;
    this.profile = null;
    this.inboxCount = 0;
  }

  /** Deletes the account and everything stored in it; what is on this device stays. */
  async deleteAccount(): Promise<void> {
    const c = await sb();
    const id = this.user?.id;
    const { error } = await c.rpc("delete_me");
    fail(error);
    if (id) localStorage.removeItem(`klopt-sync-${id}`);
    await c.auth.signOut();
    this.user = null;
    this.profile = null;
  }

  /** Reads the profile; on the first sign-in it is made from the name chosen at sign-up. */
  private async loadProfile(): Promise<void> {
    const c = await sb();
    const u = this.user;
    if (!u) return;
    const { data } = await c.from("profiles").select("id,username,display_name").eq("id", u.id).maybeSingle();
    if (data) {
      this.profile = data as Profile;
    } else {
      const meta = u.user_metadata as { username?: string; display_name?: string };
      if (meta.username && USERNAME.test(meta.username)) {
        const { data: made } = await c.from("profiles").insert({ id: u.id, username: meta.username, display_name: (meta.display_name || meta.username).slice(0, 40) }).select("id,username,display_name").maybeSingle();
        this.profile = (made as Profile | null) ?? null;
      }
    }
    void this.refreshInbox();
  }

  async setProfile(username: string, displayName: string): Promise<void> {
    const c = await sb();
    const u = this.user;
    if (!u) throw new Error("not signed in");
    const { data, error } = await c.from("profiles").upsert({ id: u.id, username, display_name: displayName }).select("id,username,display_name").single();
    if (error?.code === "23505") throw new Error("username-taken");
    fail(error);
    this.profile = data as Profile;
  }

  // Sync

  /**
   * One sync round with the account. `read` and `write` reach the local database; `write` is skipped
   * (and the round retried later) if the data changed on this device while syncing.
   */
  async sync(read: () => Promise<Snapshot>, write: (s: Snapshot) => Promise<void>): Promise<boolean> {
    const u = this.user;
    if (!u || this.syncing) return false;
    this.syncing = true;
    this.syncError = "";
    try {
      const c = await sb();
      const before = await read();
      const result = await syncOnce(before, remote(c, u.id), loadState(u.id), async (merged) => {
        if (!sameContent(before, await read())) return false;
        await write(merged);
        return true;
      });
      saveState(u.id, result.state);
      this.lastSync = new Date().toISOString();
      return result.applied;
    } catch (e) {
      this.syncError = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      this.syncing = false;
    }
  }

  // Sending by name

  async findUser(username: string): Promise<Profile | null> {
    const c = await sb();
    const { data } = await c.from("profiles").select("id,username,display_name").eq("username", username.trim().toLowerCase()).maybeSingle();
    return (data as Profile | null) ?? null;
  }

  async send(toUser: string, kind: "deck" | "quiz" | "folder", title: string, json: string): Promise<void> {
    const c = await sb();
    const { error } = await c.from("shares").insert({ to_user: toUser, kind, title: title.slice(0, 120), payload: JSON.parse(json) });
    fail(error);
  }

  async inbox(): Promise<InboxItem[]> {
    const c = await sb();
    const u = this.user;
    if (!u) return [];
    const { data, error } = await c.from("shares").select("id,kind,title,payload,from_user,created_at").eq("to_user", u.id).order("created_at", { ascending: false }).limit(100);
    fail(error);
    const rows = (data ?? []) as { id: string; kind: InboxItem["kind"]; title: string; payload: unknown; from_user: string; created_at: string }[];
    const names = await this.names(rows.map((r) => r.from_user));
    this.inboxCount = rows.length;
    return rows.map((r) => {
      const parsed = parseSharedItem(JSON.stringify(r.payload));
      return { id: r.id, kind: r.kind, title: r.title, from: names.get(r.from_user) ?? "?", created_at: r.created_at, item: parsed.ok ? parsed.data : null };
    });
  }

  async refreshInbox(): Promise<void> {
    try {
      const c = await sb();
      const u = this.user;
      if (!u) return;
      const { count } = await c.from("shares").select("id", { count: "exact", head: true }).eq("to_user", u.id);
      this.inboxCount = count ?? 0;
    } catch {
      // Offline: keep the old count.
    }
  }

  async dismiss(shareId: string): Promise<void> {
    const c = await sb();
    const { error } = await c.from("shares").delete().eq("id", shareId);
    fail(error);
    this.inboxCount = Math.max(0, this.inboxCount - 1);
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const c = await sb();
    const { data } = await c.from("profiles").select("id,display_name,username").in("id", unique);
    return new Map(((data ?? []) as Profile[]).map((p) => [p.id, `${p.display_name} (@${p.username})`]));
  }

  // Groups

  // Weekly ranking (opt-in)

  /** Whether this account takes part in group rankings: it does once it has a weekly row. */
  async inRanking(): Promise<boolean> {
    const u = this.user;
    if (!u) return false;
    const c = await sb();
    const { data, error } = await c.from("weekly_stats").select("week").eq("user_id", u.id).limit(1);
    fail(error);
    return (data ?? []).length > 0;
  }

  /** Stores this week's totals (`week` is its Monday). */
  async pushWeek(week: string, stats: WeekStats): Promise<void> {
    const u = this.user;
    if (!u) return;
    const c = await sb();
    const { error } = await c.from("weekly_stats").upsert({ user_id: u.id, week, ...stats }, { onConflict: "user_id,week" });
    fail(error);
  }

  /** Stops taking part: removes every weekly row. */
  async leaveRanking(): Promise<void> {
    const u = this.user;
    if (!u) return;
    const c = await sb();
    const { error } = await c.from("weekly_stats").delete().eq("user_id", u.id);
    fail(error);
  }

  /** This week's ranking of the members of a group who take part, most answers first. */
  async ranking(groupId: string, week: string): Promise<RankRow[]> {
    const u = this.user;
    const c = await sb();
    const { data: m, error } = await c.from("group_members").select("user_id").eq("group_id", groupId);
    fail(error);
    const members = ((m ?? []) as { user_id: string }[]).map((x) => x.user_id);
    if (!members.length) return [];
    const { data: rows, error: e2 } = await c.from("weekly_stats").select("user_id,answers,correct,days").eq("week", week).in("user_id", members);
    fail(e2);
    const stats = (rows ?? []) as ({ user_id: string } & WeekStats)[];
    const names = await this.names(stats.map((r) => r.user_id));
    return stats
      .map((r) => ({ id: r.user_id, name: names.get(r.user_id) ?? "?", answers: r.answers, correct: r.correct, days: r.days, me: r.user_id === u?.id }))
      .sort((a, b) => b.answers - a.answers || b.days - a.days || a.name.localeCompare(b.name));
  }

  async groups(): Promise<Group[]> {
    const c = await sb();
    const { data, error } = await c.from("groups").select("id,name,code,owner").order("created_at", { ascending: true });
    fail(error);
    return (data ?? []) as Group[];
  }

  async createGroup(name: string): Promise<Group> {
    const c = await sb();
    const { data, error } = await c.rpc("create_group", { group_name: name.trim().slice(0, 60) });
    fail(error);
    return data as Group;
  }

  /** Null when no group has that code. */
  async joinGroup(code: string): Promise<Group | null> {
    const c = await sb();
    const { data, error } = await c.rpc("join_group", { join_code: code });
    fail(error);
    return (data as Group | null)?.id ? (data as Group) : null;
  }

  async group(id: string): Promise<{ group: Group; members: { id: string; name: string }[]; items: GroupItem[] } | null> {
    const c = await sb();
    const { data: g } = await c.from("groups").select("id,name,code,owner").eq("id", id).maybeSingle();
    if (!g) return null;
    const [{ data: m }, { data: it }] = await Promise.all([
      c.from("group_members").select("user_id").eq("group_id", id),
      c.from("group_items").select("id,kind,title,payload,added_by,created_at").eq("group_id", id).order("created_at", { ascending: false }),
    ]);
    const members = ((m ?? []) as { user_id: string }[]).map((x) => x.user_id);
    const items = (it ?? []) as { id: string; kind: GroupItem["kind"]; title: string; payload: unknown; added_by: string; created_at: string }[];
    const names = await this.names([...members, ...items.map((x) => x.added_by)]);
    return {
      group: g as Group,
      members: members.map((uid) => ({ id: uid, name: names.get(uid) ?? "?" })).sort((a, b) => a.name.localeCompare(b.name)),
      items: items.map((x) => {
        const parsed = parseSharedItem(JSON.stringify(x.payload));
        return { id: x.id, kind: x.kind, title: x.title, added_by: x.added_by, by: names.get(x.added_by) ?? "?", created_at: x.created_at, item: parsed.ok ? parsed.data : null };
      }),
    };
  }

  async addToGroup(groupId: string, kind: GroupItem["kind"], title: string, json: string): Promise<void> {
    const c = await sb();
    const { error } = await c.from("group_items").insert({ group_id: groupId, kind, title: title.slice(0, 120), payload: JSON.parse(json) });
    fail(error);
  }

  async removeFromGroup(itemId: string): Promise<void> {
    const c = await sb();
    const { error } = await c.from("group_items").delete().eq("id", itemId);
    fail(error);
  }

  async leaveGroup(groupId: string): Promise<void> {
    const c = await sb();
    const u = this.user;
    if (!u) return;
    const { error } = await c.from("group_members").delete().eq("group_id", groupId).eq("user_id", u.id);
    fail(error);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const c = await sb();
    const { error } = await c.from("groups").delete().eq("id", groupId);
    fail(error);
  }
}

export const account = new Account();
