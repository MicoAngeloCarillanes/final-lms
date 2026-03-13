/**
 * api.js — LMS Backend client
 * NestJS (port 3000) → /api prefix
 * Real-time features (chat, announcements, tasks) → Supabase directly
 *
 * FOLDER: src/lib/api.js  (replace existing)
 */
import { supabase } from "../supabaseClient";

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

async function request(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
  return data;
}

// ─── Department (NestJS) ─────────────────────────────────────────────────────
export const departmentApi = {
  create:    (p)     => request("POST",   "/department", p),
  getOptions:()      => request("GET",    "/department/options"),
  getList:   (p={})  => request("POST",   "/department/list", { page:1, size:20, sortBy:"departmentId", sortDir:"asc", ...p }),
  getById:   (id)    => request("GET",    `/department/${id}`),
  update:    (p)     => request("PUT",    "/department", p),
  setActive: (id, a) => request("PATCH",  `/department/${id}/${a}`),
  delete:    (id)    => request("DELETE", `/department/${id}`),
};

// ─── Announcements (Supabase) ────────────────────────────────────────────────
export const announcementApi = {
  async getAll() {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create({ authorId, authorName, authorRole, title, body, category = "General", pinned = false }) {
    const { data, error } = await supabase
      .from("announcements")
      .insert({ author_id: authorId, author_name: authorName, author_role: authorRole, title, body, category, pinned })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async update(id, fields) {
    const { data, error } = await supabase.from("announcements").update(fields).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
  subscribe(callback) {
    return supabase.channel("announcements-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, callback)
      .subscribe();
  },
};

// ─── Tasks (Supabase) ────────────────────────────────────────────────────────
export const taskApi = {
  async getForUser(userUuid) {
    const { data, error } = await supabase
      .from("tasks").select("*")
      .eq("user_id", userUuid)
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create({ userUuid, title, dueDate, type = "Task", courseId = null }) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ user_id: userUuid, title, due_date: dueDate, type, course_id: courseId, is_done: false })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async toggle(id, isDone) {
    const { data, error } = await supabase.from("tasks").update({ is_done: isDone }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── Chat (Supabase realtime) ─────────────────────────────────────────────────
export const chatApi = {
  async getChannels() {
    const { data, error } = await supabase.from("chat_channels").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async getMessages(channelId, limit = 80) {
    const { data, error } = await supabase
      .from("chat_messages").select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async sendMessage({ channelId, senderId, senderName, senderRole, body }) {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ channel_id: channelId, sender_id: senderId, sender_name: senderName, sender_role: senderRole, body })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async createChannel({ name, description = "", type = "public" }) {
    const { data, error } = await supabase.from("chat_channels").insert({ name, description, type }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  subscribeMessages(channelId, callback) {
    return supabase.channel(`chat-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, callback)
      .subscribe();
  },
};

// ─── Sub-Admins (Supabase) ───────────────────────────────────────────────────
export const subAdminApi = {
  async getAll() {
    const { data, error } = await supabase.from("sub_admins").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create(payload) {
    const { data, error } = await supabase.from("sub_admins").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async update(id, fields) {
    const { data, error } = await supabase.from("sub_admins").update(fields).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from("sub_admins").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── Account Approvals (Supabase) ────────────────────────────────────────────
export const approvalApi = {
  async getPending() {
    const { data, error } = await supabase.from("account_approvals").select("*")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async getAll() {
    const { data, error } = await supabase.from("account_approvals").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async submit(payload) {
    const { data, error } = await supabase.from("account_approvals")
      .insert({ ...payload, status: "pending" }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async review(id, status, reviewedBy) {
    const { data, error } = await supabase.from("account_approvals")
      .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
};
