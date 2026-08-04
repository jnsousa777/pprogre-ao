import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyzer, e1rm, classifyChange } from '../public/static/analysis.js';

const raw = {
  routines: [
    { id: 'r1', name: 'Upper 1', weekday: 'segunda', start_date: '2026-07-01', active: true },
    { id: 'r2', name: 'Upper 2', weekday: 'quinta', start_date: '2026-07-01', active: true },
  ],
  global_exercises: [
    { id: 'g1', name: 'Rosca Scott', normalized_name: 'rosca scott', muscle_group: 'Bíceps' },
    { id: 'g2', name: 'Pulley', normalized_name: 'pulley', muscle_group: 'Tríceps' },
  ],
  routine_exercises: [
    { id: 're1', routine_id: 'r1', global_exercise_id: 'g1', order_index: 4, target_sets: 2, rep_min: 4, rep_max: 8, load_increment: 2.5, active: true },
    { id: 're2', routine_id: 'r2', global_exercise_id: 'g1', order_index: 7, target_sets: 2, rep_min: 4, rep_max: 8, load_increment: 2.5, active: true },
    { id: 're3', routine_id: 'r1', global_exercise_id: 'g2', order_index: 5, target_sets: 2, rep_min: 4, rep_max: 8, load_increment: 2.5, active: true },
  ],
  sessions: [
    { id: 's1', routine_id: 'r1', session_date: '2026-07-27', status: 'completed' },
    { id: 's2', routine_id: 'r2', session_date: '2026-07-30', status: 'completed' },
    { id: 'sSkip', routine_id: 'r2', session_date: '2026-08-01', status: 'partial' },
    { id: 's3', routine_id: 'r1', session_date: '2026-08-03', status: 'completed' },
  ],
  session_exercises: [
    { id: 'se1', session_id: 's1', routine_exercise_id: 're1', global_exercise_id: 'g1', status: 'performed', position_index: 4 },
    { id: 'se2', session_id: 's2', routine_exercise_id: 're2', global_exercise_id: 'g1', status: 'performed', position_index: 7 },
    { id: 'seSkip', session_id: 'sSkip', routine_exercise_id: 're2', global_exercise_id: 'g1', status: 'skipped', skip_reason: 'Dor', position_index: 7 },
    { id: 'se3', session_id: 's3', routine_exercise_id: 're1', global_exercise_id: 'g1', status: 'performed', position_index: 4 },
    { id: 'seP1', session_id: 's1', routine_exercise_id: 're3', global_exercise_id: 'g2', status: 'performed', position_index: 5 },
    { id: 'seP3', session_id: 's3', routine_exercise_id: 're3', global_exercise_id: 'g2', status: 'performed', position_index: 5 },
  ],
  sets: [
    { id: 'a', session_exercise_id: 'se1', set_number: 1, load: 50, reps: 7, rir: 0 },
    { id: 'b', session_exercise_id: 'se2', set_number: 1, load: 50, reps: 8, rir: 0 },
    { id: 'c', session_exercise_id: 'se3', set_number: 1, load: 52.5, reps: 5, rir: 0 },
    { id: 'd', session_exercise_id: 'seP1', set_number: 1, load: 50, reps: 5, rir: 0 },
    { id: 'e', session_exercise_id: 'seP3', set_number: 1, load: 50, reps: 7, rir: 0 },
  ],
};

test('e1RM considera carga, reps e RIR', () => {
  assert.equal(Number(e1rm(100, 6, 0).toFixed(2)), 120);
  assert.equal(Number(e1rm(100, 6, 2).toFixed(2)), 126.67);
  assert.equal(classifyChange(2), 'progressao');
  assert.equal(classifyChange(-2), 'regressao');
});

test('histórico global cruza Upper 1 e Upper 2 e ignora exercício pulado', () => {
  const analyzer = createAnalyzer(raw);
  const page = analyzer.exerciseHistory('g1');
  const performed = page.history.filter(item => item.status === 'performed');
  assert.equal(performed.length, 3);
  assert.equal(performed[2].global_comparison.previous_date, '2026-07-30');
  assert.equal(performed[2].global_comparison.previous_routine_name, 'Upper 2');
  assert.equal(performed[2].routine_comparison.previous_date, '2026-07-27');
  assert.equal(page.history.find(item => item.status === 'skipped').skip_reason, 'Dor');
});

test('treino do dia mostra base global e base do mesmo treino separadamente', () => {
  const analyzer = createAnalyzer(raw);
  const data = analyzer.bootstrap('2026-08-03');
  const scott = data.today_routines[0].exercises.find(item => item.global_exercise_id === 'g1');
  assert.equal(scott.recent_global[0].date, '2026-08-03');
  assert.equal(scott.recent_global[1].date, '2026-07-30');
  assert.equal(scott.recent_routine[0].date, '2026-08-03');
  assert.equal(scott.recent_routine[1].date, '2026-07-27');
  assert.equal(scott.recent_global[1].position, 8);
  assert.equal(scott.recent_routine[1].position, 5);
});

test('comparação de sessão continua Upper 1 contra Upper 1', () => {
  const analyzer = createAnalyzer(raw);
  const history = analyzer.routineHistory('r1').history;
  const latest = history.at(-1);
  assert.equal(latest.comparison.previous_date, '2026-07-27');
  assert.equal(latest.comparison.comparable_exercises, 2);
  assert.equal(latest.comparison.progressed, 1); // pulley
  assert.equal(latest.comparison.stable, 1); // scott no mesmo treino
});

import { parseDateValue } from "../public/static/analysis.js";
import { autoMap } from "../public/static/importer.js";

test("datas brasileiras e números decimais são normalizados", () => {
  assert.equal(parseDateValue("04/08/2026"), "2026-08-04");
});

test("mapeamento reconhece colunas comuns da planilha", () => {
  const mapping = autoMap(["Data do treino", "Ficha", "Exercício", "Carga_kg", "Repetições", "RIR"]);
  assert.equal(mapping.date, "Data do treino");
  assert.equal(mapping.workout, "Ficha");
  assert.equal(mapping.exercise, "Exercício");
  assert.equal(mapping.load, "Carga_kg");
  assert.equal(mapping.reps, "Repetições");
  assert.equal(mapping.rir, "RIR");
});

import { localIsoDate, weekdayFromIso } from "../public/static/analysis.js";

test("treino pendente de hoje não vira falta antes do dia acabar", () => {
  const today = localIsoDate();
  const raw = {
    routines: [{ id: "rt", name: "Hoje", weekday: weekdayFromIso(today), start_date: today, active: true }],
    global_exercises: [], routine_exercises: [], sessions: [], session_exercises: [], sets: [],
  };
  const dashboard = createAnalyzer(raw).bootstrap(today);
  assert.equal(dashboard.metrics.scheduled, 0);
  assert.equal(dashboard.metrics.missed, 0);
  assert.equal(dashboard.calendar.at(-1).status, "pending");
});

test("exercício substituído mantém o contexto histórico", () => {
  const raw = {
    routines: [{ id: "u1", name: "Upper 1", weekday: "segunda", start_date: "2026-01-01", active: true }],
    global_exercises: [
      { id: "scott", name: "Rosca Scott", normalized_name: "rosca scott" },
      { id: "martelo", name: "Rosca Martelo", normalized_name: "rosca martelo" },
    ],
    routine_exercises: [
      { id: "slot", routine_id: "u1", global_exercise_id: "martelo", order_index: 4, active: true, target_sets: 2, rep_min: 4, rep_max: 8 },
    ],
    sessions: [{ id: "s1", routine_id: "u1", session_date: "2026-07-01", status: "completed" }],
    session_exercises: [{ id: "se1", session_id: "s1", routine_exercise_id: "slot", global_exercise_id: "scott", status: "performed", position_index: 4 }],
    sets: [{ id: "set1", session_exercise_id: "se1", set_number: 1, load: 40, reps: 8, rir: 0 }],
  };
  const dashboard = createAnalyzer(raw).bootstrap("2026-07-06");
  const scott = dashboard.progress.find(item => item.id === "scott");
  assert.deepEqual(scott.routine_names, ["Upper 1"]);
  assert.equal(scott.contexts[0].position, 5);
  assert.equal(scott.contexts[0].active, false);
});

test('treino do dia entrega melhor marca e tendência para o modo academia', () => {
  const analyzer = createAnalyzer(raw);
  const data = analyzer.bootstrap('2026-08-04');
  const progress = data.progress.find(item => item.id === 'g1');
  assert.equal(progress.best_entry.routine_name, 'Upper 2');
  assert.equal(progress.best_ever, 63.33);
  assert.equal(progress.trend, 'regressao');
});

test('resumo pós-treino traz comparação individual e marca PR', () => {
  const analyzer = createAnalyzer(raw);
  const latest = analyzer.routineHistory('r1').history.at(-1);
  const pulley = latest.exercises.find(item => item.global_exercise_id === 'g2');
  const scott = latest.exercises.find(item => item.global_exercise_id === 'g1');
  assert.equal(pulley.is_pr, true);
  assert.equal(pulley.routine_comparison.trend, 'progressao');
  assert.equal(scott.global_comparison.previous_routine_name, 'Upper 2');
  assert.equal(scott.routine_comparison.previous_date, '2026-07-27');
});
