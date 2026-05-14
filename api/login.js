require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const initSqlJs = require("sql.js/dist/sql-wasm.js");

let SQLPromise = null;

async function getSQL() {
  if (!SQLPromise) {
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const wasmBinary = fs.readFileSync(wasmPath);

    SQLPromise = initSqlJs({
      wasmBinary
    });
  }

  return SQLPromise;
}

async function createDb() {
  const SQL = await getSQL();
  const db = new SQL.Database();

  db.run("CREATE TABLE users (username TEXT, password TEXT);");
  db.run("INSERT INTO users VALUES ('admin', 'super_secret_pwn');");

  return db;
}

function rowsFromResult(result) {
  if (!result || result.length === 0) {
    return [];
  }

  return result[0].values.map((row) => {
    return {
      username: row[0],
      password: row[1]
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed"
    });
  }

  const { username = "", password = "", level } = req.body || {};

  const user = String(username);
  const pass = String(password);
  const currentLevel = Number(level);

  if (![1, 2, 3].includes(currentLevel)) {
    return res.status(400).json({
      success: false,
      message: "Invalid level."
    });
  }

  const query = `SELECT * FROM users WHERE username='${user}' AND password='${pass}'`;

  if (currentLevel === 2) {
    if (
      user.includes(" ") ||
      pass.includes(" ") ||
      user.includes("=") ||
      pass.includes("=")
    ) {
      return res.json({
        success: false,
        message: "Hacker detected! Filter blocked your request.",
        query
      });
    }
  }

  if (currentLevel === 3) {
    if (user.toLowerCase().includes("admin") || pass.toLowerCase().includes("admin")) {
      return res.json({
        success: false,
        message: 'Filter is active: "admin" is blocked!',
        query
      });
    }

    if (user.toLowerCase().includes("or") || pass.toLowerCase().includes("or")) {
      return res.json({
        success: false,
        message: 'Filter is active: "or" is blocked!',
        query
      });
    }

    if (user.includes("-") || pass.includes("-")) {
      return res.json({
        success: false,
        message: 'Filter is active: "-" is blocked!',
        query
      });
    }

    if (user.includes("=") || pass.includes("=")) {
      return res.json({
        success: false,
        message: 'Filter is active: "=" is blocked!',
        query
      });
    }
  }

  try {
    const db = await createDb();
    const result = db.exec(query);
    const rows = rowsFromResult(result);

    let success = false;

    if (rows.length > 0) {
      if (currentLevel === 3) {
        if (rows[0].username === "admin") {
          success = true;
        }
      } else {
        success = true;
      }
    }

    if (!success) {
      return res.json({
        success: false,
        message: currentLevel === 3 ? "Login Failed or not Admin." : "Login Failed.",
        query
      });
    }

    let flag = "";

    if (currentLevel === 1) {
      flag = process.env.FLAG1;
    } else if (currentLevel === 2) {
      flag = process.env.FLAG2;
    } else if (currentLevel === 3) {
      flag = process.env.FLAG3;
    }

    return res.json({
      success: true,
      flag,
      query
    });
  } catch (err) {
    return res.json({
      success: false,
      message: "Login Failed. (SQL Syntax Error)",
      query
    });
  }
};