/* Meu Bolso — dados pessoais armazenados localmente no navegador. */
(() => {
  'use strict';

  const STORAGE_KEY = 'meuBolsoData';
  const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'];
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const $ = (selector) => document.querySelector(selector);
  const today = new Date();
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthKey = (date = today) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(today);

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
        bills: Array.isArray(saved.bills) ? saved.bills : [],
        debts: Array.isArray(saved.debts) ? saved.debts : [],
        categories: [...new Set([...DEFAULT_CATEGORIES, ...(Array.isArray(saved.categories) ? saved.categories : [])])],
        safetyMargin: Number.isFinite(Number(saved.safetyMargin)) ? Math.max(0, Number(saved.safetyMargin)) : 300
      };
    } catch (error) {
      console.warn('Não foi possível ler os dados salvos.', error);
      return { transactions: [], bills: [], debts: [], categories: [...DEFAULT_CATEGORIES], safetyMargin: 300 };
    }
  }

  let data = loadData();
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { showToast('Não foi possível salvar. Verifique o espaço do navegador.'); console.error(error); }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function getMonthTransactions() {
    return data.transactions.filter((item) => typeof item.date === 'string' && item.date.startsWith(monthKey()));
  }
  function render() {
    const transactionsThisMonth = getMonthTransactions();
    const allIncome = data.transactions.filter((item) => item.type === 'income').reduce((total, item) => total + Number(item.amount || 0), 0);
    const allExpenses = data.transactions.filter((item) => item.type === 'expense').reduce((total, item) => total + Number(item.amount || 0), 0);
    const income = transactionsThisMonth.filter((item) => item.type === 'income').reduce((total, item) => total + Number(item.amount || 0), 0);
    const expenses = transactionsThisMonth.filter((item) => item.type === 'expense').reduce((total, item) => total + Number(item.amount || 0), 0);
    const balance = allIncome - allExpenses;
    const fixedTotal = data.bills.reduce((total, bill) => total + Number(bill.amount || 0), 0);
    const amountNeeded = fixedTotal + data.safetyMargin - balance;

    $('#today-label').textContent = fullDateFormatter.format(today);
    $('#month-label').textContent = `Aqui está o resumo de ${monthName}.`;
    $('#budget-month').textContent = monthName;
    $('#balance-value').textContent = money.format(balance);
    $('#balance-value').classList.toggle('red-text', balance < 0);
    $('#balance-value').classList.toggle('green-text', balance >= 0);
    $('#income-value').textContent = money.format(income);
    $('#expense-value').textContent = money.format(expenses);
    $('#target-value').textContent = money.format(Math.max(0, amountNeeded));
    $('#target-value').classList.toggle('green-text', amountNeeded <= 0);
    $('#target-caption').textContent = amountNeeded > 0 ? 'Para cobrir contas fixas e margem de segurança' : 'Saldo cobre as contas fixas e a margem';
    $('#fixed-total').textContent = money.format(fixedTotal);
    $('#fixed-count').textContent = `${data.bills.length} ${data.bills.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}`;
    $('#safety-margin').value = data.safetyMargin.toFixed(2);
    $('#budget-spent').textContent = money.format(expenses);
    $('#budget-income').textContent = money.format(income);

    const percent = income > 0 ? Math.round((expenses / income) * 100) : 0;
    const progress = Math.min(percent, 100);
    $('#budget-progress').style.width = `${progress}%`;
    $('#budget-progress').style.background = percent > 100 ? '#e15b63' : '';
    $('.progress-track').setAttribute('aria-valuenow', String(progress));
    $('#budget-percent').textContent = `${percent}%`;
    $('#budget-caption').textContent = income === 0 ? 'Adicione receitas e despesas para acompanhar seu orçamento.' : percent > 100 ? 'As despesas passaram das receitas do mês.' : 'das receitas foram usadas em despesas';

    renderCategoryOptions();
    renderTransactions(transactionsThisMonth);
    renderBills();
    renderDebts();
  }

  function renderCategoryOptions() {
    const filter = $('#category-filter');
    const selected = filter.value || 'all';
    filter.innerHTML = '<option value="all">Todas as categorias</option>' + data.categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
    filter.value = data.categories.includes(selected) ? selected : 'all';
    const category = $('#transaction-category');
    const current = category.value;
    category.innerHTML = data.categories.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join('') + '<option value="__new">＋ Criar categoria</option>';
    if (data.categories.includes(current)) category.value = current;
  }

  function renderTransactions(items) {
    const category = $('#category-filter').value;
    const filtered = items.filter((item) => category === 'all' || item.category === category).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    $('#transaction-list').innerHTML = filtered.map((item) => {
      const income = item.type === 'income';
      const date = new Date(`${item.date}T12:00:00`);
      return `<article class="transaction-item"><div class="transaction-main"><span class="transaction-symbol ${income ? 'income' : 'expense'}" aria-hidden="true">${income ? '↙' : '↗'}</span><span class="transaction-description">${escapeHTML(item.description)}</span></div><span class="transaction-category"><span class="category-pill">${escapeHTML(item.category)}</span></span><span class="transaction-date">${dateFormatter.format(date)}</span><span class="transaction-amount ${income ? 'income' : 'expense'}">${income ? '+' : '−'} ${money.format(Number(item.amount))}</span><button class="delete-button" type="button" data-delete-transaction="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.description)}">×</button></article>`;
    }).join('');
    $('#transaction-empty').classList.toggle('visible', filtered.length === 0);
    $('#transaction-list').style.display = filtered.length ? 'grid' : 'none';
    $('#transaction-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'transação' : 'transações'}`;
  }

  function renderBills() {
    $('#bills-list').innerHTML = data.bills.slice().sort((a, b) => Number(a.dueDay) - Number(b.dueDay)).map((bill) => `<article class="bill-row"><div class="bill-name"><span class="bill-symbol" aria-hidden="true">◷</span>${escapeHTML(bill.name)}</div><span class="bill-amount">${money.format(Number(bill.amount))}</span><span class="bill-day">Vence dia ${escapeHTML(bill.dueDay)}</span><button class="delete-button" type="button" data-delete-bill="${escapeHTML(bill.id)}" aria-label="Excluir conta ${escapeHTML(bill.name)}">×</button></article>`).join('');
    $('#bills-empty').style.display = data.bills.length ? 'none' : 'block';
  }

  function renderDebts() {
    const openDebts = data.debts.filter((debt) => !debt.paid);
    const total = openDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
    $('#debts-total').textContent = money.format(total);
    $('#debts-count').textContent = `${openDebts.length} ${openDebts.length === 1 ? 'dívida em aberto' : 'dívidas em aberto'}`;
    const ordered = data.debts.slice().sort((a, b) => Number(Boolean(a.paid)) - Number(Boolean(b.paid)) || String(a.dueDate).localeCompare(String(b.dueDate)));
    $('#debts-list').innerHTML = ordered.map((debt) => {
      const dueDate = debt.dueDate ? dateFormatter.format(new Date(`${debt.dueDate}T12:00:00`)) : 'Sem vencimento';
      return `<article class="debt-row ${debt.paid ? 'debt-paid' : ''}"><div class="debt-person"><span class="debt-symbol" aria-hidden="true">↗</span><div class="debt-person-copy"><strong>${escapeHTML(debt.creditor)}</strong><span>${escapeHTML(debt.note || 'Dívida pessoal')}</span></div></div><span class="debt-due">Vence ${escapeHTML(dueDate)}</span><span class="debt-amount">${money.format(Number(debt.amount))}</span><span class="debt-status ${debt.paid ? 'paid' : 'open'}">${debt.paid ? 'Paga' : 'Em aberto'}</span><button class="debt-action" type="button" data-toggle-debt="${escapeHTML(debt.id)}" aria-label="${debt.paid ? 'Reabrir' : 'Marcar como paga'}: ${escapeHTML(debt.creditor)}">${debt.paid ? 'Reabrir' : 'Marcar paga'}</button><button class="delete-button" type="button" data-delete-debt="${escapeHTML(debt.id)}" aria-label="Excluir dívida de ${escapeHTML(debt.creditor)}">×</button></article>`;
    }).join('');
    $('#debts-empty').style.display = data.debts.length ? 'none' : 'block';
  }

  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }
  function openDialog(id) { $(id).showModal(); }
  function closeDialog(id) { $(id).close(); }

  $('#open-transaction').addEventListener('click', () => openDialog('#transaction-dialog'));
  $('#open-transaction-mobile').addEventListener('click', () => openDialog('#transaction-dialog'));
  $('#empty-add').addEventListener('click', () => openDialog('#transaction-dialog'));
  $('#open-bill').addEventListener('click', () => openDialog('#bill-dialog'));
  $('#open-debt').addEventListener('click', () => openDialog('#debt-dialog'));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(`#${button.dataset.close}`)));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));

  document.querySelectorAll('.type-button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.type-button').forEach((item) => item.classList.toggle('active', item === button));
    $('#transaction-type').value = button.dataset.type;
  }));
  $('#transaction-category').addEventListener('change', (event) => {
    const isNew = event.target.value === '__new';
    $('#new-category').classList.toggle('hidden', !isNew);
    $('#new-category').required = isNew;
    if (isNew) $('#new-category').focus();
  });

  $('#transaction-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const amount = Number($('#transaction-amount').value);
    let category = $('#transaction-category').value;
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (category === '__new') {
      category = $('#new-category').value.trim();
      if (!category) return;
      if (!data.categories.some((saved) => saved.toLocaleLowerCase('pt-BR') === category.toLocaleLowerCase('pt-BR'))) data.categories.push(category);
    }
    data.transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, type: $('#transaction-type').value, amount, description: $('#transaction-description').value.trim(), category, date: $('#transaction-date').value, createdAt: Date.now() });
    saveData(); render(); form.reset(); $('#transaction-type').value = 'expense'; $('#new-category').classList.add('hidden'); $('#new-category').required = false;
    document.querySelectorAll('.type-button').forEach((button) => button.classList.toggle('active', button.dataset.type === 'expense'));
    $('#transaction-date').value = localDate(new Date()); closeDialog('#transaction-dialog'); showToast('Transação adicionada.');
  });

  $('#bill-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number($('#bill-amount').value);
    const dueDay = Number($('#bill-due-day').value);
    if (!Number.isFinite(amount) || amount <= 0 || dueDay < 1 || dueDay > 31) return;
    data.bills.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name: $('#bill-name').value.trim(), amount, dueDay });
    saveData(); render(); event.currentTarget.reset(); closeDialog('#bill-dialog'); showToast('Conta fixa adicionada.');
  });

  $('#debt-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number($('#debt-amount').value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    data.debts.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      creditor: $('#debt-creditor').value.trim(),
      amount,
      dueDate: $('#debt-due-date').value,
      note: $('#debt-note').value.trim(),
      paid: false,
      createdAt: Date.now()
    });
    saveData(); render(); event.currentTarget.reset(); closeDialog('#debt-dialog'); showToast('Dívida adicionada.');
  });

  $('#safety-margin').addEventListener('change', (event) => {
    data.safetyMargin = Math.max(0, Number(event.target.value) || 0);
    saveData(); render(); showToast('Margem de segurança atualizada.');
  });
  $('#category-filter').addEventListener('change', () => renderTransactions(getMonthTransactions()));
  document.addEventListener('click', (event) => {
    const transactionButton = event.target.closest('[data-delete-transaction]');
    const billButton = event.target.closest('[data-delete-bill]');
    const debtToggleButton = event.target.closest('[data-toggle-debt]');
    const debtDeleteButton = event.target.closest('[data-delete-debt]');
    if (transactionButton) {
      data.transactions = data.transactions.filter((item) => item.id !== transactionButton.dataset.deleteTransaction);
      saveData(); render(); showToast('Transação excluída.');
    }
    if (billButton) {
      data.bills = data.bills.filter((item) => item.id !== billButton.dataset.deleteBill);
      saveData(); render(); showToast('Conta fixa excluída.');
    }
    if (debtToggleButton) {
      const debt = data.debts.find((item) => item.id === debtToggleButton.dataset.toggleDebt);
      if (debt) { debt.paid = !debt.paid; saveData(); render(); showToast(debt.paid ? 'Dívida marcada como paga.' : 'Dívida reaberta.'); }
    }
    if (debtDeleteButton) {
      data.debts = data.debts.filter((item) => item.id !== debtDeleteButton.dataset.deleteDebt);
      saveData(); render(); showToast('Dívida excluída.');
    }
  });

  $('#transaction-date').value = localDate(today);
  $('#debt-due-date').value = localDate(today);
  render();
})();
