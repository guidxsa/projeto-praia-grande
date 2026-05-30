// Configurações do Supabase
const supabaseUrl = "https://nnnniaoribyqkcxtbpvr.supabase.co";
const supabaseKey = "sb_publishable__2Z9ePW2wWB3z0hchdpkcw_pfbLhWtz";
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Este cliente não salva a sessão, então não vai deslogar o Admin!
const _supabaseCadastro = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Estado global
let todasNoticias = [];
let idEmEdicao = null;
// Filtro "Minhas Notícias" no gerenciamento admin
let _todasNoticiasAdmin = []; // cache das notícias carregadas na tela admin
let _filtroMinhasNoticias = false; // status do toggle

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

// ─── SISTEMA CUSTOMIZADO DE ALERTAS E CONFIRMAÇÕES ───
function mostrarToast(titulo, mensagem, tipo = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;

  let icone = "ℹ️";
  if (tipo === "success") icone = "✅";
  if (tipo === "error") icone = "❌";
  if (tipo === "warning") icone = "⚠️";

  toast.innerHTML = `
    <div class="toast-icon">${icone}</div>
    <div class="toast-content">
      <h4 class="toast-title">${titulo}</h4>
      <p class="toast-msg">${mensagem}</p>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Remove o toast ao clicar no X ou após 5 segundos
  const fechar = () => {
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove());
  };
  toast.querySelector(".toast-close").addEventListener("click", fechar);
  setTimeout(fechar, 5000);
}

// Substitui o confirm() nativo por uma Promise assíncrona
function confirmarAcao(titulo, mensagem, icone = "⚠️") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-icon">${icone}</div>
        <h3 class="confirm-title">${titulo}</h3>
        <p class="confirm-msg">${mensagem}</p>
        <div class="confirm-actions">
          <button class="btn-confirm-no">Cancelar</button>
          <button class="btn-confirm-yes">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fechar = (resultado) => {
      overlay.remove();
      resolve(resultado);
    };

    overlay
      .querySelector(".btn-confirm-yes")
      .addEventListener("click", () => fechar(true));
    overlay
      .querySelector(".btn-confirm-no")
      .addEventListener("click", () => fechar(false));
  });
}
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
    await arquivarNoticiasExpiradas(); // Arquiva automaticamente antes de renderizar
    await carregarGestaoAdmin();
  }

  await exibirNomeHeader();
  await verificarPermissoes();
}

// --- LISTENERS DE EVENTOS ESTÁTICOS ---
document.addEventListener("DOMContentLoaded", () => {
  // Listener do botão de login
  const btnEntrar = document.getElementById("btn-entrar");
  if (btnEntrar) {
    btnEntrar.addEventListener("click", fazerLogin);
  }

  /* ── Toggle Stats Mobile (Painel Admin) ── */
  const btnStats = document.getElementById("btn-toggle-stats");
  const adminStatsBar = document.getElementById("admin-stats-bar");

  if (adminStatsBar && btnStats) {
    btnStats.addEventListener("click", () => {
      const collapsed = adminStatsBar.classList.toggle("stats-collapsed");
      btnStats.setAttribute("aria-expanded", String(!collapsed));
      btnStats.setAttribute(
        "aria-label",
        collapsed ? "Expandir barra" : "Minimizar barra",
      );
    });
  }

  /* ── Toggle Menu Superior Admin Mobile ── */
  const btnToggleAdmin = document.getElementById("btn-toggle-admin");
  const adminHeaderTopo = document.getElementById("admin-header-topo");

  if (btnToggleAdmin && adminHeaderTopo) {
    btnToggleAdmin.addEventListener("click", () => {
      const collapsed = adminHeaderTopo.classList.toggle("admin-collapsed");
      btnToggleAdmin.setAttribute("aria-expanded", String(!collapsed));
      btnToggleAdmin.setAttribute(
        "aria-label",
        collapsed ? "Expandir menu" : "Minimizar menu",
      );
    });
  }

  // Listener do input de busca
  const inputBusca = document.getElementById("input-busca");
  if (inputBusca) {
    inputBusca.addEventListener("keyup", buscar);
  }

  // Listeners das abas de filtro
  const abas = document.querySelectorAll(".category-tabs .tab");
  abas.forEach((aba) => {
    aba.addEventListener("click", function () {
      const categoria = this.getAttribute("data-categoria");
      filtrar(categoria, this);
    });
  });
});

async function carregarMural() {
  const mural = document.getElementById("mural-noticias");
  if (!mural) return;

  const hoje = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data: noticias, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .or(`data_expiracao.is.null,data_expiracao.gte.${hoje}`)
    .order("criado_em", { ascending: false });

  if (error) {
    mural.innerHTML = "<p>Erro ao carregar notícias.</p>";
    console.error("Erro ao carregar mural:", error.message);
    return;
  }

  if (noticias) {
    todasNoticias = noticias; // Salva para a busca funcionar
    renderizarMural(noticias); // Usa a função de desenho que já está correta no arquivo
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
      const descricaoSegura = sanitizar(n.descricao_breve);

      // Removemos o onclick daqui e colocamos o data-id
      return `
        <article class="card-noticia" data-id="${n.id}" style="cursor: pointer;">
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

  // ADIÇÃO IMPORTANTE: Adiciona o evento de clique após criar o HTML
  const cards = mural.querySelectorAll(".card-noticia");
  cards.forEach((card) => {
    card.addEventListener("click", function () {
      const id = this.getAttribute("data-id");
      abrirNoticiaCompleta(id);
    });
  });
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

  if (!corpoAtivas) return;

  const { data: noticias, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar notificações:", error.message);
    return;
  }

  if (!noticias) return;

  // Mantém o cache para o filtro de "Minhas Notícias"
  _todasNoticiasAdmin = noticias;

  let listaAtivas = "";

  noticias.forEach((n) => {
    const dataPost = n.criado_em
      ? new Date(n.criado_em).toLocaleDateString()
      : "---";

    let dataExpFormatada = "Sem expiração";

    if (n.data_expiracao) {
      const dataExp = new Date(n.data_expiracao + "T00:00:00");
      dataExpFormatada = dataExp.toLocaleDateString();
    }

    // Como o arquivamento já rolou no init(), tudo o que sobra aqui é ativo
    listaAtivas += `
      <tr>
        <td>${n.titulo}</td>
        <td><span class="tag tag-${n.categoria.toLowerCase()}">${n.categoria}</span></td>
        <td>${dataPost}</td>
        <td>${dataExpFormatada}</td>
        <td>
          <button class="btn-edit btn-ver-noticia" data-id="${n.id}" title="Visualizar">👁️</button>
          <button class="btn-edit btn-editar-noticia" data-id="${n.id}">✏️</button>
          <button class="btn-delete btn-deletar-noticia" data-id="${n.id}">🗑️</button>
        </td>
      </tr>
    `;
  });

  corpoAtivas.innerHTML =
    listaAtivas || '<tr><td colspan="5">Nenhuma notícia para exibir.</td></tr>';
    
  // Evento para o botão de Visualizar (Preview)
  document.querySelectorAll(".btn-ver-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      abrirNoticiaCompleta(this.getAttribute("data-id"));
    });
  });

  // Reconecta os listeners dos botões de editar e deletar
  document.querySelectorAll(".btn-editar-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      prepararEdicao(this.getAttribute("data-id"));
    });
  });

  document.querySelectorAll(".btn-deletar-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      deletarNoticia(this.getAttribute("data-id"));
    });
  });
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

  const confirmado = await confirmarAcao(
    "Arquivar Notícia",
    `Tem certeza que deseja arquivar "${noticia.titulo}"?`,
    "🗄️",
  );
  if (confirmado) {
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

    if (errArq)
      return mostrarToast("Erro", "Ocorreu um erro no arquivo.", "error");

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
      mostrarToast("Sucesso", "Notícia arquivada com sucesso!", "success");
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
    mostrarToast("Acesso Negado", "Email ou senha incorretos.", "error");
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
        mostrarToast("Sucesso", "Edição salva com sucesso!", "success"); // Sucesso na edição
      } else {
        mostrarToast(
          "Acesso Negado",
          "Você não tem permissão para editar esta notícia.",
          "error",
        );
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
        mostrarToast("Sucesso", "Nova notícia publicada!", "success"); // Sucesso na criação
      }
    }

    // Ações de fechamento que só ocorrem em caso de SUCESSO REAL
    fecharModal();
    await carregarGestaoAdmin();
  } catch (err) {
    mostrarToast("Erro na Operação", err.message, "error");
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

  const { data: authData, error: authError } =
    await _supabaseCadastro.auth.signUp({
      email: email,
      password: password,
      options: { data: { nome_completo: nome, cargo: cargo } },
    });

  if (authError) {
    let msgTraduzida = authError.message;
    if (msgTraduzida.includes("at least 6 characters"))
      msgTraduzida = "A senha deve ter pelo menos 6 caracteres.";
    if (msgTraduzida.includes("already registered"))
      msgTraduzida = "Este e-mail já está cadastrado.";

    msg.innerText = "Erro no cadastro: " + msgTraduzida;
    msg.style.color = "red";
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
    msg.innerText = "Erro ao gerar perfil: " + perfilError.message;
    msg.style.color = "red";
  } else {
    msg.innerText = "Funcionário cadastrado com sucesso!";
    msg.style.color = "green";

    // Limpar os campos após o sucesso
    document.getElementById("nome-func").value = "";
    document.getElementById("email-func").value = "";
    document.getElementById("senha-func").value = "";
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
    <button class="btn-edit btn-editar-usuario" data-id="${u.id}">✏️ Editar</button>
    <button class="btn-delete btn-arquivar-usuario" data-id="${u.id}" data-nome="${u.nome_completo}">🗄️ Arquivar</button>
  </td>
          </tr>
        `,
      )
      .join("");
  }

  document.querySelectorAll(".btn-editar-usuario").forEach((btn) => {
    btn.addEventListener("click", function () {
      prepararEdicaoUsuario(this.getAttribute("data-id"));
    });
  });
  document.querySelectorAll(".btn-arquivar-usuario").forEach((btn) => {
    btn.addEventListener("click", function () {
      arquivarUsuario(
        this.getAttribute("data-id"),
        this.getAttribute("data-nome"),
      );
    });
  });
}

async function arquivarUsuario(id, nome) {
  const confirmado = await confirmarAcao(
    "Desativar Acesso",
    `Deseja desativar permanentemente o acesso de ${nome}?`,
    "⚠️",
  );
  if (confirmado) {
    const { error } = await _supabase
      .from("perfis_usuarios")
      .update({ status: "Arquivado" })
      .eq("id", id);

    if (!error) {
      await registrarLog("Arquivou Usuário", nome, id);
      mostrarToast("Acesso Desativado", "O usuário foi arquivado.", "success");

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
    mostrarToast("Falha na Atualização", error.message, "error");
  } else {
    await registrarLog(
      "Editou Usuário",
      novoNome,
      id,
      `Alterou cargo para ${novoCargo}`,
    );

    mostrarToast("Sucesso", "Dados do funcionário atualizados!", "success");
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
    mostrarToast(
      "Limite Atingido",
      "Você só pode fazer upload de 5 imagens.",
      "warning",
    );
    event.target.value = "";
    return;
  }

  const filesToProcess = files.slice(0, disponiveis);

  if (files.length > disponiveis) {
    mostrarToast(
      "Atenção",
      `Apenas as primeiras ${disponiveis} imagens foram adicionadas.`,
      "warning",
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
        <button type="button" class="btn-remover-imagem-individual" data-index="${i}"
  style="position:absolute;top:-6px;right:-6px;background:#c00;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;line-height:20px;text-align:center;">✕</button>
      </div>
    `,
    )
    .join("");

  document.querySelectorAll(".btn-remover-imagem-individual").forEach((btn) => {
    btn.addEventListener("click", function () {
      removerImagemIndividual(parseInt(this.getAttribute("data-index")));
    });
  });
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

// ─── KEEP-ALIVE SUPABASE ─────────────────────────────────────────────────────
// Previne que o projeto Supabase "durma" por inatividade.
// Executa um SELECT silencioso a cada 5 dias (bem antes do limite de 7 dias).
// Não altera dados, não interfere em nenhuma outra função.

async function keepAliveSupabase() {
  try {
    await _supabase.from("notificacoes").select("id").limit(1);
    // Sem log no console em produção para não poluir
  } catch (_) {
    // Falha silenciosa — o keep-alive é best-effort
  }
}

// --- SCRIPT DA BARRA DE PROGRESSO ---
(function () {
  var modal = document.getElementById("modal-leitura");
  var shell = null;
  var bar = document.getElementById("read-progress-bar");
  if (!modal || !bar) return;

  function onScroll() {
    if (!shell) shell = modal.querySelector(".modal-news-shell");
    if (!shell) return;
    var scrolled = shell.scrollTop;
    var total = shell.scrollHeight - shell.clientHeight;
    var pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
    bar.style.width = pct + "%";
  }

  var observer = new MutationObserver(function () {
    var visible = modal.style.display !== "none";
    if (visible) {
      shell = modal.querySelector(".modal-news-shell");
      if (shell) {
        shell.removeEventListener("scroll", onScroll);
        shell.addEventListener("scroll", onScroll, { passive: true });
        bar.style.width = "0%";
      }
    }
  });
  observer.observe(modal, {
    attributes: true,
    attributeFilter: ["style"],
  });
})();

// 5 dias em milissegundos = 5 * 24 * 60 * 60 * 1000
const KEEP_ALIVE_INTERVALO_MS = 5 * 24 * 60 * 60 * 1000;

// Inicia imediatamente ao carregar a página e repete a cada 5 dias
keepAliveSupabase();
setInterval(keepAliveSupabase, KEEP_ALIVE_INTERVALO_MS);
// ─────────────────────────────────────────────────────────────────────────────

// ==========================================
// REGISTRO DE EVENTOS (SEM UNSAFE-INLINE)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // --- Comuns a várias páginas ---
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", fazerLogout);

  // --- Index ---
  const btnFecharNoticia = document.getElementById("btn-fechar-noticia");
  if (btnFecharNoticia)
    btnFecharNoticia.addEventListener("click", fecharNoticia);

  // --- Admin (Notificações) ---
  const btnNovaNotificacao = document.getElementById("btn-nova-notificacao");
  if (btnNovaNotificacao)
    btnNovaNotificacao.addEventListener("click", () => {
      document.getElementById("modal").style.display = "flex";
    });

  // ── NOVO: botão Minhas Notícias ──────────────────────────────
  const btnMinhas = document.getElementById("btn-minhas-noticias");

  if (btnMinhas) {
    btnMinhas.addEventListener("click", async () => {
      _filtroMinhasNoticias = !_filtroMinhasNoticias;

      btnMinhas.classList.toggle("ativo", _filtroMinhasNoticias);

      btnMinhas.textContent = _filtroMinhasNoticias
        ? "✅ Minhas Notícias"
        : "👤 Minhas Notícias";

      await aplicarFiltroMinhasNoticias();
    });
  }
  // ─────────────────────────────────────────────────────────────

  const btnFecharModalTopo = document.getElementById("btn-fechar-modal-topo");
  if (btnFecharModalTopo)
    btnFecharModalTopo.addEventListener("click", fecharModal);

  const btnCancelarModal = document.getElementById("btn-cancelar-modal");
  if (btnCancelarModal) btnCancelarModal.addEventListener("click", fecharModal);

  const btnPublicar = document.getElementById("btn-publicar");
  if (btnPublicar) btnPublicar.addEventListener("click", publicar);

  const uploadArea = document.getElementById("upload-area");
  const imagemFile = document.getElementById("imagem-file");
  if (uploadArea && imagemFile) {
    uploadArea.addEventListener("click", () => imagemFile.click());
    imagemFile.addEventListener("change", handleImageUpload);
  }

  // --- Equipe (Usuários) ---
  const btnCriarUsuario = document.getElementById("btn-criar-usuario");
  if (btnCriarUsuario)
    btnCriarUsuario.addEventListener("click", cadastrarFuncionario);

  const btnFecharUsuarioTopo = document.getElementById(
    "btn-fechar-usuario-topo",
  );
  if (btnFecharUsuarioTopo)
    btnFecharUsuarioTopo.addEventListener("click", fecharModalUsuario);

  const btnCancelarUsuario = document.getElementById("btn-cancelar-usuario");
  if (btnCancelarUsuario)
    btnCancelarUsuario.addEventListener("click", fecharModalUsuario);

  const btnSalvarUsuario = document.getElementById("btn-salvar-usuario");
  if (btnSalvarUsuario)
    btnSalvarUsuario.addEventListener("click", salvarEdicaoUsuario);

  // --- Auditoria (Logs) ---
  const btnFiltrarLogs = document.getElementById("btn-filtrar-logs");
  if (btnFiltrarLogs)
    btnFiltrarLogs.addEventListener("click", alternarFiltrosLogs);

  const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");
  if (btnAplicarFiltro)
    btnAplicarFiltro.addEventListener("click", aplicarFiltroLogs);

  const btnLimparFiltro = document.getElementById("btn-limpar-filtro");
  if (btnLimparFiltro)
    btnLimparFiltro.addEventListener("click", removerFiltroLogs);

  const btnPaginaAnterior = document.getElementById("btn-pagina-anterior");
  if (btnPaginaAnterior)
    btnPaginaAnterior.addEventListener("click", () =>
      irParaPaginaLogs(paginaLogsAtual - 1),
    );

  const btnProximaPagina = document.getElementById("btn-proxima-pagina");
  if (btnProximaPagina)
    btnProximaPagina.addEventListener("click", () =>
      irParaPaginaLogs(paginaLogsAtual + 1),
    );
});

/* ── Toggle header mobile ── */
(function () {
  const header = document.querySelector(".main-header");
  const btn = document.getElementById("btn-toggle-header");
  if (!header || !btn) return;

  btn.addEventListener("click", () => {
    const collapsed = header.classList.toggle("header-collapsed");
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.setAttribute(
      "aria-label",
      collapsed ? "Expandir cabeçalho" : "Minimizar cabeçalho",
    );
  });
})();

// ─── AUTO-ARQUIVO DE NOTÍCIAS EXPIRADAS ──────────────────────────────────────
async function arquivarNoticiasExpiradas() {
  const hoje = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data: expiradas, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .lt("data_expiracao", hoje); // data_expiracao < hoje (já passou de 23:59)

  if (error || !expiradas || expiradas.length === 0) return;

  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (!user) return; // Só executa se houver admin logado

  for (const noticia of expiradas) {
    const { error: errArq } = await _supabase
      .from("notificacoes_arquivadas")
      .upsert([
        {
          ...noticia,
          arquivado_por_id: user.id,
          arquivado_por_nome: user.user_metadata.nome_completo,
        },
      ]);

    if (errArq) {
      console.error(
        "Erro ao arquivar notícia expirada:",
        noticia.titulo,
        errArq.message,
      );
      continue; // Não para o loop; tenta arquivar as próximas
    }

    await registrarLog(
      "Arquivou",
      noticia.titulo,
      noticia.id,
      "Arquivamento automático por expiração de data",
    );

    await _supabase.from("notificacoes").delete().eq("id", noticia.id);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── FILTRO MINHAS NOTÍCIAS ─────────────────────────────
async function aplicarFiltroMinhasNoticias() {
  const corpoAtivas = document.getElementById("tabela-ativas");
  const corpoExpiradas = document.getElementById("tabela-expiradas");

  if (!corpoAtivas || !corpoExpiradas) return;

  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (!user) return;

  const noticiasVisiveis = _filtroMinhasNoticias
    ? _todasNoticiasAdmin.filter(
        (n) =>
          n.autor_id === user.id ||
          (!n.autor_id &&
            n.nome_autor === (user.user_metadata?.nome_completo || "")),
      )
    : _todasNoticiasAdmin;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let listaAtivas = "";
  let listaExpiradas = "";

  noticiasVisiveis.forEach((n) => {
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
          <button class="btn-edit btn-ver-noticia" data-id="${n.id}" title="Visualizar">👁️</button>
          <button class="btn-edit btn-editar-noticia" data-id="${n.id}">✏️</button>
          <button class="btn-delete btn-deletar-noticia" data-id="${n.id}">🗑️</button>
        </td>
      </tr>
    `;

    if (expirou) {
      listaExpiradas += linhaHtml;
    } else {
      listaAtivas += linhaHtml;
    }
  });

  const msgVazia = _filtroMinhasNoticias
    ? "Você não criou nenhuma notícia."
    : "Nenhuma notícia ativa.";

  const msgVaziaExp = _filtroMinhasNoticias
    ? "Você não tem notícias expiradas."
    : "Nenhuma notícia expirada.";

  corpoAtivas.innerHTML =
    listaAtivas || `<tr><td colspan="5">${msgVazia}</td></tr>`;

  corpoExpiradas.innerHTML =
    listaExpiradas || `<tr><td colspan="5">${msgVaziaExp}</td></tr>`;

  // reatribui eventos

  document.querySelectorAll(".btn-ver-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      abrirNoticiaCompleta(this.getAttribute("data-id"));
    });
  });

  document.querySelectorAll(".btn-editar-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      prepararEdicao(this.getAttribute("data-id"));
    });
  });

  document.querySelectorAll(".btn-deletar-noticia").forEach((btn) => {
    btn.addEventListener("click", function () {
      deletarNoticia(this.getAttribute("data-id"));
    });
  });
}
