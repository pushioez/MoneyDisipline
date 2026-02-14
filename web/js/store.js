/**
 * Financial Discipline — Data layer (localStorage)
 */

const STORAGE_KEY = 'financial_discipline';
const CYCLES_KEY = STORAGE_KEY + '_cycles';
const HISTORY_KEY = STORAGE_KEY + '_defeats';

function getCycles() {
  try {
    const raw = localStorage.getItem(CYCLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getActiveCycle() {
  const cycles = getCycles();
  const id = localStorage.getItem(STORAGE_KEY + '_active');
  return id ? cycles.find(c => c.id === id) || null : null;
}

function setActiveCycleId(id) {
  if (id) localStorage.setItem(STORAGE_KEY + '_active', id);
  else localStorage.removeItem(STORAGE_KEY + '_active');
}

function saveCycles(cycles) {
  localStorage.setItem(CYCLES_KEY, JSON.stringify(cycles));
}

function createCycle({ monthlyBudget, startDate, endDate }) {
  const cycles = getCycles();
  const id = 'c_' + Date.now();
  const cycle = {
    id,
    monthlyBudget: Number(monthlyBudget) || 0,
    startDate,
    endDate,
    expenses: [],
    createdAt: new Date().toISOString(),
  };
  cycles.push(cycle);
  saveCycles(cycles);
  setActiveCycleId(id);
  return cycle;
}

function updateCycle(cycle) {
  const cycles = getCycles().map(c => (c.id === cycle.id ? cycle : c));
  saveCycles(cycles);
  return cycle;
}

function addExpense(cycleId, { amount, category, comment }) {
  const cycles = getCycles();
  const cycle = cycles.find(c => c.id === cycleId);
  if (!cycle) return null;
  const expense = {
    id: 'e_' + Date.now(),
    amount: Number(amount) || 0,
    category: category || 'other',
    comment: (comment || '').trim(),
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  cycle.expenses = cycle.expenses || [];
  cycle.expenses.push(expense);
  saveCycles(cycles);
  return expense;
}

function getDefeatsHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDefeat(record) {
  const history = getDefeatsHistory();
  history.push({ ...record, at: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getDaysSurvived(cycle) {
  const start = new Date(cycle.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - start) / (24 * 60 * 60 * 1000)));
}

function archiveAndNewCycle(newCycleParams) {
  const active = getActiveCycle();
  if (active) {
    const history = getDefeatsHistory();
    history.push({
      cycleId: active.id,
      daysSurvived: getDaysSurvived(active),
      overspent: Math.max(0, (active.expenses || []).reduce((s, e) => s + e.amount, 0) - active.monthlyBudget),
      endReason: 'manual_new_cycle',
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
  setActiveCycleId(null);
  return createCycle(newCycleParams);
}

window.FinancialDisciplineStore = {
  getCycles,
  getActiveCycle,
  createCycle,
  updateCycle,
  addExpense,
  getDefeatsHistory,
  addDefeat,
  archiveAndNewCycle,
  setActiveCycleId,
};
