"use strict";
// Empório Brasileiro — backend local de desenvolvimento.
// Não publicar na internet sem autenticação e autorização.
const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("node:path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const app = express();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
  throw new Error("Este login usa sessões em memória e HTTP local. Configure sessão persistente e HTTPS antes de publicar.");
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("Defina SESSION_SECRET com no mínimo 32 caracteres no backend/.env");
}
app.use(session({
  name: "emporio.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // Somente desenvolvimento local por HTTP.
    maxAge: 8 * 60 * 60 * 1000
  }
}));
// Exige que alterações sejam enviadas pela própria aplicação local.
app.use((req,res,next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origem = req.get("origin");
    if (origem && origem !== `http://127.0.0.1:${PORT}`) {
      return res.status(403).json({erro:"Origem não autorizada."});
    }
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
const PORT = Number(process.env.PORT || 3000);
const DB_NAME = process.env.DB_NAME || "emporionovo";
const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 5000 });
let db;
const configs = {
  categorias: { collection: "categoria", key: "id_categoria" },
  produtos: { collection: "produto", key: "id_produto" },
  entradas: { collection: "entrada_produto", key: "id_entrada" }
};
function numeroId(valor) { const n = Number(valor); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function dataCalendario(valor) {
  if (!valor) return null;
  const texto = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(texto))) return null;
  return new Date(texto + "T12:00:00.000Z");
}
function paraTela(tipo, doc) {
  const id = String(doc[configs[tipo].key]);
  if (tipo === "categorias") return { id, nome: doc.nome, descricao: doc.descricao || "", ativo: doc.ativo !== false, criadoEm: doc.criado_em || "", atualizadoEm: doc.atualizado_em || "" };
  if (tipo === "produtos") return {
    id, nome: doc.nome, marca: doc.marca || "", categoriaId: String(doc.id_categoria),
    formaVenda: doc.forma_venda, embalagem: doc.apresentacao?.embalagem || "sem_embalagem",
    quantidadeEmbalagem: doc.apresentacao?.quantidade ?? null,
    unidadeEmbalagem: doc.apresentacao?.unidade || "", apresentacao: doc.apresentacao,
    codigoBarras: doc.codigo_barras || "", codigoInterno: doc.codigo_interno || "",
    precoVenda: doc.preco_venda ?? null, exibirLanding: doc.exibir_landing === true,
    ativo: doc.ativo !== false, caracteristicas: doc.caracteristicas || {},
    criadoEm: doc.criado_em || "", atualizadoEm: doc.atualizado_em || ""
  };
  return {
    id, produtoId: String(doc.id_produto), data: doc.data_entrada instanceof Date ? doc.data_entrada.toISOString().slice(0,10) : (doc.data_entrada || ""),
    quantidade: doc.quantidade, lote: doc.lote || "", validade: doc.validade instanceof Date ? doc.validade.toISOString().slice(0,10) : (doc.validade || ""),
    custoUnitario: doc.custo_unitario ?? null, observacoes: doc.observacoes || "",
    criadoEm: doc.criado_em || "", atualizadoEm: doc.atualizado_em || ""
  };
}
async function validarEConverter(tipo, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Dados inválidos.");
  const nome = String(body.nome || "").trim();
  if (tipo === "categorias") {
    if (!nome || nome.length > 100) throw new Error("Informe o nome da categoria (até 100 caracteres).");
    return { nome, descricao: String(body.descricao || "").slice(0,500), ativo: body.ativo !== false };
  }
  if (tipo === "produtos") {
    const idCategoria = numeroId(body.categoriaId);
    const cat = idCategoria && await db.collection("categoria").findOne({ id_categoria: idCategoria, ativo: true });
    if (!cat) throw new Error("Selecione uma categoria ativa válida.");
    if (!nome || nome.length > 160) throw new Error("Informe o nome do produto.");
    if (!["Unidade", "Quilograma"].includes(body.formaVenda)) throw new Error("Forma de venda inválida.");
    const preco = body.precoVenda === null || body.precoVenda === "" ? null : Number(body.precoVenda);
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) throw new Error("Preço inválido.");
    const peso = body.formaVenda === "Quilograma";
    const embalagem = peso ? "sem_embalagem" : String(body.embalagem || "");
    if (!embalagem) throw new Error("Selecione o tipo de embalagem.");
    const quantidade = peso || embalagem === "sem_embalagem" || body.quantidadeEmbalagem === "" || body.quantidadeEmbalagem == null ? null : Number(body.quantidadeEmbalagem);
    const unidade = peso || embalagem === "sem_embalagem" ? "" : String(body.unidadeEmbalagem || "");
    if (quantidade !== null && (!Number.isFinite(quantidade) || quantidade <= 0)) throw new Error("Conteúdo inválido.");
    if ((quantidade === null) !== (unidade === "")) throw new Error("Informe conteúdo e unidade juntos.");
    const codigoBarras = String(body.codigoBarras || "").trim();
    const codigoInterno = String(body.codigoInterno || "").trim();
    if (codigoBarras.length > 40 || codigoInterno.length > 40) throw new Error("Código muito longo.");
    if (codigoBarras || codigoInterno) {
      const codigos = [codigoBarras, codigoInterno].filter(Boolean);
      const filtros = codigos.flatMap(c => [{codigo_barras:c}, {codigo_interno:c}]);
      const duplicado = await db.collection("produto").findOne({$or:filtros});
      if (duplicado && String(duplicado.id_produto) !== String(body.id)) {
        throw new Error("Código de barras ou interno já utilizado por outro produto.");
      }
    }
    return { nome, marca: String(body.marca || "").trim().slice(0,100), id_categoria: idCategoria,
      forma_venda: body.formaVenda, apresentacao: { embalagem, quantidade, unidade },
      codigo_barras: codigoBarras, codigo_interno: codigoInterno, preco_venda: preco,
      exibir_landing: body.exibirLanding === true, ativo: body.ativo !== false };
  }
  const idProduto = numeroId(body.produtoId);
  const produto = idProduto && await db.collection("produto").findOne({ id_produto: idProduto });
  if (!produto) throw new Error("Produto não encontrado.");
  const quantidade = Number(body.quantidade), custo = body.custoUnitario === "" || body.custoUnitario == null ? null : Number(body.custoUnitario);
  const data = dataCalendario(body.data), validade = body.validade ? dataCalendario(body.validade) : null;
  if (!data || !Number.isFinite(quantidade) || quantidade <= 0 || custo !== null && (!Number.isFinite(custo) || custo < 0) || body.validade && !validade) throw new Error("Confira data, quantidade, validade e custo.");
  return { id_produto: idProduto, data_entrada: data, quantidade, custo_unitario: custo,
    lote: String(body.lote || "").slice(0,100), validade, observacoes: String(body.observacoes || "").slice(0,1000) };
}
app.get("/api/health", async (_req,res) => { try { await db.command({ping:1}); res.json({status:"ok", banco:DB_NAME}); } catch { res.status(503).json({erro:"Banco indisponível"}); } });
// Autenticação administrativa: usuário e hash de senha ficam no MongoDB.
const tentativasLogin = new Map();
function limitarLogin(req,res,next) {
  const chave = req.ip;
  const agora = Date.now();
  const dados = tentativasLogin.get(chave) || { n: 0, ate: agora + 15*60*1000 };
  if (agora > dados.ate) { dados.n=0; dados.ate=agora+15*60*1000; }
  if (dados.n >= 10) return res.status(429).json({erro:"Muitas tentativas. Tente novamente em alguns minutos."});
  req.loginTentativas=dados;
  next();
}
app.post("/api/auth/login", limitarLogin, async (req,res) => {
  try {
    const usuario = String(req.body?.usuario || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");
    if (!usuario || usuario.length > 80 || !senha || senha.length > 200) return res.status(400).json({erro:"Informe usuário e senha."});
    const doc = await db.collection("usuario_admin").findOne({usuario, ativo:true});
    const hashFicticio = "$2b$12$zk55HXpqslLgL5iyqiIz.uoTIVoMsCG8cxFpCHCtn.uLrxkpAYv6K";
    const valido = await bcrypt.compare(senha, doc?.senha_hash || hashFicticio);
    if (!doc || !valido) {
      req.loginTentativas.n++;
      tentativasLogin.set(req.ip,req.loginTentativas);
      return res.status(401).json({erro:"Usuário ou senha incorretos."});
    }
    tentativasLogin.delete(req.ip);
    req.session.regenerate(err => {
      if (err) return res.status(500).json({erro:"Falha ao criar sessão."});
      req.session.admin = {id: String(doc._id), usuario: doc.usuario};
      req.session.save(err2 => {
        if (err2) return res.status(500).json({erro:"Falha ao salvar sessão."});
        res.json({ok:true, usuario:doc.usuario});
      });
    });
  } catch (erro) { console.error("Login:",erro.message); res.status(500).json({erro:"Erro ao autenticar."}); }
});
app.get("/api/auth/sessao",(req,res)=>res.json({autenticado:!!req.session.admin, usuario:req.session.admin?.usuario||null}));
app.post("/api/auth/logout",(req,res)=>{
  req.session.destroy(err=>{
    if(err)return res.status(500).json({erro:"Não foi possível sair."});
    res.clearCookie("emporio.sid",{path:"/"});
    res.json({ok:true});
  });
});
function exigirLoginApi(req,res,next) {
  if (!req.session.admin) return res.status(401).json({erro:"Sessão encerrada. Faça login novamente."});
  next();
}
function exigirLoginPagina(req,res,next) {
  if (!req.session.admin) return res.redirect("/login.html");
  res.set("Cache-Control","no-store");
  next();
}
// Protege TODAS as rotas administrativas criadas abaixo, inclusive leituras.
app.use("/api",exigirLoginApi);
for (const [tipo, config] of Object.entries(configs)) {
  app.get(`/api/${tipo}`, async (_req,res) => {
    try {
      const docs = await db.collection(config.collection).find({}).sort({[config.key]: tipo === "categorias" ? 1 : -1}).toArray();
      const registros = docs.map(d => paraTela(tipo, d));
      if (tipo === "entradas") {
        const compras = await db.collection("compra").find({}).toArray();
        for (const compra of compras) for (const [indice, item] of (compra.itens || []).entries()) {
          registros.push({
            id: `compra-${compra.id_compra}-${indice}`,
            compraId: String(compra.id_compra), produtoId: String(item.id_produto),
            data: dataTexto(compra.data_compra), quantidade: item.quantidade,
            lote: item.lote || "", validade: dataTexto(item.validade),
            custoUnitario: item.custo_unitario, observacoes: "Compra agrupada",
            somenteLeitura: true, criadoEm: compra.criado_em || ""
          });
        }
      }
      res.json(registros);
    }
    catch (e) { console.error(e); res.status(500).json({erro:"Não foi possível consultar os registros."}); }
  });
  app.post(`/api/${tipo}`, async (req,res) => {
    try {
      const dados = await validarEConverter(tipo,req.body);
      const col = db.collection(config.collection);
      // Tentativas em caso de escrita concorrente; índice único deve existir no banco.
      for (let tentativa=0; tentativa<5; tentativa++) {
        const ultimo = await col.find({[config.key]:{$exists:true}}).sort({[config.key]:-1}).limit(1).next();
        const novoId = (ultimo?.[config.key] || 0)+1;
        const novo = { [config.key]: novoId, ...dados, criado_em: new Date(), atualizado_em: new Date() };
        try { await col.insertOne(novo); return res.status(201).json(paraTela(tipo,novo)); }
        catch (e) { if (e.code === 11000 && tentativa < 4) continue; throw e; }
      }
    } catch(e) { console.error("Cadastro:",e.message); res.status(e.code===11000?409:400).json({erro:e.code===11000?"Código já cadastrado.":e.message}); }
  });
  app.put(`/api/${tipo}/:id`, async (req,res) => {
    try {
      const id = numeroId(req.params.id); if (!id) return res.status(400).json({erro:"ID inválido."});
      const dados = await validarEConverter(tipo,req.body);
      const col = db.collection(config.collection);
      const filtro = {[config.key]:id};
      const anterior = await col.findOne(filtro);
      if (!anterior) return res.status(404).json({erro:"Registro não encontrado."});
      // $set preserva campos específicos, como caracteristicas, que não estão no formulário.
      await col.updateOne(filtro, {$set:{...dados, atualizado_em:new Date()}});
      res.json(paraTela(tipo,await col.findOne(filtro)));
    } catch(e) { console.error("Atualização:",e.message); res.status(e.code===11000?409:400).json({erro:e.message}); }
  });
  app.delete(`/api/${tipo}/:id`, async (req,res) => {
    try {
      const id=numeroId(req.params.id); if (!id) return res.status(400).json({erro:"ID inválido."});
      if (tipo==="categorias" && await db.collection("produto").findOne({id_categoria:id})) return res.status(409).json({erro:"Categoria utilizada em produtos. Inative-a."});
      if (tipo==="produtos" && (await db.collection("entrada_produto").findOne({id_produto:id}) || await db.collection("encomenda").findOne({"itens.id_produto":id}) || await db.collection("venda").findOne({"itens.id_produto":id}))) return res.status(409).json({erro:"Produto com registros relacionados. Inative-o."});
      const result = await db.collection(config.collection).deleteOne({[config.key]:id});
      if (!result.deletedCount) return res.status(404).json({erro:"Registro não encontrado."});
      res.json({ok:true});
    } catch(e) { res.status(500).json({erro:"Não foi possível excluir."}); }
  });
}

// FORNECEDORES E COMPRAS AGRUPADAS
function dataTexto(valor) {
  if (!valor) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}
function respostaErro(res, erro) {
  console.error(erro);
  return res.status(erro.code === 11000 ? 409 : 400).json({erro: erro.code === 11000 ? "Identificador duplicado." : erro.message});
}
async function proximoId(colecao, campo) {
  const ultimo = await db.collection(colecao).find({[campo]:{$exists:true}}).sort({[campo]:-1}).limit(1).next();
  return (ultimo?.[campo] || 0) + 1;
}
function fornecedorTela(doc) {
  return { id: String(doc.id_fornecedor), tipo: doc.tipo, nome: doc.nome,
    cnpj: doc.cnpj || "", telefone: doc.telefone || "", ativo: doc.ativo !== false };
}
function dadosFornecedor(body) {
  const tipo = body.tipo === "PF" ? "PF" : body.tipo === "PJ" ? "PJ" : null;
  const nome = String(body.nome || "").trim();
  const cnpj = String(body.cnpj || "").replace(/\D/g, "");
  if (!tipo || nome.length < 2 || nome.length > 160) throw Error("Informe tipo e nome do fornecedor.");
  if (tipo === "PJ" && cnpj.length !== 14) throw Error("Informe o CNPJ de 14 dígitos.");
  if (tipo === "PF" && cnpj) throw Error("Pessoa física não deve possuir CNPJ.");
  return {tipo, nome, cnpj: tipo === "PJ" ? cnpj : "", telefone: String(body.telefone || "").trim().slice(0, 30), ativo: body.ativo !== false};
}
app.get("/api/fornecedores", async (_req,res) => {
  try { res.json((await db.collection("fornecedor").find({}).sort({id_fornecedor:-1}).toArray()).map(fornecedorTela)); }
  catch(e) {res.status(500).json({erro:"Erro ao consultar fornecedores."});}
});
app.post("/api/fornecedores", async (req,res) => {
  try {
    const dados = dadosFornecedor(req.body);
    const col = db.collection("fornecedor");
    if (dados.cnpj && await col.findOne({cnpj:dados.cnpj})) return res.status(409).json({erro:"CNPJ já cadastrado."});
    for(let tentativa=0; tentativa<5; tentativa++) {
      const novo = {id_fornecedor: await proximoId("fornecedor","id_fornecedor"), ...dados, criado_em:new Date()};
      try {await col.insertOne(novo);return res.status(201).json(fornecedorTela(novo));}
      catch(e) {if(e.code === 11000 && tentativa < 4) continue;throw e;}
    }
  } catch(e) {respostaErro(res,e);}
});
app.put("/api/fornecedores/:id", async (req,res) => {
  try {
    const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
    const dados=dadosFornecedor(req.body),col=db.collection("fornecedor");
    if(dados.cnpj && await col.findOne({cnpj:dados.cnpj,id_fornecedor:{$ne:id}})) return res.status(409).json({erro:"CNPJ já cadastrado."});
    const r=await col.updateOne({id_fornecedor:id},{$set:{...dados,atualizado_em:new Date()}});
    if(!r.matchedCount)return res.status(404).json({erro:"Fornecedor não encontrado."});
    res.json(fornecedorTela(await col.findOne({id_fornecedor:id})));
  }catch(e){respostaErro(res,e);}
});
function compraTela(doc) {
  return {id:String(doc.id_compra), fornecedorId:String(doc.id_fornecedor),
    data:dataTexto(doc.data_compra), documento:doc.documento,
    itens:(doc.itens||[]).map(i=>({produtoId:String(i.id_produto), quantidade:i.quantidade,custoUnitario:i.custo_unitario,lote:i.lote||"",validade:dataTexto(i.validade)})),
    total:doc.total_compra, criadoEm:doc.criado_em};
}
app.get("/api/compras", async (_req,res)=>{
  try {res.json((await db.collection("compra").find({}).sort({data_compra:-1,id_compra:-1}).toArray()).map(compraTela));}
  catch(e){res.status(500).json({erro:"Erro ao consultar compras."});}
});
app.post("/api/compras", async (req,res)=>{
  try {
    const b=req.body;
    if(!b || !Array.isArray(b.itens) || b.itens.length===0 || b.itens.length>100)throw Error("Inclua de 1 a 100 produtos.");
    const fornecedorId=numeroId(b.fornecedorId);
    if(!fornecedorId || !await db.collection("fornecedor").findOne({id_fornecedor:fornecedorId,ativo:true}))throw Error("Selecione um fornecedor ativo.");
    const data=dataCalendario(b.data);
    if(!data)throw Error("Data da compra inválida.");
    const tipo=String(b.documento?.tipo || "");
    if(!["NF-e","NFC-e","Cupom fiscal","Recibo","Sem documento"].includes(tipo))throw Error("Selecione o tipo de documento.");
    const numero=String(b.documento?.numero || "").trim().slice(0,80);
    if(tipo!=="Sem documento" && !numero)throw Error("Informe o número do documento.");
    const itens=[];
    for(const item of b.itens) {
      const idProduto=numeroId(item.produtoId), quantidade=Number(item.quantidade), custo=Number(item.custoUnitario);
      if(!idProduto || !await db.collection("produto").findOne({id_produto:idProduto,ativo:true}))throw Error("Selecione um produto ativo para cada item.");
      if(!Number.isFinite(quantidade)||quantidade<=0||!Number.isFinite(custo)||custo<0)throw Error("Quantidade ou custo inválido.");
      const validade=item.validade ? dataCalendario(item.validade) : null;
      if(item.validade && !validade)throw Error("Validade inválida.");
      itens.push({id_produto:idProduto,quantidade,custo_unitario:custo,lote:String(item.lote||"").slice(0,100),validade});
    }
    const total=Number(itens.reduce((s,i)=>s+i.quantidade*i.custo_unitario,0).toFixed(2));
    const col=db.collection("compra");
    for(let tentativa=0;tentativa<5;tentativa++) {
      const doc={id_compra:await proximoId("compra","id_compra"),id_fornecedor:fornecedorId,data_compra:data,documento:{tipo,numero:tipo==="Sem documento"?"":numero},itens,total_compra:total,criado_em:new Date()};
      try {await col.insertOne(doc);return res.status(201).json(compraTela(doc));}
      catch(e){if(e.code===11000&&tentativa<4)continue;throw e;}
    }
  }catch(e){respostaErro(res,e);}
});


// ------------------------------------------------------------
// Encomendas, vendas e sugestões — MongoDB
// ------------------------------------------------------------
const SITUACOES_ENCOMENDA = ["Pendente","Comprado","Disponível","Entregue","Não encontrado","Cancelado","Não retirada","Parcialmente atendida"];
const SITUACOES_ITEM = ["Pendente","Disponível","Não encontrado","Cancelado","Entregue"];
const SITUACOES_SUGESTAO = ["Recebida","Em análise","Atendida","Não atendida"];
function identificadorProduto(valor) {
  const id = numeroId(valor);
  if (!id) throw Error("Produto inválido.");
  return id;
}
function dataIsoCurta(v) {return v instanceof Date ? v.toISOString().slice(0,10) : String(v || "").slice(0,10);}
function numeroMoeda(v) {const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error("Valor monetário inválido.");return n;}
function itensValidos(items, encomenda) {
  if (!Array.isArray(items)||items.length===0||items.length>100)throw Error("Informe de 1 a 100 itens.");
  return items.map(item=>{
    const id_produto=identificadorProduto(item.produtoId);
    const quantidade=Number(item.quantidade);
    if(!Number.isFinite(quantidade)||quantidade<=0)throw Error("Quantidade inválida.");
    const preco_unitario=numeroMoeda(item.precoUnitario);
    const ret={id_produto, quantidade, preco_unitario};
    if(encomenda) {
      const status=String(item.status||"Pendente");
      if(!SITUACOES_ITEM.includes(status))throw Error("Situação do item inválida.");
      ret.status=status;
    }
    return ret;
  });
}
async function conferirProdutos(itens) {
  for(const item of itens) {
    if(!await db.collection("produto").findOne({id_produto:item.id_produto}))throw Error(`Produto ${item.id_produto} não cadastrado.`);
  }
}
function itensTela(items) {return (items||[]).map(i=>({produtoId:String(i.id_produto),quantidade:i.quantidade,precoUnitario:i.preco_unitario??i.precoUnitario??0,...(i.status?{status:i.status}:{})}));}
function encomendaTela(d) {return {
  id:String(d.id_encomenda),solicitante:d.solicitante||{nome:"",telefone:""},data:dataIsoCurta(d.data),dataRetirada:dataIsoCurta(d.dataRetirada??d.data_retirada),
  status:d.status||"Pendente",itens:itensTela(d.itens),total:d.total??0,observacoes:d.observacoes||"",
  disponivelEm:d.disponivel_em||d.disponivelEm||null,encerradaEm:d.encerrada_em||d.encerradaEm||null,
  criadoEm:d.criado_em||d.criadoEm||"",atualizadoEm:d.atualizado_em||d.atualizadoEm||""
};}
function vendaTela(d) {return {
  id:String(d.id_venda),...(d.id_encomenda!=null?{encomendaId:String(d.id_encomenda)}:{}),
  solicitante:d.solicitante||{nome:"",telefone:""},data:dataIsoCurta(d.data),itens:itensTela(d.itens),
  total:d.total,formaPagamento:d.forma_pagamento||d.formaPagamento||"Não informada",observacoes:d.observacoes||"",
  criadoEm:d.criado_em||d.criadoEm||"",atualizadoEm:d.atualizado_em||d.atualizadoEm||""
};}
function sugestaoTela(d) {return {
  id:String(d.id_sugestao),produto:d.produto,marca:d.marca||"",nomeSolicitante:d.nome_solicitante||d.nomeSolicitante||"",
  telefone:d.telefone||"",aceitaAlternativa:d.aceita_alternativa||d.aceitaAlternativa||"Não informado",
  receberAviso:d.receber_aviso===true||d.receberAviso===true,status:d.status||"Recebida",observacoes:d.observacoes||"",
  data:dataIsoCurta(d.data),criadoEm:d.criado_em||"",atualizadoEm:d.atualizado_em||""
};}
async function proximoDocumento(col, campo, dados, converter) {
  for(let tentativa=0;tentativa<5;tentativa++) {
    const doc={[campo]:await proximoId(col,campo),...dados,criado_em:new Date(),atualizado_em:new Date()};
    try {await db.collection(col).insertOne(doc);return converter(doc);}
    catch(e){if(e.code===11000&&tentativa<4)continue;throw e;}
  }
  throw Error("Não foi possível gerar um identificador.");
}
function validarEncomenda(b) {
  if(!b||typeof b!=="object")throw Error("Dados da encomenda inválidos.");
  const nome=String(b.solicitante?.nome||"").trim();
  const telefone=String(b.solicitante?.telefone||"").replace(/\D/g,"");
  if(!nome||nome.length>120||!/^\d{10,11}$/.test(telefone))throw Error("Informe nome e telefone com DDD.");
  const data=dataIsoCurta(b.data),retirada=dataIsoCurta(b.dataRetirada);
  if(!dataCalendario(data)||!dataCalendario(retirada)||retirada<data)throw Error("A retirada não pode ser anterior à solicitação.");
  const status=String(b.status||"Pendente");
  if(!SITUACOES_ENCOMENDA.includes(status))throw Error("Situação da encomenda inválida.");
  const itens=itensValidos(b.itens,true);
  const total=Number(itens.reduce((s,i)=>s+i.quantidade*i.preco_unitario,0).toFixed(2));
  return {solicitante:{nome,telefone},data,dataRetirada:retirada,status,itens,total,observacoes:String(b.observacoes||"").slice(0,1000),
    ...(b.disponivelEm?{disponivel_em:String(b.disponivelEm)}:{}),...(b.encerradaEm?{encerrada_em:String(b.encerradaEm)}:{})};
}
async function validarVenda(b, anterior=null) {
  if(!b||typeof b!=="object")throw Error("Dados da venda inválidos.");
  const data=dataIsoCurta(b.data);
  if(!dataCalendario(data))throw Error("Data da venda inválida.");
  const itens=itensValidos(b.itens,false);
  await conferirProdutos(itens);
  const total=Number(itens.reduce((s,i)=>s+i.quantidade*i.preco_unitario,0).toFixed(2));
  const encomendaId=b.encomendaId?numeroId(b.encomendaId):null;
  if(b.encomendaId&&!encomendaId)throw Error("Encomenda inválida.");
  if(encomendaId) {
    const encomenda=await db.collection("encomenda").findOne({id_encomenda:encomendaId});
    if(!encomenda||encomenda.status!=="Entregue")throw Error("A encomenda precisa estar entregue.");
    if(anterior&&anterior.id_encomenda!==encomendaId)throw Error("Não é permitido trocar a encomenda vinculada.");
    const existente=await db.collection("venda").findOne({id_encomenda:encomendaId,...(anterior?{id_venda:{$ne:anterior.id_venda}}:{})});
    if(existente)throw Error("Essa encomenda já gerou uma venda.");
    const entregues=(encomenda.itens||[]).filter(i=>i.status==="Entregue");
    if(!entregues.length)throw Error("Não há itens entregues.");
    const esperado=Number(entregues.reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco_unitario??i.precoUnitario),0).toFixed(2));
    if(Math.abs(total-esperado)>0.009||itens.length!==entregues.length||itens.some((i,n)=>i.id_produto!==entregues[n].id_produto||i.quantidade!==entregues[n].quantidade||i.preco_unitario!==Number(entregues[n].preco_unitario??entregues[n].precoUnitario)))throw Error("Os itens da venda devem corresponder aos itens entregues.");
  }
  return {data,itens,total,forma_pagamento:String(b.formaPagamento||"Não informada").slice(0,50),
    solicitante:{nome:String(b.solicitante?.nome||"").slice(0,120),telefone:String(b.solicitante?.telefone||"").slice(0,30)},
    observacoes:String(b.observacoes||"").slice(0,1000),...(encomendaId?{id_encomenda:encomendaId}:{})};
}
function validarSugestao(b, anterior=null) {
  if(!b||typeof b!=="object")throw Error("Dados da sugestão inválidos.");
  const produto=String(b.produto||"").trim(),status=String(b.status||"Recebida");
  if(!produto||produto.length>160||!SITUACOES_SUGESTAO.includes(status))throw Error("Sugestão inválida.");
  const data=dataIsoCurta(b.data||anterior?.data||new Date().toISOString());
  if(!dataCalendario(data))throw Error("Data inválida.");
  return {produto,marca:String(b.marca||"").slice(0,100),nome_solicitante:String(b.nomeSolicitante||"").slice(0,120),
    telefone:String(b.telefone||"").slice(0,30),aceita_alternativa:String(b.aceitaAlternativa||"Não informado"),
    receber_aviso:b.receberAviso===true,status,observacoes:String(b.observacoes||"").slice(0,1000),data};
}
app.get("/api/encomendas",async(_req,res)=>{try{res.json((await db.collection("encomenda").find({}).sort({id_encomenda:-1}).toArray()).map(encomendaTela));}catch(e){respostaErro(res,e);}});
app.post("/api/encomendas",async(req,res)=>{try{const dados=validarEncomenda(req.body);await conferirProdutos(dados.itens);res.status(201).json(await proximoDocumento("encomenda","id_encomenda",dados,encomendaTela));}catch(e){respostaErro(res,e);}});
app.put("/api/encomendas/:id",async(req,res)=>{try{
  const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
  const anterior=await db.collection("encomenda").findOne({id_encomenda:id});if(!anterior)return res.status(404).json({erro:"Encomenda não encontrada."});
  const dados=validarEncomenda(req.body);await conferirProdutos(dados.itens);
  if(["Entregue","Cancelado","Não retirada"].includes(anterior.status)&&JSON.stringify({itens:dados.itens,solicitante:dados.solicitante,data:dados.data,dataRetirada:dados.dataRetirada})!==JSON.stringify({itens:anterior.itens,solicitante:anterior.solicitante,data:anterior.data,dataRetirada:anterior.dataRetirada}))throw Error("Encomenda encerrada não permite editar itens, solicitante ou datas.");
  if(anterior.status==="Não retirada"&&dados.status!=="Não retirada")throw Error("Encomenda não retirada não pode ser reaberta.");
  if(dados.status==="Não retirada"&&anterior.status!=="Não retirada"){
    const dias=Math.floor((Date.now()-Date.parse(dados.dataRetirada+"T12:00:00Z"))/86400000);
    if(dias<3)throw Error("Prazo de retirada ainda não encerrado.");
  }
  await db.collection("encomenda").updateOne({id_encomenda:id},{$set:{...dados,atualizado_em:new Date()}});
  res.json(encomendaTela(await db.collection("encomenda").findOne({id_encomenda:id})));
}catch(e){respostaErro(res,e);}});
// Histórico de encomendas nunca é apagado pela interface.
app.delete("/api/encomendas/:id",(_req,res)=>res.status(405).json({erro:"Encomendas devem permanecer no histórico."}));
app.get("/api/vendas",async(_req,res)=>{try{res.json((await db.collection("venda").find({}).sort({id_venda:-1}).toArray()).map(vendaTela));}catch(e){respostaErro(res,e);}});
app.post("/api/vendas",async(req,res)=>{try{const dados=await validarVenda(req.body);res.status(201).json(await proximoDocumento("venda","id_venda",dados,vendaTela));}catch(e){respostaErro(res,e);}});
app.put("/api/vendas/:id",async(req,res)=>{try{
  const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
  const anterior=await db.collection("venda").findOne({id_venda:id});if(!anterior)return res.status(404).json({erro:"Venda não encontrada."});
  if(anterior.id_encomenda!=null)throw Error("Venda vinculada à encomenda não pode ser editada.");
  const dados=await validarVenda(req.body,anterior);
  await db.collection("venda").updateOne({id_venda:id},{$set:{...dados,atualizado_em:new Date()}});
  res.json(vendaTela(await db.collection("venda").findOne({id_venda:id})));
}catch(e){respostaErro(res,e);}});
app.delete("/api/vendas/:id",async(req,res)=>{try{
  const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
  const venda=await db.collection("venda").findOne({id_venda:id});if(!venda)return res.status(404).json({erro:"Venda não encontrada."});
  if(venda.id_encomenda!=null)return res.status(409).json({erro:"Venda de encomenda não pode ser excluída."});
  await db.collection("venda").deleteOne({id_venda:id});res.json({ok:true});
}catch(e){respostaErro(res,e);}});
app.get("/api/sugestoes",async(_req,res)=>{try{res.json((await db.collection("sugestao").find({}).sort({id_sugestao:-1}).toArray()).map(sugestaoTela));}catch(e){respostaErro(res,e);}});
app.post("/api/sugestoes",async(req,res)=>{try{res.status(201).json(await proximoDocumento("sugestao","id_sugestao",validarSugestao(req.body),sugestaoTela));}catch(e){respostaErro(res,e);}});
app.put("/api/sugestoes/:id",async(req,res)=>{try{
 const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
 const anterior=await db.collection("sugestao").findOne({id_sugestao:id});
 if(!anterior)return res.status(404).json({erro:"Sugestão não encontrada."});
 const r=await db.collection("sugestao").updateOne({id_sugestao:id},{$set:{...validarSugestao(req.body,anterior),atualizado_em:new Date()}});
 if(!r.matchedCount)return res.status(404).json({erro:"Sugestão não encontrada."});
 res.json(sugestaoTela(await db.collection("sugestao").findOne({id_sugestao:id})));
}catch(e){respostaErro(res,e);}});
app.delete("/api/sugestoes/:id",async(req,res)=>{try{
 const id=numeroId(req.params.id);if(!id)return res.status(400).json({erro:"ID inválido."});
 const r=await db.collection("sugestao").deleteOne({id_sugestao:id});if(!r.deletedCount)return res.status(404).json({erro:"Sugestão não encontrada."});res.json({ok:true});
}catch(e){respostaErro(res,e);}});

// As páginas e a API compartilham a mesma origem e porta 3000.
app.get("/login.html",(_req,res)=>res.sendFile(path.join(__dirname,"..","frontend","login.html")));
app.use("/admin", exigirLoginPagina, express.static(path.join(__dirname,"..","admin")));
app.use("/frontend", express.static(path.join(__dirname,"..","frontend")));
app.get("/", (_req,res) => res.redirect("/frontend/index.html"));
async function iniciar() {
  try { await client.connect(); db=client.db(DB_NAME); await db.command({ping:1});
    await db.collection("usuario_admin").createIndex({usuario:1},{unique:true});
    await db.collection("fornecedor").createIndex({id_fornecedor:1},{unique:true});
    await db.collection("compra").createIndex({id_compra:1},{unique:true});
    for (const [col,campo] of [["encomenda","id_encomenda"],["venda","id_venda"],["sugestao","id_sugestao"]]) await db.collection(col).createIndex({[campo]:1},{unique:true});
    await db.collection("venda").createIndex({id_encomenda:1},{unique:true,partialFilterExpression:{id_encomenda:{$exists:true}}});
    app.listen(PORT,"127.0.0.1",()=>console.log(`Empório conectado: http://127.0.0.1:${PORT}/admin/produtos.html`));
  } catch(e) { console.error("MongoDB:",e.message); await client.close(); process.exit(1); }
}
iniciar();