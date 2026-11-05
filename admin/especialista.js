"use strict";

const form = document.querySelector("#form-avaliacao");
const campoSugestao = document.querySelector("#sugestao");
const campoProduto = document.querySelector("#produto");
const areaPerguntas = document.querySelector("#perguntas");
const areaResultado = document.querySelector("#resultado");
const mensagem = document.querySelector("#mensagem");
const botaoAvaliar = document.querySelector("#avaliar");
const botaoSalvar = document.querySelector("#salvar");

let perguntas = [];
let sugestoes = [];
let avaliacaoAtual = null;
let revisao = 0;
let salvando = false;

// --------------------------------------------------
// Comunicação com o servidor
// --------------------------------------------------

async function requisicao(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    ...opcoes,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(opcoes.headers || {})
    }
  });

  if (resposta.status === 401) {
    window.location.assign("/login.html");

    throw new Error(
      "Sessão encerrada. Faça login novamente."
    );
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados.erro || `Erro na solicitação: ${resposta.status}`
    );
  }

  return dados;
}

// --------------------------------------------------
// Utilitários de interface
// --------------------------------------------------

function escapar(valor) {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    caractere => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[caractere]
  );
}

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function listar(seletor, textos) {
  const lista = document.querySelector(seletor);

  lista.replaceChildren();

  for (const texto of textos) {
    const item = document.createElement("li");

    item.textContent = texto;

    lista.append(item);
  }
}

function formatarData(valor) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Data não informada";
  }

  return data.toLocaleString("pt-BR");
}

function invalidarAvaliacao() {
  revisao++;

  avaliacaoAtual = null;
  areaResultado.hidden = true;

  mostrarMensagem("");
}

// --------------------------------------------------
// Sugestões
// --------------------------------------------------

function preencherSugestoes() {
  for (const sugestao of sugestoes) {
    const opcao = document.createElement("option");

    opcao.value = String(sugestao.id);

    opcao.textContent = [
      sugestao.produto,
      sugestao.marca,
      sugestao.status
    ]
      .filter(Boolean)
      .join(" · ");

    campoSugestao.append(opcao);
  }
}

function atualizarDemanda() {
  const nome = campoProduto.value
    .trim()
    .toLocaleLowerCase("pt-BR");

  const destino = document.querySelector("#demanda");

  if (!nome) {
    destino.textContent =
      "Selecione uma sugestão ou informe um produto.";

    return;
  }

  const quantidade = sugestoes.filter(sugestao => {
    const produto = String(sugestao.produto || "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    return produto === nome;
  }).length;

  destino.textContent =
    `${quantidade} sugestão(ões) registrada(s) com esse nome. ` +
    "Essa contagem não representa clientes distintos. " +
    "Avalie a procura considerando também os pedidos " +
    "recebidos no atendimento.";
}

// --------------------------------------------------
// Perguntas
// --------------------------------------------------

function montarPerguntas() {
  areaPerguntas.replaceChildren();

  for (const [id, texto] of perguntas) {
    const grupo = document.createElement("fieldset");
    const legenda = document.createElement("legend");
    const opcoes = document.createElement("div");

    legenda.textContent = texto;
    opcoes.className = "se-opcoes";

    for (const [valor, rotulo] of [
      ["sim", "Sim"],
      ["nao", "Não"]
    ]) {
      const label = document.createElement("label");
      const input = document.createElement("input");

      label.className = "se-opcao";

      input.type = "radio";
      input.name = id;
      input.value = valor;
      input.required = true;

      label.append(
        input,
        document.createTextNode(rotulo)
      );

      opcoes.append(label);
    }

    grupo.append(legenda, opcoes);

    areaPerguntas.append(grupo);
  }
}

// --------------------------------------------------
// Recomendação
// --------------------------------------------------

function mostrarResultado(avaliacao) {
  document.querySelector("#resultado-titulo").textContent =
    avaliacao.conclusao.titulo;

  document.querySelector("#resultado-produto").textContent =
    avaliacao.produto;

  document.querySelector("#resultado-motivo").textContent =
    avaliacao.conclusao.motivo;

  const condicoes = (avaliacao.conclusao.se || []).join(" + ");

  document.querySelector("#regra-final").textContent =
    `Regra final: ${avaliacao.conclusao.id}. ` +
    `Condições: ${condicoes || "nenhuma regra aplicável"}. ` +
    "Quando mais de uma regra é atendida, " +
    "o sistema utiliza a de maior prioridade.";

  const passos = avaliacao.passos.map(passo =>
    `${passo.id}: ${passo.se.join(" + ")} → ${passo.entao}`
  );

  listar(
    "#passos",
    passos.length
      ? passos
      : ["A conclusão utilizou diretamente as respostas."]
  );

  listar(
    "#respostas",
    perguntas.map(([id, texto]) =>
      `${texto} ${avaliacao.respostas[id] ? "Sim" : "Não"}`
    )
  );

  document.querySelector("#situacao-avaliacao").textContent =
    "Esta avaliação ainda não foi salva.";

  botaoSalvar.textContent = "Salvar avaliação";
  botaoSalvar.disabled = false;

  areaResultado.hidden = false;

  areaResultado.focus();
}

form.addEventListener("submit", async evento => {
  evento.preventDefault();

  if (salvando) return;

  const produto = campoProduto.value.trim();

  if (!produto) {
    campoProduto.setCustomValidity(
      "Informe o nome do produto."
    );

    campoProduto.reportValidity();
    campoProduto.setCustomValidity("");

    return;
  }

  const dados = new FormData(form);

  const payload = {
    produto,
    sugestaoId: campoSugestao.value || null,
    respostas: Object.fromEntries(
      perguntas.map(([id]) => [
        id,
        dados.get(id) === "sim"
      ])
    )
  };

  const revisaoSolicitada = ++revisao;

  avaliacaoAtual = null;
  areaResultado.hidden = true;
  botaoAvaliar.disabled = true;

  mostrarMensagem("Analisando as respostas...");

  try {
    const avaliacao = await requisicao(
      "/api/especialista/avaliar",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    // Ignora respostas antigas se o formulário foi alterado.
    if (revisaoSolicitada !== revisao) {
      return;
    }

    avaliacaoAtual = {
      payload,
      avaliacao
    };

    mostrarMensagem("");
    mostrarResultado(avaliacao);
  } catch (erro) {
    if (revisaoSolicitada === revisao) {
      mostrarMensagem(erro.message);
    }
  } finally {
    botaoAvaliar.disabled = false;
  }
});

// --------------------------------------------------
// Salvar avaliação
// --------------------------------------------------

botaoSalvar.addEventListener("click", async () => {
  if (!avaliacaoAtual || salvando) return;

  const atual = avaliacaoAtual;
  const revisaoSalva = revisao;

  salvando = true;
  botaoSalvar.disabled = true;

  mostrarMensagem("Salvando avaliação...");

  try {
    await requisicao("/api/especialista/avaliacoes", {
      method: "POST",
      body: JSON.stringify(atual.payload)
    });

    mostrarMensagem("Avaliação salva no MongoDB.");

    if (revisaoSalva === revisao) {
      document.querySelector(
        "#situacao-avaliacao"
      ).textContent = "Avaliação salva.";

      botaoSalvar.textContent = "Avaliação salva";
    }

    await carregarHistorico();
  } catch (erro) {
    mostrarMensagem(erro.message);

    if (revisaoSalva === revisao) {
      botaoSalvar.disabled = false;
    }
  } finally {
    salvando = false;
  }
});

// --------------------------------------------------
// Histórico
// --------------------------------------------------

async function carregarHistorico() {
  const destino = document.querySelector("#historico");
  const botao = document.querySelector("#atualizar-historico");

  botao.disabled = true;

  try {
    const registros = await requisicao(
      "/api/especialista/avaliacoes"
    );

    if (!registros.length) {
      destino.textContent = "Nenhuma avaliação salva.";

      return;
    }

    destino.innerHTML = registros.map(registro => {
      const respostas = perguntas.map(([id, texto]) => `
        <li>
          ${escapar(texto)}
          ${registro.respostas[id] ? "Sim" : "Não"}
        </li>
      `).join("");

      const passos = (registro.passos || []).map(passo => `
        <li>
          ${escapar(passo.id)}:
          ${escapar(passo.se.join(" + "))}
          → ${escapar(passo.entao)}
        </li>
      `).join("");

      return `
        <details class="se-registro">
          <summary>
            ${escapar(registro.produto)}
            · ${escapar(formatarData(registro.criadoEm))}
          </summary>

          <h3>${escapar(registro.conclusao.titulo)}</h3>

          <p>${escapar(registro.conclusao.motivo)}</p>

          <p class="se-ajuda">
            Regra: ${escapar(registro.conclusao.id)}
            · Versão: ${escapar(registro.versaoRegras)}
            · Usuário: ${escapar(registro.usuario || "")}
          </p>

          <h3>Respostas registradas</h3>
          <ul>${respostas}</ul>

          <h3>Passos da análise</h3>
          <ul>
            ${
              passos ||
              "<li>A conclusão utilizou diretamente as respostas.</li>"
            }
          </ul>
        </details>
      `;
    }).join("");
  } catch (erro) {
    destino.textContent =
      "Não foi possível carregar o histórico: " +
      erro.message;
  } finally {
    botao.disabled = false;
  }
}

// --------------------------------------------------
// Eventos do formulário
// --------------------------------------------------

campoSugestao.addEventListener("change", () => {
  const selecionada = sugestoes.find(
    sugestao =>
      String(sugestao.id) === campoSugestao.value
  );

  if (selecionada) {
    campoProduto.value = selecionada.produto;
  }

  invalidarAvaliacao();
  atualizarDemanda();
});

campoProduto.addEventListener("input", () => {
  campoSugestao.value = "";

  atualizarDemanda();
});

form.addEventListener("input", invalidarAvaliacao);
form.addEventListener("change", invalidarAvaliacao);

form.addEventListener("reset", () => {
  invalidarAvaliacao();

  setTimeout(atualizarDemanda, 0);
});

document.querySelector(
  "#atualizar-historico"
).addEventListener("click", carregarHistorico);

// --------------------------------------------------
// Encerrar sessão
// --------------------------------------------------

document.querySelector("#sair").addEventListener(
  "click",
  async () => {
    try {
      await requisicao("/api/auth/logout", {
        method: "POST"
      });

      window.location.assign("/login.html");
    } catch (erro) {
      mostrarMensagem(erro.message);
    }
  }
);

// --------------------------------------------------
// Inicialização
// --------------------------------------------------

async function iniciar() {
  const carregamento = document.querySelector("#carregamento");

  try {
    const [base, listaSugestoes] = await Promise.all([
      requisicao("/api/especialista/perguntas"),
      requisicao("/api/sugestoes")
    ]);

    perguntas = base.perguntas;
    sugestoes = listaSugestoes;

    montarPerguntas();
    preencherSugestoes();
    atualizarDemanda();

    carregamento.hidden = true;
    form.hidden = false;

    await carregarHistorico();
  } catch (erro) {
    carregamento.textContent =
      "Não foi possível carregar a avaliação: " +
      erro.message;

    document.querySelector("#historico").textContent =
      "Histórico indisponível.";
  }
}

iniciar();