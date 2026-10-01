import type { BrowserContext, Route } from "@playwright/test";

/**
 * A stand-in for the Supabase project the e2e build points at (https://klopt-test.supabase.co):
 * password sign-in, and a small PostgREST with the tables from supabase/schema.sql, enforcing who may
 * see what the way the row level security does. One instance is shared by several browser contexts,
 * which then act as different devices or different students.
 */
export const FAKE_URL = "https://klopt-test.supabase.co";

type Row = Record<string, unknown>;

export class FakeAccount {
  users: { id: string; email: string; password: string; meta: Row }[] = [];
  tables: Record<string, Row[]> = { profiles: [], records: [], shares: [], groups: [], group_members: [], group_items: [], weekly_stats: [] };
  private clock = Date.UTC(2026, 9, 1);
  private seq = 0;

  addUser(email: string, password: string, meta: Row = {}): string {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
    this.users.push({ id, email, password, meta });
    return id;
  }

  private now(): string {
    return new Date((this.clock += 1000)).toISOString();
  }
  private uuid(): string {
    return `10000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
  }

  async attach(ctx: BrowserContext): Promise<void> {
    await ctx.route(`${FAKE_URL}/**`, (route) => this.handle(route));
  }

  private session(u: FakeAccount["users"][number]) {
    const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, user_metadata: u.meta, app_metadata: {}, created_at: new Date(this.clock).toISOString() };
    return { access_token: u.id, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user };
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" } });
    }
    const token = (req.headers()["authorization"] ?? "").replace(/^Bearer /, "");
    const me = this.users.find((u) => u.id === token);
    const body = req.postData() ? (JSON.parse(req.postData()!) as unknown) : undefined;

    // Auth
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      const b = body as { email?: string; password?: string; refresh_token?: string };
      const u = grant === "refresh_token" ? this.users.find((x) => `r-${x.id}` === b.refresh_token) : this.users.find((x) => x.email === b.email && x.password === b.password);
      return u ? json(200, this.session(u)) : json(400, { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
    }
    if (url.pathname === "/auth/v1/signup") {
      const b = body as { email: string; password: string; data?: Row };
      if (this.users.some((u) => u.email === b.email)) return json(400, { msg: "User already registered" });
      const id = this.addUser(b.email, b.password, b.data ?? {});
      return json(200, this.session(this.users.find((u) => u.id === id)!));
    }
    if (url.pathname === "/auth/v1/user") return me ? json(200, this.session(me).user) : json(401, { msg: "no user" });
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    if (!me) return json(401, { message: "JWT required" });

    // RPC
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.slice("/rest/v1/rpc/".length);
      const b = (body ?? {}) as Row;
      if (fn === "create_group") {
        const g = { id: this.uuid(), name: String(b.group_name), code: `G${String(this.seq).padStart(5, "0")}`, owner: me.id, created_at: this.now() };
        this.tables.groups!.push(g);
        this.tables.group_members!.push({ group_id: g.id, user_id: me.id, joined_at: this.now() });
        return json(200, g);
      }
      if (fn === "join_group") {
        const g = this.tables.groups!.find((x) => x.code === String(b.join_code).trim().toUpperCase());
        if (!g) return json(200, null);
        if (!this.tables.group_members!.some((m) => m.group_id === g.id && m.user_id === me.id)) this.tables.group_members!.push({ group_id: g.id, user_id: me.id, joined_at: this.now() });
        return json(200, g);
      }
      if (fn === "delete_me") {
        for (const t of Object.keys(this.tables)) this.tables[t] = this.tables[t]!.filter((r) => ![r.user_id, r.id, r.from_user, r.to_user, r.owner, r.added_by].includes(me.id));
        this.users = this.users.filter((u) => u !== me);
        return json(200, null);
      }
      return json(404, { message: `no function ${fn}` });
    }

    // PostgREST
    const table = url.pathname.replace("/rest/v1/", "");
    const rows = this.tables[table];
    if (!rows) return json(404, { message: `no table ${table}` });
    const member = (g: unknown) => this.tables.group_members!.some((m) => m.group_id === g && m.user_id === me.id);
    const classmate = (u: unknown) => this.tables.group_members!.some((a) => a.user_id === me.id && this.tables.group_members!.some((b) => b.group_id === a.group_id && b.user_id === u));
    const visible = (r: Row) =>
      table === "profiles" ? true
      : table === "records" ? r.user_id === me.id
      : table === "shares" ? r.to_user === me.id || r.from_user === me.id
      : table === "groups" ? member(r.id)
      : table === "weekly_stats" ? r.user_id === me.id || classmate(r.user_id)
      : member(r.group_id);
    const filters: ((r: Row) => boolean)[] = [];
    let order: [string, boolean] | null = null;
    let limit = Infinity;
    for (const [k, v] of url.searchParams) {
      if (k === "select" || k === "columns" || k === "on_conflict") continue;
      if (k === "order") {
        const [col, dir] = v.split(".");
        order = [col!, dir !== "desc"];
      } else if (k === "limit") limit = Number(v);
      else {
        const [op, ...rest] = v.split(".");
        const val = rest.join(".");
        if (op === "eq") filters.push((r) => String(r[k]) === val);
        else if (op === "gt") filters.push((r) => String(r[k]) > val);
        else if (op === "in") {
          const set = new Set(val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")));
          filters.push((r) => set.has(String(r[k])));
        }
      }
    }
    const match = () => {
      let out = rows.filter((r) => visible(r) && filters.every((f) => f(r)));
      if (order) {
        const [col, asc] = order;
        out = out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
      }
      return out.slice(0, limit);
    };
    const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const reply = (out: Row[]) => (single ? (out.length === 1 ? json(200, out[0]) : json(406, { message: "not one row" })) : json(200, out));

    if (req.method() === "GET") return reply(match());
    if (req.method() === "HEAD") {
      const n = match().length;
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "*", "content-range": `0-${Math.max(0, n - 1)}/${n}` } });
    }
    if (req.method() === "DELETE") {
      const gone = new Set(match().filter((r) => this.mayDelete(table, r, me.id)));
      this.tables[table] = rows.filter((r) => !gone.has(r));
      return json(200, [...gone]);
    }
    if (req.method() === "POST" || req.method() === "PATCH") {
      const input = (Array.isArray(body) ? body : [body]) as Row[];
      const out: Row[] = [];
      for (const raw of input) {
        const r: Row = { ...raw };
        if (table === "records") {
          if (r.user_id !== me.id) return json(403, { message: "row level security" });
          r.updated_at = this.now();
          const i = rows.findIndex((x) => x.user_id === r.user_id && x.kind === r.kind && x.id === r.id);
          if (i >= 0) rows[i] = r;
          else rows.push(r);
        } else if (table === "profiles") {
          if (r.id !== me.id) return json(403, { message: "row level security" });
          if (rows.some((x) => x.username === r.username && x.id !== me.id)) return json(409, { code: "23505", message: "duplicate key" });
          const i = rows.findIndex((x) => x.id === r.id);
          if (i >= 0) rows[i] = { ...rows[i], ...r };
          else rows.push({ created_at: this.now(), ...r });
        } else if (table === "shares") {
          rows.push({ id: this.uuid(), from_user: me.id, created_at: this.now(), ...r });
          r.id = rows.at(-1)!.id;
        } else if (table === "weekly_stats") {
          if (r.user_id !== me.id) return json(403, { message: "row level security" });
          r.updated_at = this.now();
          const i = rows.findIndex((x) => x.user_id === r.user_id && x.week === r.week);
          if (i >= 0) rows[i] = r;
          else rows.push(r);
        } else if (table === "group_items") {
          if (!member(r.group_id)) return json(403, { message: "row level security" });
          rows.push({ id: this.uuid(), added_by: me.id, created_at: this.now(), ...r });
        } else return json(403, { message: "not allowed" });
        out.push(table === "records" || table === "weekly_stats" ? r : rows.at(-1)!);
      }
      return reply(out);
    }
    return json(405, { message: "method" });
  }

  private mayDelete(table: string, r: Row, me: string): boolean {
    if (table === "shares") return r.to_user === me || r.from_user === me;
    if (table === "group_members") return r.user_id === me || this.tables.groups!.some((g) => g.id === r.group_id && g.owner === me);
    if (table === "group_items") return r.added_by === me || this.tables.groups!.some((g) => g.id === r.group_id && g.owner === me);
    if (table === "groups") return r.owner === me;
    if (table === "weekly_stats") return r.user_id === me;
    return false;
  }
}
