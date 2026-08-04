// Gerado a partir da interface validada da v5.
export const legacyMarkup = String.raw`<div id="appLoading" class="loading-screen"><div class="loading-mark">P</div><strong>Preparando seu diário…</strong></div>

  <section id="connectionScreen" class="gate-screen" hidden>
    <div class="gate-card">
      <div class="brand gate-brand"><span class="brand-mark">P</span><span><strong>Progressão</strong><small>Configuração da nuvem</small></span></div>
      <p class="gate-copy">Conecte seu projeto Supabase uma única vez. A chave publicável pode ficar no navegador; a proteção real é feita pelas regras RLS do banco.</p>
      <form id="connectionForm" class="gate-form">
        <label class="field"><span>URL do projeto</span><input class="input" id="supabaseUrl" type="url" required placeholder="https://seu-projeto.supabase.co"></label>
        <label class="field"><span>Publishable key</span><textarea class="input config-key" id="supabaseKey" required placeholder="sb_publishable_..."></textarea></label>
        <button class="primary-button full" type="submit">Conectar Supabase</button>
      </form>
      <details class="gate-help"><summary>Onde encontro isso?</summary><p>No Supabase: abra o projeto, entre em <strong>Connect</strong> ou <strong>Settings → API Keys</strong> e copie a Project URL e a Publishable key.</p></details>
    </div>
  </section>

  <section id="authScreen" class="gate-screen" hidden>
    <div class="gate-card">
      <div class="brand gate-brand"><span class="brand-mark">P</span><span><strong>Progressão</strong><small>Seu treino, em qualquer dispositivo</small></span></div>
      <div class="auth-switch"><button type="button" class="active" data-auth-mode="signin">Entrar</button><button type="button" data-auth-mode="signup">Criar conta</button></div>
      <form id="authForm" class="gate-form">
        <label class="field"><span>E-mail</span><input class="input" id="authEmail" type="email" autocomplete="email" required></label>
        <label class="field"><span>Senha</span><input class="input" id="authPassword" type="password" autocomplete="current-password" minlength="6" required></label>
        <button class="primary-button full" id="authSubmit" type="submit">Entrar</button>
      </form>
      <button class="text-button" id="forgotPassword" type="button">Esqueci minha senha</button>
      <button class="text-button muted-button" id="changeConnection" type="button">Trocar conexão do Supabase</button>
      <p id="authMessage" class="gate-message"></p>
    </div>
  </section>

  <div class="app-shell" id="appShell" hidden>
    <aside class="sidebar">
      <a class="brand" href="#" data-view-link="dashboard" aria-label="Página inicial">
        <span class="brand-mark">P</span>
        <span><strong>Progressão</strong><small>Diário de treino</small></span>
      </a>

      <nav class="nav">
        <button class="nav-item active" data-view-link="dashboard"><span>⌂</span> Hoje</button>
        <button class="nav-item" data-view-link="progress"><span>↗</span> Evolução</button>
        <button class="nav-item" data-view-link="ai"><span>✦</span> IA do treino</button>
        <button class="nav-item" data-view-link="routines"><span>≡</span> Rotinas</button>
        <button class="nav-item" data-view-link="import"><span>⇧</span> Importar histórico</button>
        <button class="nav-item" data-view-link="settings"><span>⚙</span> Conta e backup</button>
      </nav>

      <div class="sidebar-footer">
        <button class="ghost-button full" id="exportHistorySidebar" type="button">Exportar histórico</button>
        <p id="sidebarUser">Dados sincronizados pelo Supabase.</p>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <button class="mobile-menu" id="mobileMenu" aria-label="Abrir menu">☰</button>
        <div>
          <p class="eyebrow" id="dateEyebrow">VISÃO DO DIA</p>
          <h1 id="pageTitle">Seu treino</h1>
        </div>
        <label class="date-control">
          <span>Data analisada</span>
          <input type="date" id="selectedDate">
        </label>
      </header>

      <div id="toast" class="toast" role="status"></div>

      <section class="view active" id="view-dashboard">
        <div class="metric-grid" id="metricGrid"></div>

        <div class="dashboard-grid">
          <section class="panel today-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">TREINO PROGRAMADO</p>
                <h2 id="todayHeading">Carregando…</h2>
              </div>
              <span class="status-pill" id="todayStatus">—</span>
            </div>
            <div id="todayWorkout"></div>
          </section>

          <aside class="panel insight-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">LEITURA RÁPIDA</p>
                <h2>O que está acontecendo</h2>
              </div>
            </div>
            <div id="insightList" class="insight-list"></div>
          </aside>
        </div>

        <section class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">ÚLTIMOS 35 DIAS</p>
              <h2>Consistência</h2>
            </div>
            <div class="calendar-legend">
              <span><i class="dot completed"></i>Treinou</span>
              <span><i class="dot missed"></i>Faltou</span>
              <span><i class="dot rest"></i>Descanso</span>
            </div>
          </div>
          <div class="calendar" id="calendar"></div>
        </section>
      </section>

      <section class="view" id="view-progress">
        <div class="progress-switch" role="tablist">
          <button class="progress-switch-button active" data-progress-mode="sessions">Sessões completas</button>
          <button class="progress-switch-button" data-progress-mode="exercises">Exercícios individuais</button>
        </div>
        <section id="sessionProgressPanel">
          <div class="split-heading compact-heading">
            <div>
              <p class="eyebrow">TREINO CONTRA TREINO</p>
              <h2>Comparação das sessões</h2>
              <p class="muted">Ex.: Upper 1 desta semana contra o Upper 1 anterior. Exercícios trocados ficam fora da média, sem bagunçar o resultado.</p>
            </div>
          </div>
          <div class="session-progress-grid" id="sessionProgressGrid"></div>
        </section>
        <section id="exerciseProgressPanel" hidden>
        <section class="panel">
          <div class="panel-heading wrap">
            <div>
              <p class="eyebrow">TODOS OS EXERCÍCIOS</p>
              <h2>Progressão e regressão</h2>
              <p class="muted">Cada exercício tem um histórico global entre todas as rotinas, sem perder a comparação dentro de cada treino e a posição em que foi executado.</p>
            </div>
            <div class="filters">
              <input class="input" id="progressSearch" placeholder="Buscar exercício">
              <select class="input" id="trendFilter">
                <option value="all">Todas as tendências</option>
                <option value="progressao">Em progressão</option>
                <option value="estavel">Estáveis</option>
                <option value="regressao">Em regressão</option>
                <option value="sem_base">Sem base</option>
              </select>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Exercício</th><th>Aparece em</th><th>Última execução</th><th>Variação global</th><th>Tendência</th><th></th></tr></thead>
              <tbody id="progressTable"></tbody>
            </table>
          </div>
        </section>
        </section>
      </section>

      <section class="view" id="view-ai">
        <div class="ai-layout">
          <section class="panel ai-hero">
            <div class="ai-hero-copy">
              <div>
                <p class="eyebrow">IA COM SEU HISTÓRICO REAL</p>
                <h2>Pergunte sobre sua evolução</h2>
                <p class="muted">A IA recebe apenas um resumo relevante dos seus dados. Ela diferencia exercício global, mesma rotina, posição no treino e exercícios pulados.</p>
              </div>
              <div class="ai-status" id="aiStatus"><i></i><span>Verificando configuração…</span></div>
            </div>
            <div class="ai-mode-switch" role="tablist">
              <button type="button" data-ai-mode="coach" class="active"><strong>Coach</strong><small>Firme e prática</small></button>
              <button type="button" data-ai-mode="analyst"><strong>Analista</strong><small>Fria e objetiva</small></button>
            </div>
          </section>

          <section class="panel ai-chat-panel">
            <div class="ai-starters" id="aiStarterPrompts">
              <button type="button" data-ai-prompt="Como está minha evolução geral nas últimas semanas?">Evolução geral</button>
              <button type="button" data-ai-prompt="Quais exercícios estão estagnados ou regredindo de forma consistente?">Estagnações</button>
              <button type="button" data-ai-prompt="Minha frequência recente pode estar afetando meu desempenho?">Frequência</button>
              <button type="button" data-ai-prompt="Qual foi minha melhor sessão recente e por quê?">Melhor sessão</button>
            </div>
            <div class="ai-messages" id="aiMessages" aria-live="polite">
              <article class="ai-message assistant">
                <div class="ai-avatar">✦</div>
                <div><strong>IA do Progressão</strong><p>Me pergunta sobre um exercício, uma rotina, frequência, PRs ou tendência. Quanto mais específico, mais histórico relevante eu puxo.</p></div>
              </article>
            </div>
            <form class="ai-composer" id="aiForm">
              <textarea id="aiQuestion" maxlength="1200" rows="3" placeholder="Ex.: como está minha rosca Scott considerando Upper 1 e Upper 2?"></textarea>
              <div class="ai-composer-footer"><small>Não substitui avaliação médica ou acompanhamento profissional.</small><button class="primary-button" id="aiSend" type="submit">Analisar →</button></div>
            </form>
          </section>
        </div>
      </section>

      <section class="view" id="view-routines">
        <div class="split-heading">
          <div>
            <p class="eyebrow">PROGRAMAÇÃO SEMANAL</p>
            <h2>Suas rotinas</h2>
            <p class="muted">Cada rotina fica vinculada a um dia da semana. Se o dia passar sem registro, conta como falta.</p>
          </div>
          <button class="primary-button" id="newRoutineBtn">+ Nova rotina</button>
        </div>
        <div class="routine-grid" id="routineGrid"></div>
      </section>

      <section class="view" id="view-import">
        <div class="import-layout">
          <section class="panel upload-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">BASE HISTÓRICA</p>
                <h2>Importe sua planilha antiga</h2>
                <p class="muted">Aceita Excel (.xlsx) ou CSV. O site tenta reconhecer as colunas e permite ajustar o mapeamento.</p>
              </div>
            </div>
            <label class="dropzone" id="dropzone">
              <input type="file" id="importFile" accept=".xlsx,.xlsm,.csv" hidden>
              <span class="drop-icon">⇧</span>
              <strong>Escolha ou arraste sua planilha</strong>
              <small>Limite de 20 MB</small>
            </label>
            <div class="import-status" id="importStatus"></div>
          </section>

          <section class="panel" id="mappingPanel" hidden>
            <div class="panel-heading">
              <div>
                <p class="eyebrow">MAPEAMENTO</p>
                <h2>Confirme as colunas</h2>
              </div>
              <label class="field compact" id="sheetField" hidden><span>Aba</span><select class="input" id="sheetSelect"></select></label>
            </div>
            <div class="mapping-grid" id="mappingGrid"></div>
            <div class="preview-wrap">
              <h3>Prévia</h3>
              <div class="table-wrap"><table class="data-table preview-table" id="previewTable"></table></div>
            </div>
            <div class="button-row end">
              <button class="primary-button" id="commitImport">Importar dados</button>
            </div>
          </section>
        </div>
      </section>
      <section class="view" id="view-settings">
        <div class="settings-grid">
          <section class="panel">
            <div class="panel-heading"><div><p class="eyebrow">CONTA</p><h2>Sincronização</h2></div><span class="status-pill completed">Online</span></div>
            <div class="settings-account"><span>Conectado como</span><strong id="settingsEmail">—</strong><small>Seus dados ficam separados por usuário pelas políticas RLS.</small></div>
            <div class="settings-actions">
              <button class="primary-button" id="installApp" type="button">Instalar no Android</button>
              <button class="ghost-button" id="exportHistory" type="button">Exportar CSV</button>
              <button class="ghost-button" id="reloadCloud" type="button">Sincronizar agora</button>
              <button class="danger-button" id="logoutButton" type="button">Sair da conta</button>
            </div>
          </section>
          <section class="panel">
            <div class="panel-heading"><div><p class="eyebrow">INTELIGÊNCIA ARTIFICIAL</p><h2>Análise automática</h2></div><span class="status-pill" id="settingsAiStatus">Verificando</span></div>
            <p class="muted">A chave da OpenAI fica somente no servidor da Vercel. O navegador envia um resumo seletivo do seu histórico, nunca a chave secreta.</p>
            <label class="ai-setting-toggle"><input type="checkbox" id="autoAiAnalysis" checked><span><strong>Analisar ao finalizar o treino</strong><small>Gera um resumo da sessão automaticamente.</small></span></label>
            <div class="connection-summary"><span>Modelo</span><strong id="settingsAiModel">—</strong></div>
            <button class="ghost-button" type="button" data-view-link="ai">Abrir IA do treino</button>
          </section>
          <section class="panel">
            <div class="panel-heading"><div><p class="eyebrow">CONEXÃO</p><h2>Projeto Supabase</h2></div></div>
            <p class="muted">A URL e a chave publicável ficam salvas neste aparelho. Nenhuma chave secreta é usada no navegador.</p>
            <div class="connection-summary"><span>Projeto</span><strong id="connectionProject">—</strong></div>
            <button class="ghost-button" id="resetConnection" type="button">Trocar projeto Supabase</button>
          </section>
          <section class="panel">
            <div class="panel-heading"><div><p class="eyebrow">BACKUP</p><h2>Não fique refém de nada</h2></div></div>
            <p class="muted">O CSV exportado contém todas as séries realizadas e pode ser aberto no Excel ou reimportado depois.</p>
            <button class="ghost-button" id="downloadModel" type="button">Baixar planilha-modelo</button>
          </section>
        </div>
      </section>
    </main>
  </div>

  <dialog id="routineDialog" class="modal">
    <form method="dialog" id="routineForm">
      <div class="modal-header">
        <div><p class="eyebrow">CONFIGURAÇÃO</p><h2 id="routineDialogTitle">Nova rotina</h2></div>
        <button class="icon-button" value="cancel" aria-label="Fechar">×</button>
      </div>
      <input type="hidden" id="routineId">
      <div class="form-grid three">
        <label class="field"><span>Nome do treino</span><input class="input" id="routineName" required placeholder="Upper A"></label>
        <label class="field"><span>Dia da semana</span><select class="input" id="routineWeekday" required>
          <option value="segunda">Segunda-feira</option><option value="terca">Terça-feira</option><option value="quarta">Quarta-feira</option>
          <option value="quinta">Quinta-feira</option><option value="sexta">Sexta-feira</option><option value="sabado">Sábado</option><option value="domingo">Domingo</option>
        </select></label>
        <label class="field"><span>Válida desde</span><input class="input" id="routineStart" type="date" required></label>
      </div>

      <div class="section-heading-row">
        <div><h3>Exercícios</h3><p class="muted">Use o mesmo nome em rotinas diferentes para compartilhar o histórico global. A posição em cada treino continua registrada.</p></div>
        <button class="ghost-button" id="addExercise" type="button">+ Exercício</button>
      </div>
      <datalist id="globalExerciseOptions"></datalist>
      <div id="exerciseEditor" class="exercise-editor"></div>
      <div class="button-row end modal-actions">
        <button class="ghost-button" value="cancel">Cancelar</button>
        <button class="primary-button" id="saveRoutine" type="submit" value="default">Salvar rotina</button>
      </div>
    </form>
  </dialog>

  <dialog id="historyDialog" class="modal large-modal">
    <div class="modal-header">
      <div><p class="eyebrow">HISTÓRICO DO EXERCÍCIO</p><h2 id="historyTitle">Evolução</h2></div>
      <button class="icon-button" id="closeHistory" aria-label="Fechar">×</button>
    </div>
    <div class="history-kpis" id="historyKpis"></div>
    <div class="history-contexts" id="historyContexts"></div>
    <div class="chart-card">
      <svg id="progressChart" viewBox="0 0 900 280" role="img" aria-label="Gráfico de evolução"></svg>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Contexto</th><th>Séries</th><th>e1RM</th><th>Global</th><th>No mesmo treino</th></tr></thead><tbody id="historyTable"></tbody></table></div>
  </dialog>

  <dialog id="routineHistoryDialog" class="modal large-modal">
    <div class="modal-header">
      <div><p class="eyebrow">SESSÃO CONTRA SESSÃO</p><h2 id="routineHistoryTitle">Histórico da rotina</h2></div>
      <button class="icon-button" id="closeRoutineHistory" aria-label="Fechar">×</button>
    </div>
    <div id="routineHistoryList" class="routine-history-list"></div>
  </dialog>

  <dialog id="gymModeDialog" class="gym-mode-dialog">
    <div class="gym-mode-shell">
      <header class="gym-mode-header">
        <button class="gym-close" id="closeGymMode" type="button" aria-label="Sair do modo academia">×</button>
        <div><p class="eyebrow">MODO ACADEMIA</p><strong id="gymRoutineName">Treino</strong></div>
        <span id="gymExerciseCounter">1 de 1</span>
      </header>
      <div class="gym-progress"><i id="gymProgressBar"></i></div>
      <main id="gymExerciseHost" class="gym-exercise-host"></main>
      <footer class="gym-mode-footer">
        <button class="ghost-button" id="gymPrevious" type="button">← Anterior</button>
        <button class="primary-button" id="gymNext" type="button">Salvar e próximo →</button>
        <button class="gym-finish-button" id="gymFinish" type="button">Finalizar treino</button>
      </footer>
    </div>
  </dialog>

  <dialog id="workoutSummaryDialog" class="modal workout-summary-modal">
    <div class="modal-header">
      <div><p class="eyebrow">ANÁLISE IMEDIATA</p><h2 id="workoutSummaryTitle">Treino concluído</h2></div>
      <button class="icon-button" id="closeWorkoutSummary" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="workout-summary-score" id="workoutSummaryScore"></div>
    <div class="workout-summary-kpis" id="workoutSummaryKpis"></div>
    <div class="workout-summary-exercises" id="workoutSummaryExercises"></div>
    <section class="workout-ai-panel" id="workoutAiPanel">
      <div class="workout-ai-heading"><div><span>✦ IA DO TREINO</span><strong id="workoutAiTitle">Análise contextual</strong></div><button class="ghost-button" id="retryWorkoutAi" type="button">Gerar análise</button></div>
      <div id="workoutAiContent" class="workout-ai-content"><p>Configure a OpenAI no Vercel para receber uma leitura contextual desta sessão.</p></div>
    </section>
    <button class="primary-button full" id="summaryDone" type="button">Fechar análise</button>
  </dialog>

  <dialog id="passwordRecoveryDialog" class="modal recovery-modal">
    <form id="passwordRecoveryForm">
      <div class="modal-header">
        <div><p class="eyebrow">RECUPERAÇÃO DE CONTA</p><h2>Crie uma nova senha</h2></div>
      </div>
      <p class="muted">O link do e-mail confirmou sua identidade. Agora escolha a nova senha.</p>
      <div class="gate-form">
        <label class="field"><span>Nova senha</span><input class="input" id="newPassword" type="password" minlength="6" autocomplete="new-password" required></label>
        <label class="field"><span>Confirmar senha</span><input class="input" id="confirmPassword" type="password" minlength="6" autocomplete="new-password" required></label>
        <button class="primary-button full" id="saveNewPassword" type="submit">Salvar nova senha</button>
        <p id="passwordRecoveryMessage" class="gate-message"></p>
      </div>
    </form>
  </dialog>

  <nav class="bottom-nav" id="bottomNav" aria-label="Navegação principal" hidden>
    <button class="bottom-nav-item active" data-view-link="dashboard"><span>⌂</span><small>Hoje</small></button>
    <button class="bottom-nav-item" data-view-link="progress"><span>↗</span><small>Evolução</small></button>
    <button class="bottom-nav-item" data-view-link="ai"><span>✦</span><small>IA</small></button>
    <button class="bottom-nav-item" data-view-link="routines"><span>≡</span><small>Rotinas</small></button>
    <button class="bottom-nav-item" data-view-link="settings"><span>⚙</span><small>Conta</small></button>
  </nav>`;
