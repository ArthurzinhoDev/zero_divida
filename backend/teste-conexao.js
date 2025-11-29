const mysql = require("mysql2");

// Configuração da conexão
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2515", // sua senha
  database: "zero_divida" // seu banco
});

// Testa a conexão
db.connect((err) => {
  if (err) {
    console.error("❌ Não conectou ao MySQL:", err);
  } else {
    console.log("✅ Conexão bem-sucedida!");
    // Fecha a conexão depois do teste
    db.end();
  }
});
