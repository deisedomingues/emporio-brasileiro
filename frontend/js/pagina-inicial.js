"use strict";

// Informações da loja: preencher o WhatsApp oficial quando confirmado.
const configuracoes = { whatsapp: "", endereco: "", horario: "" };
const janelaAviso = document.querySelector("#janela-aviso");
function mostrarAviso(titulo, texto) {
  document.querySelector("#titulo-aviso").textContent = titulo;
  document.querySelector("#texto-aviso").textContent = texto;
  janelaAviso.showModal();
}
function fecharAviso() { janelaAviso.close(); }
document.querySelector("#fechar-aviso").addEventListener("click", fecharAviso);
document.querySelector("#confirmar-aviso").addEventListener("click", fecharAviso);

function abrirWhatsApp(mensagem) {
  const telefone = configuracoes.whatsapp.replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(telefone)) {
    mostrarAviso("Contato em preparação", "O número oficial do Empório ainda precisa ser confirmado.");
    return;
  }
  window.open("https://wa.me/" + telefone + "?text=" + encodeURIComponent(mensagem), "_blank", "noopener,noreferrer");
}
document.querySelectorAll("[data-encomendar]").forEach(botao => {
  botao.addEventListener("click", () => abrirWhatsApp("Olá, Sr. Alberto! Gostaria de fazer uma encomenda."));
});

const botaoMenu = document.querySelector("#botao-menu");
const navegacao = document.querySelector("#navegacao-principal");
function fecharMenu() {
  navegacao.classList.remove("aberta");
  botaoMenu.setAttribute("aria-expanded", "false");
}
botaoMenu.addEventListener("click", () => {
  const aberta = navegacao.classList.toggle("aberta");
  botaoMenu.setAttribute("aria-expanded", String(aberta));
});
navegacao.querySelectorAll("a").forEach(a => a.addEventListener("click", fecharMenu));
document.addEventListener("keydown", evento => {
  if (evento.key === "Escape" && navegacao.classList.contains("aberta")) fecharMenu();
});

function criarElemento(tipo, classe, texto) {
  const el = document.createElement(tipo);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}
let produtos = [];
let categoriaSelecionada = "Todos";
const grade = document.querySelector("#grade-produtos");
const mensagemFiltro = document.querySelector("#resultado-filtro");

function apresentacaoTexto(produto) {
  if (produto.forma_venda === "Quilograma") return "Vendido por quilograma";
  const a = produto.apresentacao;
  if (!a) return "Consulte a apresentação";
  const embalagem = String(a.embalagem || "").replace(/_/g, " ");
  const quantidade = a.quantidade ? `${a.quantidade} ${a.unidade || ""}`.trim() : "";
  return [embalagem === "sem embalagem" ? "" : embalagem, quantidade].filter(Boolean).join(" · ") || "Vendido por unidade";
}
function mostrarProdutos() {
  grade.replaceChildren();
  const visiveis = produtos.filter(p => categoriaSelecionada === "Todos" || p.categoria === categoriaSelecionada);
  for (const p of visiveis) {
    const card = criarElemento("article", "cartao-produto");
    const foto = criarElemento("div", "foto-produto");
    // Sem foto confirmada do produto: não usamos imagens de outras mercadorias.
    const placeholder = criarElemento("div", "", "Empório Brasileiro");
    placeholder.setAttribute("aria-label", "Imagem do produto indisponível");
    placeholder.style.cssText = "width:100%;height:100%;min-height:145px;display:grid;place-items:center;background:#e9efe9;color:#183f2e;font-family:Georgia,serif;text-align:center;padding:14px;box-sizing:border-box";
    foto.append(placeholder);
    const dados = criarElemento("div", "dados-produto");
    dados.append(criarElemento("p", "categoria-produto", p.categoria));
    dados.append(criarElemento("h3", "", p.nome));
    if (p.marca) dados.append(criarElemento("p", "texto-apoio", p.marca));
    dados.append(criarElemento("p", "medida-produto", apresentacaoTexto(p)));
    const btn = criarElemento("button", "botao botao-secundario", "Consultar produto ↗");
    btn.type = "button";
    btn.setAttribute("aria-label", "Consultar " + p.nome + " pelo WhatsApp");
    btn.addEventListener("click", () => abrirWhatsApp("Olá, Sr. Alberto! Gostaria de consultar a disponibilidade de: " + p.nome + " (" + apresentacaoTexto(p) + ")."));
    dados.append(btn);
    card.append(foto, dados);
    grade.append(card);
  }
  if (!visiveis.length) grade.append(criarElemento("p", "texto-apoio", "Ainda não há destaques nesta categoria."));
  mensagemFiltro.textContent = visiveis.length + " produto(s) exibido(s).";
}
document.querySelectorAll("[data-categoria]").forEach(btn => {
  btn.addEventListener("click", () => {
    categoriaSelecionada = btn.dataset.categoria;
    document.querySelectorAll("[data-categoria]").forEach(outro => {
      const selecionado = outro === btn;
      outro.classList.toggle("selecionado", selecionado);
      outro.setAttribute("aria-pressed", String(selecionado));
    });
    mostrarProdutos();
  });
});
async function carregarProdutos() {
  grade.replaceChildren(criarElemento("p", "texto-apoio", "Carregando destaques..."));
  try {
    const resposta = await fetch("/api/publico/produtos", { cache: "no-store" });
    if (!resposta.ok) throw new Error("Não foi possível consultar os produtos.");
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error("Resposta inválida.");
    produtos = dados;
    mostrarProdutos();
  } catch (erro) {
    grade.replaceChildren(criarElemento("p", "texto-apoio", "Não foi possível carregar a vitrine. Atualize a página para tentar novamente."));
    mensagemFiltro.textContent = "";
  }
}
carregarProdutos();

const formulario = document.querySelector("#formulario-sugestao");
const produtoSugerido = document.querySelector("#produto-sugerido");
const receberAviso = document.querySelector("#receber-aviso");
const camposContato = document.querySelector("#campos-contato");
const nomeCliente = document.querySelector("#nome-cliente");
const telefoneCliente = document.querySelector("#telefone-cliente");
const mensagemFormulario = document.querySelector("#mensagem-formulario");
const botaoEnviar = formulario.querySelector('[type="submit"]');
receberAviso.addEventListener("change", () => {
  const ativo = receberAviso.checked;
  camposContato.hidden = !ativo;
  for (const campo of [nomeCliente, telefoneCliente]) {
    campo.required = ativo;
    campo.disabled = !ativo;
    if (!ativo) { campo.value = ""; campo.setCustomValidity(""); }
  }
  mensagemFormulario.textContent = "";
});
formulario.addEventListener("input", () => { mensagemFormulario.textContent = ""; });
for (const campo of [produtoSugerido, nomeCliente, telefoneCliente]) {
  campo.addEventListener("input", () => campo.setCustomValidity(""));
}
formulario.addEventListener("submit", async evento => {
  evento.preventDefault();
  mensagemFormulario.textContent = "";
  if (!produtoSugerido.value.trim()) {
    produtoSugerido.setCustomValidity("Informe o produto que deseja sugerir.");
    produtoSugerido.reportValidity();
    return;
  }
  if (receberAviso.checked) {
    if (!nomeCliente.value.trim()) {
      nomeCliente.setCustomValidity("Informe seu nome.");
      nomeCliente.reportValidity();
      return;
    }
    const digitos = telefoneCliente.value.replace(/\D/g, "");
    if (!/^(?:55)?[1-9]\d{9,10}$/.test(digitos)) {
      telefoneCliente.setCustomValidity("Informe seu telefone com DDD (10 ou 11 dígitos).");
      telefoneCliente.reportValidity();
      return;
    }
  }
  const alternativa = document.querySelector("#aceita-alternativa").value;
  const opcoes = { sim: "Sim", nao: "Não", conhecer: "Não informado" };
  botaoEnviar.disabled = true;
  botaoEnviar.textContent = "Enviando...";
  try {
    const resposta = await fetch("/api/publico/sugestoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        produto: produtoSugerido.value.trim(),
        marca: document.querySelector("#marca-sugerida").value.trim(),
        aceitaAlternativa: opcoes[alternativa] || "Não informado",
        receberAviso: receberAviso.checked,
        nomeSolicitante: receberAviso.checked ? nomeCliente.value.trim() : "",
        telefone: receberAviso.checked ? telefoneCliente.value.replace(/\D/g, "") : ""
      })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar a sugestão.");
    formulario.reset();
    camposContato.hidden = true;
    for (const campo of [nomeCliente, telefoneCliente]) { campo.disabled = true; campo.required = false; }
    mensagemFormulario.textContent = "Sugestão recebida! Obrigado por contribuir com o Empório.";
    mensagemFormulario.focus();
  } catch (erro) {
    mensagemFormulario.textContent = erro.message || "Falha ao enviar a sugestão.";
    mensagemFormulario.focus();
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = "Enviar sugestão ↗";
  }
});

if (configuracoes.endereco) {
  document.querySelector("#endereco-loja").textContent = configuracoes.endereco;
  document.querySelector("#complemento-endereco").hidden = true;
}
if (configuracoes.horario) document.querySelector("#horario-loja").textContent = configuracoes.horario;