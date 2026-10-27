"use strict";

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const readline = require("node:readline");
const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

const perguntar = pergunta =>
  new Promise(resolve => rl.question(pergunta, resolve));

async function senhaOculta(pergunta) {
  if (!process.stdin.isTTY) {
    throw Error("Execute em um terminal interativo.");
  }

  const escrever = rl._writeToOutput;

  rl._writeToOutput = function(texto) {
    if (texto.startsWith(pergunta)) {
      return escrever.call(rl, texto);
    }

    if (texto === "\r\n" || texto === "\n") {
      return escrever.call(rl, texto);
    }
  };

  try {
    return await perguntar(pergunta);
  } finally {
    rl._writeToOutput = escrever;
    process.stdout.write("\n");
  }
}

(async () => {
  let cliente;

  try {
    const usuario = (
      await perguntar("Usuário administrativo (ex.: alberto): ")
    ).trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
      throw Error(
        "Usuário inválido. Utilize de 3 a 40 caracteres."
      );
    }

    const senha = await senhaOculta(
      "Senha (mínimo 12 caracteres): "
    );

    if (senha.length < 12 || senha.length > 72) {
      throw Error(
        "A senha deve ter entre 12 e 72 caracteres."
      );
    }

    const confirmar = await senhaOculta(
      "Confirme a senha: "
    );

    if (senha !== confirmar) {
      throw Error("As senhas não conferem.");
    }

    cliente = new MongoClient(
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017"
    );

    await cliente.connect();

    const banco = cliente.db(
      process.env.DB_NAME || "emporionovo"
    );

    const colecao = banco.collection("usuario_admin");

    await colecao.createIndex(
      { usuario: 1 },
      { unique: true }
    );

    const existente = await colecao.findOne({ usuario });

    if (existente) {
      throw Error(
        "Este usuário já existe. Nenhuma alteração foi feita."
      );
    }

    const senha_hash = await bcrypt.hash(senha, 12);

    await colecao.insertOne({
      usuario,
      senha_hash,
      ativo: true,
      criado_em: new Date()
    });

    console.log("Administrador cadastrado com sucesso.");

  } catch (erro) {
    console.error("Erro:", erro.message);
    process.exitCode = 1;

  } finally {
    rl.close();

    if (cliente) {
      await cliente.close();
    }
  }
})();