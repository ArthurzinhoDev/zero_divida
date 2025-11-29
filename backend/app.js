const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de logging (ajuda a ver o que está acontecendo)
app.use((req, res, next) => {
  console.log('📥 REQUISIÇÃO:', {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body
  });
  next();
});

// Conexão com MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2515", 
  database: "zero_divida",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Erro ao conectar ao banco:", err);
    return;
  }
  console.log("✅ Conectado ao MySQL!");
});

// ================= ROTAS DE USUÁRIO (AUTH) =================

// CADASTRO
app.post("/api/register", (req, res) => {
  const { name, email, cpf, age, password } = req.body;

  if (!name || !email || !cpf || !age || !password) {
    return res.status(400).json({ success: false, error: "Campos obrigatórios faltando" });
  }

  const checkUserSql = "SELECT * FROM usuarios WHERE email = ? OR cpf = ?";
  db.query(checkUserSql, [email, cpf], async (err, results) => {
    if (err) return res.status(500).json({ success: false, error: "Erro no servidor" });

    if (results.length > 0) {
      return res.status(400).json({ success: false, error: "Email ou CPF já cadastrado" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertSql = "INSERT INTO usuarios (nome, email, cpf, idade, senha) VALUES (?, ?, ?, ?, ?)";
      db.query(insertSql, [name, email, cpf, age, hashedPassword], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: "Erro no servidor" });
        res.json({ success: true, message: "Usuário cadastrado com sucesso!" });
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Erro no hash" });
    }
  });
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ success: false, error: "Campos faltando" });

  const isEmail = login.includes('@');
  const field = isEmail ? 'email' : 'cpf';
  const sql = `SELECT * FROM usuarios WHERE ${field} = ?`;
  
  db.query(sql, [login], async (err, results) => {
    if (err) return res.status(500).json({ success: false, error: "Erro no servidor" });
    if (results.length === 0) return res.status(401).json({ success: false, error: "Usuário não encontrado" });

    const user = results[0];

    try {
      let isPasswordValid = false;
      if (user.senha.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(password, user.senha);
      } else {
        isPasswordValid = (password === user.senha);
        // Migrar senha antiga para hash se necessário
        if (isPasswordValid) {
           const hashedPassword = await bcrypt.hash(password, 10);
           db.query("UPDATE usuarios SET senha = ? WHERE id = ?", [hashedPassword, user.id]);
        }
      }
      
      if (!isPasswordValid) return res.status(401).json({ success: false, error: "Senha incorreta" });

      res.json({ success: true, userId: user.id, message: "Login realizado!" });
    } catch (error) {
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  });
});

// GET - Buscar dados do Usuário (Para o widget de perfil)
app.get('/api/user/:id', (req, res) => {
    const { id } = req.params;
    // Selecionamos 'nome' como 'name' para o frontend entender
    const sql = 'SELECT id, nome as name, email FROM usuarios WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Erro user:", err);
            return res.status(500).json({ error: "Erro servidor" });
        }
        if (results.length > 0) res.json(results[0]);
        else res.status(404).json({ error: 'Usuário não encontrado' });
    });
});

// ================= ROTAS FINANCEIRAS =================

// --- RENDAS (INCOMES) ---

// POST (Adicionar Renda)
app.post("/api/incomes", (req, res) => {
  const { userId, amount, month } = req.body;
  if (!userId || !amount || !month) return res.status(400).json({ error: "Dados incompletos" });

  const sql = "INSERT INTO incomes (userId, amount, month) VALUES (?, ?, ?)";
  db.query(sql, [userId, amount, month], (err, results) => {
    if (err) {
        console.error("Erro insert income:", err);
        return res.status(500).json({ error: "Erro no servidor" });
    }
    res.json({ success: true, id: results.insertId });
  });
});

app.get("/api/incomes", (req, res) => {
    const { userId, month } = req.query;
    console.log("📋 Buscando INCOMES para userId:", userId, "mês:", month);
    
    const sql = "SELECT * FROM incomes WHERE userId = ? AND month = ?";
    db.query(sql, [userId, month], (err, results) => {
      if (err) {
        console.error("❌ Erro ao buscar incomes:", err);
        return res.status(500).json({ error: "Erro no servidor" });
      }
      console.log(`✅ Incomes encontrados: ${results.length}`);
      res.json(results);
    });
});
// DELETE (Excluir Renda)
app.delete("/api/incomes/:id", (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM incomes WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: "Erro ao excluir" });
        res.json({ success: true });
    });
});

// --- DESPESAS (EXPENSES) ---

// POST (Adicionar Despesa)
app.post("/api/expenses", (req, res) => {
  const { userId, title, amount, category, essential, month } = req.body;
  if (!userId || !title || !amount || !category || !month) return res.status(400).json({ error: "Dados incompletos" });

  const sql = "INSERT INTO expenses (userId, title, amount, category, essential, month) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [userId, title, amount, category, essential, month], (err, results) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    res.json({ success: true, id: results.insertId });
  });
});

// GET (Buscar Despesas)
app.get("/api/expenses", (req, res) => {
  const { userId, month } = req.query;
  console.log("📋 Buscando EXPENSES para userId:", userId, "mês:", month);
  
  const sql = "SELECT * FROM expenses WHERE userId = ? AND month = ?";
  db.query(sql, [userId, month], (err, results) => {
    if (err) {
        console.error("❌ Erro Expenses:", err);
        return res.status(500).json({ error: "Erro no servidor" });
    }
    console.log(`✅ Expenses encontrados: ${results.length}`);
    res.json(results);
  });
});

// DELETE (Excluir Despesa)
app.delete("/api/expenses/:id", (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM expenses WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: "Erro ao excluir" });
        res.json({ success: true });
    });
});


// ================= ROTAS PARA METAS =================

app.get("/api/metas", (req, res) => {
  const { userId } = req.query;
  const sql = "SELECT * FROM metas WHERE userId = ? ORDER BY dataLimite ASC";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    res.json(results);
  });
});

app.post("/api/metas", (req, res) => {
  const { userId, titulo, valorMeta, valorAtual, dataLimite } = req.body;
  const sql = "INSERT INTO metas (userId, titulo, valorMeta, valorAtual, dataLimite) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [userId, titulo, valorMeta, valorAtual || 0, dataLimite], (err, results) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    res.json({ success: true, id: results.insertId });
  });
});

app.delete("/api/metas/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const sql = "DELETE FROM metas WHERE id = ? AND userId = ?";
    db.query(sql, [id, userId], (err, results) => {
      if (err) return res.status(500).json({ error: "Erro no servidor" });
      res.json({ success: true });
    });
});

app.patch("/api/metas/:id/adicionar", (req, res) => {
    const { id } = req.params;
    const { userId, valor } = req.body;
    const sql = "UPDATE metas SET valorAtual = valorAtual + ? WHERE id = ? AND userId = ?";
    db.query(sql, [valor, id, userId], (err, results) => {
      if (err) return res.status(500).json({ error: "Erro no servidor" });
      res.json({ success: true });
    });
});

// ==========================================

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
