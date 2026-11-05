"use strict";

// Empório Brasileiro — backend local de desenvolvimento.

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("node:path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const especialista = require("./especialista-regras");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DB_NAME = process.env.DB_NAME || "emporionovo";

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Este login usa sessões em memória e HTTP local. " +
    "Configure sessão persistente e HTTPS antes de publicar."
  );
}

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  throw new Error(
    "Defina SESSION_SECRET com no mínimo 32 caracteres no backend/.env"
  );
}

app.use(
  session({
    name: "emporio.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

// Exige que alterações sejam enviadas pela própria aplicação local.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origem = req.get("origin");

    if (origem && origem !== `http://127.0.0.1:${PORT}`) {
      return res.status(403).json({
        erro: "Origem não autorizada."
      });
    }
  }

  next();
});

app.use(express.json({ limit: "100kb" }));

const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  {
    serverSelectionTimeoutMS: 5000
  }
);

let db;

const configs = {
  categorias: {
    collection: "categoria",
    key: "id_categoria"
  },
  produtos: {
    collection: "produto",
    key: "id_produto"
  },
  entradas: {
    collection: "entrada_produto",
    key: "id_entrada"
  }
};

// --------------------------------------------------
// Utilitários
// --------------------------------------------------

function numeroId(valor) {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
}

function dataCalendario(valor) {
  if (!valor) return null;

  const texto = String(valor).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(texto) ||
    Number.isNaN(Date.parse(texto))
  ) {
    return null;
  }

  return new Date(texto + "T12:00:00.000Z");
}

function dataTexto(valor) {
  if (!valor) return "";

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  return String(valor).slice(0, 10);
}

function dataIsoCurta(valor) {
  return valor instanceof Date
    ? valor.toISOString().slice(0, 10)
    : String(valor || "").slice(0, 10);
}

function respostaErro(res, erro) {
  console.error(erro);

  return res.status(erro.code === 11000 ? 409 : 400).json({
    erro:
      erro.code === 11000
        ? "Identificador duplicado."
        : erro.message
  });
}

async function proximoId(colecao, campo) {
  const ultimo = await db
    .collection(colecao)
    .find({
      [campo]: { $exists: true }
    })
    .sort({
      [campo]: -1
    })
    .limit(1)
    .next();

  return (ultimo?.[campo] || 0) + 1;
}

async function proximoDocumento(
  colecao,
  campo,
  dados,
  converter
) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const documento = {
      [campo]: await proximoId(colecao, campo),
      ...dados,
      criado_em: new Date(),
      atualizado_em: new Date()
    };

    try {
      await db.collection(colecao).insertOne(documento);

      return converter(documento);
    } catch (erro) {
      if (erro.code === 11000 && tentativa < 4) {
        continue;
      }

      throw erro;
    }
  }

  throw new Error("Não foi possível gerar um identificador.");
}

// --------------------------------------------------
// Categorias, produtos e entradas
// --------------------------------------------------

function paraTela(tipo, documento) {
  const id = String(documento[configs[tipo].key]);

  if (tipo === "categorias") {
    return {
      id,
      nome: documento.nome,
      descricao: documento.descricao || "",
      ativo: documento.ativo !== false,
      criadoEm: documento.criado_em || "",
      atualizadoEm: documento.atualizado_em || ""
    };
  }

  if (tipo === "produtos") {
    return {
      id,
      nome: documento.nome,
      marca: documento.marca || "",
      categoriaId: String(documento.id_categoria),
      formaVenda: documento.forma_venda,
      embalagem:
        documento.apresentacao?.embalagem || "sem_embalagem",
      quantidadeEmbalagem:
        documento.apresentacao?.quantidade ?? null,
      unidadeEmbalagem:
        documento.apresentacao?.unidade || "",
      apresentacao: documento.apresentacao,
      codigoBarras: documento.codigo_barras || "",
      codigoInterno: documento.codigo_interno || "",
      precoVenda: documento.preco_venda ?? null,
      exibirLanding: documento.exibir_landing === true,
      ativo: documento.ativo !== false,
      caracteristicas: documento.caracteristicas || {},
      criadoEm: documento.criado_em || "",
      atualizadoEm: documento.atualizado_em || ""
    };
  }

  return {
    id,
    produtoId: String(documento.id_produto),
    data: dataTexto(documento.data_entrada),
    quantidade: documento.quantidade,
    lote: documento.lote || "",
    validade: dataTexto(documento.validade),
    custoUnitario: documento.custo_unitario ?? null,
    observacoes: documento.observacoes || "",
    criadoEm: documento.criado_em || "",
    atualizadoEm: documento.atualizado_em || ""
  };
}

async function validarEConverter(tipo, body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Dados inválidos.");
  }

  const nome = String(body.nome || "").trim();

  if (tipo === "categorias") {
    if (!nome || nome.length > 100) {
      throw new Error(
        "Informe o nome da categoria (até 100 caracteres)."
      );
    }

    return {
      nome,
      descricao: String(body.descricao || "").slice(0, 500),
      ativo: body.ativo !== false
    };
  }

  if (tipo === "produtos") {
    const idCategoria = numeroId(body.categoriaId);

    const categoria =
      idCategoria &&
      (await db.collection("categoria").findOne({
        id_categoria: idCategoria,
        ativo: true
      }));

    if (!categoria) {
      throw new Error("Selecione uma categoria ativa válida.");
    }

    if (!nome || nome.length > 160) {
      throw new Error("Informe o nome do produto.");
    }

    if (!["Unidade", "Quilograma"].includes(body.formaVenda)) {
      throw new Error("Forma de venda inválida.");
    }

    const preco =
      body.precoVenda === null || body.precoVenda === ""
        ? null
        : Number(body.precoVenda);

    if (
      preco !== null &&
      (!Number.isFinite(preco) || preco < 0)
    ) {
      throw new Error("Preço inválido.");
    }

    const peso = body.formaVenda === "Quilograma";

    const embalagem = peso
      ? "sem_embalagem"
      : String(body.embalagem || "");

    if (!embalagem) {
      throw new Error("Selecione o tipo de embalagem.");
    }

    const quantidade =
      peso ||
      embalagem === "sem_embalagem" ||
      body.quantidadeEmbalagem === "" ||
      body.quantidadeEmbalagem == null
        ? null
        : Number(body.quantidadeEmbalagem);

    const unidade =
      peso || embalagem === "sem_embalagem"
        ? ""
        : String(body.unidadeEmbalagem || "");

    if (
      quantidade !== null &&
      (!Number.isFinite(quantidade) || quantidade <= 0)
    ) {
      throw new Error("Conteúdo inválido.");
    }

    if ((quantidade === null) !== (unidade === "")) {
      throw new Error("Informe conteúdo e unidade juntos.");
    }

    const codigoBarras = String(body.codigoBarras || "").trim();
    const codigoInterno = String(body.codigoInterno || "").trim();

    if (codigoBarras.length > 40 || codigoInterno.length > 40) {
      throw new Error("Código muito longo.");
    }

    if (codigoBarras || codigoInterno) {
      const codigos = [codigoBarras, codigoInterno].filter(Boolean);

      const filtros = codigos.flatMap(codigo => [
        { codigo_barras: codigo },
        { codigo_interno: codigo }
      ]);

      const duplicado = await db.collection("produto").findOne({
        $or: filtros
      });

      if (
        duplicado &&
        String(duplicado.id_produto) !== String(body.id)
      ) {
        throw new Error(
          "Código de barras ou interno já utilizado por outro produto."
        );
      }
    }

    return {
      nome,
      marca: String(body.marca || "").trim().slice(0, 100),
      id_categoria: idCategoria,
      forma_venda: body.formaVenda,
      apresentacao: {
        embalagem,
        quantidade,
        unidade
      },
      codigo_barras: codigoBarras,
      codigo_interno: codigoInterno,
      preco_venda: preco,
      exibir_landing: body.exibirLanding === true,
      ativo: body.ativo !== false
    };
  }

  const idProduto = numeroId(body.produtoId);

  const produto =
    idProduto &&
    (await db.collection("produto").findOne({
      id_produto: idProduto
    }));

  if (!produto) {
    throw new Error("Produto não encontrado.");
  }

  const quantidade = Number(body.quantidade);

  const custo =
    body.custoUnitario === "" || body.custoUnitario == null
      ? null
      : Number(body.custoUnitario);

  const data = dataCalendario(body.data);

  const validade = body.validade
    ? dataCalendario(body.validade)
    : null;

  if (
    !data ||
    !Number.isFinite(quantidade) ||
    quantidade <= 0 ||
    (custo !== null && (!Number.isFinite(custo) || custo < 0)) ||
    (body.validade && !validade)
  ) {
    throw new Error(
      "Confira data, quantidade, validade e custo."
    );
  }

  return {
    id_produto: idProduto,
    data_entrada: data,
    quantidade,
    custo_unitario: custo,
    lote: String(body.lote || "").slice(0, 100),
    validade,
    observacoes: String(body.observacoes || "").slice(0, 1000)
  };
}

// --------------------------------------------------
// Saúde da aplicação
// --------------------------------------------------

app.get("/api/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });

    res.json({
      status: "ok",
      banco: DB_NAME
    });
  } catch {
    res.status(503).json({
      erro: "Banco indisponível"
    });
  }
});

// --------------------------------------------------
// Autenticação
// --------------------------------------------------

const tentativasLogin = new Map();

function limitarLogin(req, res, next) {
  const chave = req.ip;
  const agora = Date.now();

  const dados = tentativasLogin.get(chave) || {
    n: 0,
    ate: agora + 15 * 60 * 1000
  };

  if (agora > dados.ate) {
    dados.n = 0;
    dados.ate = agora + 15 * 60 * 1000;
  }

  if (dados.n >= 10) {
    return res.status(429).json({
      erro: "Muitas tentativas. Tente novamente em alguns minutos."
    });
  }

  req.loginTentativas = dados;

  next();
}

app.post("/api/auth/login", limitarLogin, async (req, res) => {
  try {
    const usuario = String(req.body?.usuario || "")
      .trim()
      .toLowerCase();

    const senha = String(req.body?.senha || "");

    if (
      !usuario ||
      usuario.length > 80 ||
      !senha ||
      senha.length > 200
    ) {
      return res.status(400).json({
        erro: "Informe usuário e senha."
      });
    }

    const documento = await db.collection("usuario_admin").findOne({
      usuario,
      ativo: true
    });

    const hashFicticio =
      "$2b$12$zk55HXpqslLgL5iyqiIz.uoTIVoMsCG8cxFpCHCtn.uLrxkpAYv6K";

    const valido = await bcrypt.compare(
      senha,
      documento?.senha_hash || hashFicticio
    );

    if (!documento || !valido) {
      req.loginTentativas.n++;

      tentativasLogin.set(req.ip, req.loginTentativas);

      return res.status(401).json({
        erro: "Usuário ou senha incorretos."
      });
    }

    tentativasLogin.delete(req.ip);

    req.session.regenerate(erro => {
      if (erro) {
        return res.status(500).json({
          erro: "Falha ao criar sessão."
        });
      }

      req.session.admin = {
        id: String(documento._id),
        usuario: documento.usuario
      };

      req.session.save(erroSessao => {
        if (erroSessao) {
          return res.status(500).json({
            erro: "Falha ao salvar sessão."
          });
        }

        res.json({
          ok: true,
          usuario: documento.usuario
        });
      });
    });
  } catch (erro) {
    console.error("Login:", erro.message);

    res.status(500).json({
      erro: "Erro ao autenticar."
    });
  }
});

app.get("/api/auth/sessao", (req, res) => {
  res.json({
    autenticado: !!req.session.admin,
    usuario: req.session.admin?.usuario || null
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(erro => {
    if (erro) {
      return res.status(500).json({
        erro: "Não foi possível sair."
      });
    }

    res.clearCookie("emporio.sid", {
      path: "/"
    });

    res.json({ ok: true });
  });
});

function exigirLoginApi(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({
      erro: "Sessão encerrada. Faça login novamente."
    });
  }

  next();
}

function exigirLoginPagina(req, res, next) {
  if (!req.session.admin) {
    return res.redirect("/login.html");
  }

  res.set("Cache-Control", "no-store");

  next();
}

// --------------------------------------------------
// API pública — vitrine
// --------------------------------------------------

app.get("/api/publico/produtos", async (_req, res) => {
  try {
    const produtos = await db
      .collection("produto")
      .find({
        ativo: true,
        exibir_landing: true
      })
      .sort({
        id_produto: -1
      })
      .project({
        _id: 0,
        id_produto: 1,
        nome: 1,
        marca: 1,
        id_categoria: 1,
        apresentacao: 1,
        forma_venda: 1
      })
      .toArray();

    const categorias = await db
      .collection("categoria")
      .find({
        ativo: true
      })
      .project({
        _id: 0,
        id_categoria: 1,
        nome: 1
      })
      .toArray();

    const nomes = new Map(
      categorias.map(categoria => [
        categoria.id_categoria,
        categoria.nome
      ])
    );

    res.set("Cache-Control", "no-store");

    res.json(
      produtos.map(produto => ({
        id: produto.id_produto,
        nome: produto.nome,
        marca: produto.marca || "",
        categoria: nomes.get(produto.id_categoria) || "Outros",
        apresentacao: produto.apresentacao || null,
        forma_venda: produto.forma_venda
      }))
    );
  } catch (erro) {
    console.error("Vitrine:", erro.message);

    res.status(500).json({
      erro: "Não foi possível carregar a vitrine."
    });
  }
});

// --------------------------------------------------
// API pública — sugestões
// --------------------------------------------------

const enviosPublicos = new Map();

app.post("/api/publico/sugestoes", async (req, res) => {
  try {
    const agora = Date.now();
    const chave = req.ip;
    const registro = enviosPublicos.get(chave);
    const periodo = 15 * 60 * 1000;

    const limite =
      registro && agora - registro.inicio < periodo
        ? registro
        : {
            inicio: agora,
            quantidade: 0
          };

    if (limite.quantidade >= 5) {
      return res.status(429).json({
        erro: "Limite de sugestões atingido. Tente novamente mais tarde."
      });
    }

    const entrada = req.body;

    if (
      !entrada ||
      typeof entrada !== "object" ||
      Array.isArray(entrada)
    ) {
      return res.status(400).json({
        erro: "Formulário inválido."
      });
    }

    const produto = String(entrada.produto || "").trim();
    const marca = String(entrada.marca || "").trim();

    const aceita = String(
      entrada.aceitaAlternativa || "Não informado"
    );

    const receber = entrada.receberAviso === true;

    const nome = receber
      ? String(entrada.nomeSolicitante || "").trim()
      : "";

    const digitos = receber
      ? String(entrada.telefone || "").replace(/\D/g, "")
      : "";

    const telefone =
      digitos.startsWith("55") &&
      (digitos.length === 12 || digitos.length === 13)
        ? digitos.slice(2)
        : digitos;

    if (
      produto.length < 2 ||
      produto.length > 120 ||
      marca.length > 80 ||
      !["Sim", "Não", "Não informado"].includes(aceita)
    ) {
      return res.status(400).json({
        erro: "Confira os dados do produto sugerido."
      });
    }

    if (
      receber &&
      (
        !nome ||
        nome.length > 80 ||
        !/^\d{10,11}$/.test(telefone)
      )
    ) {
      return res.status(400).json({
        erro: "Informe nome e telefone com DDD para receber avisos."
      });
    }

    const salvo = await proximoDocumento(
      "sugestao",
      "id_sugestao",
      {
        produto,
        marca,
        nome_solicitante: nome,
        telefone,
        aceita_alternativa: aceita,
        receber_aviso: receber,
        status: "Recebida",
        observacoes: "",
        data: new Date().toISOString().slice(0, 10)
      },
      sugestaoTela
    );

    limite.quantidade++;

    enviosPublicos.set(chave, limite);

    res.status(201).json({
      ok: true,
      protocolo: salvo.id
    });
  } catch (erro) {
    console.error("Sugestão pública:", erro.message);

    res.status(500).json({
      erro: "Não foi possível registrar sua sugestão."
    });
  }
});

// --------------------------------------------------
// Todas as APIs abaixo exigem login
// --------------------------------------------------

app.use("/api", exigirLoginApi);

// --------------------------------------------------
// Rotas de categorias, produtos e entradas
// --------------------------------------------------

for (const [tipo, config] of Object.entries(configs)) {
  app.get(`/api/${tipo}`, async (_req, res) => {
    try {
      const documentos = await db
        .collection(config.collection)
        .find({})
        .sort({
          [config.key]: tipo === "categorias" ? 1 : -1
        })
        .toArray();

      const registros = documentos.map(documento =>
        paraTela(tipo, documento)
      );

      if (tipo === "entradas") {
        const compras = await db
          .collection("compra")
          .find({})
          .toArray();

        for (const compra of compras) {
          for (const [indice, item] of (compra.itens || []).entries()) {
            registros.push({
              id: `compra-${compra.id_compra}-${indice}`,
              compraId: String(compra.id_compra),
              produtoId: String(item.id_produto),
              data: dataTexto(compra.data_compra),
              quantidade: item.quantidade,
              lote: item.lote || "",
              validade: dataTexto(item.validade),
              custoUnitario: item.custo_unitario,
              observacoes: "Compra agrupada",
              somenteLeitura: true,
              criadoEm: compra.criado_em || ""
            });
          }
        }
      }

      res.json(registros);
    } catch (erro) {
      console.error(erro);

      res.status(500).json({
        erro: "Não foi possível consultar os registros."
      });
    }
  });

  app.post(`/api/${tipo}`, async (req, res) => {
    try {
      const dados = await validarEConverter(tipo, req.body);
      const colecao = db.collection(config.collection);

      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const ultimo = await colecao
          .find({
            [config.key]: { $exists: true }
          })
          .sort({
            [config.key]: -1
          })
          .limit(1)
          .next();

        const novoId = (ultimo?.[config.key] || 0) + 1;

        const novo = {
          [config.key]: novoId,
          ...dados,
          criado_em: new Date(),
          atualizado_em: new Date()
        };

        try {
          await colecao.insertOne(novo);

          return res.status(201).json(
            paraTela(tipo, novo)
          );
        } catch (erro) {
          if (erro.code === 11000 && tentativa < 4) {
            continue;
          }

          throw erro;
        }
      }
    } catch (erro) {
      console.error("Cadastro:", erro.message);

      res.status(erro.code === 11000 ? 409 : 400).json({
        erro:
          erro.code === 11000
            ? "Código já cadastrado."
            : erro.message
      });
    }
  });

  app.put(`/api/${tipo}/:id`, async (req, res) => {
    try {
      const id = numeroId(req.params.id);

      if (!id) {
        return res.status(400).json({
          erro: "ID inválido."
        });
      }

      const dados = await validarEConverter(tipo, req.body);
      const colecao = db.collection(config.collection);

      const filtro = {
        [config.key]: id
      };

      const anterior = await colecao.findOne(filtro);

      if (!anterior) {
        return res.status(404).json({
          erro: "Registro não encontrado."
        });
      }

      await colecao.updateOne(filtro, {
        $set: {
          ...dados,
          atualizado_em: new Date()
        }
      });

      res.json(
        paraTela(
          tipo,
          await colecao.findOne(filtro)
        )
      );
    } catch (erro) {
      console.error("Atualização:", erro.message);

      res.status(erro.code === 11000 ? 409 : 400).json({
        erro: erro.message
      });
    }
  });

  app.delete(`/api/${tipo}/:id`, async (req, res) => {
    try {
      const id = numeroId(req.params.id);

      if (!id) {
        return res.status(400).json({
          erro: "ID inválido."
        });
      }

      if (
        tipo === "categorias" &&
        await db.collection("produto").findOne({
          id_categoria: id
        })
      ) {
        return res.status(409).json({
          erro: "Categoria utilizada em produtos. Inative-a."
        });
      }

      if (tipo === "produtos") {
        const possuiEntrada = await db
          .collection("entrada_produto")
          .findOne({ id_produto: id });

        const possuiEncomenda = await db
          .collection("encomenda")
          .findOne({ "itens.id_produto": id });

        const possuiVenda = await db
          .collection("venda")
          .findOne({ "itens.id_produto": id });

        if (possuiEntrada || possuiEncomenda || possuiVenda) {
          return res.status(409).json({
            erro: "Produto com registros relacionados. Inative-o."
          });
        }
      }

      const resultado = await db
        .collection(config.collection)
        .deleteOne({
          [config.key]: id
        });

      if (!resultado.deletedCount) {
        return res.status(404).json({
          erro: "Registro não encontrado."
        });
      }

      res.json({ ok: true });
    } catch {
      res.status(500).json({
        erro: "Não foi possível excluir."
      });
    }
  });
}

// --------------------------------------------------
// Fornecedores
// --------------------------------------------------

function fornecedorTela(documento) {
  return {
    id: String(documento.id_fornecedor),
    tipo: documento.tipo,
    nome: documento.nome,
    cnpj: documento.cnpj || "",
    telefone: documento.telefone || "",
    ativo: documento.ativo !== false
  };
}

function dadosFornecedor(body) {
  const tipo =
    body.tipo === "PF"
      ? "PF"
      : body.tipo === "PJ"
        ? "PJ"
        : null;

  const nome = String(body.nome || "").trim();
  const cnpj = String(body.cnpj || "").replace(/\D/g, "");

  if (!tipo || nome.length < 2 || nome.length > 160) {
    throw new Error("Informe tipo e nome do fornecedor.");
  }

  if (tipo === "PJ" && cnpj.length !== 14) {
    throw new Error("Informe o CNPJ de 14 dígitos.");
  }

  if (tipo === "PF" && cnpj) {
    throw new Error("Pessoa física não deve possuir CNPJ.");
  }

  return {
    tipo,
    nome,
    cnpj: tipo === "PJ" ? cnpj : "",
    telefone: String(body.telefone || "").trim().slice(0, 30),
    ativo: body.ativo !== false
  };
}

app.get("/api/fornecedores", async (_req, res) => {
  try {
    const fornecedores = await db
      .collection("fornecedor")
      .find({})
      .sort({ id_fornecedor: -1 })
      .toArray();

    res.json(fornecedores.map(fornecedorTela));
  } catch {
    res.status(500).json({
      erro: "Erro ao consultar fornecedores."
    });
  }
});

app.post("/api/fornecedores", async (req, res) => {
  try {
    const dados = dadosFornecedor(req.body);
    const colecao = db.collection("fornecedor");

    if (
      dados.cnpj &&
      await colecao.findOne({ cnpj: dados.cnpj })
    ) {
      return res.status(409).json({
        erro: "CNPJ já cadastrado."
      });
    }

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const novo = {
        id_fornecedor: await proximoId(
          "fornecedor",
          "id_fornecedor"
        ),
        ...dados,
        criado_em: new Date()
      };

      try {
        await colecao.insertOne(novo);

        return res.status(201).json(fornecedorTela(novo));
      } catch (erro) {
        if (erro.code === 11000 && tentativa < 4) {
          continue;
        }

        throw erro;
      }
    }
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.put("/api/fornecedores/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const dados = dadosFornecedor(req.body);
    const colecao = db.collection("fornecedor");

    if (
      dados.cnpj &&
      await colecao.findOne({
        cnpj: dados.cnpj,
        id_fornecedor: { $ne: id }
      })
    ) {
      return res.status(409).json({
        erro: "CNPJ já cadastrado."
      });
    }

    const resultado = await colecao.updateOne(
      { id_fornecedor: id },
      {
        $set: {
          ...dados,
          atualizado_em: new Date()
        }
      }
    );

    if (!resultado.matchedCount) {
      return res.status(404).json({
        erro: "Fornecedor não encontrado."
      });
    }

    res.json(
      fornecedorTela(
        await colecao.findOne({
          id_fornecedor: id
        })
      )
    );
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// --------------------------------------------------
// Compras
// --------------------------------------------------

function compraTela(documento) {
  return {
    id: String(documento.id_compra),
    fornecedorId: String(documento.id_fornecedor),
    data: dataTexto(documento.data_compra),
    documento: documento.documento,
    itens: (documento.itens || []).map(item => ({
      produtoId: String(item.id_produto),
      quantidade: item.quantidade,
      custoUnitario: item.custo_unitario,
      lote: item.lote || "",
      validade: dataTexto(item.validade)
    })),
    total: documento.total_compra,
    criadoEm: documento.criado_em
  };
}

app.get("/api/compras", async (_req, res) => {
  try {
    const compras = await db
      .collection("compra")
      .find({})
      .sort({
        data_compra: -1,
        id_compra: -1
      })
      .toArray();

    res.json(compras.map(compraTela));
  } catch {
    res.status(500).json({
      erro: "Erro ao consultar compras."
    });
  }
});

app.post("/api/compras", async (req, res) => {
  try {
    const body = req.body;

    if (
      !body ||
      !Array.isArray(body.itens) ||
      body.itens.length === 0 ||
      body.itens.length > 100
    ) {
      throw new Error("Inclua de 1 a 100 produtos.");
    }

    const fornecedorId = numeroId(body.fornecedorId);

    const fornecedor =
      fornecedorId &&
      await db.collection("fornecedor").findOne({
        id_fornecedor: fornecedorId,
        ativo: true
      });

    if (!fornecedor) {
      throw new Error("Selecione um fornecedor ativo.");
    }

    const data = dataCalendario(body.data);

    if (!data) {
      throw new Error("Data da compra inválida.");
    }

    const tipo = String(body.documento?.tipo || "");

    if (
      ![
        "NF-e",
        "NFC-e",
        "Cupom fiscal",
        "Recibo",
        "Sem documento"
      ].includes(tipo)
    ) {
      throw new Error("Selecione o tipo de documento.");
    }

    const numero = String(body.documento?.numero || "")
      .trim()
      .slice(0, 80);

    if (tipo !== "Sem documento" && !numero) {
      throw new Error("Informe o número do documento.");
    }

    const itens = [];

    for (const item of body.itens) {
      const idProduto = numeroId(item.produtoId);
      const quantidade = Number(item.quantidade);
      const custo = Number(item.custoUnitario);

      const produto =
        idProduto &&
        await db.collection("produto").findOne({
          id_produto: idProduto,
          ativo: true
        });

      if (!produto) {
        throw new Error(
          "Selecione um produto ativo para cada item."
        );
      }

      if (
        !Number.isFinite(quantidade) ||
        quantidade <= 0 ||
        !Number.isFinite(custo) ||
        custo < 0
      ) {
        throw new Error("Quantidade ou custo inválido.");
      }

      const validade = item.validade
        ? dataCalendario(item.validade)
        : null;

      if (item.validade && !validade) {
        throw new Error("Validade inválida.");
      }

      itens.push({
        id_produto: idProduto,
        quantidade,
        custo_unitario: custo,
        lote: String(item.lote || "").slice(0, 100),
        validade
      });
    }

    const total = Number(
      itens
        .reduce(
          (soma, item) =>
            soma + item.quantidade * item.custo_unitario,
          0
        )
        .toFixed(2)
    );

    const colecao = db.collection("compra");

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const documento = {
        id_compra: await proximoId("compra", "id_compra"),
        id_fornecedor: fornecedorId,
        data_compra: data,
        documento: {
          tipo,
          numero: tipo === "Sem documento" ? "" : numero
        },
        itens,
        total_compra: total,
        criado_em: new Date()
      };

      try {
        await colecao.insertOne(documento);

        return res.status(201).json(compraTela(documento));
      } catch (erro) {
        if (erro.code === 11000 && tentativa < 4) {
          continue;
        }

        throw erro;
      }
    }
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// --------------------------------------------------
// Encomendas, vendas e sugestões
// --------------------------------------------------

const SITUACOES_ENCOMENDA = [
  "Pendente",
  "Comprado",
  "Disponível",
  "Entregue",
  "Não encontrado",
  "Cancelado",
  "Não retirada",
  "Parcialmente atendida"
];

const SITUACOES_ITEM = [
  "Pendente",
  "Disponível",
  "Não encontrado",
  "Cancelado",
  "Entregue"
];

const SITUACOES_SUGESTAO = [
  "Recebida",
  "Em análise",
  "Atendida",
  "Não atendida"
];

function identificadorProduto(valor) {
  const id = numeroId(valor);

  if (!id) {
    throw new Error("Produto inválido.");
  }

  return id;
}

function numeroMoeda(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("Valor monetário inválido.");
  }

  return numero;
}

function itensValidos(items, encomenda) {
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100
  ) {
    throw new Error("Informe de 1 a 100 itens.");
  }

  return items.map(item => {
    const id_produto = identificadorProduto(item.produtoId);
    const quantidade = Number(item.quantidade);

    if (
      !Number.isFinite(quantidade) ||
      quantidade <= 0
    ) {
      throw new Error("Quantidade inválida.");
    }

    const preco_unitario = numeroMoeda(item.precoUnitario);

    const registro = {
      id_produto,
      quantidade,
      preco_unitario
    };

    if (encomenda) {
      const status = String(item.status || "Pendente");

      if (!SITUACOES_ITEM.includes(status)) {
        throw new Error("Situação do item inválida.");
      }

      registro.status = status;
    }

    return registro;
  });
}

async function conferirProdutos(itens) {
  for (const item of itens) {
    const produto = await db.collection("produto").findOne({
      id_produto: item.id_produto
    });

    if (!produto) {
      throw new Error(
        `Produto ${item.id_produto} não cadastrado.`
      );
    }
  }
}

function itensTela(items) {
  return (items || []).map(item => ({
    produtoId: String(item.id_produto),
    quantidade: item.quantidade,
    precoUnitario:
      item.preco_unitario ?? item.precoUnitario ?? 0,
    ...(item.status ? { status: item.status } : {})
  }));
}

function encomendaTela(documento) {
  return {
    id: String(documento.id_encomenda),
    solicitante: documento.solicitante || {
      nome: "",
      telefone: ""
    },
    data: dataIsoCurta(documento.data),
    dataRetirada: dataIsoCurta(
      documento.dataRetirada ?? documento.data_retirada
    ),
    status: documento.status || "Pendente",
    itens: itensTela(documento.itens),
    total: documento.total ?? 0,
    observacoes: documento.observacoes || "",
    disponivelEm:
      documento.disponivel_em ||
      documento.disponivelEm ||
      null,
    encerradaEm:
      documento.encerrada_em ||
      documento.encerradaEm ||
      null,
    criadoEm:
      documento.criado_em ||
      documento.criadoEm ||
      "",
    atualizadoEm:
      documento.atualizado_em ||
      documento.atualizadoEm ||
      ""
  };
}

function vendaTela(documento) {
  return {
    id: String(documento.id_venda),
    ...(documento.id_encomenda != null
      ? { encomendaId: String(documento.id_encomenda) }
      : {}),
    solicitante: documento.solicitante || {
      nome: "",
      telefone: ""
    },
    data: dataIsoCurta(documento.data),
    itens: itensTela(documento.itens),
    total: documento.total,
    formaPagamento:
      documento.forma_pagamento ||
      documento.formaPagamento ||
      "Não informada",
    observacoes: documento.observacoes || "",
    criadoEm:
      documento.criado_em ||
      documento.criadoEm ||
      "",
    atualizadoEm:
      documento.atualizado_em ||
      documento.atualizadoEm ||
      ""
  };
}

function sugestaoTela(documento) {
  return {
    id: String(documento.id_sugestao),
    produto: documento.produto,
    marca: documento.marca || "",
    nomeSolicitante:
      documento.nome_solicitante ||
      documento.nomeSolicitante ||
      "",
    telefone: documento.telefone || "",
    aceitaAlternativa:
      documento.aceita_alternativa ||
      documento.aceitaAlternativa ||
      "Não informado",
    receberAviso:
      documento.receber_aviso === true ||
      documento.receberAviso === true,
    status: documento.status || "Recebida",
    observacoes: documento.observacoes || "",
    data: dataIsoCurta(documento.data),
    criadoEm: documento.criado_em || "",
    atualizadoEm: documento.atualizado_em || ""
  };
}

function validarEncomenda(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Dados da encomenda inválidos.");
  }

  const nome = String(body.solicitante?.nome || "").trim();

  const telefone = String(
    body.solicitante?.telefone || ""
  ).replace(/\D/g, "");

  if (
    !nome ||
    nome.length > 120 ||
    !/^\d{10,11}$/.test(telefone)
  ) {
    throw new Error("Informe nome e telefone com DDD.");
  }

  const data = dataIsoCurta(body.data);
  const retirada = dataIsoCurta(body.dataRetirada);

  if (
    !dataCalendario(data) ||
    !dataCalendario(retirada) ||
    retirada < data
  ) {
    throw new Error(
      "A retirada não pode ser anterior à solicitação."
    );
  }

  const status = String(body.status || "Pendente");

  if (!SITUACOES_ENCOMENDA.includes(status)) {
    throw new Error("Situação da encomenda inválida.");
  }

  const itens = itensValidos(body.itens, true);

  const total = Number(
    itens
      .reduce(
        (soma, item) =>
          soma + item.quantidade * item.preco_unitario,
        0
      )
      .toFixed(2)
  );

  return {
    solicitante: {
      nome,
      telefone
    },
    data,
    dataRetirada: retirada,
    status,
    itens,
    total,
    observacoes: String(body.observacoes || "").slice(0, 1000),
    ...(body.disponivelEm
      ? { disponivel_em: String(body.disponivelEm) }
      : {}),
    ...(body.encerradaEm
      ? { encerrada_em: String(body.encerradaEm) }
      : {})
  };
}

async function validarVenda(body, anterior = null) {
  if (!body || typeof body !== "object") {
    throw new Error("Dados da venda inválidos.");
  }

  const data = dataIsoCurta(body.data);

  if (!dataCalendario(data)) {
    throw new Error("Data da venda inválida.");
  }

  const itens = itensValidos(body.itens, false);

  await conferirProdutos(itens);

  const total = Number(
    itens
      .reduce(
        (soma, item) =>
          soma + item.quantidade * item.preco_unitario,
        0
      )
      .toFixed(2)
  );

  const encomendaId = body.encomendaId
    ? numeroId(body.encomendaId)
    : null;

  if (body.encomendaId && !encomendaId) {
    throw new Error("Encomenda inválida.");
  }

  if (encomendaId) {
    const encomenda = await db.collection("encomenda").findOne({
      id_encomenda: encomendaId
    });

    if (!encomenda || encomenda.status !== "Entregue") {
      throw new Error("A encomenda precisa estar entregue.");
    }

    if (
      anterior &&
      anterior.id_encomenda !== encomendaId
    ) {
      throw new Error(
        "Não é permitido trocar a encomenda vinculada."
      );
    }

    const existente = await db.collection("venda").findOne({
      id_encomenda: encomendaId,
      ...(anterior
        ? { id_venda: { $ne: anterior.id_venda } }
        : {})
    });

    if (existente) {
      throw new Error("Essa encomenda já gerou uma venda.");
    }

    const entregues = (encomenda.itens || []).filter(
      item => item.status === "Entregue"
    );

    if (!entregues.length) {
      throw new Error("Não há itens entregues.");
    }

    const esperado = Number(
      entregues
        .reduce(
          (soma, item) =>
            soma +
            Number(item.quantidade) *
              Number(item.preco_unitario ?? item.precoUnitario),
          0
        )
        .toFixed(2)
    );

    const itensDiferentes = itens.some((item, indice) => {
      const entregue = entregues[indice];

      return (
        !entregue ||
        item.id_produto !== entregue.id_produto ||
        item.quantidade !== entregue.quantidade ||
        item.preco_unitario !==
          Number(
            entregue.preco_unitario ?? entregue.precoUnitario
          )
      );
    });

    if (
      Math.abs(total - esperado) > 0.009 ||
      itens.length !== entregues.length ||
      itensDiferentes
    ) {
      throw new Error(
        "Os itens da venda devem corresponder aos itens entregues."
      );
    }
  }

  return {
    data,
    itens,
    total,
    forma_pagamento: String(
      body.formaPagamento || "Não informada"
    ).slice(0, 50),
    solicitante: {
      nome: String(body.solicitante?.nome || "").slice(0, 120),
      telefone: String(
        body.solicitante?.telefone || ""
      ).slice(0, 30)
    },
    observacoes: String(body.observacoes || "").slice(0, 1000),
    ...(encomendaId
      ? { id_encomenda: encomendaId }
      : {})
  };
}

function validarSugestao(body, anterior = null) {
  if (!body || typeof body !== "object") {
    throw new Error("Dados da sugestão inválidos.");
  }

  const produto = String(body.produto || "").trim();
  const status = String(body.status || "Recebida");

  if (
    !produto ||
    produto.length > 160 ||
    !SITUACOES_SUGESTAO.includes(status)
  ) {
    throw new Error("Sugestão inválida.");
  }

  const data = dataIsoCurta(
    body.data ||
    anterior?.data ||
    new Date().toISOString()
  );

  if (!dataCalendario(data)) {
    throw new Error("Data inválida.");
  }

  return {
    produto,
    marca: String(body.marca || "").slice(0, 100),
    nome_solicitante: String(
      body.nomeSolicitante || ""
    ).slice(0, 120),
    telefone: String(body.telefone || "").slice(0, 30),
    aceita_alternativa: String(
      body.aceitaAlternativa || "Não informado"
    ),
    receber_aviso: body.receberAviso === true,
    status,
    observacoes: String(body.observacoes || "").slice(0, 1000),
    data
  };
}

// --------------------------------------------------
// Rotas de encomendas
// --------------------------------------------------

app.get("/api/encomendas", async (_req, res) => {
  try {
    const encomendas = await db
      .collection("encomenda")
      .find({})
      .sort({ id_encomenda: -1 })
      .toArray();

    res.json(encomendas.map(encomendaTela));
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.post("/api/encomendas", async (req, res) => {
  try {
    const dados = validarEncomenda(req.body);

    await conferirProdutos(dados.itens);

    const salvo = await proximoDocumento(
      "encomenda",
      "id_encomenda",
      dados,
      encomendaTela
    );

    res.status(201).json(salvo);
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.put("/api/encomendas/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const anterior = await db.collection("encomenda").findOne({
      id_encomenda: id
    });

    if (!anterior) {
      return res.status(404).json({
        erro: "Encomenda não encontrada."
      });
    }

    const dados = validarEncomenda(req.body);

    await conferirProdutos(dados.itens);

    const dadosNovos = JSON.stringify({
      itens: dados.itens,
      solicitante: dados.solicitante,
      data: dados.data,
      dataRetirada: dados.dataRetirada
    });

    const dadosAnteriores = JSON.stringify({
      itens: anterior.itens,
      solicitante: anterior.solicitante,
      data: anterior.data,
      dataRetirada: anterior.dataRetirada
    });

    if (
      ["Entregue", "Cancelado", "Não retirada"].includes(
        anterior.status
      ) &&
      dadosNovos !== dadosAnteriores
    ) {
      throw new Error(
        "Encomenda encerrada não permite editar itens, solicitante ou datas."
      );
    }

    if (
      anterior.status === "Não retirada" &&
      dados.status !== "Não retirada"
    ) {
      throw new Error(
        "Encomenda não retirada não pode ser reaberta."
      );
    }

    if (
      dados.status === "Não retirada" &&
      anterior.status !== "Não retirada"
    ) {
      const dias = Math.floor(
        (
          Date.now() -
          Date.parse(dados.dataRetirada + "T12:00:00Z")
        ) / 86400000
      );

      if (dias < 3) {
        throw new Error(
          "Prazo de retirada ainda não encerrado."
        );
      }
    }

    await db.collection("encomenda").updateOne(
      { id_encomenda: id },
      {
        $set: {
          ...dados,
          atualizado_em: new Date()
        }
      }
    );

    res.json(
      encomendaTela(
        await db.collection("encomenda").findOne({
          id_encomenda: id
        })
      )
    );
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.delete("/api/encomendas/:id", (_req, res) => {
  res.status(405).json({
    erro: "Encomendas devem permanecer no histórico."
  });
});

// --------------------------------------------------
// Rotas de vendas
// --------------------------------------------------

app.get("/api/vendas", async (_req, res) => {
  try {
    const vendas = await db
      .collection("venda")
      .find({})
      .sort({ id_venda: -1 })
      .toArray();

    res.json(vendas.map(vendaTela));
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.post("/api/vendas", async (req, res) => {
  try {
    const dados = await validarVenda(req.body);

    const salvo = await proximoDocumento(
      "venda",
      "id_venda",
      dados,
      vendaTela
    );

    res.status(201).json(salvo);
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.put("/api/vendas/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const anterior = await db.collection("venda").findOne({
      id_venda: id
    });

    if (!anterior) {
      return res.status(404).json({
        erro: "Venda não encontrada."
      });
    }

    if (anterior.id_encomenda != null) {
      throw new Error(
        "Venda vinculada à encomenda não pode ser editada."
      );
    }

    const dados = await validarVenda(req.body, anterior);

    await db.collection("venda").updateOne(
      { id_venda: id },
      {
        $set: {
          ...dados,
          atualizado_em: new Date()
        }
      }
    );

    res.json(
      vendaTela(
        await db.collection("venda").findOne({
          id_venda: id
        })
      )
    );
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.delete("/api/vendas/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const venda = await db.collection("venda").findOne({
      id_venda: id
    });

    if (!venda) {
      return res.status(404).json({
        erro: "Venda não encontrada."
      });
    }

    if (venda.id_encomenda != null) {
      return res.status(409).json({
        erro: "Venda de encomenda não pode ser excluída."
      });
    }

    await db.collection("venda").deleteOne({
      id_venda: id
    });

    res.json({ ok: true });
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// --------------------------------------------------
// Rotas administrativas de sugestões
// --------------------------------------------------

app.get("/api/sugestoes", async (_req, res) => {
  try {
    const sugestoes = await db
      .collection("sugestao")
      .find({})
      .sort({ id_sugestao: -1 })
      .toArray();

    res.json(sugestoes.map(sugestaoTela));
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.post("/api/sugestoes", async (req, res) => {
  try {
    const salvo = await proximoDocumento(
      "sugestao",
      "id_sugestao",
      validarSugestao(req.body),
      sugestaoTela
    );

    res.status(201).json(salvo);
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.put("/api/sugestoes/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const anterior = await db.collection("sugestao").findOne({
      id_sugestao: id
    });

    if (!anterior) {
      return res.status(404).json({
        erro: "Sugestão não encontrada."
      });
    }

    const resultado = await db.collection("sugestao").updateOne(
      { id_sugestao: id },
      {
        $set: {
          ...validarSugestao(req.body, anterior),
          atualizado_em: new Date()
        }
      }
    );

    if (!resultado.matchedCount) {
      return res.status(404).json({
        erro: "Sugestão não encontrada."
      });
    }

    res.json(
      sugestaoTela(
        await db.collection("sugestao").findOne({
          id_sugestao: id
        })
      )
    );
  } catch (erro) {
    respostaErro(res, erro);
  }
});

app.delete("/api/sugestoes/:id", async (req, res) => {
  try {
    const id = numeroId(req.params.id);

    if (!id) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const resultado = await db.collection("sugestao").deleteOne({
      id_sugestao: id
    });

    if (!resultado.deletedCount) {
      return res.status(404).json({
        erro: "Sugestão não encontrada."
      });
    }

    res.json({ ok: true });
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// --------------------------------------------------
// Sistema especialista
// --------------------------------------------------

app.get("/api/especialista/perguntas", (_req, res) => {
  res.json({
    perguntas: especialista.perguntas,
    versaoRegras: especialista.VERSAO_REGRAS
  });
});

async function prepararAvaliacao(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Dados inválidos.");
  }

  if (
    typeof body.produto !== "string" ||
    !body.produto.trim() ||
    body.produto.trim().length > 120
  ) {
    throw new Error(
      "Informe um produto com até 120 caracteres."
    );
  }

  const resultado = especialista.avaliar(body.respostas);

  let sugestaoId = null;

  if (
    body.sugestaoId !== undefined &&
    body.sugestaoId !== null &&
    body.sugestaoId !== ""
  ) {
    sugestaoId = numeroId(body.sugestaoId);

    if (!sugestaoId) {
      throw new Error(
        "Identificador de sugestão inválido."
      );
    }

    const sugestao = await db.collection("sugestao").findOne({
      id_sugestao: sugestaoId
    });

    if (!sugestao) {
      throw new Error(
        "Sugestão não encontrada. Atualize a página."
      );
    }
  }

  return {
    produto: body.produto.trim(),
    sugestaoId,
    ...resultado
  };
}

// Calcula sem gravar no banco.
app.post("/api/especialista/avaliar", async (req, res) => {
  try {
    const avaliacao = await prepararAvaliacao(req.body);

    res.json(avaliacao);
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// Recalcula e salva a avaliação.
app.post("/api/especialista/avaliacoes", async (req, res) => {
  try {
    const avaliacao = await prepararAvaliacao(req.body);

    const documento = {
      ...avaliacao,
      criadoEm: new Date(),
      usuario: req.session.admin.usuario
    };

    const resultado = await db
      .collection("avaliacao_produto")
      .insertOne(documento);

    res.status(201).json({
      ...documento,
      _id: String(resultado.insertedId)
    });
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// Retorna as 50 avaliações mais recentes.
app.get("/api/especialista/avaliacoes", async (_req, res) => {
  try {
    const avaliacoes = await db
      .collection("avaliacao_produto")
      .find({})
      .sort({
        criadoEm: -1,
        _id: -1
      })
      .limit(50)
      .toArray();

    res.json(avaliacoes);
  } catch (erro) {
    respostaErro(res, erro);
  }
});

// --------------------------------------------------
// Páginas da aplicação
// --------------------------------------------------

app.get("/login.html", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "frontend", "login.html")
  );
});

app.use(
  "/admin",
  exigirLoginPagina,
  express.static(path.join(__dirname, "..", "admin"))
);

app.use(
  "/frontend",
  express.static(path.join(__dirname, "..", "frontend"))
);

app.get("/", (_req, res) => {
  res.redirect("/frontend/index.html");
});

// --------------------------------------------------
// Inicialização
// --------------------------------------------------

async function iniciar() {
  try {
    await client.connect();

    db = client.db(DB_NAME);

    await db.command({ ping: 1 });

    await db.collection("usuario_admin").createIndex(
      { usuario: 1 },
      { unique: true }
    );

    await db.collection("fornecedor").createIndex(
      { id_fornecedor: 1 },
      { unique: true }
    );

    await db.collection("compra").createIndex(
      { id_compra: 1 },
      { unique: true }
    );

    for (const [colecao, campo] of [
      ["encomenda", "id_encomenda"],
      ["venda", "id_venda"],
      ["sugestao", "id_sugestao"]
    ]) {
      await db.collection(colecao).createIndex(
        { [campo]: 1 },
        { unique: true }
      );
    }

    await db.collection("venda").createIndex(
      { id_encomenda: 1 },
      {
        unique: true,
        partialFilterExpression: {
          id_encomenda: { $exists: true }
        }
      }
    );

    await db.collection("avaliacao_produto").createIndex({
      criadoEm: -1
    });

    app.listen(PORT, "127.0.0.1", () => {
      console.log(
        `Empório conectado: http://127.0.0.1:${PORT}/admin/produtos.html`
      );
    });
  } catch (erro) {
    console.error("MongoDB:", erro.message);

    await client.close();

    process.exit(1);
  }
}

iniciar();