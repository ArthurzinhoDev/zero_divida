// Autenticação
const userId = localStorage.getItem("userId");
if (!userId) {
  location.href = "index.html";
  return;
}

// UI elements - vamos definir depois que o DOM carregar
let incomeForm, incomeAmountEl, incomeMonthEl, incomeListEl;
let expenseForm, expenseTitleEl, expenseAmountEl, expenseCategoryEl, expenseEssentialEl, expenseMonthEl, expenseListEl;
let kpiIncomeEl, kpiExpensesEl, kpiBalanceEl, statusBadgeEl;
let unnecessaryListEl, tipsListEl;
let pieChart;

// Helpers
function getCurrentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function setDefaultMonths() {
  const m = getCurrentMonth();
  if (incomeMonthEl) incomeMonthEl.value = m;
  if (expenseMonthEl) expenseMonthEl.value = m;
}

function parseToNumber(v) {
  if (typeof v === "string") v = v.replace(",", ".");
  return Number(v);
}

function isValidAmount(n) {
  return Number.isFinite(n) && n >= 0;
}

function brl(n) {
  return new Intl.NumberFormat("pt-BR", { 
    style: "currency", 
    currency: "BRL" 
  }).format(n || 0);
}

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

// Função principal modificada para buscar APENAS os dados do mês ATIVO na UI
async function refresh() {
  try {
    const userId = localStorage.getItem("userId");
    
    // 🎯 Captura o mês selecionado no input da despesa (ou renda, ambos devem ser iguais)
    const activeMonth = expenseMonthEl.value; 

    if (!activeMonth) {
        console.warn('Mês ativo não definido. Não buscando dados.');
        return;
    }
    
    // Agora, busca os dados PASSANDO o filtro de MÊS
    const [incomesRes, expensesRes] = await Promise.all([
      fetch(`http://localhost:3000/api/incomes?userId=${userId}&month=${activeMonth}`),
      fetch(`http://localhost:3000/api/expenses?userId=${userId}&month=${activeMonth}`)
    ]);
    
    if (!incomesRes.ok || !expensesRes.ok) {
      console.error('Erro na resposta da API');
      return;
    }
    
    const incomes = await incomesRes.json();
    const expenses = await expensesRes.json();
    
    console.log(`📊 Dados carregados para ${activeMonth}:`, {
      incomes: incomes.length,
      expenses: expenses.length
    });

    // Calcula os totais do mês (após o filtro ser aplicado pelo backend)
    const totalIncome = incomes.reduce((sum, item) => sum + parseToNumber(item.amount), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + parseToNumber(item.amount), 0);
    
    // Chamadas de renderização (que você definiu no dashboard.html)
    renderIncomes(incomes);
    renderExpenses(expenses);
    renderKpis(totalIncome, totalExpenses);
    renderStatus(totalIncome, totalExpenses);
    renderUnnecessary(expenses);
    renderTips(totalIncome, totalExpenses); // Dicas usam os totais
    renderChart(expenses);
    
  } catch (error) {
    console.error('Erro no refresh:', error);
  }
}
//  EVENT LISTENERS CORRIGIDOS - AGORA FUNCIONANDO
function setupEventListeners() {
  console.log('🎯 Configurando event listeners...');
  
  // Income Form
  if (incomeForm) {
    // Remover qualquer listener antigo
    incomeForm.replaceWith(incomeForm.cloneNode(true));
    incomeForm = document.getElementById("income-form");
    
    incomeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log('✅ Income form submit disparado');
      
      const amount = parseToNumber(incomeAmountEl.value);
      const month = incomeMonthEl.value;
      
      if (!isValidAmount(amount)) {
        alert("Informe um valor de renda válido.");
        return;
      }

      try {
        const res = await fetch("http://localhost:3000/api/incomes", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ userId, amount, month })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          alert("Erro ao salvar renda: " + (data.error || ''));
          return;
        }
        
        incomeAmountEl.value = "";
        console.log('✅ Renda salva com sucesso! ID:', data.id);
        await refresh();
        
      } catch (error) {
        console.error('Erro ao salvar renda:', error);
        alert("Erro de conexão com o servidor.");
      }
    });
  }

  // Expense Form
  if (expenseForm) {
    // Remover qualquer listener antigo
    expenseForm.replaceWith(expenseForm.cloneNode(true));
    expenseForm = document.getElementById("expense-form");
    
    expenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log('✅ Expense form submit disparado');
      
      const title = (expenseTitleEl.value || "").trim();
      const amount = parseToNumber(expenseAmountEl.value);
      const category = expenseCategoryEl.value;
      const essential = !!expenseEssentialEl.checked;
      const month = expenseMonthEl.value;

      if (!title) {
        alert("Informe uma descrição.");
        return;
      }
      
      if (!isValidAmount(amount)) {
        alert("Informe um valor de despesa válido.");
        return;
      }

      try {
        const res = await fetch("http://localhost:3000/api/expenses", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ userId, title, amount, category, essential, month })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          alert("Erro ao salvar despesa: " + (data.error || ''));
          return;
        }

        expenseTitleEl.value = "";
        expenseAmountEl.value = "";
        expenseEssentialEl.checked = false;
        console.log('✅ Despesa salva com sucesso! ID:', data.id);
        await refresh();
        
      } catch (error) {
        console.error('Erro ao salvar despesa:', error);
        alert("Erro de conexão com o servidor.");
      }
    });
  }
}

function initializeApp() {

  console.log('🚀 Inicializando aplicação...');
  
  // Definir elementos DEPOIS que o DOM carregou
  incomeForm = document.getElementById("income-form");
  incomeAmountEl = document.getElementById("income-amount");
  incomeMonthEl = document.getElementById("income-month");
  incomeListEl = document.getElementById("income-list");

  expenseForm = document.getElementById("expense-form");
  expenseTitleEl = document.getElementById("expense-title");
  expenseAmountEl = document.getElementById("expense-amount");
  expenseCategoryEl = document.getElementById("expense-category");
  expenseEssentialEl = document.getElementById("expense-essential");
  expenseMonthEl = document.getElementById("expense-month");
  expenseListEl = document.getElementById("expense-list");

  kpiIncomeEl = document.getElementById("kpi-income");
  kpiExpensesEl = document.getElementById("kpi-expenses");
  kpiBalanceEl = document.getElementById("kpi-balance");
  statusBadgeEl = document.getElementById("status-badge");

  unnecessaryListEl = document.getElementById("unnecessary-list");
  tipsListEl = document.getElementById("tips-list");

  // Verificar se elementos existem
  console.log('✅ Elementos encontrados:', {
    incomeForm: !!incomeForm,
    expenseForm: !!expenseForm,
    incomeAmountEl: !!incomeAmountEl,
    expenseTitleEl: !!expenseTitleEl
  });
  
  // Configurar meses padrão
  setDefaultMonths();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Carregar dados iniciais
  refresh();
  
  console.log('✅ Aplicação inicializada com sucesso!');
}

// ⚡ INICIALIZAR QUANDO O DOM ESTIVER PRONTO
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}