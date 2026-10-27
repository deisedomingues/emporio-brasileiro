"use strict";

/*
  EMPÓRIO BRASILEIRO — ADMINISTRAÇÃO

  Versão inicial para desenvolvimento de interface.
  Categorias, produtos, entradas, fornecedores, compras, encomendas, vendas e sugestões: MongoDB via API.
  Não utilizar em produção com dados pessoais.

  Nenhum dado fictício é inserido automaticamente.
*/

const PAGE = document.body.dataset.page;
const APP = document.querySelector("#admin-app");
const PREFIX = "emporio_dev_";

const MENU = [
  ["painel", "Painel", "index.html"],
  ["encomendas", "Encomendas", "encomendas.html"],
  ["vendas", "Vendas", "vendas.html"],
  ["produtos", "Produtos", "produtos.html"],
  ["compras", "Compras / Entradas", "compras.html"],
  ["fornecedores", "Fornecedores", "fornecedores.html"],
  ["categorias", "Categorias", "categorias.html"],
  ["sugestoes", "Sugestões", "sugestoes.html"]
];

const TITULOS = {
  painel: ["Visão geral", "Acompanhe os registros do Empório."],
  clientes: ["Clientes", "Gerencie os contatos cadastrados."],
  produtos: ["Produtos", "Organize o catálogo de mercadorias."],
  compras: ["Compras / Entradas", "Registre vários produtos recebidos em uma única compra."],
  fornecedores: ["Fornecedores", "Consulte e cadastre fornecedores por CNPJ ou nome."],
  categorias: ["Categorias", "Crie e organize categorias de produtos."],
  encomendas: ["Encomendas", "Registre e acompanhe os pedidos."],
  vendas: ["Vendas", "Registre vendas diretas ou de encomendas."],
  sugestoes: ["Sugestões", "Acompanhe o que os clientes estão pedindo."]
};

const STATUS_ENCOMENDA = [
  "Pendente",
  "Comprado",
  "Disponível",
  "Entregue",
  "Não encontrado",
  "Cancelado",
  "Não retirada",
  "Parcialmente atendida"
];

const STATUS_ITEM = ["Pendente", "Disponível", "Não encontrado", "Cancelado", "Entregue"];

const STATUS_SUGESTAO = [
  "Recebida",
  "Em análise",
  "Atendida",
  "Não atendida"
];

// Opções controladas para manter a consistência dos dados.
// Não são registros de produtos: apenas opções dos formulários.
const EMBALAGENS = [
  ["", "Selecione"],
  ["sem_embalagem", "Sem embalagem"],
  ["pacote", "Pacote"],
  ["caixa", "Caixa"],
  ["lata", "Lata"],
  ["garrafa_pet", "Garrafa PET"],
  ["garrafa_vidro", "Garrafa de vidro"],
  ["garrafa_plastica", "Garrafa plástica"],
  ["frasco", "Frasco"],
  ["pote", "Pote"],
  ["bandeja", "Bandeja"],
  ["rolo", "Rolo"],
  ["saco", "Saco"],
  ["sache", "Sachê"],
  ["bisnaga", "Bisnaga"],
  ["cartela", "Cartela"],
  ["blister", "Blister"],
  ["maco", "Maço"],
  ["embalagem_individual", "Embalagem individual"],
  ["refil", "Refil"],
  ["fardo", "Fardo"],
  ["balde", "Balde"],
  ["tubo", "Tubo"]
];

const UNIDADES_CONTEUDO = [
  ["", "Selecione"], ["un", "Unidades"], ["g", "Gramas (g)"],
  ["kg", "Quilogramas (kg)"], ["ml", "Mililitros (ml)"],
  ["L", "Litros (L)"]
];

const CAMPOS = {
  clientes: [
    { name: "nome", label: "Nome", required: true },
    { name: "telefone", label: "Telefone / WhatsApp", type: "tel" },
    { name: "email", label: "E-mail", type: "email" },
    { name: "referencia", label: "Referência / observações" },
    { name: "ativo", label: "Cliente ativo", type: "checkbox" }
  ],

  categorias: [
    { name: "nome", label: "Nome da categoria", required: true },
    { name: "descricao", label: "Descrição" },
    { name: "ativo", label: "Categoria ativa", type: "checkbox" }
  ],

  produtos: [
    { name: "nome", label: "Nome do produto", required: true },
    { name: "marca", label: "Marca" },
    {
      name: "categoriaId", label: "Categoria", type: "relation",
      collection: "categorias", required: true
    },
    {
      name: "formaVenda", label: "Forma de venda", type: "select",
      options: ["Unidade", "Quilograma"], required: true
    },
    {
      name: "embalagem", label: "Tipo de embalagem", type: "select",
      options: EMBALAGENS
    },
    { name: "quantidadeEmbalagem", label: "Conteúdo da embalagem — quantidade",
      type: "number", step: "0.001" },
    {
      name: "unidadeEmbalagem", label: "Conteúdo da embalagem — medida",
      type: "select", options: UNIDADES_CONTEUDO
    },
    { name: "codigoBarras", label: "Código de barras (opcional)" },
    { name: "codigoInterno", label: "Código interno / hortifruti (opcional)" },
    { name: "precoVenda", label: "Preço de venda em R$ (por unidade ou kg)",
      type: "number", step: "0.01" },
    { name: "exibirLanding", label: "Exibir na landing page", type: "checkbox" },
    { name: "ativo", label: "Produto ativo", type: "checkbox" }
  ],

  sugestoes: [
    { name: "produto", label: "Produto sugerido", required: true },
    { name: "marca", label: "Marca desejada" },
    { name: "nomeSolicitante", label: "Nome do solicitante" },
    { name: "telefone", label: "Telefone", type: "tel" },
    {
      name: "aceitaAlternativa",
      label: "Aceita outra marca?",
      type: "select",
      options: ["Não informado", "Sim", "Não"]
    },
    { name: "receberAviso", label: "Deseja receber aviso",
      type: "checkbox" },
    {
      name: "status",
      label: "Situação",
      type: "select",
      options: STATUS_SUGESTAO
    },
    { name: "observacoes", label: "Observações", type: "textarea" }
  ]
};

// --------------------------------------------------
// Utilitários e armazenamento temporário
// --------------------------------------------------

// MongoDB pela API: categorias, produtos e entradas.
// As demais telas ainda permanecem locais nesta etapa.
const COLECOES_REMOTAS = ["categorias", "produtos", "entradas", "fornecedores", "compras", "encomendas", "vendas", "sugestoes"];
const cacheMongo = { categorias: [], produtos: [], entradas: [], fornecedores: [], compras: [], encomendas: [], vendas: [], sugestoes: [] };
const prontoMongo = { categorias: false, produtos: false, entradas: false, fornecedores: false, compras: false, encomendas: false, vendas: false, sugestoes: false };
function carregar(colecao) {
  if (COLECOES_REMOTAS.includes(colecao)) return [...cacheMongo[colecao]];
  try { return JSON.parse(localStorage.getItem(PREFIX + colecao)) || []; }
  catch { return []; }
}
function armazenar(colecao, registros) {
  if (COLECOES_REMOTAS.includes(colecao)) throw Error("Use a API para alterar " + colecao);
  localStorage.setItem(PREFIX + colecao, JSON.stringify(registros));
}
async function requisicaoMongo(caminho, opcoes = {}) {
  let resposta;
  try { resposta = await fetch(caminho, { ...opcoes, headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) } }); }
  catch { throw Error("Servidor indisponível. Execute npm start e abra http://127.0.0.1:3000/admin/produtos.html"); }
  let dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw Error(dados.erro || `Erro HTTP ${resposta.status}`);
  return dados;
}
async function atualizarMongo() {
  const resultados = await Promise.all(COLECOES_REMOTAS.map(async tipo => {
    const dados = await requisicaoMongo(`/api/${tipo}`);
    return { tipo, dados };
  }));
  for (const {tipo,dados} of resultados) {
    cacheMongo[tipo] = dados;
    prontoMongo[tipo] = true;
  }
  renderizar();
}
function novoId() {
  return crypto.randomUUID();
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function moeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valor) || 0);
}

function dataAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mostrarData(valor) {
  if (!valor) return "—";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : "—";
}

// Prazos calculados no calendário local, sem gerar alterações automáticas.
function diasAposData(dataISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO || "")) return null;
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.UTC(inicioHoje.getFullYear(), inicioHoje.getMonth(), inicioHoje.getDate()) - Date.UTC(ano, mes - 1, dia)) / 86400000);
}

function statusItem(item, encomenda) {
  if (STATUS_ITEM.includes(item.status)) return item.status;
  // Compatibilidade com encomendas cadastradas antes do status por item.
  const anterior = encomenda?.status;
  if (anterior === "Entregue") return "Entregue";
  if (anterior === "Disponível") return "Disponível";
  if (anterior === "Não encontrado") return "Não encontrado";
  if (anterior === "Cancelado") return "Cancelado";
  return "Pendente";
}

function resumoItens(encomenda) {
  const itens = encomenda.itens || [];
  const statuses = itens.map(item => statusItem(item, encomenda));
  const contar = s => statuses.filter(x => x === s).length;
  return { total: itens.length, disponiveis: contar("Disponível"),
    entregues: contar("Entregue"), faltantes: contar("Não encontrado"),
    pendentes: contar("Pendente"), cancelados: contar("Cancelado") };
}

function statusGeral(itens, anterior = "Pendente") {
  if (["Não retirada", "Cancelado"].includes(anterior)) return anterior;
  if (!itens.length) return "Pendente";
  const valores = itens.map(item => item.status || "Pendente");
  if (valores.every(s => s === "Pendente")) return anterior === "Comprado" ? "Comprado" : "Pendente";
  if (valores.every(s => s === "Disponível")) return "Disponível";
  if (valores.every(s => s === "Não encontrado")) return "Não encontrado";
  if (valores.every(s => s === "Cancelado")) return "Cancelado";
  if (valores.every(s => ["Entregue", "Não encontrado", "Cancelado"].includes(s)) &&
      valores.includes("Entregue")) return "Entregue";
  return "Parcialmente atendida";
}

function alertaRetirada(encomenda) {
  if (["Entregue", "Não retirada", "Cancelado", "Não encontrado"].includes(encomenda.status)
      || !encomenda.dataRetirada) return null;
  if (resumoItens(encomenda).disponiveis === 0) return null;
  const dias = diasAposData(encomenda.dataRetirada);
  if (dias === null) return null;
  if (dias >= 3) return { texto: "Prazo encerrado", dias };
  if (dias >= 2) return { texto: "Avisar cliente", dias };
  return null;
}

function contatoSolicitante(registro) {
  if (registro.solicitante) return registro.solicitante;
  // Compatibilidade para encomendas antigas que guardavam clienteId.
  const antigo = registro.clienteId ? obterRegistro("clientes", registro.clienteId) : null;
  return { nome: antigo?.nome || "", telefone: antigo?.telefone || "" };
}

const MOTIVOS_MENSAGEM = [
  ["confirmacao", "Confirmar recebimento"],
  ["disponivel", "Avisar disponibilidade"],
  ["parcial", "Informar produtos não encontrados"],
  ["lembrete", "Lembrar da retirada"]
];

function numeroWhatsApp(registro) {
  let digitos = String(contatoSolicitante(registro).telefone || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digitos)) digitos = digitos.slice(2);
  return /^\d{10,11}$/.test(digitos) ? `55${digitos}` : null;
}

function nomeDoProduto(id) {
  return obterRegistro("produtos", id)?.nome || "Produto cadastrado";
}

function mensagemWhatsApp(registro, motivo) {
  const nome = contatoSolicitante(registro).nome.trim().split(/\s+/)[0] || "cliente";
  const abertura = `Olá, ${nome}! Aqui é do Empório Brasileiro. `;
  const faltantes = (registro.itens || []).filter(item =>
    ["Não encontrado", "Cancelado"].includes(statusItem(item, registro))
  ).map(item => nomeDoProduto(item.produtoId));
  const texto = {
    confirmacao: "Recebemos sua encomenda e vamos verificar a disponibilidade dos produtos.",
    disponivel: "Sua encomenda está disponível para retirada. Aguardamos você!",
    parcial: faltantes.length
      ? `Não conseguimos atender os seguintes itens: ${faltantes.join(", ")}. Entre em contato para combinarmos os itens disponíveis.`
      : "Sua encomenda foi atendida parcialmente. Entre em contato para combinarmos os detalhes.",
    lembrete: "Sua encomenda está aguardando retirada. Poderia nos informar quando conseguirá buscá-la?"
  };
  return abertura + (texto[motivo] || texto.confirmacao);
}

function abrirMensagem(id) {
  const registro = obterRegistro("encomendas", id);
  if (!registro) return;
  if (!numeroWhatsApp(registro)) {
    alert("O telefone da encomenda não possui DDD e número válidos para WhatsApp.");
    return;
  }
  const escolha = document.createElement("dialog");
  escolha.className = "admin-dialog";
  escolha.setAttribute("aria-label", "Enviar mensagem ao cliente");
  escolha.innerHTML = `<h2>Enviar mensagem</h2>
    <div class="campo"><label for="motivo-mensagem">Motivo</label>
    <select id="motivo-mensagem">${MOTIVOS_MENSAGEM.map(([v,t]) =>
      `<option value="${v}">${t}</option>`).join("")}</select></div>
    <div class="campo"><label for="texto-mensagem">Mensagem (pode editar)</label>
    <textarea id="texto-mensagem" rows="5" style="min-height:140px"></textarea></div>
    <p class="admin-muted">O WhatsApp será aberto. Confirme o envio por lá.</p>
    <div class="admin-actions">
      <button class="botao botao-secundario" type="button" id="cancelar-mensagem">Cancelar</button>
      <button class="botao botao-primario" type="button" id="abrir-whatsapp">Abrir WhatsApp</button>
    </div>`;
  document.body.append(escolha);
  const motivo = escolha.querySelector("#motivo-mensagem");
  const texto = escolha.querySelector("#texto-mensagem");
  const atualizar = () => { texto.value = mensagemWhatsApp(registro, motivo.value); };
  motivo.addEventListener("change", atualizar);
  atualizar();
  const fechar = () => escolha.close();
  escolha.querySelector("#cancelar-mensagem").onclick = fechar;
  escolha.querySelector("#abrir-whatsapp").onclick = () => {
    const endereco = `https://wa.me/${numeroWhatsApp(registro)}?text=${encodeURIComponent(texto.value)}`;
    window.open(endereco, "_blank", "noopener,noreferrer");
    fechar();
  };
  escolha.addEventListener("close", () => escolha.remove());
  escolha.showModal();
}

function nomeRelacionado(colecao, id) {
  return carregar(colecao).find(item => item.id === id)?.nome || "—";
}

async function salvarRegistro(colecao, registro) {
  if (COLECOES_REMOTAS.includes(colecao)) {
    const existente = cacheMongo[colecao].find(r => r.id === registro.id);
    const caminho = `/api/${colecao}` + (existente ? `/${encodeURIComponent(registro.id)}` : "");
    const salvo = await requisicaoMongo(caminho, {
      method: existente ? "PUT" : "POST",
      body: JSON.stringify(registro)
    });
    cacheMongo[colecao] = existente
      ? cacheMongo[colecao].map(item => item.id === salvo.id ? salvo : item)
      : [...cacheMongo[colecao], salvo];
    return salvo;
  }
  const registros = carregar(colecao);
  const indice = registros.findIndex(item => item.id === registro.id);
  if (indice >= 0) registros[indice] = registro;
  else registros.push(registro);
  armazenar(colecao, registros);
  return registro;
}

function obterRegistro(colecao, id) {
  return carregar(colecao).find(item => item.id === id);
}

// --------------------------------------------------
// Estrutura visual compartilhada
// --------------------------------------------------

function montarLayout() {
  const links = MENU.map(([id, titulo, caminho]) => `
    <a href="${caminho}"
       class="${id === PAGE ? "ativo" : ""}"
       ${id === PAGE ? 'aria-current="page"' : ""}>
      ${titulo}
    </a>
  `).join("");

  APP.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <a class="admin-brand" href="index.html">
          Empório Brasileiro
          <small>ADMINISTRAÇÃO</small>
        </a>
                <nav class="admin-nav" aria-label="Menu administrativo">
          ${links}
        </nav>

        <button
          type="button"
          id="botao-sair-admin"
          class="botao botao-secundario"
          style="margin:20px 12px;width:calc(100% - 24px)"
        >
          Sair da administração
        </button>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <span class="admin-eyebrow">Gestão do Empório</span>
          <span class="admin-badge">Ambiente de desenvolvimento</span>
        </header>

        <section class="admin-page-heading">
          <div>
            <span class="admin-eyebrow">Empório Brasileiro</span>
            <h1>${TITULOS[PAGE][0]}</h1>
            <p>${TITULOS[PAGE][1]}</p>
          </div>
          <div id="acoes-pagina"></div>
        </section>

        <div id="conteudo-pagina"></div>
        <p id="mensagem-sistema" class="admin-status"
           role="status" aria-live="polite"></p>
      </main>
    </div>

    <dialog id="dialog-cadastro" class="admin-dialog"
            aria-labelledby="titulo-dialog">
      <h2 id="titulo-dialog"></h2>
      <form id="form-cadastro">
        <div id="campos-dialog"></div>
        <div class="admin-actions">
          <button type="button" class="botao botao-secundario"
                  id="cancelar-dialog">
            Cancelar
          </button>
          <button type="submit" class="botao botao-primario">
            Salvar
          </button>
        </div>
      </form>
    </dialog>

    <dialog id="dialog-entrada" class="admin-dialog"
            aria-labelledby="titulo-entrada">
      <h2 id="titulo-entrada">Registrar entrada</h2>
      <p id="entrada-produto-nome" class="admin-notice"></p>
      <form id="form-entrada">
        <div class="admin-form-grid">
          <div class="campo">
            <label for="entrada-data">Data de entrada *</label>
            <input id="entrada-data" name="data" type="date" required>
          </div>
          <div class="campo">
            <label for="entrada-quantidade">Quantidade recebida *</label>
            <input id="entrada-quantidade" name="quantidade"
                   type="number" min="0.001" step="0.001" required>
            <span class="admin-muted" id="entrada-unidade-ajuda"></span>
          </div>
          <div class="campo">
            <label for="entrada-lote">Lote (opcional)</label>
            <input id="entrada-lote" name="lote" type="text" maxlength="100">
          </div>
          <div class="campo">
            <label for="entrada-validade">Validade (opcional)</label>
            <input id="entrada-validade" name="validade" type="date">
          </div>
          <div class="campo">
            <label for="entrada-custo">Custo unitário de aquisição (R$) (opcional)</label>
            <input id="entrada-custo" name="custoUnitario"
                   type="number" min="0" step="0.01">
            <span class="admin-muted">Por unidade vendida ou por kg, conforme o produto.</span>
          </div>
          <div class="campo admin-full">
            <label for="entrada-observacoes">Observações (opcional)</label>
            <textarea id="entrada-observacoes" name="observacoes" maxlength="1000"></textarea>
          </div>
        </div>
        <p class="admin-muted">Este registro documenta o recebimento; não representa o estoque atual.</p>
        <div class="admin-actions">
          <button type="button" class="botao botao-secundario"
                  id="cancelar-entrada">Cancelar</button>
          <button type="submit" class="botao botao-primario">Salvar entrada</button>
        </div>
      </form>
    </dialog>
  `;

  document.querySelector("#cancelar-dialog")
    .addEventListener("click", fecharDialog);
  document.querySelector("#cancelar-entrada")
    .addEventListener("click", () => document.querySelector("#dialog-entrada").close());
}

function mensagem(texto) {
  document.querySelector("#mensagem-sistema").textContent = texto;
}

function fecharDialog() {
  document.querySelector("#dialog-cadastro").close();
}

// --------------------------------------------------
// Formulários e CRUD dos cadastros simples
// --------------------------------------------------

function montarCampo(campo, valor) {
  const id = `campo-${campo.name}`;
  const obrigatorio = campo.required ? "required" : "";
  const tipo = campo.type || "text";

  if (tipo === "checkbox") {
    return `
      <label class="opcao-marcacao admin-full">
        <input type="checkbox" name="${campo.name}" id="${id}"
               ${valor ? "checked" : ""}>
        <span>${escapar(campo.label)}</span>
      </label>`;
  }

  let controle = "";

  if (tipo === "relation") {
    const registros = carregar(campo.collection);

    controle = `
      <select id="${id}" name="${campo.name}" ${obrigatorio}>
        <option value="">Selecione</option>
        ${registros.map(item => `
          <option value="${escapar(item.id)}"
            ${item.id === valor ? "selected" : ""}>
            ${escapar(item.nome)}
          </option>
        `).join("")}
      </select>`;

  } else if (tipo === "select") {
    controle = `
      <select id="${id}" name="${campo.name}" ${obrigatorio}>
        ${campo.options.map(opcao => {
          const [chave, rotulo] = Array.isArray(opcao) ? opcao : [opcao, opcao];
          return `<option value="${escapar(chave)}"
            ${chave === valor ? "selected" : ""}>
            ${escapar(rotulo || "Selecione")}
          </option>`;
        }).join("")}
      </select>`;

  } else if (tipo === "textarea") {
    controle = `
      <textarea id="${id}" name="${campo.name}"
                ${obrigatorio}>${escapar(valor)}</textarea>`;

  } else {
    controle = `
      <input id="${id}" name="${campo.name}"
             type="${tipo}"
             value="${escapar(valor)}"
             ${campo.step ? `step="${campo.step}" min="0"` : ""}
             ${obrigatorio}>`;
  }

  return `
    <div class="campo ${tipo === "textarea" ? "admin-full" : ""}">
      <label for="${id}">
        ${escapar(campo.label)}${campo.required ? " *" : ""}
      </label>
      ${controle}
    </div>`;
}

function abrirCadastro(colecao, id = null, valoresIniciais = {}) {
  document.querySelector('#form-cadastro button[type="submit"]').hidden = false;
  document.querySelector("#cancelar-dialog").textContent = "Cancelar";
  const existente = id ? obterRegistro(colecao, id) : null;
  const campos = CAMPOS[colecao];
  const dialog = document.querySelector("#dialog-cadastro");
  const formulario = document.querySelector("#form-cadastro");

  document.querySelector("#titulo-dialog").textContent =
    `${existente ? "Editar" : "Cadastrar"} ${TITULOS[colecao][0].toLowerCase()}`;

  // Permite editar cadastros feitos antes da padronização.
  const baseValores = existente || valoresIniciais;
  const valores = colecao === "produtos" && existente ? {
    ...existente,
    embalagem: EMBALAGENS.find(([chave]) => chave === existente.embalagem)?.[0]
      || ({ "Lata": "lata", "Pacote": "pacote", "Caixa": "caixa",
            "Garrafa PET": "garrafa_pet", "Pote": "pote" }[existente.embalagem] || "")
  } : baseValores;

  document.querySelector("#campos-dialog").innerHTML = `
    <div class="admin-form-grid">
      ${campos.map(campo =>
        montarCampo(campo, valores?.[campo.name] ??
          (campo.type === "checkbox" &&
           campo.name === "ativo" ? true : ""))
      ).join("")}
    </div>
  `;

  // Campos condicionais para não exigir informações sem sentido.
  if (colecao === "produtos") {
    const forma = formulario.elements.formaVenda;
    const embalagem = formulario.elements.embalagem;
    const qtd = formulario.elements.quantidadeEmbalagem;
    const unidade = formulario.elements.unidadeEmbalagem;
    const grupoEmbalagem = embalagem.closest(".campo");
    const grupoQtd = qtd.closest(".campo");
    const grupoUnidade = unidade.closest(".campo");

    const atualizarApresentacao = () => {
      const porPeso = forma.value === "Quilograma";
      grupoEmbalagem.hidden = porPeso;
      embalagem.disabled = porPeso;
      if (porPeso) embalagem.value = "sem_embalagem";
      const comConteudo = !porPeso && embalagem.value !== "" &&
        embalagem.value !== "sem_embalagem";
      grupoQtd.hidden = !comConteudo;
      grupoUnidade.hidden = !comConteudo;
      qtd.disabled = !comConteudo;
      unidade.disabled = !comConteudo;
    };
    forma.addEventListener("change", atualizarApresentacao);
    embalagem.addEventListener("change", atualizarApresentacao);
    atualizarApresentacao();
  }

  formulario.onsubmit = async evento => {
    evento.preventDefault();

    const dados = Object.fromEntries(
      new FormData(formulario).entries()
    );

    for (const campo of campos) {
      if (campo.type === "checkbox") {
        dados[campo.name] =
          formulario.elements[campo.name].checked;
      }

      if (campo.type === "number") {
        dados[campo.name] = dados[campo.name] === ""
          ? null : Number(dados[campo.name]);
      }

      if (campo.type === "text" || !campo.type) {
        dados[campo.name] = dados[campo.name]?.trim() || "";
      }
    }

    if (colecao === "produtos") {
      // Embalagem e conteúdo são atributos da apresentação do produto.
      if (dados.formaVenda === "Quilograma") {
        dados.embalagem = "sem_embalagem";
        dados.quantidadeEmbalagem = null;
        dados.unidadeEmbalagem = "";
      } else if (!dados.embalagem || dados.embalagem === "sem_embalagem") {
        dados.quantidadeEmbalagem = null;
        dados.unidadeEmbalagem = "";
      }
      dados.codigoBarras = String(dados.codigoBarras || "").trim();
      dados.codigoInterno = String(dados.codigoInterno || "").trim();
      dados.apresentacao = {
        embalagem: dados.embalagem,
        quantidade: dados.quantidadeEmbalagem,
        unidade: dados.unidadeEmbalagem
      };
    }

    if (!validarCadastro(colecao, dados, id)) return;

    const registro = {
      ...existente,
      ...dados,
      id: id || novoId(),
      criadoEm: existente?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    try {
      const salvo = await salvarRegistro(colecao, registro);
      fecharDialog();
      renderizar();
      mensagem("Registro salvo no MongoDB.");
      if (colecao === "produtos" && !existente) {
        // Novo produto: abre imediatamente a primeira entrada.
        abrirEntrada(salvo.id);
      }
    } catch (erro) { alert(erro.message); }

  };

  dialog.showModal();
}

function validarCadastro(colecao, dados, idAtual) {
  const registros = carregar(colecao);

  if (colecao === "categorias") {
    const duplicada = registros.some(item =>
      item.id !== idAtual &&
      item.nome.toLowerCase() === dados.nome.toLowerCase()
    );

    if (duplicada) {
      alert("Já existe uma categoria com esse nome.");
      return false;
    }
  }

  if (colecao === "produtos") {
    if (!carregar("categorias").some(c => c.id === dados.categoriaId && c.ativo !== false)) {
      alert("Selecione uma categoria ativa cadastrada.");
      return false;
    }
    if (!["Unidade", "Quilograma"].includes(dados.formaVenda)) {
      alert("Forma de venda inválida.");
      return false;
    }
    if (!EMBALAGENS.some(([chave]) => chave === dados.embalagem)) {
      alert("Tipo de embalagem inválido.");
      return false;
    }
    if (dados.formaVenda === "Unidade" && !dados.embalagem) {
      alert("Selecione a embalagem ou a opção Sem embalagem.");
      return false;
    }
    if (dados.formaVenda === "Unidade" && dados.embalagem !== "sem_embalagem" &&
        ((dados.quantidadeEmbalagem == null) !== (dados.unidadeEmbalagem === ""))) {
      alert("Para informar o conteúdo, preencha quantidade e unidade de medida juntas.");
      return false;
    }
    if (dados.quantidadeEmbalagem != null &&
        (!Number.isFinite(dados.quantidadeEmbalagem) || dados.quantidadeEmbalagem <= 0)) {
      alert("O conteúdo da embalagem deve ser positivo.");
      return false;
    }
    if (!UNIDADES_CONTEUDO.some(([chave]) => chave === dados.unidadeEmbalagem)) {
      alert("Unidade de medida inválida.");
      return false;
    }
    if (dados.precoVenda != null &&
        (!Number.isFinite(dados.precoVenda) || dados.precoVenda < 0)) {
      alert("Preço de venda inválido.");
      return false;
    }
    for (const campo of ["codigoBarras", "codigoInterno"]) {
      const codigo = dados[campo]?.trim();
      if (!codigo) continue;

      if (registros.some(item =>
        item.id !== idAtual &&
        (normalizarCodigo(item.codigoBarras) === codigo ||
         normalizarCodigo(item.codigoInterno) === codigo)
      )) {
        alert("Este código já pertence a outro produto, como código de barras ou interno.");
        return false;
      }
    }
  }

  return true;
}

function registrosRelacionados(colecao, id) {
  const encomendas = carregar("encomendas");
  const vendas = carregar("vendas");

  if (colecao === "categorias") {
    return carregar("produtos").some(p => p.categoriaId === id);
  }

  if (colecao === "clientes") {
    return encomendas.some(e => e.clienteId === id) ||
           vendas.some(v => v.clienteId === id);
  }

  if (colecao === "encomendas") {
    // Uma venda já criada precisa manter a referência à encomenda original.
    return vendas.some(v => v.encomendaId === id);
  }

  if (colecao === "produtos") {
    return encomendas.some(e =>
      e.itens?.some(item => item.produtoId === id)
    ) || vendas.some(v =>
      v.itens?.some(item => item.produtoId === id)
    ) || carregar("entradas").some(entrada => entrada.produtoId === id);
  }

  return false;
}

function excluirRegistro(colecao, id) {
  if (colecao === "encomendas") {
    alert("Encomendas permanecem no histórico. Para encerrá-las, use Cancelado ou Não retirada.");
    return;
  }
  if (registrosRelacionados(colecao, id)) {
    alert("Não é possível excluir: existem registros relacionados. Você pode inativar o cadastro.");
    return;
  }

  if (colecao === "encomendas" && ["Entregue", "Não retirada"].includes(obterRegistro(colecao, id)?.status)) {
    alert("Encomendas finalizadas permanecem no histórico e não podem ser excluídas.");
    return;
  }
  if (!confirm("Deseja realmente excluir este registro?")) return;

  if (COLECOES_REMOTAS.includes(colecao)) {
    requisicaoMongo(`/api/${colecao}/${encodeURIComponent(id)}`, {method:"DELETE"})
      .then(() => {cacheMongo[colecao] = cacheMongo[colecao].filter(x => x.id !== id); renderizar(); mensagem("Registro excluído do MongoDB.");})
      .catch(erro => alert(erro.message));
    return;
  }
  armazenar(colecao, carregar(colecao).filter(item => item.id !== id));
  renderizar();
  mensagem("Registro excluído deste navegador.");
}

// --------------------------------------------------
// Listagens
// --------------------------------------------------

const COLUNAS = {
  clientes: [
    ["nome", "Cliente"],
    ["telefone", "Telefone"],
    ["email", "E-mail"],
    ["ativo", "Situação"]
  ],
  categorias: [
    ["nome", "Categoria"],
    ["descricao", "Descrição"],
    ["ativo", "Situação"]
  ],
  produtos: [
    ["nome", "Produto"],
    ["categoriaId", "Categoria"],
    ["codigoBarras", "Código de barras"],
    ["codigoInterno", "Código interno"],
    ["precoVenda", "Preço"],
    ["ativo", "Situação"]
  ],
  sugestoes: [
    ["produto", "Produto solicitado"],
    ["marca", "Marca"],
    ["nomeSolicitante", "Solicitante"],
    ["status", "Situação"]
  ],
  encomendas: [
    ["data", "Data"],
    ["solicitante", "Solicitante"],
    ["dataRetirada", "Retirada prevista"],
    ["total", "Valor estimado"],
    ["status", "Situação"]
  ],
  vendas: [
    ["data", "Data"],
    ["solicitante", "Solicitante"],
    ["total", "Valor"],
    ["formaPagamento", "Pagamento"],
    ["encomendaId", "Origem"]
  ]
};

function mostrarValor(colecao, campo, registro) {
  const valor = registro[campo];

  if (campo === "categoriaId") {
    return nomeRelacionado("categorias", valor);
  }

  if (campo === "solicitante") {
    return contatoSolicitante(registro).nome || "Não informado";
  }

  if (campo === "encomendaId") {
    return valor ? "Encomenda" : "Balcão";
  }

  if (campo === "total" ||
      campo === "precoVenda") {
    return valor == null ? "—" : moeda(valor);
  }

  if (campo === "dataRetirada") return mostrarData(valor);

  if (campo === "data") {
    return mostrarData(valor);
  }

  if (typeof valor === "boolean") {
    return valor ? "Sim" : "Não";
  }

  return valor === "" || valor == null ? "—" : String(valor);
}

function renderizarTabela(colecao) {
  const registros = carregar(colecao).sort((a, b) => {
    // Encomendas e vendas pela data da operação; outros pelo cadastro.
    // O horário do cadastro desempata datas iguais.
    const chave = item => (["encomendas", "vendas"].includes(colecao)
      ? (item.data || String(item.criadoEm || "").slice(0, 10))
      : String(item.criadoEm || "").slice(0, 10));
    return chave(b).localeCompare(chave(a)) ||
      String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""));
  });
  const colunas = COLUNAS[colecao];

  if (!registros.length) {
    return `
      <div class="admin-empty">
        Nenhum registro encontrado.<br>
        Utilize o botão de cadastro para começar.
      </div>`;
  }

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            ${colunas.map(([, titulo]) =>
              `<th scope="col">${titulo}</th>`).join("")}
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${registros.map(registro => `
            <tr>
              ${colunas.map(([campo]) => `
                <td>${escapar(mostrarValor(colecao, campo, registro))}${colecao === "encomendas" && campo === "status" ? `<div class="admin-muted">${resumoItens(registro).entregues} entregue(s) · ${resumoItens(registro).faltantes} não encontrado(s)</div>` : ""}${colecao === "encomendas" && campo === "status" && alertaRetirada(registro) ? `<div><span class="admin-badge" style="margin-top:6px;background:#fff1d6;color:#754900">${alertaRetirada(registro).texto}</span></div>` : ""}</td>
              `).join("")}
              <td>
                <button class="admin-btn-small"
                        data-action="${colecao === "encomendas" && ["Não retirada", "Entregue", "Cancelado"].includes(registro.status) ? "visualizar" : "editar"}"
                        data-id="${escapar(registro.id)}">
                  ${colecao === "encomendas" && ["Não retirada", "Entregue", "Cancelado"].includes(registro.status) ? "Visualizar itens" : "Editar"}
                </button>
                ${colecao === "encomendas" || (colecao === "vendas" && registro.encomendaId) ? "" : `<button class="admin-btn-small admin-btn-danger"
                        data-action="excluir"
                        data-id="${escapar(registro.id)}">Excluir</button>`}
                ${colecao === "encomendas" ? `<button class="admin-btn-small" data-action="mensagem" data-id="${escapar(registro.id)}">Enviar mensagem</button>` : ""}
                ${colecao === "encomendas" && alertaRetirada(registro) && alertaRetirada(registro).dias >= 3 ? `<button class="admin-btn-small" data-action="nao-retirada" data-id="${escapar(registro.id)}">Confirmar não retirada</button>` : ""}
                ${colecao === "encomendas" &&
                  registro.status === "Entregue" &&
                  !carregar("vendas").some(v => v.encomendaId === registro.id)
                    ? `<button class="admin-btn-small"
                               data-action="converter"
                               data-id="${escapar(registro.id)}">
                         Registrar venda
                       </button>` : ""}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

// --------------------------------------------------
// Consulta rápida de produtos pelos códigos
// --------------------------------------------------

function normalizarCodigo(valor) {
  return String(valor ?? "").trim();
}

function consultarProdutoPorCodigo(codigo) {
  const procurado = normalizarCodigo(codigo);
  if (!procurado) return null;

  return carregar("produtos").find(produto =>
    normalizarCodigo(produto.codigoBarras) === procurado ||
    normalizarCodigo(produto.codigoInterno) === procurado
  ) || null;
}

function nomeEmbalagem(codigo) {
  return EMBALAGENS.find(([valor]) => valor === codigo)?.[1] || "";
}

function apresentacaoProduto(produto) {
  if (produto.formaVenda === "Quilograma") return "Venda por quilograma";
  const embalagem = produto.apresentacao?.embalagem || produto.embalagem;
  const quantidade = produto.apresentacao?.quantidade ?? produto.quantidadeEmbalagem;
  const unidade = produto.apresentacao?.unidade || produto.unidadeEmbalagem;
  const partes = [nomeEmbalagem(embalagem)];
  if (quantidade != null && quantidade !== "" && unidade) {
    partes.push(`${quantidade} ${unidade}`);
  }
  return partes.filter(Boolean).join(" · ") || "Apresentação não informada";
}

// Histórico de recebimentos — independente do cadastro de produtos.
function entradasDoProduto(produtoId) {
  return carregar("entradas")
    .filter(entrada => entrada.produtoId === produtoId)
    .sort((a, b) => {
      // Data da entrada primeiro; desempate pela hora do registro.
      const porData = String(b.data || "").localeCompare(String(a.data || ""));
      return porData || String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""));
    });
}

function historicoEntradasHtml(produto) {
  const entradas = entradasDoProduto(produto.id);
  if (!entradas.length) {
    return `<p class="admin-muted">Nenhuma entrada registrada para este produto.</p>`;
  }
  const LIMITE_ENTRADAS = 5;
  const excesso = entradas.length > LIMITE_ENTRADAS;
  return `<div class="admin-table-wrap">
    <table class="admin-table">
      <thead><tr><th>Data</th><th>Quantidade</th><th>Lote</th>
        <th>Validade</th><th>Custo unitário</th><th>Ações</th></tr></thead>
      <tbody>${entradas.map((entrada, indice) => `<tr
        ${indice >= LIMITE_ENTRADAS ? 'data-entrada-extra hidden' : ''}>
        <td>${escapar(mostrarData(entrada.data))}</td>
        <td>${escapar(entrada.quantidade)} ${produto.formaVenda === "Quilograma" ? "kg" : "un"}</td>
        <td>${escapar(entrada.lote || "—")}</td>
        <td>${escapar(mostrarData(entrada.validade))}</td>
        <td>${entrada.custoUnitario == null ? "—" : moeda(entrada.custoUnitario)}</td>
        <td>${entrada.somenteLeitura ? `<a href="compras.html" class="admin-btn-small">Ver compra #${escapar(entrada.compraId)}</a>` : `<button class="admin-btn-small" type="button" data-editar-entrada="${escapar(entrada.id)}">Editar</button>
        <button class="admin-btn-small admin-btn-danger" type="button" data-excluir-entrada="${escapar(entrada.id)}">Excluir</button>`}</td>
      </tr>`).join("")}</tbody>
    </table>
  </div>
  ${excesso ? `<button type="button" class="botao botao-secundario"
    data-toggle-entradas aria-expanded="false" style="margin-top:14px">
    Ver todas as ${entradas.length} entradas
  </button>` : ''}`;
}

function abrirEntrada(produtoId, entradaId = null) {
  const produto = obterRegistro("produtos", produtoId);
  if (!produto) return alert("Produto não encontrado.");
  const existente = entradaId ? obterRegistro("entradas", entradaId) : null;
  if (entradaId && (!existente || existente.produtoId !== produtoId)) return;
  const dialog = document.querySelector("#dialog-entrada");
  const form = document.querySelector("#form-entrada");
  form.reset();
  document.querySelector("#titulo-entrada").textContent =
    existente ? "Editar entrada de mercadoria" : "Registrar entrada de mercadoria";
  document.querySelector("#entrada-produto-nome").textContent =
    `${produto.nome}${produto.marca ? " · " + produto.marca : ""} — ${apresentacaoProduto(produto)}`;
  document.querySelector("#entrada-unidade-ajuda").textContent =
    produto.formaVenda === "Quilograma" ? "Informe o peso total recebido em kg." : "Informe o número de unidades comerciais recebidas.";
  form.elements.data.value = existente?.data || dataAtual();
  form.elements.quantidade.value = existente?.quantidade ?? "";
  form.elements.lote.value = existente?.lote || "";
  form.elements.validade.value = existente?.validade || "";
  form.elements.custoUnitario.value = existente?.custoUnitario ?? "";
  form.elements.observacoes.value = existente?.observacoes || "";

  form.onsubmit = async evento => {
    evento.preventDefault();
    const quantidade = Number(form.elements.quantidade.value);
    const custoTexto = form.elements.custoUnitario.value.trim();
    const custoUnitario = custoTexto === "" ? null : Number(custoTexto);
    const data = form.elements.data.value;
    const validade = form.elements.validade.value;
    if (!data || !Number.isFinite(quantidade) || quantidade <= 0 ||
        (custoUnitario !== null && (!Number.isFinite(custoUnitario) || custoUnitario < 0))) {
      alert("Confira a data, a quantidade e o custo informado.");
      return;
    }
    if (validade && validade < data && !confirm("A validade informada é anterior à entrada. Deseja manter?")) return;
    const entrada = {
      ...existente,
      id: existente?.id || novoId(),
      produtoId,
      data,
      quantidade,
      lote: form.elements.lote.value.trim(),
      validade,
      custoUnitario,
      observacoes: form.elements.observacoes.value.trim(),
      criadoEm: existente?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    try {
      await salvarRegistro("entradas", entrada);
      dialog.close();
      renderizar();
      exibirProdutoConsultado(produtoId);
      mensagem("Entrada registrada no MongoDB.");
    } catch (erro) { alert(erro.message); }

  };
  dialog.showModal();
}

async function excluirEntrada(entradaId, produtoId) {
  if (!confirm("Excluir este registro de entrada do MongoDB?")) return;
  try {
    await requisicaoMongo(`/api/entradas/${encodeURIComponent(entradaId)}`, {method:"DELETE"});
    cacheMongo.entradas = cacheMongo.entradas.filter(e => e.id !== entradaId);
    renderizar();
    exibirProdutoConsultado(produtoId);
    mensagem("Entrada excluída do MongoDB.");
  } catch(erro) { alert(erro.message); }
}

function montarConsultaProdutos() {
  return `
    <section class="admin-card" aria-labelledby="titulo-consulta-produtos">
      <h2 id="titulo-consulta-produtos">Consultar produto</h2>
      <p class="admin-muted">Os resultados aparecem enquanto você digita
        o código de barras ou o código interno.</p>
      <div class="campo" style="margin-bottom:12px">
        <label for="consulta-codigo">Código de barras ou código interno</label>
        <input id="consulta-codigo" type="search" autocomplete="off"
          maxlength="80" placeholder="Comece a digitar um código...">
      </div>
      <div id="sugestoes-codigo" aria-live="polite"></div>
      <div id="resultado-consulta-produto" aria-live="polite"></div>
    </section>`;
}

function exibirProdutoConsultado(produtoId) {
  const produto = obterRegistro("produtos", produtoId);
  const resultado = document.querySelector("#resultado-consulta-produto");
  if (!produto || !resultado) return;
  document.querySelector("#sugestoes-codigo").innerHTML = "";
  resultado.innerHTML = `
    <div class="admin-notice" style="margin-top:18px">
      <strong>${escapar(produto.nome)}</strong>
      ${produto.marca ? `· ${escapar(produto.marca)}` : ""}<br>
      <span class="admin-muted">${escapar(apresentacaoProduto(produto))}
        · Valor de venda atual: ${produto.precoVenda == null ? "não informado" : moeda(produto.precoVenda)}
        · ${produto.ativo === false ? "Inativo" : "Ativo"}</span>
      <div class="admin-actions" style="margin-top:12px;justify-content:flex-start">
        <button type="button" class="botao botao-primario" data-registrar-entrada="${escapar(produto.id)}">Registrar entrada</button>
        <button type="button" class="botao botao-secundario" data-editar-produto="${escapar(produto.id)}">Editar produto</button>
      </div>
    </div>
    <h3>Histórico de entradas</h3>
    <p class="admin-muted">Entradas não determinam o saldo disponível sem registrar também as saídas.</p>
    ${historicoEntradasHtml(produto)}`;
}

function configurarConsultaProdutos() {
  const campo = document.querySelector("#consulta-codigo");
  if (!campo) return;
  const sugestoes = document.querySelector("#sugestoes-codigo");
  const resultado = document.querySelector("#resultado-consulta-produto");

  function atualizarPesquisa() {
    const codigo = normalizarCodigo(campo.value).toLocaleLowerCase("pt-BR");
    sugestoes.innerHTML = "";
    resultado.innerHTML = "";
    if (!codigo) return;
    const encontrados = carregar("produtos").filter(p =>
      [p.codigoBarras, p.codigoInterno].some(c =>
        normalizarCodigo(c).toLocaleLowerCase("pt-BR").startsWith(codigo)
      )
    ).slice(0, 12);
    if (encontrados.length) {
      sugestoes.innerHTML = `<p class="admin-muted">${encontrados.length} resultado(s) exibido(s). Selecione um produto:</p>
        <div style="display:grid;gap:8px">${encontrados.map(p => `
          <button type="button" class="admin-btn-small"
            style="text-align:left;white-space:normal;padding:12px"
            data-selecionar-produto="${escapar(p.id)}">
            <strong>${escapar(p.nome)}</strong> ${p.marca ? `· ${escapar(p.marca)}` : ""}<br>
            <span class="admin-muted">${escapar(p.codigoBarras || p.codigoInterno || "")}
              · ${escapar(apresentacaoProduto(p))}</span>
          </button>`).join("")}</div>`;
      // Para uma leitura completa do código de barras, abre diretamente se houver correspondência exata.
      const exato = encontrados.find(p => [p.codigoBarras, p.codigoInterno].some(c => normalizarCodigo(c).toLocaleLowerCase("pt-BR") === codigo));
      if (exato) exibirProdutoConsultado(exato.id);
    } else {
      sugestoes.innerHTML = `<div class="admin-notice" style="margin-top:12px">
        Nenhum produto com código iniciado por <strong>${escapar(campo.value.trim())}</strong>.
        <button type="button" class="botao botao-secundario" id="cadastrar-consulta-produto" style="margin-top:10px">+ Cadastrar novo produto</button>
      </div>`;
    }
  }

  campo.addEventListener("input", atualizarPesquisa);
  // Leitor de código de barras frequentemente envia Enter ao terminar.
  campo.addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      const codigo = normalizarCodigo(campo.value);
      const exato = consultarProdutoPorCodigo(codigo);
      if (exato) exibirProdutoConsultado(exato.id);
    }
  });
  const secao = document.querySelector("#titulo-consulta-produtos").closest("section");
  secao.addEventListener("click", evento => {
    const alvo = evento.target.closest("button");
    if (!alvo) return;
    if (alvo.dataset.selecionarProduto) {
      exibirProdutoConsultado(alvo.dataset.selecionarProduto);
    }
    if (alvo.dataset.editarProduto) {
      abrirCadastro("produtos", alvo.dataset.editarProduto);
    }
    if (alvo.dataset.registrarEntrada) {
      abrirEntrada(alvo.dataset.registrarEntrada);
    }
    if (alvo.hasAttribute("data-toggle-entradas")) {
      const expandir = alvo.getAttribute("aria-expanded") !== "true";
      secao.querySelectorAll("[data-entrada-extra]").forEach(linha => {
        linha.hidden = !expandir;
      });
      alvo.setAttribute("aria-expanded", String(expandir));
      const total = secao.querySelectorAll("[data-editar-entrada]").length;
      alvo.textContent = expandir ? "Recolher histórico" : `Ver todas as ${total} entradas`;
    }
    if (alvo.dataset.editarEntrada) {
      const registro = obterRegistro("entradas", alvo.dataset.editarEntrada);
      if (registro) abrirEntrada(registro.produtoId, registro.id);
    }
    if (alvo.dataset.excluirEntrada) {
      const registro = obterRegistro("entradas", alvo.dataset.excluirEntrada);
      if (registro) excluirEntrada(registro.id, registro.produtoId);
    }
    if (alvo.id === "cadastrar-consulta-produto") {
      const codigo = normalizarCodigo(campo.value);
      // A identificação do tipo de código pode ser corrigida no cadastro.
      const chave = /^\d{8,14}$/.test(codigo) ? "codigoBarras" : "codigoInterno";
      abrirCadastro("produtos", null, { [chave]: codigo });
    }
  });
}

function renderizarListagem(colecao) {
  const nomeSingular = {
    clientes: "cliente",
    produtos: "produto",
    categorias: "categoria",
    encomendas: "encomenda",
    vendas: "venda",
    sugestoes: "sugestão"
  }[colecao];

  document.querySelector("#acoes-pagina").innerHTML = `
    <button class="botao botao-primario" id="novo-registro">
      + Nova ${nomeSingular}
    </button>
  `;

  document.querySelector("#conteudo-pagina").innerHTML = `
    ${colecao === "produtos" ? montarConsultaProdutos() : ""}
    <section class="admin-card">
      <div class="admin-toolbar">
        <input type="search" class="admin-search"
               id="pesquisa-registros"
               placeholder="Pesquisar registros..."
               aria-label="Pesquisar registros">
        <span class="admin-muted">
          ${carregar(colecao).length} registro(s)
        </span>
      </div>
      <div id="resultado-registros">
        ${renderizarTabela(colecao)}
      </div>
      ${carregar(colecao).length > 3 ? `
        <button type="button" class="botao botao-secundario"
          id="alternar-registros" aria-expanded="false" style="margin-top:16px">
          Ver todos os ${carregar(colecao).length} registros
        </button>` : ""}
    </section>
  `;

  if (colecao === "produtos") configurarConsultaProdutos();

  document.querySelector("#novo-registro").onclick = () => {
    if (colecao === "encomendas" || colecao === "vendas") {
      abrirOperacao(colecao);
    } else {
      abrirCadastro(colecao);
    }
  };

  const resultado = document.querySelector("#resultado-registros");

  resultado.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-action]");
    if (!botao) return;

    const { action, id } = botao.dataset;

    if (action === "editar") {
      if (colecao === "encomendas" || colecao === "vendas") {
        abrirOperacao(colecao, id);
      } else {
        abrirCadastro(colecao, id);
      }
    }

    if (action === "visualizar") visualizarEncomenda(id);
    if (action === "excluir") excluirRegistro(colecao, id);
    if (action === "converter") converterEncomenda(id);
    if (action === "mensagem") abrirMensagem(id);
    if (action === "nao-retirada") confirmarNaoRetirada(id);
  });

  const pesquisa = document.querySelector("#pesquisa-registros");
  const alternar = document.querySelector("#alternar-registros");
  const LIMITE_REGISTROS = 3;

  function atualizarVisibilidade() {
    const termo = pesquisa.value.trim().toLocaleLowerCase("pt-BR");
    const expandido = alternar?.getAttribute("aria-expanded") === "true";
    const linhas = [...resultado.querySelectorAll("tbody tr")];
    linhas.forEach((linha, indice) => {
      const corresponde = linha.textContent.toLocaleLowerCase("pt-BR").includes(termo);
      linha.hidden = !corresponde || (
        !termo && !expandido && indice >= LIMITE_REGISTROS
      );
    });
    // Ao pesquisar, exibe todos os resultados correspondentes, mesmo recolhido.
    if (alternar) alternar.hidden = Boolean(termo);
  }

  pesquisa.addEventListener("input", atualizarVisibilidade);
  if (alternar) {
    alternar.addEventListener("click", () => {
      const expandir = alternar.getAttribute("aria-expanded") !== "true";
      alternar.setAttribute("aria-expanded", String(expandir));
      alternar.textContent = expandir
        ? "Recolher lista"
        : `Ver todos os ${carregar(colecao).length} registros`;
      atualizarVisibilidade();
    });
  }
  atualizarVisibilidade();

}

// Consulta de encomenda finalizada (somente leitura).
function visualizarEncomenda(id) {
  const e = obterRegistro("encomendas", id);
  if (!e) return;
  const solicitante = contatoSolicitante(e);
  const dialog = document.querySelector("#dialog-cadastro");
  const form = document.querySelector("#form-cadastro");
  form.onsubmit = evento => evento.preventDefault();
  form.querySelector('button[type="submit"]').hidden = true;
  document.querySelector("#cancelar-dialog").textContent = "Fechar";
  document.querySelector("#titulo-dialog").textContent = "Detalhes da encomenda";
  document.querySelector("#campos-dialog").innerHTML = `
    <div class="admin-notice">Consulta somente leitura — o histórico foi preservado.</div>
    <p><strong>Solicitante:</strong> ${escapar(solicitante.nome || "Não informado")}</p>
    <p><strong>Telefone:</strong> ${escapar(solicitante.telefone || "Não informado")}</p>
    <p><strong>Data:</strong> ${escapar(mostrarData(e.data))}</p>
    <p><strong>Retirada prevista:</strong> ${escapar(mostrarData(e.dataRetirada))}</p>
    <p><strong>Situação:</strong> ${escapar(e.status)}</p>
    <h3>Itens da encomenda</h3>
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Situação</th></tr></thead>
      <tbody>${(e.itens || []).map(item => `
        <tr><td>${escapar(nomeDoProduto(item.produtoId))}</td>
        <td>${escapar(item.quantidade)}</td>
        <td>${escapar(moeda(item.precoUnitario))}</td>
        <td>${escapar(statusItem(item, e))}</td></tr>`).join("")}</tbody>
    </table></div>
    <p><strong>Total estimado:</strong> ${escapar(moeda(e.total))}</p>
    ${e.observacoes ? `<p><strong>Observações:</strong> ${escapar(e.observacoes)}</p>` : ""}
  `;
  dialog.showModal();
}

// --------------------------------------------------
// Encomendas e vendas: itens e valores
// --------------------------------------------------

function campoSelect(name, label, colecao, selecionado = "") {
  const registros = carregar(colecao);

  return `
    <div class="campo">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}">
        <option value="">Selecione</option>
        ${registros.map(item => `
          <option value="${escapar(item.id)}"
            ${item.id === selecionado ? "selected" : ""}>
            ${escapar(item.nome)}
          </option>
        `).join("")}
      </select>
    </div>`;
}

// Rótulo descritivo e único para evitar confundir produtos de marcas ou
// apresentações diferentes. O ID continua sendo salvo, não o texto digitado.
function rotuloProduto(produto) {
  if (!produto) return "";
  return [produto.nome, produto.marca, apresentacaoProduto(produto),
    produto.codigoBarras || produto.codigoInterno || String(produto.id).slice(0, 8)]
    .filter(Boolean).join(" · ");
}

function textoBusca(valor) {
  return String(valor || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function sugerirProdutos(input) {
  const alvo = input.closest(".admin-item");
  const datalist = alvo?.querySelector("datalist");
  if (!datalist) return;
  const termo = textoBusca(input.value.trim());
  const produtos = carregar("produtos")
    .filter(p => p.ativo !== false || p.id === input.dataset.produtoId)
    .filter(p => !termo || textoBusca(rotuloProduto(p)).includes(termo))
    .slice(0, 12);
  datalist.innerHTML = produtos.map(p =>
    `<option value="${escapar(rotuloProduto(p))}"></option>`
  ).join("");
}

function resolverProdutoDigitado(input) {
  const produto = carregar("produtos").find(p =>
    rotuloProduto(p) === input.value.trim()
  );
  input.dataset.produtoId = produto?.id || "";
  if (!produto) return;
  const preco = input.closest(".admin-item").querySelector(".item-preco");
  if (preco && produto.precoVenda != null &&
      input.dataset.ultimoProdutoPreco !== produto.id) {
    preco.value = produto.precoVenda;
    input.dataset.ultimoProdutoPreco = produto.id;
  }
}

// Complemento visual dos itens: linha cheia para o produto, dados abaixo.
// CSS injetado uma só vez para não alterar os estilos da landing page.
if (!document.querySelector("#estilo-itens-encomenda")) {
  const estiloItens = document.createElement("style");
  estiloItens.id = "estilo-itens-encomenda";
  estiloItens.textContent = `
    .admin-item-grid-confortavel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 14px;
      align-items: end;
    }
    .admin-item-produto-linha { grid-column: 1 / -1; }
    .admin-item-produto-linha input { width: 100%; }
    .admin-item-grid-confortavel .campo { min-width: 0; }
    .admin-item-remover { align-self: end; min-height: 46px; }
    @media (max-width: 620px) {
      .admin-item-grid-confortavel {
        grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
      }
      .admin-item-produto-linha { grid-column: 1 / -1; }
      .admin-item-remover { grid-column: 1 / -1; justify-self: end; }
    }
  `;
  document.head.appendChild(estiloItens);
}

function novoItemHtml(item = {}, encomenda = false, origem = null) {
  const produto = carregar("produtos").find(p => p.id === item.produtoId);
  const listaId = `lista-produtos-${novoId()}`;
  return `
    <div class="admin-item">
      <div class="admin-item-grid admin-item-grid-confortavel">
        <div class="campo admin-item-produto-linha">
          <label>Produto *</label>
          <input type="search" class="item-produto"
                 list="${listaId}" autocomplete="off"
                 placeholder="Digite nome, marca ou código"
                 data-produto-id="${escapar(item.produtoId || "")}"
                 value="${escapar(rotuloProduto(produto))}" required>
          <datalist id="${listaId}"></datalist>
          <small class="admin-muted">Selecione uma sugestão da lista.</small>
        </div>
        <div class="campo">
          <label>Quantidade *</label>
          <input class="item-quantidade" type="number"
                 min="0.001" step="0.001" required
                 value="${escapar(item.quantidade ?? 1)}">
        </div>
        <div class="campo">
          <label>Preço unitário (R$) *</label>
          <input class="item-preco" type="number"
                 min="0" step="0.01" required
                 value="${escapar(item.precoUnitario ?? "")}">
        </div>
        <button type="button" class="admin-btn-small admin-btn-danger admin-item-remover"
                data-remove-item>Remover</button>
      </div>
      ${encomenda ? `<div class="campo" style="margin-top:12px">
        <label>Situação deste item</label>
        <select class="item-status">${STATUS_ITEM.map(st =>
          `<option value="${st}" ${st === statusItem(item, origem) ? "selected" : ""}>${st}</option>`
        ).join("")}</select>
      </div>` : ""}
    </div>`;
}

function abrirOperacao(colecao, id = null) {
  document.querySelector('#form-cadastro button[type="submit"]').hidden = false;
  document.querySelector("#cancelar-dialog").textContent = "Cancelar";
  const existente = id ? obterRegistro(colecao, id) : null;
  const formulario = document.querySelector("#form-cadastro");
  const dialog = document.querySelector("#dialog-cadastro");
  const encomenda = colecao === "encomendas";

  if (encomenda && existente?.status === "Não retirada") {
    alert("Encomenda encerrada como não retirada. Histórico preservado."); return;
  }
  if (encomenda && id && carregar("vendas").some(v => v.encomendaId === id)) {
    alert("Esta encomenda já foi convertida em venda e não pode mais ser alterada.");
    return;
  }

  document.querySelector("#titulo-dialog").textContent =
    `${existente ? "Editar" : "Registrar"} ${encomenda ? "encomenda" : "venda"}`;

  const vinculo = !encomenda && existente?.encomendaId;

  document.querySelector("#campos-dialog").innerHTML = `
    <div class="admin-form-grid">
      <div class="campo">
        <label for="operacao-data">Data *</label>
        <input id="operacao-data" name="data" type="date" required
               value="${escapar(existente?.data || dataAtual())}">
      </div>

      ${encomenda ? `
        <div class="campo">
          <label for="solicitanteNome">Nome do solicitante *</label>
          <input id="solicitanteNome" name="solicitanteNome" type="text" maxlength="120" required value="${escapar(contatoSolicitante(existente || {}).nome)}">
        </div>
        <div class="campo">
          <label for="solicitanteTelefone">Telefone / WhatsApp *</label>
          <input id="solicitanteTelefone" name="solicitanteTelefone" type="tel" maxlength="22" required placeholder="(11) 99999-9999" value="${escapar(contatoSolicitante(existente || {}).telefone)}">
        </div>
        <div class="campo">
          <label for="dataRetirada">Data prevista de retirada *</label>
          <input id="dataRetirada" name="dataRetirada" type="date" required
               min="${escapar(existente?.data || dataAtual())}"
               value="${escapar(existente?.dataRetirada || "")}">
        <small class="admin-muted">A retirada não pode ser anterior à solicitação.</small>
        </div>
      ` : `
        <div class="campo">
          <label for="solicitanteNome">Nome do cliente (opcional)</label>
          <input id="solicitanteNome" name="solicitanteNome" type="text" maxlength="120" value="${escapar(contatoSolicitante(existente || {}).nome)}">
        </div>
      `}

      ${encomenda ? `
        <div class="campo">
          <label for="status">Situação da encomenda</label>
          <select id="status" name="status">
            ${STATUS_ENCOMENDA.filter(st => !["Disponível", "Entregue", "Não encontrado", "Parcialmente atendida", "Não retirada"].includes(st)).map(status => `
              <option value="${status}"
                ${status === (existente?.status || "Pendente")
                  ? "selected" : ""}>${status}</option>
            `).join("")}
          </select>
          <p class="admin-muted">A disponibilidade e a entrega são calculadas pela situação de cada item.</p>
        </div>
      ` : `
        <div class="campo">
          <label for="formaPagamento">Forma de pagamento</label>
          <select id="formaPagamento" name="formaPagamento">
            ${["Não informada", "Pix", "Dinheiro",
                "Cartão de débito", "Cartão de crédito",
                "Outros"].map(opcao => `
              <option ${opcao === existente?.formaPagamento
                ? "selected" : ""}>${opcao}</option>
            `).join("")}
          </select>
        </div>
      `}

      <div class="campo admin-full">
        <label for="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes">${escapar(
          existente?.observacoes || ""
        )}</textarea>
      </div>
    </div>

    ${encomenda ? `
      <p class="admin-notice">
        Encomendar não exige pagamento antecipado. O valor mostrado é
        estimado; o pagamento ocorre na retirada e a venda é registrada
        separadamente.
      </p>
    ` : ""}

    ${vinculo ? `
      <p class="admin-notice">
        Esta venda foi originada de uma encomenda.
        Os itens e valores são preservados para evitar
        divergências entre os registros.
      </p>
    ` : ""}

    <h3>Itens</h3>
    <div id="lista-itens" class="admin-items">
      ${(existente?.itens?.length
        ? existente.itens : [{}]).map(item => novoItemHtml(item, encomenda, existente)).join("")}
    </div>

    ${vinculo ? "" : `
      <button type="button" class="botao botao-secundario"
              id="adicionar-item">+ Adicionar item</button>
    `}

    <p style="margin-top:18px">
      <strong>${encomenda ? "Total estimado" : "Total da venda"}: <span id="total-operacao">R$ 0,00</span></strong>
    </p>
  `;

  // A data prevista acompanha a data informada para a solicitação.
  // A regra é validada novamente no envio, não apenas no calendário.
  if (encomenda) {
    const campoData = formulario.elements.data;
    const campoRetirada = formulario.elements.dataRetirada;
    const validarDatas = () => {
      campoRetirada.min = campoData.value || "";
      const invalida = Boolean(campoData.value && campoRetirada.value &&
                               campoRetirada.value < campoData.value);
      campoRetirada.setCustomValidity(invalida
        ? "A data prevista para retirada não pode ser anterior à data da solicitação."
        : "");
      return !invalida;
    };
    campoData.addEventListener("change", validarDatas);
    campoRetirada.addEventListener("change", validarDatas);
    campoData.addEventListener("input", validarDatas);
    campoRetirada.addEventListener("input", validarDatas);
    validarDatas();
  }

  const lista = document.querySelector("#lista-itens");

  if (vinculo) {
    lista.querySelectorAll("input,select,button")
      .forEach(elemento => elemento.disabled = true);
  } else {
    document.querySelector("#adicionar-item").onclick = () => {
      lista.insertAdjacentHTML("beforeend", novoItemHtml({}, encomenda));
    };
  }

  lista.addEventListener("click", evento => {
    const remover = evento.target.closest("[data-remove-item]");
    if (remover) {
      remover.closest(".admin-item").remove();
      atualizarTotal();
    }
  });

  const tratarMudancaItem = evento => {
    if (evento.target.matches(".item-produto")) {
      // Busca incremental, limitada às 12 sugestões mais próximas.
      // O valor gravado será sempre o ID do produto escolhido.
      if (evento.type === "input") {
        evento.target.dataset.produtoId = "";
        sugerirProdutos(evento.target);
      }
      resolverProdutoDigitado(evento.target);
    }
    atualizarTotal();
  };
  lista.addEventListener("input", tratarMudancaItem);
  lista.addEventListener("change", tratarMudancaItem);
  lista.addEventListener("focusin", evento => {
    if (evento.target.matches(".item-produto")) sugerirProdutos(evento.target);
  });

  function coletarItens() {
    return [...lista.querySelectorAll(".admin-item")].map(elemento => ({
      produtoId: elemento.querySelector(".item-produto").dataset.produtoId || "",
      quantidade: Number(elemento.querySelector(".item-quantidade").value),
      precoUnitario: Number(elemento.querySelector(".item-preco").value),
      ...(encomenda ? { status: elemento.querySelector(".item-status").value } : {})
    }));
  }

  function atualizarTotal() {
    const total = coletarItens().reduce(
      (soma, item) => soma + item.quantidade * item.precoUnitario, 0
    );
    document.querySelector("#total-operacao").textContent = moeda(total);
    return total;
  }

  atualizarTotal();

  formulario.onsubmit = async evento => {
    evento.preventDefault();

    const dados = Object.fromEntries(new FormData(formulario).entries());
    const itens = vinculo ? existente.itens : coletarItens();
    const total = atualizarTotal();

    if (!itens.length || itens.some(item =>
      !item.produtoId ||
      !Number.isFinite(item.quantidade) ||
      item.quantidade <= 0 ||
      !Number.isFinite(item.precoUnitario) ||
      item.precoUnitario < 0
    )) {
      alert("Informe corretamente os produtos, quantidades e preços.");
      return;
    }

    if (encomenda) {
      if (!dados.data || !dados.dataRetirada || dados.dataRetirada < dados.data) {
        formulario.elements.dataRetirada.setCustomValidity(
          "A retirada deve ocorrer na mesma data ou após a solicitação.");
        formulario.elements.dataRetirada.reportValidity();
        return;
      }
      if (itens.some(item => !STATUS_ITEM.includes(item.status))) {
        alert("Selecione uma situação válida para cada item."); return;
      }
      const situacaoEscolhida = dados.status || "Pendente";
      if (["Não retirada", "Cancelado"].includes(situacaoEscolhida)) {
        if (situacaoEscolhida === "Não retirada" && existente?.status !== "Não retirada") {
          alert("Use a ação Confirmar não retirada após o prazo."); return;
        }
        dados.status = situacaoEscolhida;
      } else {
        dados.status = statusGeral(itens, situacaoEscolhida);
      }
      const nome = dados.solicitanteNome.trim();
      const telefone = dados.solicitanteTelefone.replace(/\D/g, "");
      const nacional = telefone.startsWith("55") && (telefone.length === 12 || telefone.length === 13)
        ? telefone.slice(2) : telefone;
      if (!nome || !/^\d{10,11}$/.test(nacional)) {
        alert("Informe nome e telefone com DDD (10 ou 11 dígitos).");
        return;
      }
      if (!dados.dataRetirada || (diasAposData(dados.dataRetirada) === null)) {
        alert("Informe uma data de retirada válida.");
        return;
      }
      if (existente?.status === "Não retirada" && dados.status !== "Não retirada") {
        alert("Uma encomenda encerrada como não retirada não pode ser reaberta nesta versão.");
        return;
      }
      dados.solicitante = { nome, telefone: nacional };
      delete dados.solicitanteNome;
      delete dados.solicitanteTelefone;
    } else {
      dados.solicitante = vinculo ? contatoSolicitante(existente) :
        { nome: dados.solicitanteNome.trim(), telefone: "" };
      delete dados.solicitanteNome;
    }

    const registro = {
      ...existente,
      ...dados,
      id: id || novoId(),
      itens,
      total,
      criadoEm: existente?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    // Remove o campo antigo caso a encomenda tenha sido salva em uma
    // versão anterior do formulário que permitia pagamentos antecipados.
    if (encomenda) {
      delete registro.valorPago;
      delete registro.clienteId;
      if (resumoItens(registro).disponiveis > 0 && !registro.disponivelEm) registro.disponivelEm = new Date().toISOString();
      if (registro.status !== "Disponível" && !existente?.disponivelEm) delete registro.disponivelEm;
    }

    try {
      await salvarRegistro(colecao, registro);
      fecharDialog();
      renderizar();
      mensagem("Operação salva no MongoDB.");
    } catch (erro) { alert(erro.message); }
  };

  dialog.showModal();
}

// --------------------------------------------------
// Conversão de encomenda em venda
// --------------------------------------------------

async function confirmarNaoRetirada(id) {
  const encomenda = obterRegistro("encomendas", id);
  const aviso = encomenda ? alertaRetirada(encomenda) : null;
  if (!aviso || aviso.dias < 3) return alert("Prazo ainda não encerrado ou encomenda indisponível.");
  if (!confirm("Confirmar que a encomenda NÃO foi retirada e que os produtos foram liberados para venda? O histórico será preservado.")) return;
  try {
    await salvarRegistro("encomendas", {
      ...encomenda, status: "Não retirada", encerradaEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
    renderizar();
    mensagem("Encomenda marcada como não retirada. Histórico preservado.");
  } catch (erro) { alert(erro.message); }
}

async function converterEncomenda(id) {
  const encomenda = obterRegistro("encomendas", id);
  if (!encomenda) return;

  if (encomenda.status !== "Entregue") {
    alert("A encomenda precisa estar entregue.");
    return;
  }

  if (carregar("vendas").some(v => v.encomendaId === id)) {
    alert("Esta encomenda já possui uma venda vinculada.");
    return;
  }

  const itensEntregues = encomenda.itens.filter(item => statusItem(item, encomenda) === "Entregue");
  if (!itensEntregues.length) return alert("Não existem itens entregues para registrar como venda.");
  if (!confirm("O cliente retirou e pagou os itens entregues? Registrar venda desses itens?")) return;
  const totalEntregue = itensEntregues.reduce((soma, item) => soma +
    Number(item.quantidade) * Number(item.precoUnitario), 0);

  const venda = {
    id: novoId(),
    encomendaId: id,
    solicitante: { ...contatoSolicitante(encomenda) },
    data: dataAtual(),
    itens: itensEntregues.map(item => ({ ...item })),
    total: totalEntregue,
    formaPagamento: "Não informada",
    observacoes: "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  try {
    await salvarRegistro("vendas", venda);
    renderizar();
    mensagem("Venda registrada a partir da encomenda no MongoDB.");
  } catch (erro) { alert(erro.message); }
}

// --------------------------------------------------
// Painel inicial
// --------------------------------------------------

function renderizarPainel() {
  const encomendas = carregar("encomendas");
  const vendas = carregar("vendas");
  const sugestoes = carregar("sugestoes");

  const pendentes = encomendas.filter(
    e => e.status === "Pendente"
  ).length;

  const entregues = encomendas.filter(
    e => e.status === "Entregue"
  ).length;

  const vendasDeEncomendas = vendas.filter(v => Boolean(v.encomendaId));

  const vendasDiretas = vendas.filter(v => !v.encomendaId);
  const valorVendasDiretas = vendasDiretas.reduce(
    (total, v) => total + Number(v.total || 0), 0
  );

  const valorVendasEncomendas = vendasDeEncomendas.reduce(
    (total, v) => total + Number(v.total || 0), 0
  );

  const alertas = encomendas.filter(e => alertaRetirada(e));
  const naoRetiradas = encomendas.filter(e => e.status === "Não retirada");
  const cards = [
    ["Alertas de retirada", alertas.length],
    ["Não retiradas", naoRetiradas.length],
    ["Encomendas registradas", encomendas.length],
    ["Encomendas pendentes", pendentes],
    ["Encomendas entregues", entregues],
    ["Sugestões recebidas", sugestoes.length],
    ["Vendas de encomendas registradas", vendasDeEncomendas.length],
    ["Valor das vendas registradas", moeda(valorVendasDiretas + valorVendasEncomendas)]
  ];

  document.querySelector("#conteudo-pagina").innerHTML = `
    <div class="admin-notice">
      Os indicadores consideram apenas os registros
      armazenados neste navegador. Ainda não há conexão
      com o banco de dados. Encomendas não incluem recebimentos;
      valores de vendas são contabilizados apenas após registro da venda.
      Alertas de retirada são calculados ao abrir ou atualizar a página.
    </div>

    <section class="admin-grid-3">
      ${cards.map(([titulo, valor]) => `
        <article class="admin-stat">
          <span>${titulo}</span>
          <strong>${escapar(valor)}</strong>
        </article>
      `).join("")}
    </section>

    ${alertas.length ? `<section class="admin-card" style="margin-top:22px">
      <h2>Retiradas que precisam de atenção</h2>
      <p>${alertas.length} encomenda(s) aguardando contato ou encerramento.</p>
      <a class="botao botao-primario" href="encomendas.html">Consultar encomendas</a>
    </section>` : ""}
    <section class="admin-card" style="margin-top:22px">
      <h2>Acesso rápido</h2>
      <div class="admin-grid">
        <a class="botao botao-primario"
           href="encomendas.html">Encomendas</a>
        <a class="botao botao-secundario"
           href="vendas.html">Vendas</a>
        <a class="botao botao-secundario"
           href="produtos.html">Produtos</a>
        <a class="botao botao-secundario"
           href="sugestoes.html">Sugestões</a>
      </div>
    </section>
  `;
}


// --------------------------------------------------
// Fornecedores e compras agrupadas
// --------------------------------------------------
const modeloCompra = () => ({ produtoId:"", texto:"", quantidade:1, custoUnitario:"", lote:"", validade:"" });
let itensCompra = [modeloCompra()];
let fornecedorCompraId = "";
let buscaCompra = "";
let limiteCompras = 3;

function cssCompras() {
  if (document.getElementById("css-compras")) return;
  const estilo = document.createElement("style");
  estilo.id = "css-compras";
  estilo.textContent = `
  .comp-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .comp-campo {display:flex;flex-direction:column;gap:6px;min-width:0}
  .comp-campo input,.comp-campo select {width:100%;min-width:0;padding:12px;border:1px solid #bacbc0;border-radius:9px;background:#fff;font:inherit}
  .comp-full {grid-column:1 / -1}
  .comp-item {padding:16px;border:1px solid #d6e1d7;border-radius:12px;margin:12px 0;background:#fff}
  .comp-acoes {display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}
  .comp-hint {font-size:.88rem;color:#53675b}
  .comp-item-top {display:flex;align-items:center;justify-content:space-between;gap:12px}
  .comp-sugestoes {display:flex;flex-direction:column;gap:4px;max-height:210px;overflow:auto}
  .comp-sugestoes button {padding:10px;text-align:left;background:#f2f7eb;border:1px solid #dce5d1;border-radius:7px;cursor:pointer;color:#183f2e}
  .comp-muted {color:#54665a;font-size:.92rem}
  @media(max-width:650px){.comp-grid{grid-template-columns:1fr}.comp-full{grid-column:auto}}
  `;
  document.head.append(estilo);
}
function validarCnpjBasico(texto) {return String(texto).replace(/\D/g,"");}
function exibirFornecedorNome(id) {
  const f = carregar("fornecedores").find(x => x.id === String(id));
  return f ? f.nome + (f.cnpj ? ` · ${f.cnpj}` : "") : "Fornecedor não identificado";
}
function abrirCadastroFornecedor(id = null, aoSalvar = null) {
  const atual = id ? obterRegistro("fornecedores", id) : null;
  const dialog = document.querySelector("#dialog-cadastro");
  const form = document.querySelector("#form-cadastro");
  document.querySelector("#titulo-dialog").textContent = atual ? "Editar fornecedor" : "Cadastrar fornecedor";
  document.querySelector("#campos-dialog").innerHTML = `
    <div class="comp-grid">
      <label class="comp-campo">Tipo de fornecedor *
        <select name="tipo" id="fornecedor-tipo"><option value="PJ" ${atual?.tipo!=="PF"?"selected":""}>Empresa (CNPJ)</option><option value="PF" ${atual?.tipo==="PF"?"selected":""}>Pessoa física</option></select></label>
      <label class="comp-campo">Nome / razão social *<input name="nome" required maxlength="160" value="${escapar(atual?.nome||"")}"></label>
      <label class="comp-campo" id="campo-cnpj">CNPJ *<input name="cnpj" inputmode="numeric" maxlength="18" placeholder="Somente números" value="${escapar(atual?.cnpj||"")}"></label>
      <label class="comp-campo">Telefone (opcional)<input name="telefone" maxlength="30" value="${escapar(atual?.telefone||"")}"></label>
      <label class="comp-campo comp-full"><span><input type="checkbox" name="ativo" ${atual?.ativo===false?"":"checked"}> Fornecedor ativo</span></label>
    </div>`;
  document.querySelector('#form-cadastro button[type="submit"]').hidden=false;
  document.querySelector("#cancelar-dialog").textContent="Cancelar";
  function atualizarTipo() {
    form.elements.cnpj.disabled=form.elements.tipo.value==="PF";
    form.elements.cnpj.required=form.elements.tipo.value==="PJ";
    form.elements.cnpj.closest("label").hidden=form.elements.tipo.value==="PF";
  }
  form.elements.tipo.onchange=atualizarTipo;
  atualizarTipo();
  form.onsubmit=async ev=>{
    ev.preventDefault();
    const registro={tipo:form.elements.tipo.value,nome:form.elements.nome.value.trim(),cnpj:validarCnpjBasico(form.elements.cnpj.value),telefone:form.elements.telefone.value.trim(),ativo:form.elements.ativo.checked};
    try {
      const salvo=await requisicaoMongo(`/api/fornecedores${atual?"/"+atual.id:""}`,{method:atual?"PUT":"POST",body:JSON.stringify(registro)});
      cacheMongo.fornecedores=await requisicaoMongo("/api/fornecedores");
      dialog.close();
      if(aoSalvar)aoSalvar(salvo);
      if (PAGE === "fornecedores") renderizar();
      if (PAGE === "compras" && aoSalvar) {
        fornecedorCompraId = salvo.id;
        document.querySelector("#comp-fornecedor").value = exibirFornecedorNome(salvo.id);
        document.querySelector("#fornecedor-selecionado").textContent = "Fornecedor cadastrado e selecionado.";
      }
      mensagem("Fornecedor salvo no MongoDB.");
    } catch(erro){alert(erro.message);}
  };
  dialog.showModal();
}
function renderizarFornecedores() {
  cssCompras();
  document.querySelector("#acoes-pagina").innerHTML='<button class="botao botao-primario" id="novo-fornecedor">+ Novo fornecedor</button>';
  const fornecedores=carregar("fornecedores");
  document.querySelector("#conteudo-pagina").innerHTML=`<section class="admin-card">
    <label class="comp-campo">Buscar por nome ou CNPJ<input id="pesquisa-fornecedor" type="search" placeholder="Digite nome ou CNPJ" autocomplete="off"></label>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Fornecedor</th><th>Tipo</th><th>CNPJ</th><th>Situação</th><th>Ação</th></tr></thead>
    <tbody id="linhas-fornecedor">${fornecedores.map(f=>`<tr><td>${escapar(f.nome)}</td><td>${f.tipo}</td><td>${escapar(f.cnpj||"—")}</td><td>${f.ativo?"Ativo":"Inativo"}</td><td><button class="admin-btn-small" data-fornecedor="${escapar(f.id)}">Editar</button></td></tr>`).join("")}</tbody></table></div>
    <p class="comp-muted">${fornecedores.length} fornecedor(es)</p></section>`;
  document.querySelector("#novo-fornecedor").onclick=()=>abrirCadastroFornecedor();
  const linhas=[...document.querySelectorAll("#linhas-fornecedor tr")];
  document.querySelector("#pesquisa-fornecedor").oninput=e=>{const q=e.target.value.toLocaleLowerCase("pt-BR").replace(/\D/g,"");const raw=e.target.value.toLocaleLowerCase("pt-BR");linhas.forEach(tr=>tr.hidden=!tr.textContent.toLocaleLowerCase("pt-BR").includes(raw)&&!(q&&tr.textContent.replace(/\D/g,"").includes(q)));};
  document.querySelector("#linhas-fornecedor").onclick=e=>{const b=e.target.closest("[data-fornecedor]");if(b)abrirCadastroFornecedor(b.dataset.fornecedor);};
}
function resumoCompra(c) {
  return `${c.itens.length} produto(s) · ${moeda(c.total)}`;
}
function renderizarCompras() {
  cssCompras();
  const compras=carregar("compras");
  document.querySelector("#acoes-pagina").innerHTML='';
  document.querySelector("#conteudo-pagina").innerHTML=`
    <section class="admin-card"><h2>Registrar compra</h2><p class="comp-muted">Cadastre o fornecedor uma vez e inclua todos os produtos da compra.</p>
      <form id="form-compra">
        <div class="comp-grid">
          <label class="comp-campo">Data da compra *<input type="date" name="data" required value="${dataAtual()}"></label>
          <label class="comp-campo">Tipo de documento *<select name="tipoDocumento"><option>NF-e</option><option>NFC-e</option><option>Cupom fiscal</option><option>Recibo</option><option>Sem documento</option></select></label>
          <label class="comp-campo" id="numero-documento">Número da nota / cupom *<input name="numeroDocumento" maxlength="80" required placeholder="Número do documento"></label>
          <div class="comp-campo comp-full"><label for="comp-fornecedor">Fornecedor (CNPJ ou nome) *</label><input id="comp-fornecedor" autocomplete="off" placeholder="Digite o CNPJ ou nome"><div id="lista-fornecedores" class="comp-sugestoes"></div>
          <button type="button" class="botao botao-secundario" id="criar-fornecedor">+ Cadastrar novo fornecedor</button><span id="fornecedor-selecionado" class="comp-hint"></span></div>
        </div>
        <h3 style="margin-top:22px">Produtos recebidos</h3><div id="lista-itens-compra"></div>
        <div class="comp-acoes"><button type="button" id="adicionar-item" class="botao botao-secundario">+ Adicionar produto</button>
        <button type="button" id="atualizar-produtos" class="botao botao-secundario">Atualizar catálogo</button>
        <span class="comp-muted">Produto novo? <a href="produtos.html" target="_blank" rel="noopener">Cadastrar produto em outra aba</a> e volte para atualizar.</span></div>
        <div class="comp-acoes" style="justify-content:space-between"><strong id="total-compra">Total: R$ 0,00</strong><button class="botao botao-primario" type="submit" id="salvar-compra">Salvar compra</button></div>
      </form></section>
    <section class="admin-card"><h2>Compras registradas</h2><input id="pesquisa-compras" type="search" placeholder="Buscar compra, fornecedor, produto ou documento" value="${escapar(buscaCompra)}" style="width:100%;padding:12px">
      <div id="lista-compras">${compras.map((c,indice)=>`<details class="comp-registro" data-busca="${escapar([c.id,c.data,c.documento?.numero,exibirFornecedorNome(c.fornecedorId),...c.itens.map(i=>obterRegistro("produtos",i.produtoId)?.nome||"")].join(" ").toLocaleLowerCase("pt-BR"))}" style="border-bottom:1px solid #dae1d8;padding:12px 0" ${indice>=limiteCompras?"hidden":""}><summary style="cursor:pointer"><strong>#${escapar(c.id)}</strong> · ${mostrarData(c.data)} · ${escapar(exibirFornecedorNome(c.fornecedorId))} — ${moeda(c.total)}</summary>
        <p>${escapar(c.documento?.tipo||"")} ${escapar(c.documento?.numero||"")}</p><ul>${c.itens.map(i=>`<li>${escapar(obterRegistro("produtos",i.produtoId)?.nome||"Produto #"+i.produtoId)} — ${escapar(i.quantidade)} ${obterRegistro("produtos",i.produtoId)?.formaVenda==="Quilograma"?"kg":"un"} × ${moeda(i.custoUnitario)}</li>`).join("")}</ul></details>`).join("")||'<p class="comp-muted">Nenhuma compra encontrada.</p>'}</div>
      ${compras.length>3?'<button type="button" id="alternar-compras" class="botao botao-secundario" style="margin-top:14px">Ver todos</button>':''}
    </section>`;
  const form=document.querySelector("#form-compra");
  function atualizarDocumento(){const sem=form.elements.tipoDocumento.value==="Sem documento";form.elements.numeroDocumento.required=!sem;document.querySelector("#numero-documento").hidden=sem;if(sem)form.elements.numeroDocumento.value="";}
  form.elements.tipoDocumento.onchange=atualizarDocumento;atualizarDocumento();
  const fornecedorInput=document.querySelector("#comp-fornecedor");
  fornecedorInput.value=fornecedorCompraId?exibirFornecedorNome(fornecedorCompraId):"";
  function buscarFornecedor(){
    const q=fornecedorInput.value.trim().toLocaleLowerCase("pt-BR");const numeros=q.replace(/\D/g,"");
    document.querySelector("#lista-fornecedores").innerHTML=q?carregar("fornecedores").filter(f=>f.ativo&&(f.nome.toLocaleLowerCase("pt-BR").includes(q)||(numeros&&f.cnpj.includes(numeros)))).slice(0,8).map(f=>`<button type="button" data-id="${escapar(f.id)}">${escapar(f.nome)} ${f.cnpj?"· "+escapar(f.cnpj):"(PF)"}</button>`).join(""):"";
  }
  fornecedorInput.oninput=()=>{fornecedorCompraId="";buscarFornecedor();};
  document.querySelector("#lista-fornecedores").onclick=e=>{const b=e.target.closest("[data-id]");if(!b)return;fornecedorCompraId=b.dataset.id;fornecedorInput.value=exibirFornecedorNome(fornecedorCompraId);document.querySelector("#lista-fornecedores").innerHTML="";document.querySelector("#fornecedor-selecionado").textContent="Fornecedor selecionado.";};
  document.querySelector("#criar-fornecedor").onclick=()=>abrirCadastroFornecedor(null,()=>{});
  document.querySelector("#adicionar-item").onclick=()=>{itensCompra.push(modeloCompra());montarItensCompra();};
  document.querySelector("#atualizar-produtos").onclick=async()=>{try{cacheMongo.produtos=await requisicaoMongo("/api/produtos");montarItensCompra();mensagem("Catálogo atualizado.");}catch(e){alert(e.message);}};
  const pesquisar=document.querySelector("#pesquisa-compras");
  const alternar=document.querySelector("#alternar-compras");
  function aplicarFiltroCompras() {
    const q=pesquisar.value.trim().toLocaleLowerCase("pt-BR");
    const registros=[...document.querySelectorAll(".comp-registro")];
    registros.forEach((el,i)=>el.hidden = q ? !el.dataset.busca.includes(q) : (i>=limiteCompras));
    if(alternar){alternar.hidden=Boolean(q);alternar.textContent=limiteCompras===3?"Ver todos":"Recolher";}
  }
  pesquisar.oninput=()=>{buscaCompra=pesquisar.value;aplicarFiltroCompras();};
  if(alternar)alternar.onclick=()=>{limiteCompras=limiteCompras===3?compras.length:3;aplicarFiltroCompras();};
  aplicarFiltroCompras();
  montarItensCompra();
  form.onsubmit=async ev=>{
    ev.preventDefault();
    if(!fornecedorCompraId)return alert("Selecione um fornecedor na lista ou cadastre um novo.");
    const itens=itensCompra.map(x=>({produtoId:x.produtoId,quantidade:Number(x.quantidade),custoUnitario:Number(x.custoUnitario),lote:x.lote,validade:x.validade}));
    if(itens.some((i,indice)=>!i.produtoId||!Number.isFinite(i.quantidade)||i.quantidade<=0||!Number.isFinite(i.custoUnitario)||i.custoUnitario<0||String(itensCompra[indice].custoUnitario).trim()===""))return alert("Selecione cada produto e informe quantidade e custo.");
    const botao=document.querySelector("#salvar-compra");botao.disabled=true;
    try{
      await requisicaoMongo("/api/compras",{method:"POST",body:JSON.stringify({fornecedorId:fornecedorCompraId,data:form.elements.data.value,documento:{tipo:form.elements.tipoDocumento.value,numero:form.elements.numeroDocumento.value.trim()},itens})});
      cacheMongo.compras=await requisicaoMongo("/api/compras");
      cacheMongo.entradas=await requisicaoMongo("/api/entradas");
      itensCompra=[modeloCompra()];fornecedorCompraId="";buscaCompra="";limiteCompras=3;renderizarCompras();mensagem("Compra salva no MongoDB, com histórico por produto.");
    }catch(e){alert(e.message);botao.disabled=false;}
  };
}
function montarItensCompra() {
  const lista=document.querySelector("#lista-itens-compra");if(!lista)return;
  lista.innerHTML=itensCompra.map((item,i)=>`<article class="comp-item" data-item="${i}">
    <div class="comp-item-top"><strong>Item ${i+1}</strong><button type="button" class="admin-btn-small admin-btn-danger" data-remover="${i}" ${itensCompra.length===1?"disabled":""}>Remover</button></div>
    <div class="comp-grid"><div class="comp-campo comp-full"><label>Produto *</label><input type="search" data-campo="texto" placeholder="Nome, marca ou código" autocomplete="off" value="${escapar(item.texto)}"><div class="comp-sugestoes" data-sugestoes="${i}"></div></div>
    <label class="comp-campo">Quantidade *<input type="number" data-campo="quantidade" min="0.001" step="0.001" required value="${escapar(item.quantidade)}"></label>
    <label class="comp-campo">Custo unitário (R$) *<input type="number" data-campo="custoUnitario" min="0" step="0.01" required value="${escapar(item.custoUnitario)}"></label>
    <label class="comp-campo">Lote (opcional)<input data-campo="lote" maxlength="100" value="${escapar(item.lote)}"></label>
    <label class="comp-campo">Validade (opcional)<input type="date" data-campo="validade" value="${escapar(item.validade)}"></label></div></article>`).join("");
  lista.oninput=e=>{const input=e.target.closest("[data-campo]");if(!input)return;const i=Number(input.closest("[data-item]").dataset.item),campo=input.dataset.campo;itensCompra[i][campo]=input.value;
    if(campo==="texto"){itensCompra[i].produtoId="";sugerirProdutosCompra(i,input);}else{atualizarTotalCompra();}};
  lista.onfocusin=e=>{const input=e.target.closest('[data-campo="texto"]');if(input)sugerirProdutosCompra(Number(input.closest("[data-item]").dataset.item),input);};
  lista.onclick=e=>{const remove=e.target.closest("[data-remover]");if(remove){itensCompra.splice(Number(remove.dataset.remover),1);montarItensCompra();return;}
    const escolha=e.target.closest("[data-escolha]");if(escolha){const i=Number(escolha.closest("[data-item]").dataset.item);const p=obterRegistro("produtos",escolha.dataset.escolha);if(!p)return;itensCompra[i].produtoId=p.id;itensCompra[i].texto=p.nome+(p.marca?" · "+p.marca:"");montarItensCompra();}};
  atualizarTotalCompra();
}
function sugerirProdutosCompra(i,input) {
  const q=input.value.trim().toLocaleLowerCase("pt-BR");const lista=input.closest("[data-item]").querySelector("[data-sugestoes]");
  lista.innerHTML=q?carregar("produtos").filter(p=>p.ativo!==false&&[p.nome,p.marca,p.codigoBarras,p.codigoInterno].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(q))).slice(0,8).map(p=>`<button type="button" data-escolha="${escapar(p.id)}">${escapar(p.nome)} ${p.marca?"· "+escapar(p.marca):""}</button>`).join(""):"";
}
function atualizarTotalCompra() {
  const soma=itensCompra.reduce((s,i)=>s+(Number(i.quantidade)||0)*(Number(i.custoUnitario)||0),0);
  const el=document.querySelector("#total-compra");if(el)el.textContent="Total: "+moeda(soma);
}

// --------------------------------------------------
// Inicialização
// --------------------------------------------------

function renderizar() {
  if (PAGE === "painel") {
    renderizarPainel();
  } else if (PAGE === "fornecedores") {
    renderizarFornecedores();
  } else if (PAGE === "compras") {
    renderizarCompras();
  } else {
    renderizarListagem(PAGE);
  }
}

if (!APP || !TITULOS[PAGE]) {
  console.error("Página administrativa não reconhecida.");
} else {
  montarLayout();
  document.querySelector("#conteudo-pagina").innerHTML = "<p>Carregando dados do MongoDB...</p>";
  atualizarMongo().catch(erro => {
    document.querySelector("#conteudo-pagina").innerHTML =
      `<div class="admin-card"><h2>Não foi possível carregar o MongoDB</h2><p>${escapar(erro.message)}</p><p>Execute <code>npm start</code> e abra a página pela porta 3000.</p></div>`;
  });
}
// Encerrar sessão administrativa

document.addEventListener("click", async evento => {

  if (!evento.target.closest("#botao-sair-admin")) {
    return;
  }

  try {
    const resposta = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    if (!resposta.ok) {
      throw new Error(
        "Não foi possível encerrar a sessão."
      );
    }

    window.location.assign("/login.html");

  } catch (erro) {
    alert(erro.message);
  }
});