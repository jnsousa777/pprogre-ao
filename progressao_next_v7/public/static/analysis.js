export const WEEKDAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
export const WEEKDAY_LABELS = {
  segunda: "Segunda-feira", terca: "Terça-feira", quarta: "Quarta-feira",
  quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado", domingo: "Domingo",
};

export function normalizeText(value) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function localIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function parseIsoDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(iso, amount) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + amount);
  return localIsoDate(date);
}

export function weekdayFromIso(iso) {
  const jsDay = parseIsoDate(iso).getDay();
  return WEEKDAYS[(jsDay + 6) % 7];
}

export function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return localIsoDate(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(1899, 11, 30, 12);
    excelEpoch.setDate(excelEpoch.getDate() + Math.trunc(value));
    return localIsoDate(excelEpoch);
  }
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Data vazia.");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (match) {
    let [, d, m, y] = match;
    if (y.length === 2) y = `20${y}`;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
    if (date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d)) {
      return localIsoDate(date);
    }
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.valueOf())) return localIsoDate(parsed);
  throw new Error(`Data inválida: ${raw}`);
}

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  let text = String(value).trim().toLowerCase().replace(/kg/g, "").replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else {
    text = text.replace(",", ".");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function e1rm(load, reps, rir = 0) {
  const weight = toNumber(load, 0);
  const repetitions = toNumber(reps, 0);
  const reserve = Math.max(toNumber(rir, 0), 0);
  if (weight <= 0 || repetitions <= 0) return 0;
  return weight * (1 + (repetitions + reserve) / 30);
}

export function classifyChange(changePct) {
  if (changePct === null || changePct === undefined || Number.isNaN(Number(changePct))) return "sem_base";
  if (changePct >= 2) return "progressao";
  if (changePct <= -2) return "regressao";
  return "estavel";
}

export function calculateChange(current, previous) {
  if (!current || !previous || Number(previous) <= 0) return null;
  return (Number(current) / Number(previous) - 1) * 100;
}

export function round(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function sortByDateAsc(a, b) {
  return String(a.date).localeCompare(String(b.date)) || String(a.session_id).localeCompare(String(b.session_id));
}

export function createAnalyzer(raw) {
  const routines = raw.routines || [];
  const routineExercises = raw.routine_exercises || [];
  const globalExercises = raw.global_exercises || [];
  const sessions = raw.sessions || [];
  const sessionExercises = raw.session_exercises || [];
  const sets = raw.sets || [];

  const routineById = new Map(routines.map(item => [item.id, item]));
  const routineExerciseById = new Map(routineExercises.map(item => [item.id, item]));
  const globalById = new Map(globalExercises.map(item => [item.id, item]));
  const sessionById = new Map(sessions.map(item => [item.id, item]));
  const setsBySessionExercise = new Map();
  for (const set of sets) {
    if (!setsBySessionExercise.has(set.session_exercise_id)) setsBySessionExercise.set(set.session_exercise_id, []);
    setsBySessionExercise.get(set.session_exercise_id).push(set);
  }
  for (const list of setsBySessionExercise.values()) list.sort((a, b) => Number(a.set_number) - Number(b.set_number));

  const entries = sessionExercises.map(row => {
    const session = sessionById.get(row.session_id);
    const routine = session ? routineById.get(session.routine_id) : null;
    const slot = row.routine_exercise_id ? routineExerciseById.get(row.routine_exercise_id) : null;
    const exercise = globalById.get(row.global_exercise_id);
    const setRows = (setsBySessionExercise.get(row.id) || []).map(set => ({
      set_number: Number(set.set_number),
      load: Number(set.load || 0),
      reps: Number(set.reps || 0),
      rir: set.rir === null || set.rir === undefined || set.rir === "" ? null : Number(set.rir),
      notes: set.notes || "",
      e1rm: round(e1rm(set.load, set.reps, set.rir), 2),
    }));
    const best = Math.max(0, ...setRows.map(item => item.e1rm || 0));
    return {
      id: row.id,
      session_id: row.session_id,
      routine_exercise_id: row.routine_exercise_id,
      global_exercise_id: row.global_exercise_id,
      exercise_id: row.routine_exercise_id,
      date: session?.session_date,
      routine_id: session?.routine_id,
      routine_name: routine?.name || "Treino",
      weekday: routine?.weekday,
      position: Number(row.position_index ?? slot?.order_index ?? 0) + 1,
      status: row.status,
      skip_reason: row.skip_reason || "",
      notes: row.notes || "",
      sets: setRows,
      best_e1rm: round(best, 2),
      volume: round(setRows.reduce((sum, item) => sum + item.load * item.reps, 0), 2),
      exercise_name: exercise?.name || slot?.name || "Exercício",
      muscle_group: exercise?.muscle_group || "",
      session_status: session?.status,
    };
  }).filter(item => item.date && item.routine_id);

  const entriesByGlobal = new Map();
  const entriesByRoutine = new Map();
  const entriesBySession = new Map();
  for (const entry of entries) {
    if (!entriesByGlobal.has(entry.global_exercise_id)) entriesByGlobal.set(entry.global_exercise_id, []);
    entriesByGlobal.get(entry.global_exercise_id).push(entry);
    if (!entriesByRoutine.has(entry.routine_id)) entriesByRoutine.set(entry.routine_id, []);
    entriesByRoutine.get(entry.routine_id).push(entry);
    if (!entriesBySession.has(entry.session_id)) entriesBySession.set(entry.session_id, []);
    entriesBySession.get(entry.session_id).push(entry);
  }
  for (const list of entriesByGlobal.values()) list.sort(sortByDateAsc);
  for (const list of entriesByRoutine.values()) list.sort(sortByDateAsc);

  function performedHistory(globalId, routineId = null) {
    return (entriesByGlobal.get(globalId) || []).filter(item => item.status === "performed" && item.best_e1rm > 0 && (!routineId || item.routine_id === routineId));
  }

  function recentGlobal(globalId, limit = 2) {
    return performedHistory(globalId).slice(-limit).reverse();
  }

  function recentRoutine(globalId, routineId, limit = 2) {
    return performedHistory(globalId, routineId).slice(-limit).reverse();
  }

  function comparisonsForEntry(entry) {
    if (!entry || entry.status !== "performed" || !entry.best_e1rm) {
      return { global_comparison: null, routine_comparison: null, is_pr: false };
    }
    const globalHistory = performedHistory(entry.global_exercise_id);
    const index = globalHistory.findIndex(item => item.id === entry.id);
    if (index < 0) return { global_comparison: null, routine_comparison: null, is_pr: false };
    const previousGlobal = index > 0 ? globalHistory[index - 1] : null;
    const previousRoutine = [...globalHistory.slice(0, index)].reverse().find(item => item.routine_id === entry.routine_id) || null;
    const priorBest = Math.max(0, ...globalHistory.slice(0, index).map(item => item.best_e1rm || 0));
    const comparison = previous => {
      if (!previous?.best_e1rm) return null;
      const change = calculateChange(entry.best_e1rm, previous.best_e1rm);
      return {
        previous_date: previous.date,
        previous_routine_name: previous.routine_name,
        change_pct: round(change, 2),
        trend: classifyChange(change),
      };
    };
    return {
      global_comparison: comparison(previousGlobal),
      routine_comparison: comparison(previousRoutine),
      is_pr: entry.best_e1rm > priorBest && priorBest > 0,
    };
  }

  function suggestion(slot, globalId, routineId) {
    const routineRecent = recentRoutine(globalId, routineId, 2);
    const globalRecent = recentGlobal(globalId, 2);
    const basis = routineRecent.length ? routineRecent : globalRecent;
    if (!basis.length) return "Registre a primeira sessão para gerar uma sugestão.";
    const latest = basis[0];
    const top = [...latest.sets].sort((a, b) => (b.e1rm - a.e1rm) || (b.load - a.load) || (b.reps - a.reps))[0];
    if (!top) return "Registre uma série válida para gerar uma sugestão.";
    const increment = Number(slot.load_increment || 2.5);
    const repMin = Number(slot.rep_min || 4);
    const repMax = Number(slot.rep_max || 8);
    const contextChange = routineRecent.length >= 2 ? calculateChange(routineRecent[0].best_e1rm, routineRecent[1].best_e1rm) : null;
    const globalChange = globalRecent.length >= 2 ? calculateChange(globalRecent[0].best_e1rm, globalRecent[1].best_e1rm) : null;
    const relevant = contextChange ?? globalChange;
    if (top.reps >= repMax && (top.rir === null || top.rir <= 1)) return `Boa hora para testar ${round(top.load + increment, 2)} kg mantendo ${repMin}–${repMax} reps.`;
    if (relevant !== null && relevant <= -4) return `Mantenha ${top.load} kg e tente recuperar reps antes de subir a carga.`;
    if (top.reps < repMin) return `Repita ou reduza levemente os ${top.load} kg até voltar à faixa mínima.`;
    return `Tente superar ${top.load} kg × ${top.reps} sem piorar o RIR.`;
  }

  function serializeRoutine(routine) {
    const exercises = routineExercises
      .filter(item => item.routine_id === routine.id && item.active !== false)
      .sort((a, b) => Number(a.order_index) - Number(b.order_index))
      .map(slot => {
        const exercise = globalById.get(slot.global_exercise_id) || {};
        return {
          ...slot,
          name: exercise.name || slot.name || "Exercício",
          muscle_group: slot.muscle_group || exercise.muscle_group || "",
          global_exercise_id: slot.global_exercise_id,
        };
      });
    return {
      ...routine,
      weekday_label: WEEKDAY_LABELS[routine.weekday] || routine.weekday,
      active: routine.active !== false,
      exercises,
    };
  }

  function sessionHistory(routineId, limit = 60) {
    const list = sessions
      .filter(session => session.routine_id === routineId && ["completed", "partial"].includes(session.status))
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
      .slice(-limit);
    const history = [];
    let previous = null;
    for (const session of list) {
      const sessionEntries = (entriesBySession.get(session.id) || [])
        .sort((a, b) => a.position - b.position)
        .map(item => ({ ...item, ...comparisonsForEntry(item) }));
      const currentPerformed = new Map(sessionEntries.filter(item => item.status === "performed" && item.best_e1rm > 0).map(item => [item.global_exercise_id, item]));
      let comparison = null;
      if (previous) {
        const previousEntries = new Map(previous.exercises.filter(item => item.status === "performed" && item.best_e1rm > 0).map(item => [item.global_exercise_id, item]));
        const changes = [];
        let progressed = 0, stable = 0, regressed = 0;
        for (const [globalId, current] of currentPerformed) {
          const before = previousEntries.get(globalId);
          if (!before?.best_e1rm) continue;
          const change = calculateChange(current.best_e1rm, before.best_e1rm);
          changes.push(change);
          const trend = classifyChange(change);
          if (trend === "progressao") progressed += 1;
          else if (trend === "regressao") regressed += 1;
          else stable += 1;
        }
        const average = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : null;
        comparison = {
          previous_date: previous.date,
          change_pct: round(average, 2),
          trend: classifyChange(average),
          comparable_exercises: changes.length,
          progressed, stable, regressed,
        };
      }
      const item = {
        session_id: session.id,
        date: session.session_date,
        status: session.status,
        notes: session.notes || "",
        exercises: sessionEntries,
        performed: sessionEntries.filter(item => item.status === "performed").length,
        skipped: sessionEntries.filter(item => item.status === "skipped").length,
        volume: round(sessionEntries.reduce((sum, item) => sum + item.volume, 0), 2),
        comparison,
      };
      history.push(item);
      previous = item;
    }
    return history;
  }

  function globalExerciseSummary(exercise) {
    const recent = recentGlobal(exercise.id, 2);
    const change = recent.length >= 2 ? calculateChange(recent[0].best_e1rm, recent[1].best_e1rm) : null;
    const exerciseEntries = entriesByGlobal.get(exercise.id) || [];
    const slots = routineExercises.filter(slot => slot.global_exercise_id === exercise.id);
    const routineIds = [...new Set([
      ...slots.map(slot => slot.routine_id),
      ...exerciseEntries.map(entry => entry.routine_id),
    ])];
    const contexts = routineIds.map(routineId => {
      const routine = routineById.get(routineId);
      const contextRecent = recentRoutine(exercise.id, routineId, 2);
      const contextChange = contextRecent.length >= 2 ? calculateChange(contextRecent[0].best_e1rm, contextRecent[1].best_e1rm) : null;
      const contextAll = exerciseEntries.filter(entry => entry.routine_id === routineId);
      const currentSlot = slots
        .filter(slot => slot.routine_id === routineId && slot.active !== false)
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))[0];
      const historicalSlot = slots.find(slot => slot.routine_id === routineId);
      const latestEntry = contextAll.at(-1);
      return {
        exercise_id: currentSlot?.id || historicalSlot?.id || latestEntry?.routine_exercise_id || null,
        routine_id: routineId,
        routine_name: routine?.name || latestEntry?.routine_name || "Treino",
        weekday: routine?.weekday || latestEntry?.weekday,
        position: currentSlot ? Number(currentSlot.order_index) + 1 : (latestEntry?.position || Number(historicalSlot?.order_index || 0) + 1),
        active: Boolean(currentSlot && routine?.active !== false),
        recent: contextRecent,
        performed: contextAll.filter(item => item.status === "performed" && item.best_e1rm > 0).length,
        skipped: contextAll.filter(item => item.status === "skipped").length,
        change_pct: round(contextChange, 2),
        trend: classifyChange(contextChange),
      };
    }).sort((a, b) => String(a.routine_name).localeCompare(String(b.routine_name), "pt-BR") || Number(a.position) - Number(b.position));
    const performed = performedHistory(exercise.id);
    const bestEntry = performed.reduce((best, item) => !best || item.best_e1rm > best.best_e1rm ? item : best, null);
    let progressStreak = 0;
    for (let index = performed.length - 1; index > 0; index -= 1) {
      const step = calculateChange(performed[index].best_e1rm, performed[index - 1].best_e1rm);
      if (step !== null && step >= 2) progressStreak += 1;
      else break;
    }
    return {
      id: exercise.id,
      global_exercise_id: exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group || "",
      recent,
      recent_global: recent,
      change_pct: round(change, 2),
      global_change_pct: round(change, 2),
      trend: classifyChange(change),
      best_ever: round(bestEntry?.best_e1rm || 0, 2),
      best_entry: bestEntry,
      progress_streak: progressStreak,
      contexts,
      routine_names: [...new Set(contexts.map(item => item.routine_name))],
    };
  }

  function exerciseHistory(globalId) {
    const exercise = globalById.get(globalId);
    if (!exercise) throw new Error("Exercício não encontrado.");
    const source = [...(entriesByGlobal.get(globalId) || [])].sort(sortByDateAsc);
    const history = [];
    let previousGlobal = null;
    const previousByRoutine = new Map();
    let bestEver = 0;
    for (const original of source) {
      const item = { ...original, global_comparison: null, routine_comparison: null };
      bestEver = Math.max(bestEver, item.best_e1rm || 0);
      if (item.status === "performed" && item.best_e1rm > 0) {
        if (previousGlobal?.best_e1rm) {
          const change = calculateChange(item.best_e1rm, previousGlobal.best_e1rm);
          item.global_comparison = {
            previous_date: previousGlobal.date,
            previous_routine_name: previousGlobal.routine_name,
            change_pct: round(change, 2),
            trend: classifyChange(change),
          };
        }
        const previousContext = previousByRoutine.get(item.routine_id);
        if (previousContext?.best_e1rm) {
          const change = calculateChange(item.best_e1rm, previousContext.best_e1rm);
          item.routine_comparison = {
            previous_date: previousContext.date,
            change_pct: round(change, 2),
            trend: classifyChange(change),
          };
        }
        previousGlobal = item;
        previousByRoutine.set(item.routine_id, item);
      }
      history.push(item);
    }
    const contexts = [];
    for (const routineId of [...new Set(history.map(item => item.routine_id))]) {
      const all = history.filter(item => item.routine_id === routineId);
      const performed = all.filter(item => item.status === "performed" && item.best_e1rm > 0);
      const latest = all.at(-1);
      const change = performed.length >= 2 ? calculateChange(performed.at(-1).best_e1rm, performed.at(-2).best_e1rm) : null;
      contexts.push({
        routine_id: routineId,
        routine_name: latest?.routine_name || routineById.get(routineId)?.name || "Treino",
        position: latest?.position || 1,
        performed: performed.length,
        skipped: all.filter(item => item.status === "skipped").length,
        change_pct: round(change, 2),
        trend: classifyChange(change),
        latest: performed.at(-1) || null,
      });
    }
    return { exercise, history, contexts, best_ever: round(bestEver, 2) };
  }

  function scheduledOccurrences(startIso, endIso, activeRoutines) {
    const occurrences = [];
    for (const routine of activeRoutines) {
      const start = String(routine.start_date) > startIso ? String(routine.start_date) : startIso;
      for (let day = start; day <= endIso; day = addDays(day, 1)) {
        if (weekdayFromIso(day) === routine.weekday) occurrences.push({ routine_id: routine.id, date: day, routine_name: routine.name });
      }
    }
    return occurrences;
  }

  function bootstrap(selectedDate) {
    const todayIso = localIsoDate();
    const selectedWeekday = weekdayFromIso(selectedDate);
    const activeRoutines = routines.filter(item => item.active !== false && String(item.start_date) <= selectedDate);
    const todayRoutines = activeRoutines.filter(item => item.weekday === selectedWeekday).map(routine => {
      const serialized = serializeRoutine(routine);
      const session = sessions.find(item => item.routine_id === routine.id && item.session_date === selectedDate) || null;
      const sessionEntryList = session ? (entriesBySession.get(session.id) || []) : [];
      return {
        ...serialized,
        session,
        exercises: serialized.exercises.map(slot => {
          const global = globalById.get(slot.global_exercise_id) || {};
          const current = sessionEntryList.find(item => item.global_exercise_id === slot.global_exercise_id) || null;
          const summary = global.id ? globalExerciseSummary(global) : null;
          return {
            ...slot,
            name: global.name || slot.name,
            muscle_group: slot.muscle_group || global.muscle_group || "",
            current_sets: current?.sets || [],
            current_status: current?.status || null,
            skip_reason: current?.skip_reason || "",
            recent: recentGlobal(slot.global_exercise_id, 2),
            recent_global: recentGlobal(slot.global_exercise_id, 2),
            recent_routine: recentRoutine(slot.global_exercise_id, routine.id, 2),
            best_ever: summary?.best_ever || 0,
            best_entry: summary?.best_entry || null,
            trend: summary?.trend || "sem_base",
            global_change_pct: summary?.global_change_pct ?? null,
            progress_streak: summary?.progress_streak || 0,
            suggestion: suggestion(slot, slot.global_exercise_id, routine.id),
          };
        }),
      };
    });

    const metricStart = addDays(todayIso, -29);
    const metricYesterday = addDays(todayIso, -1);
    const activeForMetrics = routines.filter(item => item.active !== false && String(item.start_date) <= todayIso);
    const scheduledPast = metricYesterday >= metricStart ? scheduledOccurrences(metricStart, metricYesterday, activeForMetrics) : [];
    const scheduledToday = scheduledOccurrences(todayIso, todayIso, activeForMetrics);
    const recordedToday = scheduledToday.filter(item => sessions.some(session => session.routine_id === item.routine_id && session.session_date === todayIso));
    const scheduled = [...scheduledPast, ...recordedToday];
    const attendedKeys = new Set(sessions.filter(item => item.session_date >= metricStart && item.session_date <= todayIso && ["completed", "partial"].includes(item.status)).map(item => `${item.routine_id}:${item.session_date}`));
    const attended = scheduled.filter(item => attendedKeys.has(`${item.routine_id}:${item.date}`)).length;
    const missed = Math.max(scheduled.length - attended, 0);
    const tracked = globalExercises.filter(item => performedHistory(item.id).length > 0).length;

    const calendarStart = addDays(selectedDate, -34);
    const calendar = [];
    const calendarRoutines = routines.filter(item => item.active !== false && String(item.start_date) <= selectedDate);
    const calendarScheduled = scheduledOccurrences(calendarStart, selectedDate, calendarRoutines);
    for (const scheduledItem of calendarScheduled) {
      const session = sessions.find(item => item.routine_id === scheduledItem.routine_id && item.session_date === scheduledItem.date);
      const past = scheduledItem.date < todayIso;
      calendar.push({
        session_date: scheduledItem.date,
        routine_id: scheduledItem.routine_id,
        routine_name: scheduledItem.routine_name,
        status: session?.status || (past ? "missed" : "pending"),
      });
    }

    const progress = globalExercises.map(globalExerciseSummary).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const sessionProgress = routines.filter(item => item.active !== false).map(routine => {
      const history = sessionHistory(routine.id, 30);
      return {
        routine_id: routine.id,
        routine_name: routine.name,
        weekday: routine.weekday,
        weekday_label: WEEKDAY_LABELS[routine.weekday] || routine.weekday,
        latest: history.at(-1) || null,
      };
    });

    return {
      selected_date: selectedDate,
      selected_weekday: selectedWeekday,
      selected_weekday_label: WEEKDAY_LABELS[selectedWeekday],
      today_routines: todayRoutines,
      metrics: {
        attendance_pct: scheduled.length ? round(attended / scheduled.length * 100, 1) : 100,
        attended,
        scheduled: scheduled.length,
        missed,
        tracked_exercises: tracked,
      },
      calendar,
      progress,
      session_progress: sessionProgress,
      routines: routines.filter(item => item.active !== false).map(serializeRoutine).sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday)),
      exercise_catalog: [...globalExercises].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    };
  }

  return {
    bootstrap,
    exerciseHistory,
    routineHistory: routineId => ({ routine: routineById.get(routineId), history: sessionHistory(routineId, 60) }),
    recentGlobal,
    recentRoutine,
    serializeRoutine,
    entries,
  };
}
