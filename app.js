// Configurações do Supabase
const supabaseUrl = "https://nnnniaoribyqkcxtbpvr.supabase.co";
("");
const supabaseKey = "sb_publishable__2Z9ePW2wWB3z0hchdpkcw_pfbLhWtz";
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Carregamento Automático
async function init() {
  if (document.getElementById("mural-noticias")) carregarMural();
  if (document.getElementById("tabela-corpo")) carregarGestaoAdmin();
}

let todasNoticias = []; // Variável global para o mural

// 1. CARREGAR MURAL PÚBLICO (INDEX)
async function carregarMural() {
  const mural = document.getElementById("mural-noticias");
  if (!mural) return;

  const { data, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false }); // Usando a coluna correta

  if (error) {
    console.error("Erro ao carregar mural:", error.message);
    mural.innerHTML = "<p>Erro ao carregar dados.</p>";
    return;
  }

  todasNoticias = data; // Guarda no "estoque" para o filtro funcionar
  renderizarMural(data);
}

function renderizarMural(lista) {
  const mural = document.getElementById("mural-noticias");
  if (lista.length === 0) {
    mural.innerHTML = "<p>Nenhuma notícia encontrada.</p>";
    return;
  }

  mural.innerHTML = lista
    .map(
      (n) => `
        <article class="card" onclick="abrirNoticiaCompleta('${n.id}')">
            ${n.imagem_url ? `<img src="${n.imagem_url}" class="card-img" alt="Capa">` : ""}
            <div class="card-body">
                <span class="tag">${n.categoria}</span>
                <h3>${n.titulo}</h3>
                <p>${n.descricao_breve}</p> 
                <div class="card-footer">
                    <small>📅 ${new Date(n.criado_em).toLocaleDateString()}</small>
                    <small>✍️ ${n.nome_autor}</small>
                </div>
            </div>
        </article>
    `,
    )
    .join("");
}

// 2. FILTRAR E BUSCAR (Ajustado para não bugar)
function filtrar(cat, elemento) {
  // 1. Remove a classe active de todos os botões
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));

  // 2. Adiciona active no botão clicado (usando o elemento passado)
  if (elemento) {
    elemento.classList.add("active");
  }

  // 3. Filtra a partir do "estoque" global
  if (cat === "Todas") {
    renderizarMural(todasNoticias);
  } else {
    const filtradas = todasNoticias.filter((n) => n.categoria === cat);
    renderizarMural(filtradas);
  }
}

function buscar() {
  const termo = document.getElementById("input-busca").value.toLowerCase();
  const filtradas = todasNoticias.filter(
    (n) =>
      n.titulo.toLowerCase().includes(termo) ||
      n.descricao_breve.toLowerCase().includes(termo),
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

      // HTML da linha da tabela (Reutilizável)
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

      // Faz a separação para as tabelas e contadores
      if (expirou) {
        listaExpiradas += linhaHtml;
        contExpiradas++;
      } else {
        listaAtivas += linhaHtml;
        contAtivas++;
      }
    });

    // Injeta os dados nas respectivas tabelas
    corpoAtivas.innerHTML =
      listaAtivas || '<tr><td colspan="5">Nenhuma notícia ativa.</td></tr>';
    corpoExpiradas.innerHTML =
      listaExpiradas ||
      '<tr><td colspan="5">Nenhuma notícia expirada.</td></tr>';

    // Atualiza as estatísticas no topo
    document.getElementById("total-notif").innerText = noticias.length;
    document.getElementById("ativas-notif").innerText = contAtivas;
    document.getElementById("expiradas-notif").innerText = contExpiradas;
  }
}

function abrirNoticiaCompleta(id) {
  const noticia = todasNoticias.find((n) => n.id === id);
  if (!noticia) return;

  const foco = document.getElementById("conteudo-noticia-foco");
  foco.innerHTML = `
        ${noticia.imagem_url ? `<img src="${noticia.imagem_url}" class="noticia-full-img">` : ""}
        <div class="noticia-full-header">
            <h2>${noticia.titulo}</h2>
            <div class="noticia-full-meta">
                Postado em ${new Date(noticia.criado_em).toLocaleDateString()} por <strong>${noticia.nome_autor}</strong> (${noticia.cargo_autor})
            </div>
        </div>
        <div class="noticia-full-text">
            ${noticia.conteudo_completo || noticia.descricao_breve}
        </div>
    `;

  document.getElementById("modal-leitura").style.display = "flex";
}

function fecharNoticia() {
  document.getElementById("modal-leitura").style.display = "none";
}

let idEmEdicao = null; // Guarda o ID da notícia que está sendo editada

async function deletarNoticia(id) {
  const { data: noticia } = await _supabase
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .single();
  if (!noticia) return;

  if (confirm(`A notícia "${noticia.titulo}" será arquivada. Confirmar?`)) {
    const {
      data: { user },
    } = await _supabase.auth.getUser();

    // Criamos o objeto de arquivo de forma limpa
    const dadosArquivo = {
      id: noticia.id,
      titulo: noticia.titulo,
      categoria: noticia.categoria,
      descricao_breve: noticia.descricao_breve,
      conteudo_completo: noticia.conteudo_completo,
      imagem_url: noticia.imagem_url,
      data_publicacao: noticia.data_publicacao,
      nome_autor: noticia.nome_autor,
      cargo_autor: noticia.cargo_autor,
      autor_id: noticia.autor_id,
      criado_em: noticia.criado_em,
      data_expiracao: noticia.data_expiracao,
      arquivado_em: new Date().toISOString(),
      arquivado_por_nome: user.user_metadata.nome_completo,
      arquivado_por_cargo: user.user_metadata.cargo,
    };

    // 1. Tenta arquivar (upsert evita o erro de ID já existente)
    const { error: erroArquivo } = await _supabase
      .from("notificacoes_arquivadas")
      .upsert([dadosArquivo]);

    if (erroArquivo) {
      console.error("Erro no Supabase:", erroArquivo.message);
      alert("Erro técnico ao arquivar: " + erroArquivo.message);
      return;
    }

    // 2. Se o arquivo funcionou, agora deleta do mural
    const { error: erroDelete } = await _supabase
      .from("notificacoes")
      .delete()
      .eq("id", id);

    if (!erroDelete) {
      await registrarLog(
        "Arquivou",
        noticia.titulo,
        id,
        "Notícia movida para o arquivo histórico",
      );
      alert("Notícia arquivada com sucesso!");
      carregarGestaoAdmin();
      carregarLogs();
    } else {
      alert("Erro ao remover do mural: " + erroDelete.message);
    }
  }
}

// LOGIN E LOGOUT
async function fazerLogin() {
  const { error } = await _supabase.auth.signInWithPassword({
    email: document.getElementById("email").value,
    password: document.getElementById("senha").value,
  });
  if (error) alert(error.message);
  else window.location.href = "admin.html";
}

async function fazerLogout() {
  await _supabase.auth.signOut();
  window.location.href = "index.html";
}

async function publicar() {
  const {
    data: { user },
  } = await _supabase.auth.getUser();
  if (!user) return alert("Sessão expirada. Faça login novamente.");

  const payload = {
    titulo: document.getElementById("titulo").value,
    categoria: document.getElementById("categoria").value,
    descricao_breve: document.getElementById("descricao").value,
    conteudo_completo: document.getElementById("conteudo-completo").value,
    imagem_url: document.getElementById("imagem-url").value || null,
    data_expiracao: document.getElementById("data-expiracao").value || null,
    nome_autor: user.user_metadata.nome_completo,
    cargo_autor: user.user_metadata.cargo,
  };

  if (idEmEdicao) {
    // Tentamos o update e pedimos os dados de volta com .select()
    const { data, error } = await _supabase
      .from("notificacoes")
      .update(payload)
      .eq("id", idEmEdicao)
      .select();

    if (error) {
      alert("Erro técnico: " + error.message);
    } else if (!data || data.length === 0) {
      // Se cair aqui, o RLS barrou a edição!
      alert(
        "Atenção: Você não tem permissão para editar esta notícia (apenas o autor ou a Direção podem).",
      );
    } else {
      // SUCESSO REAL: Agora sim fazemos o log
      await registrarLog(
        "Editou",
        payload.titulo,
        idEmEdicao,
        "Alteração realizada com sucesso por administrador/autor",
      );
      alert("Edição salva com sucesso!");
      fecharModal();
      carregarGestaoAdmin();
    }
  } else {
    // --- LÓGICA DE CRIAR NOVO (INSERT) ---
    payload.autor_id = user.id;
    const { data, error } = await _supabase
      .from("notificacoes")
      .insert([payload])
      .select(); // O .select() é vital para pegar o ID gerado para o log

    if (error) {
      alert("Erro ao publicar: " + error.message);
    } else {
      // Registra o log de criação com o ID recém-gerado
      const novoId = data[0].id;
      await registrarLog(
        "Criou",
        payload.titulo,
        novoId,
        "Nova notícia publicada",
      );
      alert("Publicado com sucesso!");
      fecharModal();
      carregarGestaoAdmin();
      carregarLogs();
    }
  }
}
// 3. INICIALIZAÇÃO ÚNICA
function iniciar() {
  console.log("Iniciando carregamento das páginas...");
  carregarMural();
  carregarGestaoAdmin();
}

// 2. FUNÇÃO PARA CARREGAR DADOS NO FORMULÁRIO (Para Editar)
async function prepararEdicao(id) {
  // Busca os dados da notícia específica no banco
  const { data: noticia, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (noticia) {
    idEmEdicao = id; // Marca que estamos editando

    // Preenche o formulário com o que já existe no banco
    document.getElementById("titulo").value = noticia.titulo;
    document.getElementById("categoria").value = noticia.categoria;
    document.getElementById("descricao").value = noticia.descricao_breve;
    document.getElementById("conteudo-completo").value =
      noticia.conteudo_completo || "";
    document.getElementById("imagem-url").value = noticia.imagem_url || "";
    document.getElementById("data-expiracao").value =
      noticia.data_expiracao || "";

    // Muda o visual do modal para "Edição"
    document.querySelector(".modal-header h2").innerText = "Editar Notificação";
    document.querySelector(".btn-postar").innerText = "Salvar Alterações";

    // Abre o modal
    document.getElementById("modal").style.display = "flex";
  }
}

function fecharModal() {
  // 1. Reseta o ID de controle para nulo (Essencial para não editar o errado)
  idEmEdicao = null;

  // 2. Esconde o modal na tela
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";

  // 3. Volta o título e o botão para o texto original
  const tituloModal = document.querySelector(".modal-header h2");
  const botaoPostar = document.querySelector(".btn-postar");

  if (tituloModal) tituloModal.innerText = "Nova Notificação";
  if (botaoPostar) botaoPostar.innerText = "Publicar Notificação";

  // 4. Limpa todos os campos de texto e seleções
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

  // 1. Cria o usuário na Autenticação (Passaporte)
  const { data: authData, error: authError } = await _supabase.auth.signUp({
    email: email,
    password: password,
    options: { data: { nome_completo: nome, cargo: cargo } },
  });

  if (authError) {
    msg.innerText = "Erro no cadastro: " + authError.message;
    return;
  }

  // 2. Se a conta foi criada, criamos o Perfil (Crachá) usando o ID gerado
  const { error: perfilError } = await _supabase
    .from("perfis_usuarios")
    .insert([
      {
        id: authData.user.id, // O ID que o Supabase acabou de gerar
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

    // Limpa campos e atualiza a tabela na hora!
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

  // Busca os dados do usuário atual na sessão do Supabase
  const {
    data: { user },
    error,
  } = await _supabase.auth.getUser();

  if (user && user.user_metadata) {
    // Puxa o nome_completo que definimos no cadastro
    const nome = user.user_metadata.nome_completo || "Funcionário";
    nomeHeader.innerText = `Olá, ${nome}`;
  } else {
    nomeHeader.innerText = "Olá, Visitante";
  }
}

// Chame a função dentro do seu window.onload ou na inicialização
window.onload = () => {
  carregarMural();
  carregarGestaoAdmin();
  exibirNomeHeader(); // Garante que o nome mude assim que a página abrir
};

// 1. ATUALIZAÇÃO DA VERIFICAÇÃO DE CARGO
async function verificarPermissoes() {
  // Pegamos as três sessões administrativas
  const sessaoCadastro = document.getElementById("sessao-cadastro");
  const sessaoLogs = document.getElementById("sessao-logs");
  const sessaoUsuarios = document.getElementById("sessao-usuarios"); // A nova aqui!

  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (user && user.user_metadata) {
    const cargo = user.user_metadata.cargo;

    if (cargo === "Direção") {
      // Mostra tudo se for Direção
      if (sessaoCadastro) sessaoCadastro.style.display = "block";
      if (sessaoLogs) sessaoLogs.style.display = "block";
      if (sessaoUsuarios) sessaoUsuarios.style.display = "block"; // Liberando o acesso visual

      // Carrega os dados das tabelas
      carregarLogs();
      carregarUsuarios(); // Chama a função que busca os funcionários
    }
  }
}

async function carregarLogs() {
  const corpoLogs = document.getElementById("tabela-logs");
  if (!corpoLogs) return;

  console.log("Solicitando logs ao banco de dados...");

  const { data: logs, error } = await _supabase
    .from("logs_atividades")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao buscar logs:", error.message);
    corpoLogs.innerHTML = `<tr><td colspan="5" style="color:red">Erro: ${error.message}</td></tr>`;
    return;
  }

  console.log("Logs recebidos:", logs); // Isso aparecerá no seu Console (F12)

  if (logs.length === 0) {
    corpoLogs.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum log registrado ainda. Tente criar ou editar uma notícia.</td></tr>`;
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
            <td style="color: #666; font-size: 0.85rem;">${l.detalhes || "---"}</td>
        </tr>
    `,
    )
    .join("");
}

// Função robusta de Auditoria
async function registrarLog(acao, itemTitulo, noticiaId = null, detalhes = "") {
  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (user && user.user_metadata) {
    const logData = {
      usuario_nome: user.user_metadata.nome_completo,
      usuario_cargo: user.user_metadata.cargo,
      acao: acao,
      item_titulo: itemTitulo,
      noticia_id: noticiaId, // ID da notícia para rastreio
      detalhes: detalhes,
    };

    const { error } = await _supabase.from("logs_atividades").insert([logData]);
    if (error) console.error("Falha ao registrar log:", error.message);
  }
}

async function carregarUsuarios() {
  const corpo = document.getElementById("tabela-usuarios");
  if (!corpo) return;

  const { data: usuarios, error } = await _supabase
    .from("perfis_usuarios")
    .select("*")
    .order("nome_completo");

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

      // Atualiza as tabelas na hora
      carregarUsuarios();
      carregarLogs();
    }
  }
}

async function prepararEdicaoUsuario(id) {
  console.log("Botão de editar clicado para o ID:", id); // SE ISSO NÃO APARECER, O ERRO É NO ONCLICK

  const { data: usuario, error } = await _supabase
    .from("perfis_usuarios")
    .select("*")
    .eq("id", id)
    .single();

  if (usuario) {
    document.getElementById("edit-user-id").value = usuario.id;
    document.getElementById("edit-user-nome").value = usuario.nome_completo;
    document.getElementById("edit-user-cargo").value = usuario.cargo;

    // Verifique se este ID existe no seu HTML!
    const modal = document.getElementById("modal-usuario");
    if (modal) {
      modal.style.display = "flex";
    } else {
      console.error("Erro: Modal 'modal-usuario' não encontrado no HTML");
    }
  }
}

// Salva as alterações na tabela perfis_usuarios
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
    carregarUsuarios(); // Atualiza a lista na hora!
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
    // 1. Registra o log primeiro
    await registrarLog(
      "Editou Usuário",
      novoNome,
      id,
      `Alterou cargo para ${novoCargo}`,
    );

    alert("Dados do funcionário atualizados!");

    // 2. Fecha o modal
    fecharModalUsuario();

    // 3. O SEGREDO: Atualiza as tabelas na tela sem recarregar!
    carregarUsuarios();
    carregarLogs();
  }
}

function fecharModalUsuario() {
  document.getElementById("modal-usuario").style.display = "none";
}

// Não esqueça de chamar essa função no carregamento da página
window.onload = () => {
  carregarMural();
  carregarGestaoAdmin();
  exibirNomeHeader();
  verificarPermissoes(); // Nova verificação de segurança
};

// Garante que o código rode apenas quando o HTML estiver pronto
window.addEventListener("DOMContentLoaded", iniciar);

// Garante que o HTML consiga "enxergar" as funções
window.prepararEdicaoUsuario = prepararEdicaoUsuario;
window.salvarEdicaoUsuario = salvarEdicaoUsuario;
window.fecharModalUsuario = fecharModalUsuario;
