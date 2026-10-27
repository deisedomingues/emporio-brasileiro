"use strict";

const form = document.querySelector("#form-login");
const erro = document.querySelector("#erro-login");
const botao = document.querySelector("#entrar");

// Se o administrador já estiver autenticado,
// não precisa entrar novamente.

fetch("/api/auth/sessao")
  .then(resposta => resposta.json())
  .then(dados => {
    if (dados.autenticado) {
      window.location.replace("/admin/index.html");
    }
  })
  .catch(() => {});

// Enviar usuário e senha para o servidor.

form.addEventListener("submit", async evento => {
  evento.preventDefault();

  erro.textContent = "";
  botao.disabled = true;
  botao.textContent = "Entrando...";

  try {
    const resposta = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        usuario: form.elements.usuario.value.trim(),
        senha: form.elements.senha.value
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível entrar."
      );
    }

    form.elements.senha.value = "";

    window.location.replace("/admin/index.html");

  } catch (erroLogin) {
    erro.textContent = erroLogin.message;

    form.elements.senha.value = "";
    form.elements.senha.focus();

  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});