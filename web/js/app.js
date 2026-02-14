/**
 * Financial Discipline — UI, routing, modals
 */

const CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'other', label: 'Other' },
];

function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
}

function render() {
  const active = window.FinancialDisciplineStore.getActiveCycle();
  const state = active ? window.FinancialDisciplineLogic.getState(active) : null;

  if (!active) {
    showScreen('onboarding');
    return;
  }
  if (state === 'death') {
    showScreen('death');
    renderDeath(active);
    return;
  }

  showScreen('dashboard');
  renderDashboard(active);
}

function showScreen(name) {
  document.querySelectorAll('[data-screen]').forEach(el => el.classList.remove('active'));
  const el = document.querySelector('[data-screen="' + name + '"]');
  if (el) el.classList.add('active');
}

function renderDeath(cycle) {
  const L = window.FinancialDisciplineLogic;
  const start = new Date(cycle.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const daysSurvived = Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000)));
  const overspent = Math.max(0, L.getTotalSpent(cycle) - cycle.monthlyBudget);
  document.getElementById('death-days').textContent = daysSurvived;
  document.getElementById('death-overspent').textContent = new Intl.NumberFormat('ru-RU').format(overspent);
}

function renderDashboard(cycle) {
  const L = window.FinancialDisciplineLogic;
  const remaining = L.getRemainingBudget(cycle);
  const allowedDaily = L.getAllowedDaily(cycle);
  const spentToday = L.getSpentToday(cycle);
  const state = L.getState(cycle);
  const progress = L.getProgressPercent(cycle);

  document.getElementById('remaining-value').textContent = formatMoney(remaining);
  document.getElementById('allowed-today-value').textContent = formatMoney(allowedDaily);
  document.getElementById('spent-today-value').textContent = formatMoney(spentToday);

  const widget = document.getElementById('burning-budget-widget');
  widget.className = 'burning-widget state-' + state;
  widget.style.setProperty('--progress', progress + '%');

  document.body.classList.remove('state-normal', 'state-risk', 'state-overspending', 'state-death');
  document.body.classList.add('state-' + state);
}

function initOnboarding() {
  const form = document.getElementById('onboarding-form');
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
    const monthlyBudget = document.getElementById('monthly-budget').value.replace(/\s/g, '');
    const startDate = startInput.value;
    const endDate = endInput.value;
    if (!monthlyBudget || !startDate || !endDate) return;
    window.FinancialDisciplineStore.createCycle({
      monthlyBudget: Number(monthlyBudget),
      startDate,
      endDate,
    });
    render();
  });
}

function initDashboard() {
  document.getElementById('btn-add-expense').addEventListener('click', () => document.getElementById('modal-add-expense').classList.add('open'));
  document.getElementById('btn-analytics').addEventListener('click', () => {
    showScreen('analytics');
    renderAnalytics();
  });
  document.getElementById('btn-new-cycle').addEventListener('click', openNewCycleModal);
  document.getElementById('btn-emergency').addEventListener('click', openEmergencyModal);
  document.getElementById('analytics-back').addEventListener('click', () => render());

  document.getElementById('expense-save').addEventListener('click', () => {
    const amount = document.getElementById('expense-amount').value.replace(/\s/g, '');
    const category = document.getElementById('expense-category').value;
    const comment = document.getElementById('expense-comment').value;
    if (!amount) return;
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (!cycle) return;
    window.FinancialDisciplineStore.addExpense(cycle.id, { amount, category, comment });
    document.getElementById('modal-add-expense').classList.remove('open');
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-comment').value = '';
    render();
    const L = window.FinancialDisciplineLogic;
    if (L.getSpentToday(cycle) > L.getAllowedDaily(cycle)) document.body.classList.add('flash-red');
    setTimeout(() => document.body.classList.remove('flash-red'), 600);
  });
  document.getElementById('expense-cancel').addEventListener('click', () => document.getElementById('modal-add-expense').classList.remove('open'));

  document.getElementById('death-survive').addEventListener('click', () => { showScreen('dashboard'); render(); });
  document.getElementById('death-new-cycle').addEventListener('click', () => {
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (cycle) {
      const start = new Date(cycle.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      start.setHours(0, 0, 0, 0);
      window.FinancialDisciplineStore.addDefeat({
        cycleId: cycle.id,
        daysSurvived: Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000))),
        overspent: Math.max(0, window.FinancialDisciplineLogic.getTotalSpent(cycle) - cycle.monthlyBudget),
        endReason: 'defeat',
      });
    }
    window.FinancialDisciplineStore.setActiveCycleId(null);
    render();
  });

  document.getElementById('new-cycle-confirm').addEventListener('click', () => {
    const monthlyBudget = document.getElementById('new-cycle-budget').value.replace(/\s/g, '');
    const startDate = document.getElementById('new-cycle-start').value;
    const endDate = document.getElementById('new-cycle-end').value;
    if (!monthlyBudget || !startDate || !endDate) return;
    window.FinancialDisciplineStore.archiveAndNewCycle({ monthlyBudget: Number(monthlyBudget), startDate, endDate });
    document.getElementById('modal-new-cycle').classList.remove('open');
    render();
  });
  document.getElementById('new-cycle-cancel').addEventListener('click', () => document.getElementById('modal-new-cycle').classList.remove('open'));

  document.getElementById('emergency-decrease').addEventListener('click', () => {
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (!cycle) return;
    const val = prompt('Reduce remaining budget by (₽):', '0');
    const n = Number((val || '0').replace(/\s/g, ''));
    if (n > 0) {
      cycle.monthlyBudget = Math.max(0, cycle.monthlyBudget - n);
      window.FinancialDisciplineStore.updateCycle(cycle);
      document.getElementById('modal-emergency').classList.remove('open');
      render();
    }
  });
  document.getElementById('emergency-increase').addEventListener('click', () => {
    const cycle = window.FinancialDisciplineStore.getActiveCycle();
    if (!cycle) return;
    const val = prompt('Increase budget by (₽) — rule violation:', '0');
    const n = Number((val || '0').replace(/\s/g, ''));
    if (n > 0) {
      cycle.monthlyBudget += n;
      window.FinancialDisciplineStore.updateCycle(cycle);
      document.getElementById('modal-emergency').classList.remove('open');
      render();
    }
  });
  document.getElementById('emergency-close').addEventListener('click', () => document.getElementById('modal-emergency').classList.remove('open'));

  document.querySelectorAll('.modal .modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')));
  });
}

function openNewCycleModal() {
  const now = new Date();
  document.getElementById('new-cycle-budget').value = '';
  document.getElementById('new-cycle-start').value = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  document.getElementById('new-cycle-end').value = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);
  document.getElementById('modal-new-cycle').classList.add('open');
}

function openEmergencyModal() {
  const cycle = window.FinancialDisciplineStore.getActiveCycle();
  if (!cycle) return;
  document.getElementById('emergency-remaining').textContent = formatMoney(window.FinancialDisciplineLogic.getRemainingBudget(cycle));
  document.getElementById('modal-emergency').classList.add('open');
}

function renderAnalytics() {
  const cycle = window.FinancialDisciplineStore.getActiveCycle();
  if (!cycle) return;
  const L = window.FinancialDisciplineLogic;
  const ideal = L.getIdealPacePoints(cycle);
  const actual = L.getActualPacePoints(cycle);
  const categories = L.getCategoryDistribution(cycle);
  const disciplineIndex = L.getDisciplineIndex(cycle);
  const maxAmount = Math.max(cycle.monthlyBudget, ...actual.map(p => p.amount));
  const maxDay = Math.max(...ideal.map(p => p.day), ...actual.map(p => p.day), 1);
  const w = 280, h = 140, pad = { top: 10, right: 10, bottom: 20, left: 40 };
  const x = d => pad.left + (d / maxDay) * (w - pad.left - pad.right);
  const y = a => pad.top + (h - pad.top - pad.bottom) - (a / (maxAmount || 1)) * (h - pad.top - pad.bottom);
  const pathIdeal = 'M ' + ideal.map(p => x(p.day) + ' ' + y(p.amount)).join(' L ');
  const pathActual = 'M ' + actual.map(p => x(p.day) + ' ' + y(p.amount)).join(' L ');
  document.getElementById('pace-chart').innerHTML =
    '<path class="line-ideal" d="' + pathIdeal + '" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path class="line-actual" d="' + pathActual + '" fill="none" stroke="currentColor" stroke-width="2.5"/>';
  document.getElementById('discipline-index-value').textContent = Math.round(disciplineIndex) + '%';
  document.getElementById('discipline-bar').style.setProperty('--percent', disciplineIndex + '%');
  document.getElementById('analytics-categories').innerHTML = categories.map(c =>
    '<div class="glass card category-card"><span class="category-name">' + (CATEGORIES.find(x => x.id === c.name)?.label || c.name) +
    '</span><span class="category-percent">' + Math.round(c.percent) + '%</span><div class="category-bar"><span style="width:' + c.percent + '%"></span></div></div>'
  ).join('');
}

function init() {
  initOnboarding();
  initDashboard();
  render();
}

document.addEventListener('DOMContentLoaded', init);
