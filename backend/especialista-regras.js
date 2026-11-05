"use strict";

/*
 * Sistema especialista — Empório Brasileiro
 *
 * Base inicial de conhecimento.
 * As regras precisam ser validadas com o Sr. Alberto.
 */

const VERSAO_REGRAS = "1.0-proposta";

// Perguntas apresentadas ao administrador.
const perguntas = [
  [
    "procura",
    "Há procura recorrente por esse produto?"
  ],
  [
    "fornecedor",
    "Existe fornecedor com esse produto disponível?"
  ],
  [
    "lotePequeno",
    "É possível comprar uma pequena quantidade?"
  ],
  [
    "validadeCurta",
    "O produto tem validade curta?"
  ],
  [
    "refrigeracao",
    "O produto precisa de refrigeração?"
  ],
  [
    "espaco",
    "Existe espaço adequado para armazenar o produto, incluindo refrigeração quando necessária?"
  ]
];

// Regras intermediárias: geram novos fatos.
const regras = [
  {
    id: "F1",
    se: ["refrigeracao_sim", "espaco_nao"],
    entao: "armazenamento_inadequado"
  },
  {
    id: "F2",
    se: ["refrigeracao_nao", "espaco_nao"],
    entao: "armazenamento_inadequado"
  },
  {
    id: "F3",
    se: ["validadeCurta_sim", "procura_nao"],
    entao: "risco_perda"
  },
  {
    id: "F4",
    se: [
      "procura_sim",
      "fornecedor_sim",
      "lotePequeno_sim",
      "espaco_sim"
    ],
    entao: "teste_viavel"
  }
];

// Quanto menor o número, maior a prioridade.
// Isso evita apresentar recomendações incompatíveis.
const conclusoes = [
  {
    id: "R1",
    prioridade: 1,
    se: ["armazenamento_inadequado"],
    titulo: "Adiar a compra",
    motivo:
      "Não há espaço adequado para armazenar o produto."
  },
  {
    id: "R2",
    prioridade: 2,
    se: ["fornecedor_nao"],
    titulo: "Consultar outro fornecedor",
    motivo:
      "Não foi identificado fornecedor com o produto disponível."
  },
  {
    id: "R3",
    prioridade: 3,
    se: [
      "fornecedor_sim",
      "espaco_sim",
      "risco_perda"
    ],
    titulo: "Avaliar a oferta somente por encomenda",
    motivo:
      "O produto tem validade curta e não há procura recorrente. " +
      "Confirme as encomendas e as condições do fornecedor antes de comprar."
  },
  {
    id: "R4",
    prioridade: 4,
    se: ["teste_viavel"],
    titulo: "Testar uma pequena quantidade",
    motivo:
      "Há procura recorrente, fornecedor disponível, espaço adequado " +
      "e possibilidade de comprar uma pequena quantidade."
  },
  {
    id: "R5",
    prioridade: 5,
    se: [
      "fornecedor_sim",
      "espaco_sim",
      "lotePequeno_nao"
    ],
    titulo: "Negociar uma quantidade menor",
    motivo:
      "O fornecedor não permite uma compra pequena. " +
      "Verifique se o lote pode ser atendido por encomendas confirmadas."
  },
  {
    id: "R6",
    prioridade: 6,
    se: [
      "fornecedor_sim",
      "espaco_sim",
      "procura_nao",
      "validadeCurta_nao",
      "lotePequeno_sim"
    ],
    titulo: "Aguardar mais sinais de procura",
    motivo:
      "Ainda não há procura recorrente. " +
      "Continue acompanhando as solicitações antes de decidir."
  }
];

function avaliar(respostas) {
  // Só aceita perguntas respondidas com true ou false.
  for (const [id] of perguntas) {
    if (!respostas || typeof respostas[id] !== "boolean") {
      throw new Error("Responda todas as perguntas com sim ou não.");
    }
  }

  // Set é um conjunto que não permite fatos repetidos.
  const fatos = new Set();

  for (const [id] of perguntas) {
    const resposta = respostas[id] ? "sim" : "nao";

    fatos.add(`${id}_${resposta}`);
  }

  const passos = [];
  let novosFatos = true;

  // Encadeamento progressivo:
  // aplica regras até não encontrar novos fatos.
  while (novosFatos) {
    novosFatos = false;

    for (const regra of regras) {
      const premissasAtendidas = regra.se.every(
        fato => fatos.has(fato)
      );

      if (premissasAtendidas && !fatos.has(regra.entao)) {
        fatos.add(regra.entao);

        passos.push({
          id: regra.id,
          se: [...regra.se],
          entao: regra.entao
        });

        novosFatos = true;
      }
    }
  }

  const conclusoesPossiveis = conclusoes
    .filter(regra =>
      regra.se.every(fato => fatos.has(fato))
    )
    .sort((a, b) => a.prioridade - b.prioridade);

  const conclusao = conclusoesPossiveis[0] || {
    id: "R0",
    se: [],
    titulo: "Revisar as informações com o Sr. Alberto",
    motivo:
      "Nenhuma regra cobre esta combinação de respostas."
  };

  return {
    versaoRegras: VERSAO_REGRAS,
    respostas: Object.fromEntries(
      perguntas.map(([id]) => [id, respostas[id]])
    ),
    fatos: [...fatos],
    passos,
    conclusao
  };
}

// Permite que o server.js utilize este arquivo.
module.exports = {
  VERSAO_REGRAS,
  perguntas,
  regras,
  conclusoes,
  avaliar
};