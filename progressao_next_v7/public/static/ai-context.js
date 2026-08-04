import { normalizeText } from "./analysis.js";

function compactSet(set) {
  return {
    n: Number(set?.set_number || 0),
    kg: Number(set?.load || 0),
    reps: Number(set?.reps || 0),
    rir: set?.rir === null || set?.rir === undefined || set?.rir === "" ? null : Number(set.rir),
    e1rm: Number(set?.e1rm || 0),
  };
}

export function compactEntry(entry) {
  if (!entry) return null;
  return {
    date: entry.date,
    routine: entry.routine_name,
    routine_id: entry.routine_id,
    position: Number(entry.position || 0),
    status: entry.status,
    skip_reason: entry.skip_reason || "",
    exercise: entry.exercise_name,
    muscle_group: entry.muscle_group || "",
    best_e1rm: Number(entry.best_e1rm || 0),
    volume: Number(entry.volume || 0),
    sets: (entry.sets || []).slice(0, 12).map(compactSet),
    global_comparison: entry.global_comparison || null,
    routine_comparison: entry.routine_comparison || null,
    is_pr: Boolean(entry.is_pr),
  };
}

function queryTokens(value) {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(token => token.length >= 3);
}

function scoreLabel(question, label, extra = "") {
  const q = normalizeText(question);
  const normalized = normalizeText(label);
  const tokens = queryTokens(question);
  const labelTokens = queryTokens(label);
  let score = 0;
  if (normalized && q.includes(normalized)) score += 100;
  if (labelTokens.length && labelTokens.every(token => q.includes(token))) score += 45;
  for (const token of tokens) if (labelTokens.includes(token)) score += 8;
  const normalizedExtra = normalizeText(extra);
  if (normalizedExtra && q.includes(normalizedExtra)) score += 25;
  return score;
}

export function matchRelevantExercises(question, progress = [], limit = 5) {
  return progress
    .map(item => ({ item, score: scoreLabel(question, item.name, item.muscle_group) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name), "pt-BR"))
    .slice(0, limit)
    .map(result => result.item);
}

export function matchRelevantRoutines(question, routines = [], limit = 3) {
  return routines
    .map(item => ({ item, score: scoreLabel(question, item.name, item.weekday_label || item.weekday) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.item);
}

function compactProgress(item) {
  return {
    id: item.global_exercise_id || item.id,
    name: item.name,
    muscle_group: item.muscle_group || "",
    global_change_pct: item.global_change_pct ?? null,
    trend: item.trend,
    best_ever_e1rm: Number(item.best_ever || 0),
    progress_streak: Number(item.progress_streak || 0),
    routines: item.routine_names || [],
    latest_global: compactEntry(item.recent_global?.[0] || item.recent?.[0]),
    previous_global: compactEntry(item.recent_global?.[1] || item.recent?.[1]),
    contexts: (item.contexts || []).map(context => ({
      routine: context.routine_name,
      routine_id: context.routine_id,
      position: context.position,
      performed: context.performed,
      skipped: context.skipped,
      change_pct: context.change_pct,
      trend: context.trend,
      latest: compactEntry(context.recent?.[0] || context.latest),
    })),
  };
}

function compactSessionLatest(item) {
  const latest = item?.latest;
  if (!latest) return { routine: item.routine_name, weekday: item.weekday_label || item.weekday, latest: null };
  return {
    routine: item.routine_name,
    routine_id: item.routine_id,
    weekday: item.weekday_label || item.weekday,
    latest: {
      date: latest.date,
      status: latest.status,
      performed: latest.performed,
      skipped: latest.skipped,
      total_volume: latest.total_volume,
      comparison: latest.comparison || null,
      exercises: (latest.exercises || []).map(compactEntry),
    },
  };
}

export async function buildAiContext({ data, question = "", workout = null, fetchExerciseHistory, fetchRoutineHistory }) {
  if (!data) throw new Error("Os dados do treino ainda não carregaram.");
  const matchedExercises = matchRelevantExercises(question, data.progress || []);
  const matchedRoutines = matchRelevantRoutines(question, data.routines || []);

  const exerciseHistories = [];
  if (fetchExerciseHistory) {
    for (const exercise of matchedExercises) {
      try {
        const historyData = await fetchExerciseHistory(exercise.global_exercise_id || exercise.id);
        exerciseHistories.push({
          exercise: historyData.exercise?.name || exercise.name,
          muscle_group: historyData.exercise?.muscle_group || exercise.muscle_group || "",
          best_ever_e1rm: historyData.best_ever,
          contexts: historyData.contexts || [],
          history: (historyData.history || []).slice(-40).map(compactEntry),
        });
      } catch (_) { /* um histórico específico não deve derrubar o chat */ }
    }
  }

  const routineHistories = [];
  if (fetchRoutineHistory) {
    for (const routine of matchedRoutines) {
      try {
        const historyData = await fetchRoutineHistory(routine.id);
        routineHistories.push({
          routine: historyData.routine?.name || routine.name,
          history: (historyData.history || []).slice(-20).map(session => ({
            date: session.date,
            status: session.status,
            performed: session.performed,
            skipped: session.skipped,
            total_volume: session.total_volume,
            comparison: session.comparison || null,
            exercises: (session.exercises || []).map(compactEntry),
          })),
        });
      } catch (_) { /* idem */ }
    }
  }

  const allProgress = (data.progress || []).map(compactProgress);
  const orderedSignals = [...allProgress].sort((a, b) => {
    const absA = Math.abs(Number(a.global_change_pct || 0));
    const absB = Math.abs(Number(b.global_change_pct || 0));
    return absB - absA;
  });

  return {
    generated_at: new Date().toISOString(),
    selected_date: data.selected_date,
    selected_weekday: data.selected_weekday_label,
    metrics_30_days: data.metrics,
    rules: {
      skipped_is_not_regression: true,
      global_exercise_history_crosses_routines: true,
      same_routine_comparison_is_preserved: true,
      position_is_fatigue_context_not_causal_proof: true,
      e1rm_is_estimate: true,
    },
    routines: (data.routines || []).map(routine => ({
      id: routine.id,
      name: routine.name,
      weekday: routine.weekday_label || routine.weekday,
      exercises: (routine.exercises || []).map((exercise, index) => ({
        name: exercise.name,
        muscle_group: exercise.muscle_group || "",
        position: index + 1,
        target_sets: exercise.target_sets,
        rep_range: [exercise.rep_min, exercise.rep_max],
      })),
    })),
    latest_sessions: (data.session_progress || []).map(compactSessionLatest),
    exercise_signals: orderedSignals.slice(0, 50),
    relevant_exercise_histories: exerciseHistories,
    relevant_routine_histories: routineHistories,
    workout_just_completed: workout ? {
      routine: workout.routine_name,
      routine_id: workout.routine_id,
      date: workout.date,
      status: workout.status,
      performed: workout.performed,
      skipped: workout.skipped,
      total_volume: workout.total_volume,
      comparison: workout.comparison || null,
      exercises: (workout.exercises || []).map(compactEntry),
    } : null,
  };
}
