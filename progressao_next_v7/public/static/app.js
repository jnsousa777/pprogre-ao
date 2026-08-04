import { cloudApi, loadCloudConfig, saveCloudConfig, clearCloudConfig, initializeCloud, getSession, getAccessToken, signIn, signUp, signOut, updatePassword, sendPasswordReset, onAuthStateChange, exportCsv, importRows, loadDataset } from "./cloud-api.js";
import { inspectSpreadsheet, selectSheet } from "./importer.js";
import { buildAiContext } from "./ai-context.js";

const state = {
  data: null,
  selectedDate: (() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })(),
  import: null,
  gym: null,
  saving: false,
  ai: {
    enabled: null,
    model: null,
    dailyLimit: null,
    mode: localStorage.getItem("progressao_ai_mode") === "analyst" ? "analyst" : "coach",
    autoWorkout: localStorage.getItem("progressao_ai_auto") !== "false",
    messages: [],
    busy: false,
    lastWorkout: null,
  },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtNumber(value, max = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: max });
}

function fmtDate(value, options = {}) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(y, m - 1, d));
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = "toast", 3300);
}

async function api(url, options = {}) {
  return cloudApi(url, options);
}


function aiResultHtml(result, compact = false) {
  const highlights = (result?.highlights || []).filter(Boolean);
  const attention = (result?.attention || []).filter(Boolean);
  const main = result?.answer || result?.summary || "Análise concluída.";
  if (compact) {
    return `<p>${escapeHtml(result?.summary || main)}</p>
      ${highlights.length ? `<ul>${highlights.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${attention.length ? `<ul class="attention">${attention.slice(0, 2).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${result?.recommendation ? `<div class="ai-result-recommendation">${escapeHtml(result.recommendation)}</div>` : ""}
      ${result?.confidence_note ? `<small class="ai-confidence">${escapeHtml(result.confidence_note)}</small>` : ""}`;
  }
  return `<p>${escapeHtml(main)}</p>
    ${highlights.length ? `<div class="ai-result-section"><strong>Destaques</strong><ul class="ai-result-list">${highlights.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${attention.length ? `<div class="ai-result-section"><strong>Pontos de atenção</strong><ul class="ai-result-list">${attention.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${result?.recommendation ? `<div class="ai-result-recommendation"><strong>Próxima decisão:</strong> ${escapeHtml(result.recommendation)}</div>` : ""}
    ${result?.confidence_note ? `<small class="ai-confidence">${escapeHtml(result.confidence_note)}</small>` : ""}`;
}

function renderAiStatus() {
  const status = $("#aiStatus");
  const settingsStatus = $("#settingsAiStatus");
  const model = $("#settingsAiModel");
  if (!status) return;
  if (state.ai.enabled === null) {
    status.className = "ai-status";
    status.innerHTML = "<i></i><span>Verificando configuração…</span>";
    if (settingsStatus) { settingsStatus.textContent = "Verificando"; settingsStatus.className = "status-pill"; }
  } else if (state.ai.enabled) {
    status.className = "ai-status ready";
    status.innerHTML = `<i></i><span>Online · ${escapeHtml(state.ai.model || "OpenAI")}</span>`;
    if (settingsStatus) { settingsStatus.textContent = "Online"; settingsStatus.className = "status-pill completed"; }
  } else {
    status.className = "ai-status offline";
    status.innerHTML = "<i></i><span>Falta configurar OPENAI_API_KEY</span>";
    if (settingsStatus) { settingsStatus.textContent = "Não configurada"; settingsStatus.className = "status-pill missed"; }
  }
  if (model) model.textContent = state.ai.model || "Não configurado";
  const send = $("#aiSend");
  if (send) send.disabled = !state.ai.enabled || state.ai.busy;
}

async function checkAiStatus() {
  try {
    const response = await fetch("/api/ai/status", { cache: "no-store" });
    const data = await response.json();
    state.ai.enabled = Boolean(data.enabled);
    state.ai.model = data.model || null;
    state.ai.dailyLimit = data.dailyLimit || null;
  } catch (_) {
    state.ai.enabled = false;
    state.ai.model = null;
  }
  renderAiStatus();
  return state.ai.enabled;
}

function setAiMode(mode) {
  state.ai.mode = mode === "analyst" ? "analyst" : "coach";
  localStorage.setItem("progressao_ai_mode", state.ai.mode);
  $$('[data-ai-mode]').forEach(button => button.classList.toggle("active", button.dataset.aiMode === state.ai.mode));
}

function appendAiMessage(role, { text = "", result = null, thinking = false } = {}) {
  const host = $("#aiMessages");
  const article = document.createElement("article");
  article.className = `ai-message ${role}${thinking ? " ai-thinking" : ""}`;
  if (thinking) article.id = "aiThinkingMessage";
  const label = role === "user" ? "Você" : "IA do Progressão";
  const avatar = role === "user" ? "J" : "✦";
  article.innerHTML = `<div class="ai-avatar">${avatar}</div><div><strong>${label}</strong>${result ? aiResultHtml(result) : `<p>${escapeHtml(text)}</p>`}</div>`;
  host.appendChild(article);
  host.scrollTop = host.scrollHeight;
  return article;
}

async function collectAiContext(question, workout = null) {
  return buildAiContext({
    data: state.data,
    question,
    workout,
    fetchExerciseHistory: id => api(`/api/global-exercises/${id}/history`),
    fetchRoutineHistory: id => api(`/api/routines/${id}/history`),
  });
}

async function callAi({ task = "chat", question = "", workout = null }) {
  if (state.ai.enabled === null) await checkAiStatus();
  if (!state.ai.enabled) throw new Error("Adicione OPENAI_API_KEY nas variáveis do Vercel para ativar a IA.");
  const token = await getAccessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const context = await collectAiContext(question, workout);
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      task,
      mode: state.ai.mode,
      question,
      context,
      conversation: state.ai.messages.slice(-8),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível gerar a análise.");
  return data;
}

async function submitAiQuestion(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  if (!question || state.ai.busy) return;
  state.ai.busy = true;
  renderAiStatus();
  appendAiMessage("user", { text: question });
  state.ai.messages.push({ role: "user", text: question });
  const thinking = appendAiMessage("assistant", { text: "Cruzando as sessões e os exercícios relevantes…", thinking: true });
  try {
    const data = await callAi({ task: "chat", question });
    thinking.remove();
    appendAiMessage("assistant", { result: data.result });
    state.ai.messages.push({ role: "assistant", text: data.result.answer || data.result.summary || "Análise concluída." });
  } catch (error) {
    thinking.remove();
    appendAiMessage("assistant", { text: `Não consegui analisar agora: ${error.message}` });
  } finally {
    state.ai.busy = false;
    renderAiStatus();
    const input = $("#aiQuestion");
    if (input) input.value = "";
  }
}

async function runWorkoutAiAnalysis() {
  const host = $("#workoutAiContent");
  const title = $("#workoutAiTitle");
  if (!state.ai.lastWorkout || !host) return;
  host.innerHTML = `<p class="ai-thinking">Cruzando esta sessão com a rotina anterior e o histórico global…</p>`;
  title.textContent = "Analisando sessão";
  const button = $("#retryWorkoutAi");
  if (button) button.disabled = true;
  try {
    const data = await callAi({
      task: "post_workout",
      question: `Analise meu ${state.ai.lastWorkout.routine_name} concluído em ${state.ai.lastWorkout.date}.`,
      workout: state.ai.lastWorkout,
    });
    title.textContent = data.result.title || "Leitura da sessão";
    host.innerHTML = aiResultHtml(data.result, true);
  } catch (error) {
    title.textContent = "IA indisponível";
    host.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadDashboard() {
  try {
    state.data = await api(`/api/bootstrap?date=${state.selectedDate}`);
    renderAll();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAll() {
  const data = state.data;
  $("#selectedDate").value = data.selected_date;
  $("#dateEyebrow").textContent = data.selected_weekday_label.toUpperCase();
  renderMetrics();
  renderToday();
  renderInsights();
  renderCalendar();
  renderSessionProgress();
  renderProgress();
  renderRoutines();
  renderExerciseCatalog();
}

function renderMetrics() {
  const m = state.data.metrics;
  const cards = [
    ["Frequência — 30 dias", `${fmtNumber(m.attendance_pct)}%`, `${m.attended} de ${m.scheduled} sessões`, Math.min(m.attendance_pct, 100)],
    ["Exercícios acompanhados", m.tracked_exercises, "com histórico individual", Math.min(m.tracked_exercises * 8, 100)],
    ["Faltas registradas", m.missed, "dias programados sem treino", Math.min(m.missed * 12, 100)],
    ["Sessões recentes", m.attended, "treinos feitos no período", Math.min(m.attended * 10, 100)],
  ];
  $("#metricGrid").innerHTML = cards.map(card => `
    <article class="metric-card">
      <div class="metric-label">${escapeHtml(card[0])}</div>
      <div class="metric-value">${escapeHtml(card[1])}<small>${escapeHtml(card[2])}</small></div>
      <div class="bar"><i style="width:${card[3]}%"></i></div>
    </article>`).join("");
}

function performanceText(session) {
  if (!session) return "Sem histórico";
  return session.sets.map(set => `${fmtNumber(set.load)} kg × ${set.reps}${set.rir !== null ? ` @${fmtNumber(set.rir)} RIR` : ""}`).join(" · ");
}

function recentText(exercise) {
  return performanceText(exercise.recent_global?.[0] || exercise.recent?.[0]);
}

function contextLabel(session) {
  if (!session) return "";
  return `${session.routine_name || "Treino"}${session.position ? ` · ${session.position}º exercício` : ""}`;
}

function referenceCards(exercise, routineName) {
  const routineRecent = exercise.recent_routine?.[0];
  const globalRecent = exercise.recent_global?.[0];
  const sameExecution = routineRecent && globalRecent && routineRecent.session_id === globalRecent.session_id && routineRecent.id === globalRecent.id;
  const best = exercise.best_entry;
  const change = exercise.global_change_pct;
  const changeText = change === null || change === undefined ? "Sem base" : `${change > 0 ? "+" : ""}${fmtNumber(change)}%`;
  return `<div class="exercise-reference-grid">
    <div class="reference-card routine-reference"><span>Última no ${escapeHtml(routineName)}${routineRecent?.position ? ` · ${routineRecent.position}º` : ""}</span><strong>${escapeHtml(performanceText(routineRecent))}</strong></div>
    ${!globalRecent || sameExecution ? "" : `<div class="reference-card global-reference"><span>Última global · ${escapeHtml(contextLabel(globalRecent))}</span><strong>${escapeHtml(performanceText(globalRecent))}</strong></div>`}
    <div class="reference-card best-reference"><span>Melhor marca${best ? ` · ${escapeHtml(contextLabel(best))}` : ""}</span><strong>${best ? `${fmtNumber(exercise.best_ever)} kg e1RM · ${escapeHtml(performanceText(best))}` : "Sem marca ainda"}</strong></div>
    <div class="reference-card trend-reference"><span>Tendência global</span><strong class="${change > 0 ? "change-positive" : change < 0 ? "change-negative" : ""}">${escapeHtml(changeText)}${exercise.progress_streak ? ` · ${exercise.progress_streak} alta(s) seguida(s)` : ""}</strong></div>
  </div>`;
}

function renderToday() {
  const routines = state.data.today_routines;
  const host = $("#todayWorkout");
  if (!routines.length) {
    $("#todayHeading").textContent = "Dia de descanso";
    $("#todayStatus").textContent = "Livre";
    $("#todayStatus").className = "status-pill";
    host.innerHTML = `<div class="empty-state"><strong>Nenhuma rotina programada</strong>Use o descanso sem culpa ou configure um treino para este dia.</div>`;
    return;
  }

  const routine = routines[0];
  $("#todayHeading").textContent = routine.name;
  const status = routine.session?.status;
  $("#todayStatus").textContent = status === "completed" ? "Registrado" : status === "partial" ? "Parcial" : status === "missed" ? "Falta" : "Pendente";
  $("#todayStatus").className = `status-pill ${status || ""}`;

  host.innerHTML = `
    <form id="todayForm" data-routine-id="${routine.id}">
      <div class="mobile-workout-note">Preencha o que fez. Exercício totalmente vazio será salvo como <strong>não realizado</strong>.</div>
      <div class="workout-mode-row"><button class="gym-mode-launch" id="openGymMode" type="button"><span>▶</span><strong>Modo Academia</strong><small>Um exercício por vez</small></button></div>
      ${routine.exercises.map((ex, exerciseIndex) => {
        const currentSets = ex.current_sets || [];
        const setCount = Math.max(ex.target_sets || 2, currentSets.length);
        const skipped = ex.current_status === "skipped";
        return `<article class="workout-exercise ${skipped ? "is-skipped" : ""}" data-exercise-id="${ex.id}">
          <div class="exercise-topline">
            <div class="exercise-index">${exerciseIndex + 1}</div>
            <div class="exercise-title-block">
              <div class="exercise-name">${escapeHtml(ex.name)}</div>
              <div class="exercise-meta">${escapeHtml(ex.muscle_group || "Grupo não definido")} · ${ex.target_sets} séries · ${ex.rep_min}–${ex.rep_max} reps</div>
            </div>
            <button class="skip-exercise-button ${skipped ? "active" : ""}" type="button" aria-pressed="${skipped}">${skipped ? "Não feito" : "Pular"}</button>
          </div>
          ${referenceCards(ex, routine.name)}
          <div class="suggestion">${escapeHtml(ex.suggestion)}</div>
          <div class="sets-container">
            ${Array.from({ length: setCount }, (_, index) => renderSetRow(index + 1, currentSets[index])).join("")}
          </div>
          <div class="exercise-footer">
            <div class="exercise-inline-actions"><button class="add-set-button" type="button">+ série</button><button class="ghost-button exercise-history-inline" type="button" data-global-exercise-id="${ex.global_exercise_id}">Histórico</button></div>
            <label class="skip-reason ${skipped ? "show" : ""}">
              <span>Motivo opcional</span>
              <select class="input skip-reason-select">
                <option value="">Não informar</option>
                <option value="Dor" ${ex.skip_reason === "Dor" ? "selected" : ""}>Dor</option>
                <option value="Preguiça" ${ex.skip_reason === "Preguiça" ? "selected" : ""}>Preguiça</option>
                <option value="Tempo" ${ex.skip_reason === "Tempo" ? "selected" : ""}>Falta de tempo</option>
                <option value="Outro" ${ex.skip_reason === "Outro" ? "selected" : ""}>Outro</option>
              </select>
            </label>
          </div>
        </article>`;
      }).join("")}
      <div class="workout-actions sticky-actions">
        <button class="danger-button" type="button" id="markMissed">Não fui</button>
        <button class="ghost-button" type="button" id="savePartial">Salvar parcial</button>
        <button class="primary-button" type="submit">Finalizar treino</button>
      </div>
    </form>`;

  $$(".skip-exercise-button", host).forEach(button => button.addEventListener("click", () => {
    const card = button.closest(".workout-exercise");
    const skippedNow = !card.classList.contains("is-skipped");
    card.classList.toggle("is-skipped", skippedNow);
    button.classList.toggle("active", skippedNow);
    button.setAttribute("aria-pressed", String(skippedNow));
    button.textContent = skippedNow ? "Não feito" : "Pular";
    $(".skip-reason", card).classList.toggle("show", skippedNow);
    if (skippedNow) $$('input', card).forEach(input => input.value = "");
  }));
  $$(".add-set-button", host).forEach(button => button.addEventListener("click", () => {
    const container = $(".sets-container", button.closest(".workout-exercise"));
    container.insertAdjacentHTML("beforeend", renderSetRow($$("[data-set]", container).length + 1));
  }));
  $$(".exercise-history-inline", host).forEach(button => button.addEventListener("click", () => openHistory(button.dataset.globalExerciseId)));
  $("#openGymMode")?.addEventListener("click", () => openGymMode(routine));
  $$("[data-set] input", host).forEach(input => input.addEventListener("input", () => {
    if (!input.value) return;
    const card = input.closest(".workout-exercise");
    card.classList.remove("is-skipped");
    const button = $(".skip-exercise-button", card);
    button.classList.remove("active"); button.textContent = "Pular"; button.setAttribute("aria-pressed", "false");
    $(".skip-reason", card).classList.remove("show");
  }));
  $("#todayForm").addEventListener("submit", event => { event.preventDefault(); submitWorkout("completed"); });
  $("#savePartial").addEventListener("click", () => submitWorkout("partial"));
  $("#markMissed").addEventListener("click", () => submitWorkout("missed"));
}

function renderSetRow(number, value = {}) {
  return `<div class="set-grid" data-set>
    <div class="set-number">${number}</div>
    <label class="mini-field"><span>Carga (kg)</span><input inputmode="decimal" name="load" value="${value.load ?? ""}" placeholder="0"></label>
    <label class="mini-field"><span>Reps</span><input inputmode="numeric" name="reps" value="${value.reps ?? ""}" placeholder="0"></label>
    <label class="mini-field"><span>RIR</span><input inputmode="decimal" name="rir" value="${value.rir ?? ""}" placeholder="0"></label>
  </div>`;
}

function gymSetRow(number, value = {}) {
  return `<div class="gym-set-row" data-gym-set>
    <div class="gym-set-number"><span>SÉRIE</span><strong>${number}</strong></div>
    <label><span>Carga</span><div class="gym-input-wrap"><input inputmode="decimal" name="load" value="${value.load ?? ""}" placeholder="0"><small>kg</small></div></label>
    <label><span>Reps</span><input inputmode="numeric" name="reps" value="${value.reps ?? ""}" placeholder="0"></label>
    <label><span>RIR</span><input inputmode="decimal" name="rir" value="${value.rir ?? ""}" placeholder="0"></label>
  </div>`;
}

function openGymMode(routine) {
  if (state.gym?.routineId === routine.id && state.gym?.date === state.selectedDate) {
    renderGymMode();
    $("#gymModeDialog").showModal();
    return;
  }
  state.gym = {
    date: state.selectedDate,
    routineId: routine.id,
    routineName: routine.name,
    index: 0,
    exercises: routine.exercises.map(exercise => ({
      ...exercise,
      skipped: exercise.current_status === "skipped",
      skip_reason: exercise.skip_reason || "",
      sets: Array.from({ length: Math.max(exercise.target_sets || 2, exercise.current_sets?.length || 0) }, (_, index) => ({
        load: exercise.current_sets?.[index]?.load ?? "",
        reps: exercise.current_sets?.[index]?.reps ?? "",
        rir: exercise.current_sets?.[index]?.rir ?? "",
      })),
    })),
  };
  renderGymMode();
  $("#gymModeDialog").showModal();
}

function captureGymExercise() {
  if (!state.gym) return;
  const exercise = state.gym.exercises[state.gym.index];
  const host = $("#gymExerciseHost");
  if (!host) return;
  exercise.sets = $$("[data-gym-set]", host).map(row => ({
    load: $('[name="load"]', row)?.value || "",
    reps: $('[name="reps"]', row)?.value || "",
    rir: $('[name="rir"]', row)?.value || "",
  }));
  exercise.skip_reason = $("#gymSkipReason")?.value || "";
  if (exercise.sets.some(set => String(set.load).trim() || String(set.reps).trim())) exercise.skipped = false;
}

function renderGymMode() {
  if (!state.gym) return;
  const exercise = state.gym.exercises[state.gym.index];
  const total = state.gym.exercises.length;
  $("#gymRoutineName").textContent = state.gym.routineName;
  $("#gymExerciseCounter").textContent = `${state.gym.index + 1} de ${total}`;
  $("#gymProgressBar").style.width = `${((state.gym.index + 1) / total) * 100}%`;
  $("#gymExerciseHost").innerHTML = `<article class="gym-exercise-card ${exercise.skipped ? "is-skipped" : ""}">
    <div class="gym-exercise-heading"><div><p class="eyebrow">${escapeHtml(exercise.muscle_group || "EXERCÍCIO")}</p><h2>${escapeHtml(exercise.name)}</h2><span>${state.gym.index + 1}º exercício · ${exercise.target_sets} séries · ${exercise.rep_min}–${exercise.rep_max} reps</span></div><button class="ghost-button" id="gymHistory" type="button">Histórico</button></div>
    ${referenceCards(exercise, state.gym.routineName)}
    <div class="gym-suggestion"><span>ALVO DE HOJE</span><strong>${escapeHtml(exercise.suggestion)}</strong></div>
    <div class="gym-sets">${exercise.sets.map((set, index) => gymSetRow(index + 1, set)).join("")}</div>
    <div class="gym-small-actions"><button class="ghost-button" id="gymAddSet" type="button">+ Adicionar série</button><button class="danger-button ${exercise.skipped ? "active" : ""}" id="gymSkip" type="button">${exercise.skipped ? "Marcado como não feito" : "Não fiz este exercício"}</button></div>
    <label class="field gym-skip-reason ${exercise.skipped ? "show" : ""}"><span>Motivo opcional</span><select class="input" id="gymSkipReason"><option value="">Não informar</option><option value="Dor" ${exercise.skip_reason === "Dor" ? "selected" : ""}>Dor</option><option value="Preguiça" ${exercise.skip_reason === "Preguiça" ? "selected" : ""}>Preguiça</option><option value="Tempo" ${exercise.skip_reason === "Tempo" ? "selected" : ""}>Falta de tempo</option><option value="Outro" ${exercise.skip_reason === "Outro" ? "selected" : ""}>Outro</option></select></label>
  </article>`;
  $("#gymPrevious").disabled = state.gym.index === 0;
  $("#gymNext").textContent = state.gym.index === total - 1 ? "Finalizar treino →" : "Salvar e próximo →";
  $("#gymHistory").addEventListener("click", () => openHistory(exercise.global_exercise_id));
  $("#gymAddSet").addEventListener("click", () => {
    captureGymExercise();
    exercise.sets.push({ load: "", reps: "", rir: "" });
    renderGymMode();
  });
  $("#gymSkip").addEventListener("click", () => {
    exercise.skipped = !exercise.skipped;
    if (exercise.skipped) exercise.sets = exercise.sets.map(() => ({ load: "", reps: "", rir: "" }));
    renderGymMode();
  });
}

function moveGym(direction) {
  if (!state.gym) return;
  captureGymExercise();
  state.gym.index = Math.max(0, Math.min(state.gym.exercises.length - 1, state.gym.index + direction));
  renderGymMode();
}

async function finishGymWorkout() {
  if (!state.gym) return;
  captureGymExercise();
  const exercises = state.gym.exercises.map(exercise => ({
    exercise_id: exercise.id,
    status: exercise.skipped ? "skipped" : "performed",
    skip_reason: exercise.skip_reason || "",
    sets: exercise.sets,
  }));
  await persistWorkout({ routine_id: state.gym.routineId, date: state.selectedDate, status: "completed", exercises }, true);
}

async function showPostWorkoutSummary(routineId) {
  const routine = (state.data.session_progress || []).find(item => item.routine_id === routineId);
  const latest = routine?.latest;
  if (!latest || latest.date !== state.selectedDate) return;
  const comparison = latest.comparison;
  $("#workoutSummaryTitle").textContent = `${routine.routine_name} concluído`;
  $("#workoutSummaryScore").innerHTML = comparison?.change_pct === null || comparison?.change_pct === undefined
    ? `<strong>Primeira base registrada</strong><span>O próximo ${escapeHtml(routine.routine_name)} já terá comparação.</span>`
    : `<strong class="${comparison.change_pct > 0 ? "change-positive" : comparison.change_pct < 0 ? "change-negative" : ""}">${comparison.change_pct > 0 ? "+" : ""}${fmtNumber(comparison.change_pct)}%</strong><span>contra ${fmtDate(comparison.previous_date)}</span>`;
  $("#workoutSummaryKpis").innerHTML = `<div><span>Realizados</span><strong>${latest.performed}</strong></div><div><span>Não feitos</span><strong>${latest.skipped}</strong></div><div><span>Subiram</span><strong>${comparison?.progressed ?? "—"}</strong></div><div><span>Caíram</span><strong>${comparison?.regressed ?? "—"}</strong></div>`;
  $("#workoutSummaryExercises").innerHTML = latest.exercises.map(exercise => {
    if (exercise.status === "skipped") return `<div class="summary-exercise skipped"><span>${escapeHtml(exercise.exercise_name)}</span><strong>Não realizado${exercise.skip_reason ? ` · ${escapeHtml(exercise.skip_reason)}` : ""}</strong></div>`;
    const cmp = exercise.routine_comparison || exercise.global_comparison;
    const label = exercise.is_pr ? "NOVO PR" : !cmp ? "Primeira base" : `${cmp.change_pct > 0 ? "+" : ""}${fmtNumber(cmp.change_pct)}%`;
    return `<div class="summary-exercise"><span>${escapeHtml(exercise.exercise_name)}<small>${escapeHtml(performanceText(exercise))}</small></span><strong class="${exercise.is_pr || cmp?.change_pct > 0 ? "change-positive" : cmp?.change_pct < 0 ? "change-negative" : ""}">${escapeHtml(label)}</strong></div>`;
  }).join("");
  state.ai.lastWorkout = { ...latest, routine_name: routine.routine_name, routine_id: routine.routine_id };
  $("#workoutAiTitle").textContent = "Análise contextual";
  $("#workoutAiContent").innerHTML = `<p>Use o botão para cruzar esta sessão com seu histórico.</p>`;
  $("#workoutSummaryDialog").showModal();
  if (state.ai.enabled === null) await checkAiStatus();
  if (state.ai.enabled && state.ai.autoWorkout) await runWorkoutAiAnalysis();
}

async function persistWorkout(payload, fromGym = false) {
  if (state.saving) return;
  state.saving = true;
  try {
    const exercises = payload.exercises || [];
    const skipped = exercises.filter(item => item.status === "skipped" || !item.sets?.some(set => Number(String(set.reps).replace(",", ".")) > 0 || Number(String(set.load).replace(",", ".")) > 0)).length;
    await api("/api/sessions", { method: "POST", body: JSON.stringify(payload) });
    if (fromGym) {
      $("#gymModeDialog")?.close();
      state.gym = null;
    }
    showToast(payload.status === "missed" || skipped === exercises.length ? "Falta registrada." : skipped ? `Treino salvo com ${skipped} exercício(s) não realizado(s).` : "Treino salvo. A análise já foi atualizada.");
    await loadDashboard();
    if (payload.status !== "missed") await showPostWorkoutSummary(payload.routine_id);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.saving = false;
  }
}

async function submitWorkout(status) {
  const form = $("#todayForm");
  if (!form) return;
  const exercises = $$("[data-exercise-id]", form).map(block => ({
    exercise_id: block.dataset.exerciseId,
    status: block.classList.contains("is-skipped") ? "skipped" : "performed",
    skip_reason: $(".skip-reason-select", block)?.value || "",
    sets: $$("[data-set]", block).map(row => ({
      load: $('[name="load"]', row).value,
      reps: $('[name="reps"]', row).value,
      rir: $('[name="rir"]', row).value,
    })),
  }));
  await persistWorkout({ routine_id: form.dataset.routineId, date: state.selectedDate, status, exercises });
}

function renderInsights() {
  const progress = state.data.progress;
  if (!progress.length) {
    $("#insightList").innerHTML = `<div class="insight-item neutral"><strong>Ainda sem base</strong><p>Importe seu histórico ou registre as primeiras sessões.</p></div>`;
    return;
  }
  const progressing = progress.filter(x => x.trend === "progressao").sort((a,b) => b.change_pct - a.change_pct);
  const regressing = progress.filter(x => x.trend === "regressao").sort((a,b) => a.change_pct - b.change_pct);
  const stable = progress.filter(x => x.trend === "estavel");
  const insights = [];
  if (progressing[0]) insights.push(["good", `${progressing[0].name} está voando`, `Alta de ${fmtNumber(progressing[0].change_pct)}% na comparação mais recente.`]);
  if (regressing[0]) insights.push(["bad", `${regressing[0].name} merece atenção`, `Queda de ${fmtNumber(Math.abs(regressing[0].change_pct))}% no indicador de performance.`]);
  if (stable.length) insights.push(["neutral", `${stable.length} exercício(s) estáveis`, "Variações abaixo de 2% entram como manutenção, não como regressão."]);
  if (state.data.metrics.attendance_pct < 70 && state.data.metrics.scheduled) insights.push(["bad", "A frequência está pesando", `Você compareceu a ${fmtNumber(state.data.metrics.attendance_pct)}% dos treinos programados nos últimos 30 dias.`]);
  if (!insights.length) insights.push(["neutral", "Base em construção", "Mais duas sessões por exercício deixam a leitura bem mais confiável."]);
  $("#insightList").innerHTML = insights.slice(0,4).map(i => `<div class="insight-item ${i[0]}"><strong>${escapeHtml(i[1])}</strong><p>${escapeHtml(i[2])}</p></div>`).join("");
}

function renderCalendar() {
  const selected = new Date(`${state.data.selected_date}T12:00:00`);
  const start = new Date(selected);
  start.setDate(start.getDate() - 34);
  const byDate = {};
  for (const item of state.data.calendar) {
    byDate[item.session_date] ||= [];
    byDate[item.session_date].push(item);
  }
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const iso = current.toISOString().slice(0,10);
    const items = byDate[iso] || [];
    const hasCompleted = items.some(x => x.status === "completed" || x.status === "partial");
    const hasMissed = items.some(x => x.status === "missed");
    const status = hasCompleted ? "completed" : hasMissed ? "missed" : "rest";
    const label = items.map(x => x.routine_name).join(", ") || "Descanso";
    cells.push(`<div class="calendar-day ${status} ${iso === state.data.selected_date ? "today" : ""}" title="${escapeHtml(label)}">
      <span class="number">${current.getDate()}</span><small>${escapeHtml(label)}</small>
    </div>`);
  }
  $("#calendar").innerHTML = cells.join("");
}

function trendLabel(value) {
  return { progressao: "Progressão", regressao: "Regressão", estavel: "Estável", sem_base: "Sem base" }[value] || value;
}

function renderSessionProgress() {
  const host = $("#sessionProgressGrid");
  const items = state.data.session_progress || [];
  if (!items.length) {
    host.innerHTML = `<div class="empty-state"><strong>Sem sessões para comparar</strong>Registre ou importe ao menos dois treinos da mesma rotina.</div>`;
    return;
  }
  host.innerHTML = items.map(item => {
    const latest = item.latest;
    const comparison = latest?.comparison;
    const change = comparison?.change_pct;
    const summary = !latest ? "Nenhuma sessão registrada" : !comparison ? "Só existe uma sessão nessa rotina" : !comparison.comparable_exercises ? "As duas sessões não têm exercícios comparáveis" : `${comparison.progressed} subiram · ${comparison.stable} mantiveram · ${comparison.regressed} caíram`;
    return `<article class="session-progress-card">
      <div class="session-card-top">
        <div><p class="routine-day">${escapeHtml(item.weekday_label)}</p><h3>${escapeHtml(item.routine_name)}</h3></div>
        <span class="trend-pill ${comparison?.trend || "sem_base"}">${comparison ? trendLabel(comparison.trend) : "Sem base"}</span>
      </div>
      <div class="session-score ${change > 0 ? "change-positive" : change < 0 ? "change-negative" : ""}">${change === null || change === undefined ? "—" : `${change > 0 ? "+" : ""}${fmtNumber(change)}%`}</div>
      <p class="muted">${latest ? `${fmtDate(latest.date)}${comparison ? ` vs ${fmtDate(comparison.previous_date)}` : ""}` : ""}</p>
      <div class="session-summary">${escapeHtml(summary)}</div>
      ${latest ? `<div class="session-completion"><span>${latest.performed} realizados</span><span>${latest.skipped} pulados</span><span>${comparison?.comparable_exercises || 0} comparáveis</span></div>` : ""}
      <button class="ghost-button full routine-history-button" data-routine-id="${item.routine_id}">Ver histórico das sessões</button>
    </article>`;
  }).join("");
  $$(".routine-history-button", host).forEach(button => button.addEventListener("click", () => openRoutineHistory(button.dataset.routineId)));
}

async function openRoutineHistory(routineId) {
  try {
    const data = await api(`/api/routines/${routineId}/history`);
    $("#routineHistoryTitle").textContent = data.routine.name;
    $("#routineHistoryList").innerHTML = [...data.history].reverse().map(item => {
      const comparison = item.comparison;
      const details = item.exercises.map(ex => ex.status === "skipped"
        ? `<div class="routine-exercise-result skipped"><span>${escapeHtml(ex.name)}</span><strong>Não feito${ex.skip_reason ? ` · ${escapeHtml(ex.skip_reason)}` : ""}</strong></div>`
        : `<div class="routine-exercise-result"><span>${escapeHtml(ex.name)}</span><strong>${fmtNumber(ex.best_e1rm)} kg e1RM</strong></div>`).join("");
      return `<article class="routine-history-card">
        <div class="routine-history-heading"><div><strong>${fmtDate(item.date)}</strong><small>${item.performed} realizados · ${item.skipped} pulados</small></div>
        <span class="trend-pill ${comparison?.trend || "sem_base"}">${comparison?.change_pct === null || comparison?.change_pct === undefined ? "Sem comparação" : `${comparison.change_pct > 0 ? "+" : ""}${fmtNumber(comparison.change_pct)}%`}</span></div>
        ${comparison ? `<p class="muted">Comparado a ${fmtDate(comparison.previous_date)} usando ${comparison.comparable_exercises} exercício(s) em comum.</p>` : ""}
        <div class="routine-exercise-results">${details}</div>
      </article>`;
    }).join("") || `<div class="empty-state">Sem histórico.</div>`;
    $("#routineHistoryDialog").showModal();
  } catch (error) { showToast(error.message, "error"); }
}

function renderProgress() {
  const search = normalize($("#progressSearch")?.value || "");
  const filter = $("#trendFilter")?.value || "all";
  const rows = state.data.progress.filter(ex => {
    const routines = (ex.routine_names || []).join(" ");
    return (!search || normalize(ex.name).includes(search) || normalize(routines).includes(search)) && (filter === "all" || ex.trend === filter);
  });
  $("#progressTable").innerHTML = rows.length ? rows.map(ex => {
    const recent = ex.recent_global?.[0] || ex.recent?.[0];
    const change = ex.global_change_pct === null ? "—" : `${ex.global_change_pct > 0 ? "+" : ""}${fmtNumber(ex.global_change_pct)}%`;
    const changeClass = ex.global_change_pct > 0 ? "change-positive" : ex.global_change_pct < 0 ? "change-negative" : "";
    const contexts = (ex.contexts || []).map(context => `${escapeHtml(context.routine_name)} · ${context.position}º`).join("<br>");
    return `<tr>
      <td><span class="strong">${escapeHtml(ex.name)}</span><br><span class="muted">${escapeHtml(ex.muscle_group || "Sem grupo")}</span></td>
      <td><span class="context-list">${contexts || "—"}</span></td>
      <td>${recent ? `${fmtDate(recent.date, {day:"2-digit", month:"short"})}<br><span class="muted">${escapeHtml(contextLabel(recent))}</span><br><span class="muted">${escapeHtml(performanceText(recent))}</span>` : "—"}</td>
      <td class="${changeClass}">${change}</td>
      <td><span class="trend-pill ${ex.trend}">${trendLabel(ex.trend)}</span></td>
      <td><button class="ghost-button history-button" data-global-exercise-id="${ex.global_exercise_id}">Ver histórico</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>Nada encontrado</strong>Ajuste os filtros ou registre mais treinos.</div></td></tr>`;
  $$(".history-button").forEach(button => button.addEventListener("click", () => openHistory(button.dataset.globalExerciseId)));
}

function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderRoutines() {
  const host = $("#routineGrid");
  const routines = state.data.routines;
  if (!routines.length) {
    host.innerHTML = `<div class="empty-state"><strong>Você ainda não criou uma rotina</strong>Cadastre o primeiro treino ou importe a planilha antiga.</div>`;
    return;
  }
  host.innerHTML = routines.map(routine => `<article class="routine-card">
    <div class="routine-card-header">
      <div><div class="routine-day">${escapeHtml(routine.weekday_label)}</div><h3>${escapeHtml(routine.name)}</h3><p class="muted">Ativa desde ${fmtDate(routine.start_date)}</p></div>
      <span class="status-pill ${routine.active ? "completed" : ""}">${routine.active ? "Ativa" : "Inativa"}</span>
    </div>
    <div class="routine-exercises">${routine.exercises.slice(0,8).map(ex => `<div><span>${escapeHtml(ex.name)}</span><span>${ex.target_sets}× ${ex.rep_min}–${ex.rep_max}</span></div>`).join("")}${routine.exercises.length > 8 ? `<div><span>+ ${routine.exercises.length - 8} exercícios</span><span></span></div>` : ""}</div>
    <div class="card-actions"><button class="danger-button delete-routine" data-id="${routine.id}">Excluir</button><button class="ghost-button edit-routine" data-id="${routine.id}">Editar</button></div>
  </article>`).join("");
  $$(".edit-routine").forEach(button => button.addEventListener("click", () => openRoutine(state.data.routines.find(r => r.id === button.dataset.id))));
  $$(".delete-routine").forEach(button => button.addEventListener("click", () => deleteRoutine(button.dataset.id)));
}

function renderExerciseCatalog() {
  const list = $("#globalExerciseOptions");
  if (!list) return;
  list.innerHTML = (state.data.exercise_catalog || []).map(ex => `<option value="${escapeHtml(ex.name)}">${escapeHtml(ex.muscle_group || "")}</option>`).join("");
}

function addExerciseRow(exercise = {}) {
  const row = document.createElement("div");
  row.className = "exercise-edit-row";
  row.dataset.exerciseId = exercise.id || "";
  row.dataset.globalExerciseId = exercise.global_exercise_id || "";
  row.innerHTML = `
    <div class="drag">⋮⋮</div>
    <label class="field"><span>Exercício</span><input class="input ex-name" list="globalExerciseOptions" required value="${escapeHtml(exercise.name || "")}" placeholder="Supino articulado"></label>
    <label class="field muscle-field"><span>Grupo</span><input class="input ex-muscle" value="${escapeHtml(exercise.muscle_group || "")}" placeholder="Peito"></label>
    <label class="field"><span>Séries</span><input class="input ex-sets" type="number" min="1" value="${exercise.target_sets || 2}"></label>
    <label class="field"><span>Rep. mín.</span><input class="input ex-min" type="number" min="1" value="${exercise.rep_min || 4}"></label>
    <label class="field"><span>Rep. máx.</span><input class="input ex-max" type="number" min="1" value="${exercise.rep_max || 8}"></label>
    <label class="field increment-field"><span>Incremento</span><input class="input ex-inc" inputmode="decimal" value="${exercise.load_increment || 2.5}"></label>
    <button class="icon-button remove-exercise" type="button" aria-label="Remover">×</button>`;
  $(".remove-exercise", row).addEventListener("click", () => row.remove());
  $("#exerciseEditor").append(row);
}

function openRoutine(routine = null) {
  $("#routineDialogTitle").textContent = routine ? "Editar rotina" : "Nova rotina";
  $("#routineId").value = routine?.id || "";
  $("#routineName").value = routine?.name || "";
  $("#routineWeekday").value = routine?.weekday || "segunda";
  $("#routineStart").value = routine?.start_date || state.selectedDate;
  $("#exerciseEditor").innerHTML = "";
  (routine?.exercises?.length ? routine.exercises : [{}, {}]).forEach(addExerciseRow);
  $("#routineDialog").showModal();
}

async function saveRoutine(event) {
  event.preventDefault();
  const exercises = $$(".exercise-edit-row", $("#exerciseEditor")).map(row => ({
    id: row.dataset.exerciseId || null,
    global_exercise_id: row.dataset.globalExerciseId || null,
    name: $(".ex-name", row).value,
    muscle_group: $(".ex-muscle", row)?.value || "",
    target_sets: $(".ex-sets", row).value,
    rep_min: $(".ex-min", row).value,
    rep_max: $(".ex-max", row).value,
    load_increment: $(".ex-inc", row)?.value || 2.5,
  })).filter(x => x.name.trim());
  try {
    await api("/api/routines", { method: "POST", body: JSON.stringify({
      id: $("#routineId").value || null,
      name: $("#routineName").value,
      weekday: $("#routineWeekday").value,
      start_date: $("#routineStart").value,
      exercises,
    }) });
    $("#routineDialog").close();
    showToast("Rotina salva.");
    await loadDashboard();
  } catch (error) { showToast(error.message, "error"); }
}

async function deleteRoutine(id) {
  if (!confirm("Arquivar esta rotina? O histórico antigo será preservado.")) return;
  try {
    await api(`/api/routines/${id}`, { method: "DELETE" });
    showToast("Rotina arquivada. O histórico foi preservado.");
    await loadDashboard();
  } catch (error) { showToast(error.message, "error"); }
}

async function openHistory(globalExerciseId) {
  try {
    const data = await api(`/api/global-exercises/${globalExerciseId}/history`);
    $("#historyTitle").textContent = data.exercise.name;
    const performed = data.history.filter(item => item.status === "performed" && item.best_e1rm > 0);
    const latest = performed.at(-1);
    const first = performed[0];
    const totalChange = first && latest && first.best_e1rm ? (latest.best_e1rm / first.best_e1rm - 1) * 100 : null;
    const skippedCount = data.history.filter(item => item.status === "skipped").length;
    $("#historyKpis").innerHTML = `
      <div class="history-kpi"><span>Melhor e1RM</span><strong>${fmtNumber(data.best_ever)} kg</strong></div>
      <div class="history-kpi"><span>Realizado / pulado</span><strong>${performed.length} / ${skippedCount}</strong></div>
      <div class="history-kpi"><span>Evolução global</span><strong>${totalChange === null ? "—" : `${totalChange > 0 ? "+" : ""}${fmtNumber(totalChange)}%`}</strong></div>`;
    $("#historyContexts").innerHTML = (data.contexts || []).map(context => {
      const change = context.change_pct;
      return `<article class="history-context-card">
        <div><strong>${escapeHtml(context.routine_name)}</strong><small>${context.position}º exercício · ${context.performed} feitos · ${context.skipped} pulados</small></div>
        <span class="trend-pill ${context.trend}">${change === null ? "Sem base" : `${change > 0 ? "+" : ""}${fmtNumber(change)}%`}</span>
      </article>`;
    }).join("");
    const comparisonCell = comparison => comparison ? `<span class="inline-change ${comparison.change_pct > 0 ? "change-positive" : comparison.change_pct < 0 ? "change-negative" : ""}">${comparison.change_pct > 0 ? "+" : ""}${fmtNumber(comparison.change_pct)}%</span><small>vs ${fmtDate(comparison.previous_date, {day:"2-digit",month:"2-digit"})}${comparison.previous_routine_name ? ` · ${escapeHtml(comparison.previous_routine_name)}` : ""}</small>` : "—";
    $("#historyTable").innerHTML = [...data.history].reverse().map(item => item.status === "skipped"
      ? `<tr class="skipped-row"><td>${fmtDate(item.date)}</td><td><strong>${escapeHtml(item.routine_name)}</strong><br><span class="muted">${item.position}º exercício</span></td><td><span class="trend-pill skipped">Não feito${item.skip_reason ? ` · ${escapeHtml(item.skip_reason)}` : ""}</span></td><td>—</td><td>—</td><td>—</td></tr>`
      : `<tr><td>${fmtDate(item.date)}</td><td><strong>${escapeHtml(item.routine_name)}</strong><br><span class="muted">${item.position}º exercício</span></td><td>${escapeHtml(item.sets.map(s => `${fmtNumber(s.load)}×${s.reps}${s.rir !== null ? ` @${fmtNumber(s.rir)}` : ""}`).join(" · "))}</td><td>${fmtNumber(item.best_e1rm)} kg</td><td>${comparisonCell(item.global_comparison)}</td><td>${comparisonCell(item.routine_comparison)}</td></tr>`).join("") || `<tr><td colspan="6">Sem histórico.</td></tr>`;
    drawChart(performed);
    $("#historyDialog").showModal();
  } catch (error) { showToast(error.message, "error"); }
}

function drawChart(history) {
  const svg = $("#progressChart");
  if (!history.length) { svg.innerHTML = `<text x="450" y="140" text-anchor="middle" class="chart-label">Sem dados suficientes</text>`; return; }
  const W = 900, H = 280, pad = { l: 55, r: 22, t: 22, b: 42 };
  const values = history.map(x => x.best_e1rm);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min *= .92; max *= 1.08; }
  const x = i => pad.l + (history.length === 1 ? (W-pad.l-pad.r)/2 : i * (W-pad.l-pad.r)/(history.length-1));
  const y = value => pad.t + (max-value)/(max-min) * (H-pad.t-pad.b);
  const points = history.map((item,i) => `${x(i)},${y(item.best_e1rm)}`).join(" ");
  const area = `${pad.l},${H-pad.b} ${points} ${x(history.length-1)},${H-pad.b}`;
  const grid = Array.from({length:5}, (_,i) => {
    const gy = pad.t + i*(H-pad.t-pad.b)/4;
    const val = max - i*(max-min)/4;
    return `<line x1="${pad.l}" x2="${W-pad.r}" y1="${gy}" y2="${gy}" class="chart-gridline"/><text x="${pad.l-9}" y="${gy+4}" text-anchor="end" class="chart-label">${fmtNumber(val)}</text>`;
  }).join("");
  const labelsEvery = Math.max(1, Math.ceil(history.length / 7));
  const labels = history.map((item,i) => i % labelsEvery === 0 || i === history.length-1 ? `<text x="${x(i)}" y="${H-15}" text-anchor="middle" class="chart-label">${fmtDate(item.date,{day:"2-digit",month:"2-digit"})}</text>` : "").join("");
  const circles = history.map((item,i) => `<circle cx="${x(i)}" cy="${y(item.best_e1rm)}" r="5" class="chart-point"><title>${fmtDate(item.date)}: ${fmtNumber(item.best_e1rm)} kg</title></circle>`).join("");
  svg.innerHTML = `<defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8bffb0" stop-opacity=".35"/><stop offset="1" stop-color="#8bffb0" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" class="chart-area"/><polyline points="${points}" class="chart-line"/>${circles}${labels}`;
}

const canonicalFields = [
  ["date", "Data *"], ["workout", "Nome do treino"], ["weekday", "Dia da semana"],
  ["exercise", "Exercício *"], ["set", "Número da série"], ["load", "Carga *"],
  ["reps", "Repetições *"], ["rir", "RIR"], ["notes", "Observações"],
];

async function inspectFile(file) {
  $("#importStatus").textContent = "Lendo planilha no próprio navegador…";
  try {
    state.import = await inspectSpreadsheet(file);
    $("#importStatus").textContent = `${state.import.row_count} linhas encontradas em ${state.import.filename}. Nada foi enviado antes da confirmação.`;
    setupMapping(state.import);
  } catch (error) {
    $("#importStatus").textContent = "";
    showToast(error.message, "error");
  }
}

function setupMapping(info) {
  $("#mappingPanel").hidden = false;
  const sheetField = $("#sheetField");
  if (info.sheets?.length > 1) {
    sheetField.hidden = false;
    $("#sheetSelect").innerHTML = info.sheets.map(sheet => `<option value="${escapeHtml(sheet)}" ${sheet === info.selected_sheet ? "selected" : ""}>${escapeHtml(sheet)}</option>`).join("");
  } else {
    sheetField.hidden = true;
  }
  renderMapping(info.headers, info.auto_mapping, info.preview);
  $("#mappingPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMapping(headers, mapping, preview) {
  const options = `<option value="">Não importar</option>` + headers.map(header => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
  $("#mappingGrid").innerHTML = canonicalFields.map(([key, label]) => `<label class="field"><span>${label}</span><select class="input mapping-select" data-canonical="${key}">${options}</select></label>`).join("");
  $$(".mapping-select").forEach(select => { select.value = mapping[select.dataset.canonical] || ""; });
  renderPreview(headers, preview);
}

function renderPreview(headers, rows) {
  $("#previewTable").innerHTML = `<thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(header => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

async function changeSheet() {
  try {
    state.import = selectSheet(state.import, $("#sheetSelect").value);
    renderMapping(state.import.headers, state.import.auto_mapping, state.import.preview);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function commitImport() {
  const mapping = {};
  $$(".mapping-select").forEach(select => { if (select.value) mapping[select.dataset.canonical] = select.value; });
  const button = $("#commitImport");
  button.disabled = true;
  button.classList.add("syncing");
  try {
    const result = await importRows(state.import.rows, mapping);
    const errorNote = result.errors?.length ? ` Algumas linhas tiveram problema: ${result.errors.join(" | ")}` : "";
    showToast(`${result.imported_rows} séries importadas em ${result.sessions} sessões.${errorNote}`, result.imported_rows ? "success" : "error");
    $("#mappingPanel").hidden = true;
    $("#importFile").value = "";
    state.import = null;
    await loadDashboard();
    switchView("progress");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.classList.remove("syncing");
  }
}

function switchView(view) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  $$("[data-view-link]").forEach(link => link.classList.toggle("active", link.dataset.viewLink === view));
  $("#pageTitle").textContent = { dashboard: "Seu treino", progress: "Evolução", ai: "IA do treino", routines: "Rotinas", import: "Importar histórico", settings: "Conta e backup" }[view];
  $(".sidebar").classList.remove("open");
}

function bindEvents() {
  $$("[data-view-link]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); switchView(link.dataset.viewLink); }));
  $("#selectedDate").addEventListener("change", event => { state.selectedDate = event.target.value; loadDashboard(); });
  $("#progressSearch").addEventListener("input", renderProgress);
  $("#trendFilter").addEventListener("change", renderProgress);
  $("#newRoutineBtn").addEventListener("click", () => openRoutine());
  $("#addExercise").addEventListener("click", () => addExerciseRow());
  $("#routineForm").addEventListener("submit", saveRoutine);
  $("#closeHistory").addEventListener("click", () => $("#historyDialog").close());
  $("#closeRoutineHistory").addEventListener("click", () => $("#routineHistoryDialog").close());
  $("#closeGymMode").addEventListener("click", () => { captureGymExercise(); $("#gymModeDialog").close(); });
  $("#gymPrevious").addEventListener("click", () => moveGym(-1));
  $("#gymNext").addEventListener("click", () => state.gym && state.gym.index === state.gym.exercises.length - 1 ? finishGymWorkout() : moveGym(1));
  $("#gymFinish").addEventListener("click", finishGymWorkout);
  $("#closeWorkoutSummary").addEventListener("click", () => $("#workoutSummaryDialog").close());
  $("#summaryDone").addEventListener("click", () => $("#workoutSummaryDialog").close());
  $("#retryWorkoutAi").addEventListener("click", runWorkoutAiAnalysis);
  $$('[data-ai-mode]').forEach(button => button.addEventListener("click", () => setAiMode(button.dataset.aiMode)));
  $$('[data-ai-prompt]').forEach(button => button.addEventListener("click", () => submitAiQuestion(button.dataset.aiPrompt)));
  $("#aiForm").addEventListener("submit", event => { event.preventDefault(); submitAiQuestion($("#aiQuestion").value); });
  $("#autoAiAnalysis").checked = state.ai.autoWorkout;
  $("#autoAiAnalysis").addEventListener("change", event => { state.ai.autoWorkout = event.target.checked; localStorage.setItem("progressao_ai_auto", String(state.ai.autoWorkout)); });
  setAiMode(state.ai.mode);
  renderAiStatus();
  $("#mobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $$("[data-progress-mode]").forEach(button => button.addEventListener("click", () => {
    const sessions = button.dataset.progressMode === "sessions";
    $$("[data-progress-mode]").forEach(item => item.classList.toggle("active", item === button));
    $("#sessionProgressPanel").hidden = !sessions;
    $("#exerciseProgressPanel").hidden = sessions;
  }));

  const fileInput = $("#importFile"), dropzone = $("#dropzone");
  fileInput.addEventListener("change", () => fileInput.files[0] && inspectFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove("dragover"); }));
  dropzone.addEventListener("drop", event => event.dataTransfer.files[0] && inspectFile(event.dataTransfer.files[0]));
  $("#sheetSelect").addEventListener("change", changeSheet);
  $("#commitImport").addEventListener("click", commitImport);
  bindSettingsEvents();
}


let authMode = "signin";
let appEventsBound = false;
let deferredInstallPrompt = null;

function setGateMessage(message, type = "") {
  const host = $("#authMessage");
  host.textContent = message || "";
  host.className = `gate-message ${type}`;
}

function showConnectionScreen() {
  $("#appLoading").hidden = true;
  $("#authScreen").hidden = true;
  $("#appShell").hidden = true;
  $("#bottomNav").hidden = true;
  $("#connectionScreen").hidden = false;
}

function showAuthScreen() {
  $("#appLoading").hidden = true;
  $("#connectionScreen").hidden = true;
  $("#appShell").hidden = true;
  $("#bottomNav").hidden = true;
  $("#authScreen").hidden = false;
}

async function showApp(session) {
  $("#appLoading").hidden = true;
  $("#connectionScreen").hidden = true;
  $("#authScreen").hidden = true;
  $("#appShell").hidden = false;
  $("#bottomNav").hidden = false;
  const email = session?.user?.email || "Conta conectada";
  $("#settingsEmail").textContent = email;
  $("#sidebarUser").textContent = email;
  const config = await loadCloudConfig();
  $("#connectionProject").textContent = config?.supabaseUrl?.replace(/^https:\/\//, "") || "—";
  if (!appEventsBound) {
    bindEvents();
    appEventsBound = true;
  }
  await loadDashboard();
  await checkAiStatus();
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function performExport() {
  try {
    const csv = await exportCsv();
    downloadText(`progressao_backup_${state.selectedDate}.csv`, csv, "text/csv;charset=utf-8");
    showToast("Backup CSV gerado.");
  } catch (error) { showToast(error.message, "error"); }
}

function bindGateEvents() {
  $("#connectionForm").addEventListener("submit", event => {
    event.preventDefault();
    try {
      saveCloudConfig({ supabaseUrl: $("#supabaseUrl").value, supabaseKey: $("#supabaseKey").value });
      window.location.reload();
    } catch (error) { alert(error.message); }
  });
  $$("[data-auth-mode]").forEach(button => button.addEventListener("click", () => {
    authMode = button.dataset.authMode;
    $$("[data-auth-mode]").forEach(item => item.classList.toggle("active", item === button));
    $("#authSubmit").textContent = authMode === "signin" ? "Entrar" : "Criar conta";
    $("#authPassword").autocomplete = authMode === "signin" ? "current-password" : "new-password";
    setGateMessage("");
  }));
  $("#authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#authSubmit");
    button.disabled = true; button.classList.add("syncing");
    try {
      const email = $("#authEmail").value.trim();
      const password = $("#authPassword").value;
      const result = authMode === "signin" ? await signIn(email, password) : await signUp(email, password);
      if (result.session) await showApp(result.session);
      else setGateMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.", "success");
    } catch (error) {
      setGateMessage(error.message, "error");
    } finally {
      button.disabled = false; button.classList.remove("syncing");
    }
  });
  $("#forgotPassword").addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    if (!email) { setGateMessage("Digite seu e-mail primeiro.", "error"); return; }
    try { await sendPasswordReset(email); setGateMessage("Enviei o link de redefinição para seu e-mail.", "success"); }
    catch (error) { setGateMessage(error.message, "error"); }
  });
  $("#changeConnection").addEventListener("click", () => {
    if (confirm("Trocar a conexão deste aparelho? Seus dados no Supabase não serão apagados.")) { clearCloudConfig(); window.location.reload(); }
  });
  $("#passwordRecoveryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const password = $("#newPassword").value;
    const confirmation = $("#confirmPassword").value;
    const message = $("#passwordRecoveryMessage");
    message.textContent = "";
    if (password !== confirmation) { message.textContent = "As duas senhas precisam ser iguais."; message.className = "gate-message error"; return; }
    const button = $("#saveNewPassword");
    button.disabled = true; button.classList.add("syncing");
    try {
      await updatePassword(password);
      message.textContent = "Senha atualizada."; message.className = "gate-message success";
      setTimeout(() => $("#passwordRecoveryDialog").close(), 500);
    } catch (error) {
      message.textContent = error.message; message.className = "gate-message error";
    } finally {
      button.disabled = false; button.classList.remove("syncing");
    }
  });
}

function bindSettingsEvents() {
  [$("#exportHistory"), $("#exportHistorySidebar")].filter(Boolean).forEach(button => button.addEventListener("click", performExport));
  $("#logoutButton").addEventListener("click", async () => {
    try { await signOut(); showAuthScreen(); } catch (error) { showToast(error.message, "error"); }
  });
  $("#reloadCloud").addEventListener("click", async event => {
    const button = event.currentTarget; button.classList.add("syncing");
    try { await loadDataset(true); await loadDashboard(); showToast("Dados sincronizados."); }
    catch (error) { showToast(error.message, "error"); }
    finally { button.classList.remove("syncing"); }
  });
  $("#resetConnection").addEventListener("click", () => {
    if (confirm("Trocar o projeto Supabase neste aparelho? O banco atual não será apagado.")) { clearCloudConfig(); window.location.reload(); }
  });
  $("#downloadModel").addEventListener("click", () => {
    const link = document.createElement("a"); link.href = "/modelo_importacao.xlsx"; link.download = "modelo_importacao.xlsx"; link.click();
  });
  $("#installApp").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    } else {
      showToast("No Chrome: menu ⋮ → Adicionar à tela inicial.");
    }
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

document.addEventListener("DOMContentLoaded", async () => {
  bindGateEvents();
  const config = await loadCloudConfig();
  if (!config) { showConnectionScreen(); return; }
  try {
    initializeCloud(config);
    onAuthStateChange((event, session) => {
      if (!session) { showAuthScreen(); return; }
      if (event === "PASSWORD_RECOVERY") {
        setTimeout(async () => {
          await showApp(session);
          $("#newPassword").value = "";
          $("#confirmPassword").value = "";
          $("#passwordRecoveryMessage").textContent = "";
          $("#passwordRecoveryDialog").showModal();
        }, 0);
      }
    });
    const session = await getSession();
    if (session) await showApp(session);
    else showAuthScreen();
    if (navigator.serviceWorker?.register) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  } catch (error) {
    $("#appLoading").hidden = true;
    clearCloudConfig();
    showConnectionScreen();
    alert(`Não foi possível conectar ao Supabase: ${error.message}`);
  }
});
