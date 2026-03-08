// Configurações do Supabase
const supabaseUrl = "https://nnnniaoribyqkcxtbpvr.supabase.co";
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
    mural.innerHTML = "<p>Nenhuma notícia encontrada nesta categoria.</p>";
    return;
  }

  mural.innerHTML = lista
    .map(
      (n) => `
        <article class="card">
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

// 2. CARREGAR TABELA ADMIN
async function carregarGestaoAdmin() {
  const corpo = document.getElementById("tabela-corpo");
  if (!corpo) return;

  const { data: noticias, error } = await _supabase
    .from("notificacoes")
    .select("*")
    .order("criado_em", { ascending: false });

  if (noticias) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas os dias

    let ativas = 0;
    let expiradas = 0;

    corpo.innerHTML = noticias
      .map((n) => {
        // Lógica de Data de Publicação (Corrige o Invalid Date)
        const dataPost = n.criado_em
          ? new Date(n.criado_em).toLocaleDateString()
          : "Sem data";

        // Lógica de Expiração
        let statusExpira = "Sem expiração";
        if (n.data_expiracao) {
          const dataExp = new Date(n.data_expiracao + "T00:00:00"); // Força formato local
          statusExpira = dataExp.toLocaleDateString();

          // Compara para as estatísticas
          if (dataExp < hoje) {
            expiradas++;
          } else {
            ativas++;
          }
        } else {
          ativas++; // Se não tem expiração, ela é considerada ativa
        }

        return `
                <tr>
                    <td>${n.titulo}</td>
                    <td><span class="tag tag-${n.categoria.toLowerCase()}">${n.categoria}</span></td>
                    <td>${dataPost}</td>
                    <td>${statusExpira}</td>
                    <td>
                        <button class="btn-delete" onclick="deletarNoticia('${n.id}')">🗑️</button>
                    </td>
                </tr>
            `;
      })
      .join("");

    // Atualiza os contadores na barra lateral
    document.getElementById("total-notif").innerText = noticias.length;
    document.getElementById("ativas-notif").innerText = ativas;
    document.getElementById("expiradas-notif").innerText = expiradas;
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

// PUBLICAÇÃO
async function publicar() {
  const {
    data: { user },
  } = await _supabase.auth.getUser();

  if (!user) {
    alert("Você precisa estar logado para publicar.");
    return;
  }

  // Capturando todos os campos, incluindo os que tinham sumido
  const payload = {
    titulo: document.getElementById("titulo").value,
    categoria: document.getElementById("categoria").value,
    descricao_breve: document.getElementById("descricao").value,
    conteudo_completo: document.getElementById("conteudo-completo").value, // Restaurado
    imagem_url: document.getElementById("imagem-url").value || null, // Adicionado
    data_expiracao: document.getElementById("data-expiracao").value || null,
    // Dados automáticos do autor
    nome_autor: user.user_metadata.nome_completo,
    cargo_autor: user.user_metadata.cargo,
    autor_id: user.id,
  };

  // Validação simples
  if (!payload.titulo || !payload.descricao_breve) {
    alert("Título e Descrição Curta são obrigatórios.");
    return;
  }

  const { error } = await _supabase.from("notificacoes").insert([payload]);

  if (error) {
    console.error("Erro ao publicar:", error.message);
    alert("Erro ao publicar: " + error.message);
  } else {
    alert("Notificação publicada com sucesso!");
    location.reload(); // Recarrega para mostrar na tabela
  }
}
// 3. INICIALIZAÇÃO ÚNICA
function iniciar() {
  console.log("Iniciando carregamento das páginas...");
  carregarMural();
  carregarGestaoAdmin();
}

// Garante que o código rode apenas quando o HTML estiver pronto
window.addEventListener("DOMContentLoaded", iniciar);

window.onload = () => {
  carregarMural();
  carregarGestaoAdmin();
};
