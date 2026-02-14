/**
 * Financial Discipline — Burn rate & state logic
 * Allowed daily = remaining budget / remaining days
 */

function parseDate(str) {
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getRemainingDays(cycle) {
  const end = parseDate(cycle.endDate);
  const today = parseDate(new Date().toISOString().slice(0, 10));
  if (today > end) return 0;
  return Math.ceil((end - today) / (24 * 60 * 60 * 1000)) || 1;
}

function getTotalSpent(cycle) {
  return (cycle.expenses || []).reduce((s, e) => s + e.amount, 0);
}

function getRemainingBudget(cycle) {
  return Math.max(0, cycle.monthlyBudget - getTotalSpent(cycle));
}

function getAllowedDaily(cycle) {
  const remaining = getRemainingBudget(cycle);
  const days = getRemainingDays(cycle);
  if (days <= 0) return 0;
  return remaining / days;
}

function getSpentToday(cycle) {
  const today = new Date().toISOString().slice(0, 10);
  return (cycle.expenses || [])
    .filter(e => (e.date || (e.createdAt || '').slice(0, 10)) === today)
    .reduce((s, e) => s + e.amount, 0);
}

function getState(cycle) {
  if (getRemainingBudget(cycle) <= 0) return 'death';
  const allowedDaily = getAllowedDaily(cycle);
  const spentToday = getSpentToday(cycle);
  if (spentToday > allowedDaily) return 'overspending';
  if (allowedDaily > 0 && spentToday / allowedDaily >= 0.8) return 'risk';
  return 'normal';
}

function getProgressPercent(cycle) {
  const total = getTotalSpent(cycle);
  const limit = cycle.monthlyBudget;
  if (limit <= 0) return 0;
  return Math.min(100, (total / limit) * 100);
}

function getIdealPacePoints(cycle) {
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const totalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const perDay = cycle.monthlyBudget / totalDays;
  const points = [];
  for (let i = 0; i <= totalDays; i++) points.push({ day: i, amount: perDay * i });
  return points;
}

function getActualPacePoints(cycle) {
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const byDay = {};
  (cycle.expenses || []).forEach(e => {
    const d = e.date || (e.createdAt || '').slice(0, 10);
    if (!d) return;
    const dayIndex = Math.floor((parseDate(d) - start) / (24 * 60 * 60 * 1000));
    byDay[dayIndex] = (byDay[dayIndex] || 0) + e.amount;
  });
  const totalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
  let cum = 0;
  const points = [];
  for (let i = 0; i <= totalDays; i++) {
    cum += byDay[i] || 0;
    points.push({ day: i, amount: cum });
  }
  return points;
}

function getCategoryDistribution(cycle) {
  const totals = {};
  (cycle.expenses || []).forEach(e => {
    const cat = e.category || 'other';
    totals[cat] = (totals[cat] || 0) + e.amount;
  });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.entries(totals).map(([name, amount]) => ({
    name,
    amount,
    percent: total ? (amount / total) * 100 : 0,
  }));
}

function getTotalDays(cycle) {
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** Deviation: how much today's spend is over/under daily limit (percentage, e.g. 20 = 20% over) */
function getDeviationPercent(cycle) {
  const allowed = getAllowedDaily(cycle);
  const spent = getSpentToday(cycle);
  if (allowed <= 0) return spent > 0 ? 100 : 0;
  return ((spent - allowed) / allowed) * 100;
}

/** Predicted day (1-based from cycle start) when money runs out at today's spend rate; null if safe. */
function getRunOutDay(cycle) {
  const remaining = getRemainingBudget(cycle);
  const spentToday = getSpentToday(cycle);
  if (remaining <= 0) return 0;
  if (spentToday <= 0) return null;
  const start = parseDate(cycle.startDate);
  const today = parseDate(new Date().toISOString().slice(0, 10));
  const dayIndexToday = Math.floor((today - start) / (24 * 60 * 60 * 1000));
  const daysUntilZero = remaining / spentToday;
  const runOutDayIndex = dayIndexToday + Math.ceil(daysUntilZero);
  const totalDays = getTotalDays(cycle);
  return runOutDayIndex >= totalDays ? null : runOutDayIndex + 1;
}

/** Days until budget hits zero at today's spend rate */
function getDaysUntilRunOut(cycle) {
  const remaining = getRemainingBudget(cycle);
  const spentToday = getSpentToday(cycle);
  if (spentToday <= 0) return null;
  return Math.floor(remaining / spentToday);
}

/** UI stage: mild | critical | collapse */
function getStage(cycle) {
  const remaining = getRemainingBudget(cycle);
  const remainingPercent = cycle.monthlyBudget > 0 ? (remaining / cycle.monthlyBudget) * 100 : 100;
  const allowed = getAllowedDaily(cycle);
  const spentToday = getSpentToday(cycle);
  const isOverspending = allowed > 0 && spentToday > allowed;

  if (remaining <= 0 || remainingPercent < 5) return 'collapse';
  if (remainingPercent < 25 || (isOverspending && remainingPercent < 40)) return 'critical';
  if (isOverspending) return 'mild';
  return 'stable';
}

function getDisciplineIndex(cycle) {
  const start = parseDate(cycle.startDate);
  const end = parseDate(cycle.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = today > end ? end : today;
  const totalDays = Math.ceil((lastDay - start) / (24 * 60 * 60 * 1000)) + 1;
  if (totalDays <= 0) return 100;
  const cycleTotalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const perDayIdeal = cycle.monthlyBudget / cycleTotalDays;
  const byDay = {};
  (cycle.expenses || []).forEach(e => {
    const d = e.date || (e.createdAt || '').slice(0, 10);
    if (!d) return;
    const dayIndex = Math.floor((parseDate(d) - start) / (24 * 60 * 60 * 1000));
    byDay[dayIndex] = (byDay[dayIndex] || 0) + e.amount;
  });
  let daysWithoutOverspend = 0;
  for (let i = 0; i < totalDays; i++) {
    if ((byDay[i] || 0) <= perDayIdeal * 1.001) daysWithoutOverspend++;
  }
  return (daysWithoutOverspend / totalDays) * 100;
}

window.FinancialDisciplineLogic = {
  getRemainingDays,
  getTotalSpent,
  getRemainingBudget,
  getAllowedDaily,
  getSpentToday,
  getState,
  getProgressPercent,
  getDeviationPercent,
  getRunOutDay,
  getDaysUntilRunOut,
  getTotalDays,
  getStage,
  getIdealPacePoints,
  getActualPacePoints,
  getCategoryDistribution,
  getDisciplineIndex,
};
