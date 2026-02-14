/**
 * Financial Discipline — Telegram Mini App
 * Setup + Dashboard, validation, stages, Telegram WebApp SDK
 */

const MAX_CYCLE_DAYS = 365;
const MIN_BUDGET = 1;

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function initTelegram() {
  if (typeof window.Telegram?.WebApp === 'undefined') return;
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
  document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams?.bg_color || '#000');
  document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams?.text_color || '#fff');
}

function showScreen(name) {
  document.querySelectorAll('[data-screen]').forEach(el => el.classList.remove('active'));
  const el = document.querySelector('[data-screen="' + name + '"]');
  if (el) el.classList.add('active');
}

function showError(msg) {
  const w = document.getElementById('setup-error');
  w.textContent = msg;
  w.classList.add('visible');
}

function clearError() {
  document.getElementById('setup-error').classList.remove('visible');
  document.getElementById('setup-error').textContent = '';
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

function setInvalid(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.classList.add('invalid');
}

function validateSetup() {
  const budgetRaw = document.getElementById('monthly-budget').value.replace(/\s/g, '');
  const budget = Number(budgetRaw);
  const start = document.getElementById('cycle-start').value;
  const end = document.getElementById('cycle-end').value;

  clearError();
  const errors = [];

  if (!budgetRaw || isNaN(budget) || budget < MIN_BUDGET) {
    errors.push('Budget must be greater than 0.');
    setInvalid('monthly-budget');
  }
  if (!start) {
    errors.push('Cycle start is required.');
    setInvalid('cycle-start');
  }
  if (!end) {
    errors.push('Cycle end is required.');
    setInvalid('cycle-end');
  }
  if (start && end && new Date(end) <= new Date(start)) {
    errors.push('End date must be after start date.');
    setInvalid('cycle-end');
  }
  if (start && end) {
    const days = (new Date(end) - new Date(start)) / (24 * 60 * 60 * 1000) + 1;
    if (days > MAX_CYCLE_DAYS) {
      errors.push('Cycle cannot exceed ' + MAX_CYCLE_DAYS + ' days.');
      setInvalid('cycle-end');
    }
  }

  if (errors.length) {
    showError(errors.join(' '));
    document.getElementById('setup-form').classList.add('shake');
    setTimeout(() => document.getElementById('setup-form').classList.remove('shake'), 500);
    return null;
  }

  return { monthlyBudget: budget, startDate: start, endDate: end };
}

function initSetup() {
  const form = document.getElementById('setup-form');
  const startInput = document.getElementById('cycle-start');
  const endInput = document.getElementById('cycle-end');

  const now = new Date();
  startInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  endInput.value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  startInput.addEventListener('change', () => {
    const start = startInput.value;
    if (!start) return;
    const d = new Date(start);
    endInput.value = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const params = validateSetup();
    if (!params) return;
    window.FinancialDisciplineStore.createCycle(params);
    clearError();
    showScreen('dashboard');
    renderDashboard();
  });
}

function getBurnWidgetState(cycle) {
  const L = window.FinancialDisciplineLogic;
  const allowed = L.getAllowedDaily(cycle);
  const spent = L.getSpentToday(cycle);
  if (L.getRemainingBudget(cycle) <= 0) return 'critical';
  if (allowed > 0 && spent > allowed) return L.getStage(cycle) === 'critical' ? 'critical' : 'overspend';
  if (allowed > 0 && spent >= allowed * 0.8) return 'safe';
  return 'stable';
}

function renderDashboard() {
  const cycle = window.FinancialDisciplineStore.getActiveCycle();
  if (!cycle) {
    showScreen('setup');
    return;
  }

  const L = window.FinancialDisciplineLogic;
  const remaining = L.getRemainingBudget(cycle);
  const daysLeft = L.getRemainingDays(cycle);
  const allowedDaily = L.getAllowedDaily(cycle);
  const spentToday = L.getSpentToday(cycle);
  const deviation = L.getDeviationPercent(cycle);
  const remainingPercent = cycle.monthlyBudget > 0 ? (remaining / cycle.monthlyBudget) * 100 : 0;
  const stage = L.getStage(cycle);

  document.getElementById('allowed-today').textContent = formatMoney(allowedDaily);
  document.getElementById('spent-today').textContent = formatMoney(spentToday);
  const devEl = document.getElementById('deviation');
  devEl.textContent = (deviation >= 0 ? '+' : '') + Math.round(deviation) + '%';
  devEl.classList.toggle('over', deviation > 0);

  document.getElementById('survival-percent').textContent = Math.round(remainingPercent) + '%';
  document.getElementById('survival-fill').style.width = Math.max(0, Math.min(100, remainingPercent)) + '%';

  document.getElementById('remaining-total').textContent = formatMoney(remaining);
  document.getElementById('days-left').textContent = daysLeft;
  document.getElementById('daily-allowed').textContent = formatMoney(allowedDaily);

  const burnWidget = document.getElementById('burn-widget');
  burnWidget.className = 'glass widget burn-widget ' + getBurnWidgetState(cycle);

  const survivalWrap = document.getElementById('survival-bar-wrap');
  survivalWrap.classList.remove('melt', 'crack', 'glitch');
  if (stage === 'collapse' || remainingPercent < 5) survivalWrap.classList.add('glitch');
  else if (stage === 'critical') survivalWrap.classList.add('crack');
  else if (L.getState(cycle) === 'overspending' || L.getState(cycle) === 'risk') survivalWrap.classList.add('melt');

  document.body.classList.remove('stage-mild', 'stage-critical', 'stage-collapse');
  document.body.classList.add('stage-' + stage);
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModals() {
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
}

function initDashboard() {
  document.getElementById('btn-add-expense').addEventListener('click', () => {
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-comment').value = '';
    openModal('modal-expense');
  });

  document.getElementById('expense-save').addEventListener('click', () => {
    const amount = document.getElementById('expense-amount').value.replace(/\s/g, '');
    const comment = document.getElementById('expense-comment').value.trim();
    if (!amount || isNaN(Number(amount))) return;
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (!cycle) return;
    window.FinancialDisciplineStore.addExpense(cycle.id, {
      amount: Number(amount),
      category: 'other',
      comment,
    });
    closeModals();
    renderDashboard();
  });
  document.getElementById('expense-cancel').addEventListener('click', closeModals);

  document.getElementById('btn-details').addEventListener('click', () => {
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (!cycle) return;
    const L = window.FinancialDisciplineLogic;
    const runOutDay = L.getRunOutDay(cycle);
    const daysUntil = L.getDaysUntilRunOut(cycle);
    let msg = 'At your current daily spend rate, ';
    if (runOutDay != null) msg += 'you will run out of money on day ' + runOutDay + ' of the cycle.';
    else if (daysUntil != null) msg += 'budget lasts ' + daysUntil + ' more days.';
    else msg += 'you are within the daily limit.';
    document.getElementById('prediction-msg').textContent = msg;

    const ideal = L.getIdealPacePoints(cycle);
    const actual = L.getActualPacePoints(cycle);
    const maxAmount = Math.max(cycle.monthlyBudget, ...actual.map(p => p.amount));
    const maxDay = Math.max(...ideal.map(p => p.day), ...actual.map(p => p.day), 1);
    const w = 300; const h = 120; const pad = { top: 10, right: 15, bottom: 20, left: 35 };
    const x = d => pad.left + (d / maxDay) * (w - pad.left - pad.right);
    const y = a => pad.top + (h - pad.top - pad.bottom) - (a / (maxAmount || 1)) * (h - pad.top - pad.bottom);
    const pathIdeal = 'M ' + ideal.map(p => x(p.day) + ' ' + y(p.amount)).join(' L ');
    const pathActual = 'M ' + actual.map(p => x(p.day) + ' ' + y(p.amount)).join(' L ');
    document.getElementById('details-chart').innerHTML =
      '<path class="line-ideal" d="' + pathIdeal + '" stroke-width="1.5"/>' +
      '<path class="line-actual" d="' + pathActual + '"/>';
    openModal('modal-details');
  });
  document.getElementById('details-close').addEventListener('click', closeModals);

  document.getElementById('btn-reset').addEventListener('click', () => openModal('modal-reset'));
  document.getElementById('reset-confirm').addEventListener('click', () => {
    window.FinancialDisciplineStore.setActiveCycleId(null);
    closeModals();
    showScreen('setup');
  });
  document.getElementById('reset-cancel').addEventListener('click', closeModals);

  document.querySelectorAll('.modal .modal-backdrop[data-close]').forEach(backdrop => {
    backdrop.addEventListener('click', closeModals);
  });
}

function render() {
  const active = window.FinancialDisciplineStore.getActiveCycle();
  if (!active) {
    showScreen('setup');
    return;
  }
  showScreen('dashboard');
  renderDashboard();
}

function init() {
  initTelegram();
  initSetup();
  initDashboard();
  render();
}

document.addEventListener('DOMContentLoaded', init);
