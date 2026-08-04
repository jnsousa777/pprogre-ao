import { createAnalyzer, normalizeText, parseDateValue, weekdayFromIso, toNumber } from "./analysis.js";

let client = null;
let currentConfig = null;
let datasetCache = null;
let analyzerCache = null;

function supabaseGlobal() {
  if (!window.supabase?.createClient) throw new Error("A biblioteca do Supabase não carregou. Confira sua internet e recarregue.");
  return window.supabase;
}

function normalizeCloudConfig(config) {
  const rawUrl = String(config?.supabaseUrl || "").trim().replace(/^['"]|['"]$/g, "");
  const rawKey = String(config?.supabaseKey || "").trim().replace(/^['"]|['"]$/g, "");
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw new Error("A URL do Supabase é inválida.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("Cole a Project URL do Supabase, terminando em .supabase.co.");
  }
  if (rawKey.length < 20) throw new Error("A chave publicável parece incompleta.");
  return {
    supabaseUrl: `${parsed.protocol}//${parsed.host}`,
    supabaseKey: rawKey,
  };
}

export async function loadCloudConfig() {
  // A configuração da Vercel é a fonte principal. Isso evita que uma conexão
  // antiga salva no navegador continue sobrescrevendo variáveis corrigidas.
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) {
      const config = await response.json();
      if (config.supabaseUrl && config.supabaseKey) return normalizeCloudConfig(config);
    }
  } catch (_) { /* execução local sem função */ }

  if (window.PROGRESSAO_CONFIG?.supabaseUrl && window.PROGRESSAO_CONFIG?.supabaseKey) {
    return normalizeCloudConfig(window.PROGRESSAO_CONFIG);
  }

  const saved = localStorage.getItem("progressao_cloud_config");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.supabaseUrl && parsed.supabaseKey) return normalizeCloudConfig(parsed);
    } catch (_) { /* ignora config corrompida */ }
  }
  return null;
}

export function saveCloudConfig(config) {
  const normalized = normalizeCloudConfig(config);
  localStorage.setItem("progressao_cloud_config", JSON.stringify(normalized));
  return normalized;
}

export function clearCloudConfig() {
  localStorage.removeItem("progressao_cloud_config");
  client = null;
  currentConfig = null;
  invalidateData();
}

export function initializeCloud(config) {
  if (!config?.supabaseUrl || !config?.supabaseKey) throw new Error("Supabase ainda não foi configurado.");
  const normalized = normalizeCloudConfig(config);
  currentConfig = normalized;
  client = supabaseGlobal().createClient(normalized.supabaseUrl, normalized.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export function getCloudClient() {
  if (!client) throw new Error("Conecte o Supabase primeiro.");
  return client;
}

export async function getSession() {
  const { data, error } = await getCloudClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || "";
}

export async function signIn(email, password) {
  const { data, error } = await getCloudClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  invalidateData();
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await getCloudClient().auth.signUp({ email, password });
  if (error) throw error;
  invalidateData();
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await getCloudClient().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await getCloudClient().auth.signOut();
  if (error) throw error;
  invalidateData();
}

export async function updatePassword(password) {
  if (String(password || "").length < 6) throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
  const { data, error } = await getCloudClient().auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export function onAuthStateChange(callback) {
  return getCloudClient().auth.onAuthStateChange((event, session) => callback(event, session));
}

async function requireUser() {
  const session = await getSession();
  if (!session?.user) throw new Error("Sua sessão expirou. Entre novamente.");
  return session.user;
}

function invalidateData() {
  datasetCache = null;
  analyzerCache = null;
}

async function fetchAll(table, orderField = "created_at", ascending = true) {
  const user = await requireUser();
  const pageSize = 1000;
  const result = [];
  for (let from = 0; ; from += pageSize) {
    let query = getCloudClient().from(table).select("*").eq("user_id", user.id).range(from, from + pageSize - 1);
    if (orderField) query = query.order(orderField, { ascending });
    const { data, error } = await query;
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return result;
}

export async function loadDataset(force = false) {
  if (datasetCache && !force) return datasetCache;
  const [routines, globalExercises, routineExercises, sessions, sessionExercises, sets] = await Promise.all([
    fetchAll("routines", "start_date", true),
    fetchAll("global_exercises", "name", true),
    fetchAll("routine_exercises", "order_index", true),
    fetchAll("sessions", "session_date", true),
    fetchAll("session_exercises", "created_at", true),
    fetchAll("workout_sets", "set_number", true),
  ]);
  datasetCache = {
    routines,
    global_exercises: globalExercises,
    routine_exercises: routineExercises,
    sessions,
    session_exercises: sessionExercises,
    sets,
  };
  analyzerCache = createAnalyzer(datasetCache);
  return datasetCache;
}

async function analyzer(force = false) {
  await loadDataset(force);
  return analyzerCache;
}

async function upsertGlobalExercise(userId, input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Informe o nome do exercício.");
  const normalizedName = normalizeText(name);
  const existing = datasetCache?.global_exercises?.find(item => item.normalized_name === normalizedName);
  if (existing) {
    if (!existing.muscle_group && input.muscle_group) {
      const { data, error } = await getCloudClient().from("global_exercises").update({ muscle_group: input.muscle_group }).eq("id", existing.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return data;
    }
    return existing;
  }
  const payload = { user_id: userId, name, normalized_name: normalizedName, muscle_group: String(input.muscle_group || "").trim() };
  const { data, error } = await getCloudClient().from("global_exercises").upsert(payload, { onConflict: "user_id,normalized_name" }).select().single();
  if (error) throw error;
  return data;
}

async function saveRoutine(payload) {
  const user = await requireUser();
  await loadDataset();
  const routineValues = {
    user_id: user.id,
    name: String(payload.name || "").trim(),
    weekday: payload.weekday,
    start_date: payload.start_date,
    active: true,
  };
  if (!routineValues.name) throw new Error("Informe o nome da rotina.");
  if (!routineValues.weekday) throw new Error("Escolha o dia da semana.");
  let routine;
  if (payload.id) {
    const { data, error } = await getCloudClient().from("routines").update(routineValues).eq("id", payload.id).eq("user_id", user.id).select().single();
    if (error) throw error;
    routine = data;
  } else {
    const { data, error } = await getCloudClient().from("routines").insert(routineValues).select().single();
    if (error) throw error;
    routine = data;
  }

  const previousSlots = datasetCache.routine_exercises.filter(item => item.routine_id === routine.id);
  const keptIds = [];
  for (let index = 0; index < (payload.exercises || []).length; index += 1) {
    const input = payload.exercises[index];
    const global = await upsertGlobalExercise(user.id, input);
    let slot = input.id ? previousSlots.find(item => item.id === input.id) : previousSlots.find(item => item.global_exercise_id === global.id);
    const values = {
      user_id: user.id,
      routine_id: routine.id,
      global_exercise_id: global.id,
      target_sets: Math.max(1, Number(input.target_sets || 2)),
      rep_min: Math.max(1, Number(input.rep_min || 4)),
      rep_max: Math.max(1, Number(input.rep_max || 8)),
      load_increment: Number(String(input.load_increment || 2.5).replace(",", ".")) || 2.5,
      order_index: index,
      notes: String(input.notes || ""),
      active: true,
    };
    if (slot) {
      const { data, error } = await getCloudClient().from("routine_exercises").update(values).eq("id", slot.id).eq("user_id", user.id).select().single();
      if (error) throw error;
      keptIds.push(data.id);
    } else {
      const { data, error } = await getCloudClient().from("routine_exercises").insert(values).select().single();
      if (error) throw error;
      keptIds.push(data.id);
    }
  }
  const toArchive = previousSlots.filter(item => !keptIds.includes(item.id) && item.active !== false).map(item => item.id);
  if (toArchive.length) {
    const { error } = await getCloudClient().from("routine_exercises").update({ active: false }).in("id", toArchive).eq("user_id", user.id);
    if (error) throw error;
  }
  invalidateData();
  return { ok: true, routine_id: routine.id };
}

async function archiveRoutine(id) {
  const user = await requireUser();
  const { error } = await getCloudClient().from("routines").update({ active: false }).eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  invalidateData();
  return { ok: true };
}

async function saveSession(payload) {
  const user = await requireUser();
  await loadDataset();
  const routine = datasetCache.routines.find(item => item.id === payload.routine_id);
  if (!routine) throw new Error("Rotina não encontrada.");
  const supplied = payload.exercises || [];
  const normalizedExercises = supplied.map((input, index) => {
    const slot = datasetCache.routine_exercises.find(item => item.id === input.exercise_id);
    if (!slot) throw new Error("Um exercício da rotina não foi encontrado.");
    const validSets = (input.sets || []).map((set, setIndex) => ({
      set_number: setIndex + 1,
      load: toNumber(set.load, 0),
      reps: Math.trunc(toNumber(set.reps, 0)),
      rir: set.rir === "" || set.rir === null || set.rir === undefined ? null : toNumber(set.rir, 0),
    })).filter(set => set.load > 0 && set.reps > 0);
    const skipped = payload.status === "missed" || input.status === "skipped" || validSets.length === 0;
    return { input, slot, index, validSets, skipped };
  });
  const performedCount = normalizedExercises.filter(item => !item.skipped).length;
  const finalStatus = payload.status === "missed" || performedCount === 0 ? "missed" : payload.status === "partial" ? "partial" : "completed";
  const sessionValues = {
    user_id: user.id,
    routine_id: payload.routine_id,
    session_date: payload.date,
    status: finalStatus,
    notes: String(payload.notes || ""),
  };
  const { data: session, error: sessionError } = await getCloudClient().from("sessions")
    .upsert(sessionValues, { onConflict: "user_id,routine_id,session_date" }).select().single();
  if (sessionError) throw sessionError;

  for (const item of normalizedExercises) {
    const sessionExerciseValues = {
      user_id: user.id,
      session_id: session.id,
      routine_exercise_id: item.slot.id,
      global_exercise_id: item.slot.global_exercise_id,
      status: item.skipped ? "skipped" : "performed",
      skip_reason: item.skipped ? String(item.input.skip_reason || "") : "",
      position_index: item.index,
      notes: "",
    };
    const { data: sessionExercise, error: seError } = await getCloudClient().from("session_exercises")
      .upsert(sessionExerciseValues, { onConflict: "user_id,session_id,global_exercise_id" }).select().single();
    if (seError) throw seError;
    const { error: deleteError } = await getCloudClient().from("workout_sets").delete().eq("session_exercise_id", sessionExercise.id).eq("user_id", user.id);
    if (deleteError) throw deleteError;
    if (!item.skipped && item.validSets.length) {
      const rows = item.validSets.map(set => ({ ...set, user_id: user.id, session_exercise_id: sessionExercise.id, notes: "" }));
      const { error: setError } = await getCloudClient().from("workout_sets").insert(rows);
      if (setError) throw setError;
    }
  }
  invalidateData();
  return { ok: true, session_id: session.id, status: finalStatus };
}

function autoRoutineName(weekday) {
  const labels = { segunda: "Treino de segunda", terca: "Treino de terça", quarta: "Treino de quarta", quinta: "Treino de quinta", sexta: "Treino de sexta", sabado: "Treino de sábado", domingo: "Treino de domingo" };
  return labels[weekday] || "Treino importado";
}

export async function importRows(rows, mapping, options = {}) {
  const user = await requireUser();
  await loadDataset(true);
  const required = ["date", "exercise", "load", "reps"];
  for (const field of required) if (!mapping[field]) throw new Error("Mapeie Data, Exercício, Carga e Repetições.");
  const routineMap = new Map(datasetCache.routines.map(item => [`${normalizeText(item.name)}|${item.weekday}`, item]));
  const globalMap = new Map(datasetCache.global_exercises.map(item => [item.normalized_name, item]));
  const slotMap = new Map(datasetCache.routine_exercises.map(item => [`${item.routine_id}|${item.global_exercise_id}`, item]));
  const sessionMap = new Map(datasetCache.sessions.map(item => [`${item.routine_id}|${item.session_date}`, item]));
  const setCounters = new Map();
  let importedRows = 0;
  let skippedRows = 0;
  const errors = [];
  const sessionsTouched = new Set();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    try {
      const date = parseDateValue(row[mapping.date]);
      const exerciseName = String(row[mapping.exercise] || "").trim();
      const load = toNumber(row[mapping.load], 0);
      const reps = Math.trunc(toNumber(row[mapping.reps], 0));
      if (!exerciseName || load <= 0 || reps <= 0) { skippedRows += 1; continue; }
      const weekdayRaw = mapping.weekday ? normalizeText(row[mapping.weekday]) : "";
      const weekdayAliases = { seg: "segunda", segunda: "segunda", ter: "terca", terca: "terca", qua: "quarta", quarta: "quarta", qui: "quinta", quinta: "quinta", sex: "sexta", sexta: "sexta", sab: "sabado", sabado: "sabado", dom: "domingo", domingo: "domingo" };
      const weekday = weekdayAliases[weekdayRaw] || weekdayFromIso(date);
      const workoutName = String(mapping.workout ? row[mapping.workout] || "" : "").trim() || autoRoutineName(weekday);
      const routineKey = `${normalizeText(workoutName)}|${weekday}`;
      let routine = routineMap.get(routineKey);
      if (!routine) {
        const { data, error } = await getCloudClient().from("routines").insert({ user_id: user.id, name: workoutName, weekday, start_date: date, active: true }).select().single();
        if (error) throw error;
        routine = data; routineMap.set(routineKey, routine);
      } else if (date < routine.start_date) {
        const { data, error } = await getCloudClient().from("routines").update({ start_date: date }).eq("id", routine.id).eq("user_id", user.id).select().single();
        if (error) throw error;
        routine = data; routineMap.set(routineKey, routine);
      }

      const normalizedName = normalizeText(exerciseName);
      let global = globalMap.get(normalizedName);
      if (!global) {
        const { data, error } = await getCloudClient().from("global_exercises").insert({ user_id: user.id, name: exerciseName, normalized_name: normalizedName, muscle_group: "" }).select().single();
        if (error) throw error;
        global = data; globalMap.set(normalizedName, global);
      }
      const slotKey = `${routine.id}|${global.id}`;
      let slot = slotMap.get(slotKey);
      if (!slot) {
        const orderIndex = [...slotMap.values()].filter(item => item.routine_id === routine.id).reduce((max, item) => Math.max(max, Number(item.order_index)), -1) + 1;
        const { data, error } = await getCloudClient().from("routine_exercises").insert({
          user_id: user.id, routine_id: routine.id, global_exercise_id: global.id, target_sets: 2,
          rep_min: 4, rep_max: 8, load_increment: 2.5, order_index: orderIndex, active: true,
        }).select().single();
        if (error) throw error;
        slot = data; slotMap.set(slotKey, slot);
      }
      const sessionKey = `${routine.id}|${date}`;
      let session = sessionMap.get(sessionKey);
      if (!session) {
        const { data, error } = await getCloudClient().from("sessions").upsert({ user_id: user.id, routine_id: routine.id, session_date: date, status: "completed", notes: "" }, { onConflict: "user_id,routine_id,session_date" }).select().single();
        if (error) throw error;
        session = data; sessionMap.set(sessionKey, session);
      }
      sessionsTouched.add(sessionKey);
      const { data: sessionExercise, error: seError } = await getCloudClient().from("session_exercises").upsert({
        user_id: user.id, session_id: session.id, routine_exercise_id: slot.id, global_exercise_id: global.id,
        status: "performed", skip_reason: "", position_index: Number(slot.order_index), notes: "",
      }, { onConflict: "user_id,session_id,global_exercise_id" }).select().single();
      if (seError) throw seError;
      const explicitSet = mapping.set ? Math.trunc(toNumber(row[mapping.set], 0)) : 0;
      const counterKey = sessionExercise.id;
      const setNumber = explicitSet > 0 ? explicitSet : (setCounters.set(counterKey, (setCounters.get(counterKey) || 0) + 1), setCounters.get(counterKey));
      const rir = mapping.rir && row[mapping.rir] !== "" && row[mapping.rir] !== null && row[mapping.rir] !== undefined ? toNumber(row[mapping.rir], 0) : null;
      const notes = mapping.notes ? String(row[mapping.notes] || "") : "";
      const { error: setError } = await getCloudClient().from("workout_sets").upsert({
        user_id: user.id, session_exercise_id: sessionExercise.id, set_number: setNumber, load, reps, rir, notes,
      }, { onConflict: "user_id,session_exercise_id,set_number" });
      if (setError) throw setError;
      importedRows += 1;
    } catch (error) {
      skippedRows += 1;
      if (errors.length < 8) errors.push(`Linha ${rowIndex + 2}: ${error.message}`);
    }
  }
  invalidateData();
  return { ok: true, imported_rows: importedRows, skipped_rows: skippedRows, sessions: sessionsTouched.size, errors };
}

export async function exportCsv() {
  await loadDataset(true);
  const analysis = await analyzer();
  const header = ["Data", "Treino", "Exercicio", "Serie", "Carga_kg", "Repeticoes", "RIR", "Observacoes"];
  const rows = [];
  for (const entry of analysis.entries.filter(item => item.status === "performed").sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.position - b.position)) {
    for (const set of entry.sets) rows.push([entry.date, entry.routine_name, entry.exercise_name, set.set_number, set.load, set.reps, set.rir ?? "", set.notes || ""]);
  }
  const escape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return "\ufeff" + [header, ...rows].map(row => row.map(escape).join(";")).join("\n");
}

export async function cloudApi(url, options = {}) {
  const parsed = new URL(url, window.location.origin);
  const path = parsed.pathname;
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body && typeof options.body === "string" ? JSON.parse(options.body) : options.body;

  if (path === "/api/bootstrap" && method === "GET") {
    const date = parsed.searchParams.get("date");
    return (await analyzer()).bootstrap(date);
  }
  if (path === "/api/sessions" && method === "POST") return saveSession(body);
  if (path === "/api/routines" && method === "POST") return saveRoutine(body);
  const routineHistoryMatch = path.match(/^\/api\/routines\/([^/]+)\/history$/);
  if (routineHistoryMatch && method === "GET") return (await analyzer()).routineHistory(routineHistoryMatch[1]);
  const routineMatch = path.match(/^\/api\/routines\/([^/]+)$/);
  if (routineMatch && method === "DELETE") return archiveRoutine(routineMatch[1]);
  const exerciseMatch = path.match(/^\/api\/global-exercises\/([^/]+)\/history$/);
  if (exerciseMatch && method === "GET") return (await analyzer()).exerciseHistory(exerciseMatch[1]);
  throw new Error(`Rota não implementada: ${method} ${path}`);
}
