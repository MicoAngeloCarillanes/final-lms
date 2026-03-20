/**
 * api.js — LMS data client
 * ALL calls go directly to Supabase — NestJS backend is not required.
 *
 * FOLDER: src/lib/api.js  (replace existing)
 */
import { supabase } from "../supabaseClient";

// ─── User / Password ──────────────────────────────────────────────────────────
export const userApi = {
  async resetPassword(username, newPassword) {
    const plain = newPassword ?? "Welcome@123";
    const { data: user, error: findErr } = await supabase
      .from("users").select("user_id").eq("username", username).single();
    if (findErr || !user) throw new Error(`User "${username}" not found.`);

    const { data: hash, error: hashErr } = await supabase.rpc("hash_password", { plain });
    if (hashErr || !hash) throw new Error("Password hashing failed.");

    const { error: upErr } = await supabase
      .from("users").update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq("user_id", user.user_id);
    if (upErr) throw new Error(upErr.message);
    return `Password for "${username}" has been reset successfully.`;
  },

  async changePassword(username, currentPassword, newPassword) {
    const { data: user, error: findErr } = await supabase
      .from("users").select("user_id, password_hash").eq("username", username).single();
    if (findErr || !user) throw new Error(`User "${username}" not found.`);

    const { data: ok, error: verifyErr } = await supabase
      .rpc("verify_password", { plain: currentPassword, hash: user.password_hash });
    if (verifyErr) throw new Error(verifyErr.message);
    if (!ok) throw new Error("Current password is incorrect.");

    const { data: hash, error: hashErr } = await supabase.rpc("hash_password", { plain: newPassword });
    if (hashErr || !hash) throw new Error("Password hashing failed.");

    const { error: upErr } = await supabase
      .from("users").update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq("user_id", user.user_id);
    if (upErr) throw new Error(upErr.message);
    return "Password changed successfully.";
  },
};

// ─── Department (Supabase) ────────────────────────────────────────────────────
export const departmentApi = {
  async getList({ page = 1, size = 20, name = "", code = "" } = {}) {
    let q = supabase.from("department").select("*", { count: "exact" })
      .eq("is_deleted", false)
      .order("created_date", { ascending: true });
    if (name) q = q.ilike("name", `%${name}%`);
    if (code) q = q.ilike("code", `%${code}%`);
    q = q.range((page - 1) * size, page * size - 1);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    // Normalise column names to match what AdminDepartments.jsx expects
    const items = (data ?? []).map(r => ({
      departmentId: r.department_id,
      code:         r.code,
      name:         r.name,
      room:         r.room,
      email:        r.email,
      phone:        r.phone,
      description:  r.description,
      isActive:     r.is_active ? 1 : 0,
      isDeleted:    r.is_deleted ? 1 : 0,
    }));
    return { items, total: count ?? 0 };
  },

  async getOptions() {
    const { data, error } = await supabase
      .from("department")
      .select("department_id, name")
      .eq("is_deleted", false)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({ departmentId: r.department_id, name: r.name }));
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("department").select("*").eq("department_id", id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create({ code, name, room, email, phone, description }) {
    // Duplicate checks
    for (const [field, val] of [["code", code], ["name", name], ["email", email], ["phone", phone]]) {
      if (!val) continue;
      const { count } = await supabase.from("department").select("*", { count: "exact", head: true })
        .eq(field, val).eq("is_deleted", false);
      if (count > 0) throw new Error(`Department ${field} already exists.`);
    }
    const { error } = await supabase.from("department")
      .insert({ code, name, room: room || null, email: email || null, phone: phone || null, description: description || null });
    if (error) throw new Error(error.message);
    return "Department created successfully.";
  },

  async update({ departmentId, code, name, room, email, phone, description }) {
    // Duplicate checks (exclude self)
    for (const [field, val] of [["code", code], ["name", name], ["email", email], ["phone", phone]]) {
      if (!val) continue;
      const { count } = await supabase.from("department").select("*", { count: "exact", head: true })
        .eq(field, val).eq("is_deleted", false).neq("department_id", departmentId);
      if (count > 0) throw new Error(`Department ${field} already exists.`);
    }
    const { error } = await supabase.from("department")
      .update({ code, name, room: room || null, email: email || null, phone: phone || null, description: description || null, updated_date: new Date().toISOString() })
      .eq("department_id", departmentId).eq("is_deleted", false);
    if (error) throw new Error(error.message);
    return "Department updated successfully.";
  },

  async setActive(id, isActive) {
    const { error } = await supabase.from("department")
      .update({ is_active: isActive === 1, updated_date: new Date().toISOString() })
      .eq("department_id", id).eq("is_deleted", false);
    if (error) throw new Error(error.message);
    return isActive === 1 ? "Department activated successfully." : "Department deactivated successfully.";
  },

  async delete(id) {
    const { error } = await supabase.from("department")
      .update({ is_deleted: true, is_active: false, updated_date: new Date().toISOString() })
      .eq("department_id", id);
    if (error) throw new Error(error.message);
    return "Department deleted successfully.";
  },
};

// ─── Program (Supabase) ───────────────────────────────────────────────────────
export const programApi = {
  async getList({ page = 1, size = 20, name = "", code = "" } = {}) {
    let q = supabase
      .from("program")
      .select("*, department(name)", { count: "exact" })
      .eq("is_deleted", false)
      .order("created_date", { ascending: true });
    if (name) q = q.ilike("name", `%${name}%`);
    if (code) q = q.ilike("code", `%${code}%`);
    q = q.range((page - 1) * size, page * size - 1);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const items = (data ?? []).map(r => ({
      programId:      r.program_id,
      code:           r.code,
      name:           r.name,
      departmentId:   r.department_id,
      departmentName: r.department?.name ?? null,
      description:    r.description,
      isActive:       r.is_active ? 1 : 0,
    }));
    return { items, total: count ?? 0 };
  },

  async getOptions() {
    const { data, error } = await supabase
      .from("program")
      .select("program_id, code, name")
      .eq("is_deleted", false)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({ programId: r.program_id, code: r.code, name: r.name }));
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("program").select("*").eq("program_id", id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create({ code, name, departmentId, description }) {
    for (const [field, val] of [["code", code], ["name", name]]) {
      const { count } = await supabase.from("program").select("*", { count: "exact", head: true })
        .eq(field, val).eq("is_deleted", false);
      if (count > 0) throw new Error(`Program ${field} already exists.`);
    }
    const { error } = await supabase.from("program")
      .insert({ code, name, department_id: departmentId || null, description: description || null });
    if (error) throw new Error(error.message);
    return "Program created successfully.";
  },

  async update({ programId, code, name, departmentId, description }) {
    for (const [field, val] of [["code", code], ["name", name]]) {
      const { count } = await supabase.from("program").select("*", { count: "exact", head: true })
        .eq(field, val).eq("is_deleted", false).neq("program_id", programId);
      if (count > 0) throw new Error(`Program ${field} already exists.`);
    }
    const { error } = await supabase.from("program")
      .update({ code, name, department_id: departmentId || null, description: description || null, updated_date: new Date().toISOString() })
      .eq("program_id", programId).eq("is_deleted", false);
    if (error) throw new Error(error.message);
    return "Program updated successfully.";
  },

  async setActive(id, isActive) {
    const { error } = await supabase.from("program")
      .update({ is_active: isActive === 1, updated_date: new Date().toISOString() })
      .eq("program_id", id).eq("is_deleted", false);
    if (error) throw new Error(error.message);
    return isActive === 1 ? "Program activated." : "Program deactivated.";
  },

  async delete(id) {
    const { error } = await supabase.from("program")
      .update({ is_deleted: true, is_active: false, updated_date: new Date().toISOString() })
      .eq("program_id", id);
    if (error) throw new Error(error.message);
    return "Program deleted successfully.";
  },
};

// ─── Announcements (Supabase) ─────────────────────────────────────────────────
export const announcementApi = {
  async getAll() {
    const { data, error } = await supabase.from("announcements").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create({ authorId, authorName, authorRole, title, body, category = "General", pinned = false, courseId = null }) {
    const { data, error } = await supabase.from("announcements")
      .insert({ author_id: authorId, author_name: authorName, author_role: authorRole, title, body, category, pinned, course_id: courseId || null })
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

// ─── Tasks (Supabase) ─────────────────────────────────────────────────────────
export const taskApi = {
  async getForUser(userUuid) {
    const { data, error } = await supabase.from("tasks").select("*")
      .eq("user_id", userUuid).order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create({ userUuid, title, dueDate, type = "Task", courseId = null }) {
    const { data, error } = await supabase.from("tasks")
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
    const { data, error } = await supabase.from("chat_messages").select("*")
      .eq("channel_id", channelId).order("created_at", { ascending: true }).limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async sendMessage({ channelId, senderId, senderName, senderRole, body }) {
    const { data, error } = await supabase.from("chat_messages")
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

// ─── Sub-Admins (Supabase) ────────────────────────────────────────────────────
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

// ─── Account Approvals (Supabase) ─────────────────────────────────────────────
export const approvalApi = {
  async getPending() {
    const { data, error } = await supabase.from("account_approvals").select("*")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async getAll() {
    const { data, error } = await supabase.from("account_approvals").select("*")
      .order("created_at", { ascending: false });
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
