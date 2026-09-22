"use strict";

/* ==========================================
   CONFIGURAÇÕES DA LOJA

   Quando tiver o telefone oficial, preencha
   com país + DDD + número, somente dígitos.

   Não coloque senhas ou dados de conexão
   ao MongoDB neste arquivo.
   ========================================== */

const configuracoes = {
  whatsapp: "",
  endereco: "",
  horario: ""
};

/* ==========================================
   PRODUTOS DE EXEMPLO

   Futuramente, estes dados virão do backend.

   exibir_na_landing: true  -> aparece
   exibir_na_landing: false -> não aparece

   As marcas estão vazias porque estes são
   exemplos, sem marca real definida.
   ========================================== */

const produtos = [
  {
    id: "morango",
    nome: "Morango",
    marca: "",
    categoria: "Hortifruti",
    apresentacao: "Bandeja · 250 g",

    imagem:
      "https://images.unsplash.com/" +
      "photo-1464965911861-746a04b4bca6" +
      "?auto=format&fit=crop&w=640&q=85",

    descricaoImagem: "Morangos frescos, foto ilustrativa",
    exibir_na_landing: true
  },

  {
    id: "arroz",
    nome: "Arroz branco",
    marca: "",
    categoria: "Mercearia",
    apresentacao: "Pacote · 5 kg",

    imagem:
      "https://images.unsplash.com/" +
      "photo-1586201375761-83865001e31c" +
      "?auto=format&fit=crop&w=640&q=85",

    descricaoImagem: "Grãos de arroz, foto ilustrativa",
    exibir_na_landing: true
  },

  {
    id: "cafe",
    nome: "Café torrado e moído",
    marca: "",
    categoria: "Mercearia",
    apresentacao: "Pacote · 500 g",

    imagem:
      "https://images.unsplash.com/" +
      "photo-1447933601403-0c6688de566e" +
      "?auto=format&fit=crop&w=640&q=85",

    descricaoImagem: "Grãos de café, foto ilustrativa",
    exibir_na_landing: true
  },

  {
    id: "leite",
    nome: "Leite integral",
    marca: "",
    categoria: "Laticínios e frios",
    apresentacao: "Caixa · 1 L",

    imagem:
      "https://images.unsplash.com/" +
      "photo-1563636619-e9143da7973b" +
      "?auto=format&fit=crop&w=640&q=85",

    descricaoImagem: "Leite em recipiente, foto ilustrativa",
    exibir_na_landing: true
  }
];

/* ==========================================
   JANELA DE AVISOS
   ========================================== */

const janelaAviso = document.querySelector("#janela-aviso");

function mostrarAviso(titulo, texto) {
  document.querySelector("#titulo-aviso").textContent = titulo;
  document.querySelector("#texto-aviso").textContent = texto;

  janelaAviso.showModal();
}

function fecharAviso() {
  janelaAviso.close();
}

document
  .querySelector("#fechar-aviso")
  .addEventListener("click", fecharAviso);

document
  .querySelector("#confirmar-aviso")
  .addEventListener("click", fecharAviso);

/* Ainda não há login nesta primeira versão */
document
  .querySelector("#abrir-administracao")
  .addEventListener("click", () => {
    mostrarAviso(
      "Área administrativa",

      "O acesso do Sr. Alberto será implementado " +
      "na próxima etapa. Esta prévia apresenta " +
      "a página pública; ainda não há login disponível."
    );
  });

/* ==========================================
   WHATSAPP
   ========================================== */

function abrirWhatsApp(mensagem) {
  // Remove espaços, parênteses e outros caracteres.
  const telefone = configuracoes.whatsapp.replace(/\D/g, "");

  // Confere se há código do Brasil, DDD e número.
  if (!/^55\d{10,11}$/.test(telefone)) {
    mostrarAviso(
      "Contato em preparação",

      "O número oficial do Empório ainda precisa " +
      "ser confirmado. Assim que ele for cadastrado, " +
      "este botão abrirá a conversa com o Sr. Alberto."
    );

    return;
  }

  // Preenche a mensagem; o visitante decide enviá-la.
  const endereco =
    "https://wa.me/" +
    telefone +
    "?text=" +
    encodeURIComponent(mensagem);

  window.open(endereco, "_blank", "noopener,noreferrer");
}

document
  .querySelectorAll("[data-encomendar]")
  .forEach((botao) => {
    botao.addEventListener("click", () => {
      abrirWhatsApp(
        "Olá, Sr. Alberto! Gostaria de fazer uma encomenda."
      );
    });
  });

/* ==========================================
   MENU PARA CELULAR
   ========================================== */

const botaoMenu = document.querySelector("#botao-menu");

const navegacao = document.querySelector(
  "#navegacao-principal"
);

function fecharMenu() {
  navegacao.classList.remove("aberta");
  botaoMenu.setAttribute("aria-expanded", "false");
}

botaoMenu.addEventListener("click", () => {
  const aberta = navegacao.classList.toggle("aberta");

  botaoMenu.setAttribute(
    "aria-expanded",
    String(aberta)
  );
});

navegacao.querySelectorAll("a").forEach((ligacao) => {
  ligacao.addEventListener("click", fecharMenu);
});

document.addEventListener("keydown", (evento) => {
  if (
    evento.key === "Escape" &&
    navegacao.classList.contains("aberta")
  ) {
    fecharMenu();
    botaoMenu.focus();
  }
});

/* ==========================================
   CRIAÇÃO DOS CARTÕES DE PRODUTOS
   ========================================== */

/*
  Função auxiliar para criar elementos HTML.

  textContent trata o conteúdo como texto,
  sem interpretar nomes de produtos como HTML.
*/
function criarElemento(tipo, classe, texto) {
  const elemento = document.createElement(tipo);

  if (classe) {
    elemento.className = classe;
  }

  if (texto !== undefined) {
    elemento.textContent = texto;
  }

  return elemento;
}

function mostrarProdutos(categoria = "Todos") {
  const grade = document.querySelector("#grade-produtos");

  // Remove os cartões anteriores.
  grade.replaceChildren();

  // Mostra somente produtos autorizados para a vitrine.
  const produtosVisiveis = produtos.filter((produto) => {
    const podeAparecer = produto.exibir_na_landing === true;

    const correspondeCategoria =
      categoria === "Todos" ||
      produto.categoria === categoria;

    return podeAparecer && correspondeCategoria;
  });

  produtosVisiveis.forEach((produto) => {
    const cartao = criarElemento(
      "article",
      "cartao-produto"
    );

    const foto = criarElemento("div", "foto-produto");

    const imagem = criarElemento("img");

    imagem.src = produto.imagem;
    imagem.alt = produto.descricaoImagem;
    imagem.loading = "lazy";
    imagem.width = 640;
    imagem.height = 480;

    foto.append(imagem);

    const dados = criarElemento("div", "dados-produto");

    dados.append(
      criarElemento(
        "p",
        "categoria-produto",
        produto.categoria
      )
    );

    dados.append(
      criarElemento("h3", "", produto.nome)
    );

    if (produto.marca) {
      dados.append(
        criarElemento("p", "texto-apoio", produto.marca)
      );
    }

    dados.append(
      criarElemento(
        "p",
        "medida-produto",
        produto.apresentacao
      )
    );

    const botao = criarElemento(
      "button",
      "botao botao-secundario",
      "Consultar produto ↗"
    );

    botao.type = "button";

    botao.setAttribute(
      "aria-label",
      "Consultar " + produto.nome + " pelo WhatsApp"
    );

    botao.addEventListener("click", () => {
      const marca = produto.marca
        ? " — " + produto.marca
        : "";

      const mensagem =
        "Olá, Sr. Alberto! Gostaria de consultar " +
        "o preço e a disponibilidade de: " +
        produto.nome +
        marca +
        " (" +
        produto.apresentacao +
        ").";

      abrirWhatsApp(mensagem);
    });

    dados.append(botao);
    cartao.append(foto, dados);
    grade.append(cartao);
  });

  if (produtosVisiveis.length === 0) {
    grade.append(
      criarElemento(
        "p",
        "texto-apoio",
        "Ainda não há destaques nesta categoria."
      )
    );
  }

  document.querySelector("#resultado-filtro").textContent =
    produtosVisiveis.length + " produto(s) exibido(s).";
}

/* ==========================================
   FILTROS DE CATEGORIA
   ========================================== */

document
  .querySelectorAll("[data-categoria]")
  .forEach((botao) => {
    botao.addEventListener("click", () => {

      document
        .querySelectorAll("[data-categoria]")
        .forEach((outroBotao) => {
          const selecionado = outroBotao === botao;

          outroBotao.classList.toggle(
            "selecionado",
            selecionado
          );

          outroBotao.setAttribute(
            "aria-pressed",
            String(selecionado)
          );
        });

      mostrarProdutos(botao.dataset.categoria);
    });
  });

// Exibe os produtos ao abrir a página.
mostrarProdutos();

/* ==========================================
   FORMULÁRIO DE SUGESTÕES

   Esta versão valida os campos, mas NÃO envia
   nem salva dados no navegador ou no banco.
   ========================================== */

const formulario = document.querySelector(
  "#formulario-sugestao"
);

const produtoSugerido = document.querySelector(
  "#produto-sugerido"
);

const receberAviso = document.querySelector(
  "#receber-aviso"
);

const camposContato = document.querySelector(
  "#campos-contato"
);

const nomeCliente = document.querySelector(
  "#nome-cliente"
);

const telefoneCliente = document.querySelector(
  "#telefone-cliente"
);

const mensagemFormulario = document.querySelector(
  "#mensagem-formulario"
);

// Mostra ou esconde o contato conforme a escolha.
receberAviso.addEventListener("change", () => {
  const desejaAviso = receberAviso.checked;

  camposContato.hidden = !desejaAviso;

  [nomeCliente, telefoneCliente].forEach((campo) => {
    campo.required = desejaAviso;
    campo.disabled = !desejaAviso;

    if (!desejaAviso) {
      campo.value = "";
      campo.setCustomValidity("");
    }
  });

  mensagemFormulario.textContent = "";
});

// Limpa mensagens antigas quando o usuário edita.
formulario.addEventListener("input", () => {
  mensagemFormulario.textContent = "";
});

[
  produtoSugerido,
  nomeCliente,
  telefoneCliente
].forEach((campo) => {
  campo.addEventListener("input", () => {
    campo.setCustomValidity("");
  });
});

formulario.addEventListener("submit", (evento) => {
  // Impede recarregamento ou envio padrão.
  evento.preventDefault();

  mensagemFormulario.textContent = "";

  // Não aceita um produto composto apenas por espaços.
  if (!produtoSugerido.value.trim()) {
    produtoSugerido.setCustomValidity(
      "Informe o produto que deseja sugerir."
    );

    produtoSugerido.reportValidity();
    return;
  }

  if (receberAviso.checked) {

    if (!nomeCliente.value.trim()) {
      nomeCliente.setCustomValidity("Informe seu nome.");
      nomeCliente.reportValidity();
      return;
    }

    const telefone = telefoneCliente.value.replace(/\D/g, "");

    // Aceita DDD + número, com código 55 opcional.
    const telefoneValido =
      /^(?:55)?[1-9][0-9][0-9]{8,9}$/.test(telefone);

    if (!telefoneValido) {
      telefoneCliente.setCustomValidity(
        "Informe um telefone com DDD, com 10 ou 11 dígitos. " +
        "O código 55 é opcional."
      );

      telefoneCliente.reportValidity();
      return;
    }
  }

  mensagemFormulario.textContent =
    "Prévia concluída: os campos estão preenchidos. " +
    "Sua sugestão NÃO foi enviada nem salva. " +
    "O recebimento pelo Sr. Alberto será ativado " +
    "quando conectarmos o formulário ao sistema.";

  mensagemFormulario.focus();
});

/* ==========================================
   INFORMAÇÕES REAIS DA LOJA
   ========================================== */

if (configuracoes.endereco) {
  document.querySelector("#endereco-loja").textContent =
    configuracoes.endereco;

  document.querySelector(
    "#complemento-endereco"
  ).hidden = true;
}

if (configuracoes.horario) {
  document.querySelector("#horario-loja").textContent =
    configuracoes.horario;
}