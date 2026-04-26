// Configurações do Supabase
const supabaseUrl = "https://nnnniaoribyqkcxtbpvr.supabase.co";
const supabaseKey = "sb_publishable__2Z9ePW2wWB3z0hchdpkcw_pfbLhWtz";
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Estado global
let todasNoticias = [];
let idEmEdicao = null;

// ─── MULTI-IMAGEM: array de base64 em memória ────────────────────────────────
let imagensEmEdicao = [];

// Paginação dos logs
let paginaLogsAtual = 1;
const logsPorPagina = 15;
let totalPaginasLogs = 1;

// Filtros dos logs
let filtrosLogs = {
  acao: "",
  dataInicio: "",
  dataFim: "",
};

// Imagem default para notícias sem foto (SVG leve, ~400 bytes inline)
const IMAGEM_DEFAULT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23e8f0fe'/%3E%3Crect x='60' y='80' width='280' height='200' rx='8' fill='%23c5d5f5'/%3E%3Crect x='380' y='80' width='360' height='28' rx='6' fill='%23b0c4ee'/%3E%3Crect x='380' y='124' width='300' height='16' rx='4' fill='%23c5d5f5'/%3E%3Crect x='380' y='152' width='320' height='16' rx='4' fill='%23c5d5f5'/%3E%3Crect x='380' y='180' width='280' height='16' rx='4' fill='%23c5d5f5'/%3E%3Crect x='60' y='310' width='680' height='16' rx='4' fill='%23c5d5f5'/%3E%3Crect x='60' y='338' width='620' height='16' rx='4' fill='%23c5d5f5'/%3E%3Crect x='60' y='366' width='500' height='16' rx='4' fill='%23c5d5f5'/%3E%3Ccircle cx='200' cy='180' r='40' fill='%23a0b8e8'/%3E%3Ctext x='400' y='240' font-family='Arial' font-size='18' fill='%236b8ccc' text-anchor='middle'%3ENot%C3%ADcia%3C%2Ftext%3E%3C%2Fsvg%3E";

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
async function init() {
  // 1. Checa se o usuário está logado
  const {
    data: { session },
  } = await _supabase.auth.getSession();

  // 2. Se estiver em uma página admin sem estar logado, expulsa para o index
  const paginasPrivadas = ["admin.html", "equipe.html", "auditoria.html"];
  const paginaAtual = window.location.pathname.split("/").pop();

  if (!session && paginasPrivadas.includes(paginaAtual)) {
    window.location.href = "index.html";
    return; // Para a execução aqui
  }

  destacarLinkAtivo();

  if (document.getElementById("mural-noticias")) {
    await carregarMural();
  }

  if (
    document.getElementById("tabela-ativas") ||
    document.getElementById("tabela-expiradas")
  ) {
    await carregarGestaoAdmin();
  }

  await exibirNomeHeader();
  await verificarPermissoes();
}

async function carregarMural() {
  const mural = document.getElementById("mural-noticias");
  if (!mural) return;

  const { data: noticias, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    mural.innerHTML = "<p>Nenhuma notícia encontrada.</p>";
    console.error("Erro ao carregar mural:", error.message);
    return;
  }

  if (noticias) {
    todasNoticias = noticias;
    renderizarMural(noticias);
  }
}

function ajustarLayoutMural() {
  const mural = document.getElementById("mural-noticias");
  if (!mural) return;

  const totalCards = mural.querySelectorAll(".card-noticia").length;
  mural.classList.remove("grid-1-item", "grid-2-items", "grid-3-items");

  if (totalCards === 1) {
    mural.classList.add("grid-1-item");
  } else if (totalCards === 2) {
    mural.classList.add("grid-2-items");
  } else if (totalCards === 3) {
    mural.classList.add("grid-3-items");
  }
}

// ─── HELPER: parse de imagem_url retrocompatível ─────────────────────────────
function parseImagensUrl(imagem_url) {
  if (!imagem_url) return [];
  try {
    const parsed = JSON.parse(imagem_url);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {}
  return [imagem_url];
}

function renderizarMural(lista) {
  const mural = document.getElementById("mural-noticias");
  if (!mural) return;

  mural.innerHTML = lista
    .map((n) => {
      const imagens = parseImagensUrl(n.imagem_url);
      const srcCapa = imagens.length > 0 ? imagens[0] : IMAGEM_DEFAULT;

      // PROTEÇÃO AQUI: Limpamos a descrição curta antes de exibir
      const descricaoSegura = sanitizar(n.descricao_breve);

      return `
        <article class="card-noticia" onclick="abrirNoticiaCompleta('${n.id}')" style="cursor: pointer;">
            <img src="${srcCapa}" class="card-img" alt="Capa">
            <div class="card-content">
                <span class="tag tag-${n.categoria.toLowerCase()}">${n.categoria}</span>
                <h3 class="card-title">${n.titulo}</h3>
                <p class="card-summary">${descricaoSegura || "Clique para ler mais..."}</p>
                <div class="card-footer">
                    <small>Postado por: <strong>${n.nome_autor}</strong></small>
                </div>
            </div>
        </article>
      `;
    })
    .join("");
}

function filtrar(cat, elemento) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));

  if (elemento) {
    elemento.classList.add("active");
  }

  if (cat === "Todas") {
    renderizarMural(todasNoticias);
  } else {
    const filtradas = todasNoticias.filter((n) => n.categoria === cat);
    renderizarMural(filtradas);
  }
}

function buscar() {
  const inputBusca = document.getElementById("input-busca");
  if (!inputBusca) return;

  const termo = inputBusca.value.toLowerCase();

  const filtradas = todasNoticias.filter(
    (n) =>
      (n.titulo || "").toLowerCase().includes(termo) ||
      (n.descricao_breve || "").toLowerCase().includes(termo),
  );

  renderizarMural(filtradas);
}

async function carregarGestaoAdmin() {
  const corpoAtivas = document.getElementById("tabela-ativas");
  const corpoExpiradas = document.getElementById("tabela-expiradas");

  if (!corpoAtivas || !corpoExpiradas) return;

  const { data: noticias, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar notificações:", error.message);
    return;
  }

  if (noticias) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let listaAtivas = "";
    let listaExpiradas = "";
    let contAtivas = 0;
    let contExpiradas = 0;

    noticias.forEach((n) => {
      const dataPost = n.criado_em
        ? new Date(n.criado_em).toLocaleDateString()
        : "---";

      let dataExpFormatada = "Sem expiração";
      let expirou = false;

      if (n.data_expiracao) {
        const dataExp = new Date(n.data_expiracao + "T00:00:00");
        dataExpFormatada = dataExp.toLocaleDateString();
        if (dataExp < hoje) expirou = true;
      }

      const linhaHtml = `
        <tr>
          <td>${n.titulo}</td>
          <td><span class="tag tag-${n.categoria.toLowerCase()}">${n.categoria}</span></td>
          <td>${dataPost}</td>
          <td>${dataExpFormatada}</td>
          <td>
            <button class="btn-edit" onclick="prepararEdicao('${n.id}')">✏️</button>
            <button class="btn-delete" onclick="deletarNoticia('${n.id}')">🗑️</button>
          </td>
        </tr>
      `;

      if (expirou) {
        listaExpiradas += linhaHtml;
        contExpiradas++;
      } else {
        listaAtivas += linhaHtml;
        contAtivas++;
      }
    });

    corpoAtivas.innerHTML =
      listaAtivas || '<tr><td colspan="5">Nenhuma notícia ativa.</td></tr>';

    corpoExpiradas.innerHTML =
      listaExpiradas ||
      '<tr><td colspan="5">Nenhuma notícia expirada.</td></tr>';

    const totalNotif = document.getElementById("total-notif");
    const ativasNotif = document.getElementById("ativas-notif");
    const expiradasNotif = document.getElementById("expiradas-notif");

    if (totalNotif) totalNotif.innerText = noticias.length;
    if (ativasNotif) ativasNotif.innerText = contAtivas;
    if (expiradasNotif) expiradasNotif.innerText = contExpiradas;
  }
}

// ─── MODAL DE LEITURA COM CARROSSEL ──────────────────────────────────────────
let carrosselIndex = 0;
let carrosselImagens = [];

function renderizarCarrossel(imagens) {
  const wrapper = document.getElementById("carrossel-wrapper");
  if (!wrapper) return;

  if (!imagens || imagens.length === 0) {
    wrapper.style.display = "none";
    return;
  }

  wrapper.style.display = "block";
  carrosselImagens = imagens;
  carrosselIndex = 0;

  atualizarCarrossel();
}

function atualizarCarrossel() {
  const img = document.getElementById("carrossel-img");
  const dots = document.querySelectorAll(".carrossel-dot");
  const btnPrev = document.getElementById("carrossel-prev");
  const btnNext = document.getElementById("carrossel-next");

  if (img) img.src = carrosselImagens[carrosselIndex];
  dots.forEach((d, i) => d.classList.toggle("active", i === carrosselIndex));
  if (btnPrev)
    btnPrev.style.display = carrosselImagens.length > 1 ? "flex" : "none";
  if (btnNext)
    btnNext.style.display = carrosselImagens.length > 1 ? "flex" : "none";
}

function carrosselAnterior(e) {
  if (e) e.stopPropagation();
  if (carrosselImagens.length <= 1) return;
  carrosselIndex =
    (carrosselIndex - 1 + carrosselImagens.length) % carrosselImagens.length;
  atualizarCarrossel();
}

function carrosselProximo(e) {
  if (e) e.stopPropagation();
  if (carrosselImagens.length <= 1) return;
  carrosselIndex = (carrosselIndex + 1) % carrosselImagens.length;
  atualizarCarrossel();
}

function irParaDot(index, e) {
  if (e) e.stopPropagation();
  carrosselIndex = index;
  atualizarCarrossel();
}

async function abrirNoticiaCompleta(id) {
  const { data: n, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao abrir notícia:", error.message);
    return;
  }

  if (n) {
    const textoComLinks = transformarLinks(n.conteudo_completo);
    const imagens = parseImagensUrl(n.imagem_url);

    const conteudoFoco = document.getElementById("conteudo-noticia-foco");
    const modalLeitura = document.getElementById("modal-leitura");

    if (!conteudoFoco || !modalLeitura) return;

    // Usa IMAGEM_DEFAULT consistente com o mural quando não há imagens
    const imagensParaExibir = imagens.length > 0 ? imagens : [IMAGEM_DEFAULT];

    const dotsHtml =
      imagensParaExibir.length > 1
        ? `<div class="carrossel-dots">
          ${imagensParaExibir
            .map(
              (_, i) =>
                `<span class="carrossel-dot${i === 0 ? " active" : ""}" onclick="irParaDot(${i}, event)"></span>`,
            )
            .join("")}
        </div>`
        : "";

    const carrosselHtml = `<div class="carrossel-wrapper" id="carrossel-wrapper">
          <div class="carrossel-track">
            <button class="carrossel-btn carrossel-prev" id="carrossel-prev" onclick="carrosselAnterior(event)" aria-label="Anterior" style="display:${imagensParaExibir.length > 1 ? "flex" : "none"}">&#8249;</button>
            <img src="${imagensParaExibir[0]}" class="noticia-full-img" id="carrossel-img" alt="Imagem da notícia" onerror="this.src='${IMAGEM_DEFAULT}'">
            <button class="carrossel-btn carrossel-next" id="carrossel-next" onclick="carrosselProximo(event)" aria-label="Próxima" style="display:${imagensParaExibir.length > 1 ? "flex" : "none"}">&#8250;</button>
          </div>
          ${dotsHtml}
        </div>`;

    conteudoFoco.innerHTML = `
      ${carrosselHtml}
      <div class="noticia-full-header">
        <h2 id="titulo-modal-leitura">${n.titulo}</h2>
        <p class="tag">${n.categoria}</p>
      </div>
      <div class="noticia-full-meta">
        Postado por: ${n.nome_autor} | Data: ${new Date(
          n.criado_em,
        ).toLocaleDateString()}
      </div>
      <div class="noticia-full-text">
        ${textoComLinks}
      </div>
    `;

    carrosselImagens = imagensParaExibir;
    carrosselIndex = 0;

    modalLeitura.style.display = "flex";

    const botaoFechar = modalLeitura.querySelector(".close-btn");
    if (botaoFechar) botaoFechar.focus();
  }
}

function fecharNoticia() {
  const modal = document.getElementById("modal-leitura");
  if (modal) modal.style.display = "none";
  carrosselImagens = [];
  carrosselIndex = 0;
}

async function deletarNoticia(id) {
  const { data: noticia } = await _supabase
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (!noticia) return;

  if (confirm(`Arquivar "${noticia.titulo}"?`)) {
    const {
      data: { user },
    } = await _supabase.auth.getUser();

    const { error: errArq } = await _supabase
      .from("notificacoes_arquivadas")
      .upsert([
        {
          ...noticia,
          arquivado_por_id: user.id,
          arquivado_por_nome: user.user_metadata.nome_completo,
        },
      ]);

    if (errArq) return alert("Erro no arquivo");

    await registrarLog(
      "Arquivou",
      noticia.titulo,
      id,
      "Movido para o histórico",
    );

    const { error: errDel } = await _supabase
      .from("notificacoes")
      .delete()
      .eq("id", id);

    if (!errDel) {
      alert("Arquivado com sucesso!");
      await carregarGestaoAdmin();
    }
  }
}

// ─── LOGIN E LOGOUT ───────────────────────────────────────────────────────────
async function fazerLogin() {
  const { error } = await _supabase.auth.signInWithPassword({
    email: document.getElementById("email").value,
    password: document.getElementById("senha").value,
  });

  if (error) {
    alert(error.message);
  } else {
    window.location.href = "admin.html";
  }
}

async function fazerLogout() {
  await _supabase.auth.signOut();
  window.location.href = "index.html";
}

async function publicar() {
  const {
    data: { user },
  } = await _supabase.auth.getUser();
  const imagemUrlFinal =
    imagensEmEdicao.length > 0 ? JSON.stringify(imagensEmEdicao) : null;

  const payload = {
    titulo: document.getElementById("titulo").value,
    categoria: document.getElementById("categoria").value,
    descricao_breve: document.getElementById("descricao").value,
    conteudo_completo: document.getElementById("conteudo-completo").value,
    imagem_url: imagemUrlFinal,
    data_expiracao: document.getElementById("data-expiracao").value || null,
    nome_autor: user.user_metadata.nome_completo,
    cargo_autor: user.user_metadata.cargo,
  };

  try {
    if (idEmEdicao) {
      const { data, error } = await _supabase
        .from("notificacoes")
        .update(payload)
        .eq("id", idEmEdicao)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        await registrarLog(
          "Editou",
          payload.titulo,
          idEmEdicao,
          "Alteração de dados",
        );
        alert("Edição salva com sucesso!"); // Sucesso na edição
      } else {
        alert("Erro: Você não tem permissão para editar esta notícia!");
        return; // IMPORTANTE: Para a execução aqui e não mostra o alerta final
      }
    } else {
      payload.autor_id = user.id;
      const { data, error } = await _supabase
        .from("notificacoes")
        .insert([payload])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        await registrarLog(
          "Criou",
          payload.titulo,
          data[0].id,
          "Nova postagem",
        );
        alert("Publicado com sucesso!"); // Sucesso na criação
      }
    }

    // Ações de fechamento que só ocorrem em caso de SUCESSO REAL
    fecharModal();
    await carregarGestaoAdmin();
  } catch (err) {
    alert("Erro na operação: " + err.message);
  }
}

function iniciar() {
  console.log("Iniciando carregamento das páginas...");
  carregarMural();
  carregarGestaoAdmin();
}

async function prepararEdicao(id) {
  const { data: noticia, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao preparar edição:", error.message);
    return;
  }

  if (noticia) {
    idEmEdicao = id;

    document.getElementById("titulo").value = noticia.titulo;
    document.getElementById("categoria").value = noticia.categoria;
    document.getElementById("descricao").value = noticia.descricao_breve;
    document.getElementById("conteudo-completo").value =
      noticia.conteudo_completo || "";
    document.getElementById("data-expiracao").value =
      noticia.data_expiracao || "";

    imagensEmEdicao = parseImagensUrl(noticia.imagem_url);

    const hiddenImgUrl = document.getElementById("imagem-url");
    if (hiddenImgUrl) {
      hiddenImgUrl.value =
        imagensEmEdicao.length > 0 ? JSON.stringify(imagensEmEdicao) : "";
    }

    renderizarPreviewAdmin();

    document.querySelector(".modal-header h2").innerText = "Editar Notificação";
    document.querySelector(".btn-postar").innerText = "Salvar Alterações";

    document.getElementById("modal").style.display = "flex";
  }
}

function fecharModal() {
  idEmEdicao = null;
  removerImagem();

  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";

  const tituloModal = document.querySelector(".modal-header h2");
  const botaoPostar = document.querySelector(".btn-postar");

  if (tituloModal) tituloModal.innerText = "Nova Notificação";
  if (botaoPostar) botaoPostar.innerText = "Publicar Notificação";

  const campos = document.querySelectorAll(
    "#modal input, #modal textarea, #modal select",
  );
  campos.forEach((campo) => {
    campo.value = "";
  });

  console.log("Modal resetado: pronto para novo cadastro.");
}

async function cadastrarFuncionario() {
  const nome = document.getElementById("novo-nome").value;
  const cargo = document.getElementById("novo-cargo").value;
  const email = document.getElementById("novo-email").value;
  const password = document.getElementById("nova-senha").value;
  const msg = document.getElementById("msg-cadastro");

  if (!nome || !email || !password) {
    msg.innerText = "Preencha todos os campos!";
    msg.style.color = "red";
    return;
  }

  const { data: authData, error: authError } = await _supabase.auth.signUp({
    email: email,
    password: password,
    options: { data: { nome_completo: nome, cargo: cargo } },
  });

  if (authError) {
    msg.innerText = "Erro no cadastro: " + authError.message;
    return;
  }

  const { error: perfilError } = await _supabase
    .from("perfis_usuarios")
    .insert([
      {
        id: authData.user.id,
        nome_completo: nome,
        cargo: cargo,
        email: email,
        status: "Ativo",
      },
    ]);

  if (perfilError) {
    msg.innerText =
      "Usuário criado, mas erro ao gerar perfil: " + perfilError.message;
  } else {
    msg.innerText = "Funcionário cadastrado com sucesso!";
    msg.style.color = "green";

    document
      .querySelectorAll("#novo-nome, #novo-email, #nova-senha")
      .forEach((i) => (i.value = ""));

    carregarUsuarios();

    await registrarLog(
      "Cadastrou Usuário",
      nome,
      authData.user.id,
      `Novo acesso criado para ${cargo}`,
    );
  }
}

async function exibirNomeHeader() {
  const nomeHeader = document.getElementById("nome-usuario-header");
  if (!nomeHeader) return;

  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (user && user.user_metadata) {
    const nome = user.user_metadata.nome_completo || "Funcionário";
    nomeHeader.innerText = `Olá, ${nome}`;
  } else {
    nomeHeader.innerText = "Olá, Visitante";
  }
}

async function verificarPermissoes() {
  // Captura as abas da navegação e as sessões de conteúdo
  const navEquipe = document.getElementById("nav-equipe");
  const navAuditoria = document.getElementById("nav-auditoria");
  const sessaoCadastro = document.getElementById("sessao-cadastro");
  const sessaoLogs = document.getElementById("sessao-logs");
  const sessaoUsuarios = document.getElementById("sessao-usuarios");

  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (user && user.user_metadata) {
    const cargo = user.user_metadata.cargo;

    if (cargo === "Direção") {
      // 1. Mostra os links na barra de navegação
      if (navEquipe) navEquipe.style.display = "inline-flex";
      if (navAuditoria) navAuditoria.style.display = "inline-flex";

      // 2. Mostra os blocos de conteúdo das páginas
      if (sessaoCadastro) sessaoCadastro.style.display = "block";
      if (sessaoLogs) sessaoLogs.style.display = "block";
      if (sessaoUsuarios) sessaoUsuarios.style.display = "block";

      // 3. Carrega os dados
      if (sessaoLogs) await carregarLogs(1);
      if (sessaoUsuarios) await carregarUsuarios();
    }
  }
}

function alternarFiltrosLogs() {
  const painel = document.getElementById("painel-filtros-logs");
  const botao = document.getElementById("btn-filtrar-logs");

  if (!painel || !botao) return;

  const aberto = painel.style.display === "block";
  painel.style.display = aberto ? "none" : "block";
  botao.setAttribute("aria-expanded", aberto ? "false" : "true");
}

function aplicarFiltroLogs() {
  const filtroAcao = document.getElementById("filtro-acao-logs");
  const filtroDataInicio = document.getElementById("filtro-data-inicio-logs");
  const filtroDataFim = document.getElementById("filtro-data-fim-logs");

  filtrosLogs.acao = filtroAcao ? filtroAcao.value : "";
  filtrosLogs.dataInicio = filtroDataInicio ? filtroDataInicio.value : "";
  filtrosLogs.dataFim = filtroDataFim ? filtroDataFim.value : "";

  carregarLogs(1);
}

function removerFiltroLogs() {
  filtrosLogs = {
    acao: "",
    dataInicio: "",
    dataFim: "",
  };

  const filtroAcao = document.getElementById("filtro-acao-logs");
  const filtroDataInicio = document.getElementById("filtro-data-inicio-logs");
  const filtroDataFim = document.getElementById("filtro-data-fim-logs");

  if (filtroAcao) filtroAcao.value = "";
  if (filtroDataInicio) filtroDataInicio.value = "";
  if (filtroDataFim) filtroDataFim.value = "";

  carregarLogs(1);
}

async function carregarLogs(pagina = 1) {
  const corpoLogs = document.getElementById("tabela-logs");
  const paginacao = document.getElementById("logs-paginacao");
  const infoPagina = document.getElementById("pagina-logs-info");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnProxima = document.getElementById("btn-proxima-pagina");

  if (!corpoLogs) return;

  paginaLogsAtual = pagina;

  const inicio = (pagina - 1) * logsPorPagina;
  const fim = inicio + logsPorPagina - 1;

  let query = _supabase
    .from("logs_atividades")
    .select("*", { count: "exact" })
    .order("criado_em", { ascending: false });

  if (filtrosLogs.acao) {
    query = query.eq("acao", filtrosLogs.acao);
  }

  if (filtrosLogs.dataInicio) {
    query = query.gte("criado_em", `${filtrosLogs.dataInicio}T00:00:00`);
  }

  if (filtrosLogs.dataFim) {
    query = query.lte("criado_em", `${filtrosLogs.dataFim}T23:59:59`);
  }

  const { data: logs, error, count } = await query.range(inicio, fim);

  if (error) {
    console.error("Erro ao buscar logs:", error.message);
    corpoLogs.innerHTML = `<tr><td colspan="5" style="color:red">Erro: ${error.message}</td></tr>`;
    if (paginacao) paginacao.style.display = "none";
    return;
  }

  totalPaginasLogs = Math.max(1, Math.ceil((count || 0) / logsPorPagina));

  if (!logs || logs.length === 0) {
    corpoLogs.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
    if (paginacao) paginacao.style.display = "none";
    return;
  }

  corpoLogs.innerHTML = logs
    .map(
      (l) => `
      <tr>
        <td>${new Date(l.criado_em).toLocaleString()}</td>
        <td><strong>${l.usuario_nome}</strong><br><small>${l.usuario_cargo}</small></td>
        <td><span class="badge-${l.acao.toLowerCase()}">${l.acao}</span></td>
        <td>${l.item_titulo || "---"}</td>
        <td class="log-detalhes">${l.detalhes || "---"}</td> 
      </tr>
    `,
    )
    .join("");

  if (paginacao) {
    paginacao.style.display = totalPaginasLogs > 1 ? "flex" : "none";
  }

  if (infoPagina) {
    infoPagina.innerText = `Página ${paginaLogsAtual} de ${totalPaginasLogs}`;
  }

  if (btnAnterior) {
    btnAnterior.disabled = paginaLogsAtual === 1;
  }

  if (btnProxima) {
    btnProxima.disabled = paginaLogsAtual === totalPaginasLogs;
  }
}

function irParaPaginaLogs(pagina) {
  if (pagina < 1 || pagina > totalPaginasLogs) return;
  carregarLogs(pagina);
}

async function registrarLog(acao, itemTitulo, noticiaId = null, detalhes = "") {
  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (user) {
    const logData = {
      usuario_id: user.id,
      usuario_nome: user.user_metadata.nome_completo,
      usuario_cargo: user.user_metadata.cargo,
      acao: acao,
      item_titulo: itemTitulo,
      noticia_id: noticiaId,
      detalhes: detalhes,
    };

    const { error } = await _supabase.from("logs_atividades").insert([logData]);

    if (error) {
      console.error("Erro ao registrar log:", error.message);
    }
  }
}

async function carregarUsuarios() {
  const corpo = document.getElementById("tabela-usuarios");
  if (!corpo) return;

  const { data: usuarios, error } = await _supabase
    .from("perfis_usuarios")
    .select("*")
    .order("nome_completo");

  if (error) {
    console.error("Erro ao carregar usuários:", error.message);
    return;
  }

  if (usuarios) {
    corpo.innerHTML = usuarios
      .map(
        (u) => `
          <tr style="${u.status === "Arquivado" ? "opacity: 0.5; background: #f9f9f9;" : ""}">
            <td><strong>${u.nome_completo}</strong></td>
            <td>${u.email}</td>
            <td><span class="tag">${u.cargo}</span></td>
            <td><small>${u.status}</small></td>
            <td>
              <button class="btn-edit" onclick="prepararEdicaoUsuario('${u.id}')">✏️ Editar</button>
              <button class="btn-delete" onclick="arquivarUsuario('${u.id}', '${u.nome_completo}')">🗄️ Arquivar</button>
            </td>
          </tr>
        `,
      )
      .join("");
  }
}

async function arquivarUsuario(id, nome) {
  if (confirm(`Deseja desativar o acesso de ${nome}?`)) {
    const { error } = await _supabase
      .from("perfis_usuarios")
      .update({ status: "Arquivado" })
      .eq("id", id);

    if (!error) {
      await registrarLog("Arquivou Usuário", nome, id);
      alert("Usuário arquivado!");

      carregarUsuarios();
      carregarLogs(1);
    }
  }
}

async function prepararEdicaoUsuario(id) {
  const { data: usuario, error } = await _supabase
    .from("perfis_usuarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao buscar usuário:", error.message);
    return;
  }

  if (usuario) {
    document.getElementById("edit-user-id").value = usuario.id;
    document.getElementById("edit-user-nome").value = usuario.nome_completo;
    document.getElementById("edit-user-cargo").value = usuario.cargo;

    const modal = document.getElementById("modal-usuario");
    if (modal) {
      modal.style.display = "flex";
    } else {
      console.error("Erro: Modal 'modal-usuario' não encontrado no HTML");
    }
  }
}

async function salvarEdicaoUsuario() {
  const id = document.getElementById("edit-user-id").value;
  const novoNome = document.getElementById("edit-user-nome").value;
  const novoCargo = document.getElementById("edit-user-cargo").value;

  const { error } = await _supabase
    .from("perfis_usuarios")
    .update({
      nome_completo: novoNome,
      cargo: novoCargo,
    })
    .eq("id", id);

  if (error) {
    alert("Erro ao atualizar: " + error.message);
  } else {
    await registrarLog(
      "Editou Usuário",
      novoNome,
      id,
      `Alterou cargo para ${novoCargo}`,
    );

    alert("Dados do funcionário atualizados!");
    fecharModalUsuario();
    carregarUsuarios();
    carregarLogs(1);
  }
}

function transformarLinks(texto) {
  if (!texto) return "";

  // 1. "Sanitização" básica: Transforma os caracteres de tags HTML em texto comum
  // Isso impede que o <script> seja lido como código pelo navegador
  const textoSeguro = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Agora identifica as URLs no texto já limpo
  const regexUrl = /(https?:\/\/[^\s]+)/g;
  return textoSeguro.replace(regexUrl, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-mural">${url}</a>`;
  });
}

function fecharModalUsuario() {
  const modal = document.getElementById("modal-usuario");
  if (modal) modal.style.display = "none";
}

document.addEventListener("keydown", (event) => {
  const modalLeitura = document.getElementById("modal-leitura");
  if (!modalLeitura) return;

  const modalAberto = modalLeitura.style.display === "flex";

  if (event.key === "Escape" && modalAberto) {
    fecharNoticia();
  }

  if (modalAberto && carrosselImagens.length > 1) {
    if (event.key === "ArrowLeft") carrosselAnterior(null);
    if (event.key === "ArrowRight") carrosselProximo(null);
  }
});

window.onload = () => {
  init();
};

// ─── UPLOAD E COMPRESSÃO DE IMAGEM (MULTI) ───────────────────────────────────

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const MAX_IMAGENS = 5;
  const disponiveis = MAX_IMAGENS - imagensEmEdicao.length;

  if (disponiveis <= 0) {
    alert("Limite de 5 imagens atingido.");
    event.target.value = "";
    return;
  }

  const filesToProcess = files.slice(0, disponiveis);

  if (files.length > disponiveis) {
    alert(
      `Você selecionou ${files.length} imagens, mas só há espaço para ${disponiveis}. Apenas as primeiras ${disponiveis} serão adicionadas.`,
    );
  }

  let processados = 0;

  filesToProcess.forEach((file) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      comprimirImagem(e.target.result, function (base64Comprimida) {
        imagensEmEdicao.push(base64Comprimida);
        processados++;
        if (processados === filesToProcess.length) {
          const hiddenField = document.getElementById("imagem-url");
          if (hiddenField) {
            hiddenField.value =
              imagensEmEdicao.length > 0 ? JSON.stringify(imagensEmEdicao) : "";
          }
          renderizarPreviewAdmin();
        }
      });
    };
    reader.onerror = function () {
      console.error("Erro ao ler arquivo:", file.name);
      processados++;
      if (processados === filesToProcess.length) {
        renderizarPreviewAdmin();
      }
    };
    reader.readAsDataURL(file);
  });

  event.target.value = "";
}

function comprimirImagem(base64Original, callback) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  img.onload = function () {
    const MAX = 800;
    let w = img.width;
    let h = img.height;

    if (w > MAX || h > MAX) {
      if (w > h) {
        h = Math.round((h * MAX) / w);
        w = MAX;
      } else {
        w = Math.round((w * MAX) / h);
        h = MAX;
      }
    }

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const resultado = canvas.toDataURL("image/jpeg", 0.6);
    callback(resultado);
  };

  img.onerror = function () {
    console.error("Erro ao carregar imagem para compressão.");
    callback(base64Original);
  };

  img.src = base64Original;
}

function renderizarPreviewAdmin() {
  const previewArea = document.getElementById("preview-area");
  const previewLista = document.getElementById("preview-lista");
  const uploadLabel = document.getElementById("upload-label");

  if (!previewLista) return;

  if (imagensEmEdicao.length === 0) {
    if (previewArea) previewArea.style.display = "none";
    if (uploadLabel)
      uploadLabel.textContent = "📁 Clique para selecionar imagens (até 5)";
    return;
  }

  if (previewArea) previewArea.style.display = "block";
  if (uploadLabel) {
    uploadLabel.textContent = `✅ ${imagensEmEdicao.length} imagem(ns) selecionada(s) — clique para adicionar mais`;
  }

  previewLista.innerHTML = imagensEmEdicao
    .map(
      (src, i) => `
      <div style="position:relative;display:inline-block;">
        <img src="${src}" alt="Imagem ${i + 1}"
          style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #ddd;" />
        <button type="button" onclick="removerImagemIndividual(${i})"
          style="position:absolute;top:-6px;right:-6px;background:#c00;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;line-height:20px;text-align:center;">✕</button>
      </div>
    `,
    )
    .join("");
}

function removerImagemIndividual(index) {
  imagensEmEdicao.splice(index, 1);
  const hiddenField = document.getElementById("imagem-url");
  if (hiddenField) {
    hiddenField.value =
      imagensEmEdicao.length > 0 ? JSON.stringify(imagensEmEdicao) : "";
  }
  renderizarPreviewAdmin();
}

function removerImagem() {
  imagensEmEdicao = [];
  const inputFile = document.getElementById("imagem-file");
  if (inputFile) inputFile.value = "";
  const hiddenField = document.getElementById("imagem-url");
  if (hiddenField) hiddenField.value = "";
  renderizarPreviewAdmin();
}

// Função para neutralizar qualquer tag HTML
function sanitizar(texto) {
  if (!texto) return "";
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function destacarLinkAtivo() {
  // 1. Pega todos os links da barra de navegação
  const links = document.querySelectorAll(".admin-nav-link");

  // 2. Pega o nome do arquivo atual (ex: admin.html ou equipe.html)
  const paginaAtual = window.location.pathname.split("/").pop();

  links.forEach((link) => {
    // Remove a classe active de todos para começar do zero
    link.classList.remove("active");
    link.removeAttribute("aria-current");

    // 3. Se o destino do link (href) for igual à página atual, destaca ele!
    if (link.getAttribute("href") === paginaAtual) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
}
