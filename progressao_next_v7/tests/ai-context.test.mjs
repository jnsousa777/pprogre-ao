import test from "node:test";
import assert from "node:assert/strict";
import { buildAiContext, matchRelevantExercises, matchRelevantRoutines } from "../public/static/ai-context.js";

const entry = (date, routine, position, best) => ({
  date, routine_name: routine, routine_id: routine === "Upper 1" ? "r1" : "r2", position,
  status: "performed", exercise_name: "Rosca Scott", muscle_group: "Bíceps", best_e1rm: best,
  volume: 500, sets: [{ set_number: 1, load: 50, reps: 8, rir: 0, e1rm: best }],
});

const data = {
  selected_date: "2026-08-04",
  selected_weekday_label: "Terça-feira",
  metrics: { attendance_pct: 90, attended: 9, scheduled: 10, missed: 1, tracked_exercises: 2 },
  routines: [
    { id: "r1", name: "Upper 1", weekday: "segunda", exercises: [{ name: "Rosca Scott", target_sets: 2, rep_min: 4, rep_max: 8 }] },
    { id: "r2", name: "Upper 2", weekday: "quinta", exercises: [{ name: "Rosca Scott", target_sets: 2, rep_min: 4, rep_max: 8 }] },
  ],
  progress: [
    { id: "g1", global_exercise_id: "g1", name: "Rosca Scott", muscle_group: "Bíceps", trend: "progressao", global_change_pct: 3, best_ever: 65, progress_streak: 2, routine_names: ["Upper 1", "Upper 2"], recent_global: [entry("2026-08-03", "Upper 1", 5, 65), entry("2026-07-31", "Upper 2", 8, 63)] },
    { id: "g2", global_exercise_id: "g2", name: "Pulley", muscle_group: "Tríceps", trend: "estavel", global_change_pct: 0, best_ever: 70, routine_names: ["Upper 1"] },
  ],
  session_progress: [],
};

test("seleciona exercício e rotina citados na pergunta", () => {
  assert.equal(matchRelevantExercises("Como está minha Scott no Upper 2?", data.progress)[0].name, "Rosca Scott");
  assert.equal(matchRelevantRoutines("Como está minha Scott no Upper 2?", data.routines)[0].name, "Upper 2");
});

test("contexto da IA preserva global, rotina e posição", async () => {
  const context = await buildAiContext({
    data,
    question: "Como está minha Rosca Scott no Upper 1 e Upper 2?",
    fetchExerciseHistory: async () => ({
      exercise: { name: "Rosca Scott", muscle_group: "Bíceps" }, best_ever: 65, contexts: [],
      history: [entry("2026-07-31", "Upper 2", 8, 63), entry("2026-08-03", "Upper 1", 5, 65)],
    }),
    fetchRoutineHistory: async id => ({ routine: { name: id === "r1" ? "Upper 1" : "Upper 2" }, history: [] }),
  });
  assert.equal(context.rules.skipped_is_not_regression, true);
  assert.equal(context.relevant_exercise_histories[0].history[0].position, 8);
  assert.equal(context.relevant_exercise_histories[0].history[1].routine, "Upper 1");
  assert.equal(context.exercise_signals.find(item => item.name === "Rosca Scott").routines.length, 2);
});
