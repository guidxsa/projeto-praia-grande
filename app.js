// Configurações do Supabase
const supabaseUrl = 'https://nnnniaoribyqkcxtbpvr.supabase.co';""
const supabaseKey = 'sb_publishable__2Z9ePW2wWB3z0hchdpkcw_pfbLhWtz';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Carregamento Automático
async function init() {
    if (document.getElementById('mural-noticias')) carregarMural();
    if (document.getElementById('tabela-corpo')) carregarGestaoAdmin();
}

let todasNoticias = []; // Variável global para o mural

// 1. CARREGAR MURAL PÚBLICO (INDEX)
async function carregarMural() {
    const mural = document.getElementById('mural-noticias');
    if (!mural) return;

    const { data, error } = await _supabase
        .from('notificacoes')
        .select('*')
        .order('criado_em', { ascending: false }); // Usando a coluna correta

    if (error) {
        console.error("Erro ao carregar mural:", error.message);
        mural.innerHTML = "<p>Erro ao carregar dados.</p>";
        return;
    }

    todasNoticias = data; // Guarda no "estoque" para o filtro funcionar
    renderizarMural(data);
}

function renderizarMural(lista) {
    const mural = document.getElementById('mural-noticias');
    if (lista.length === 0) {
        mural.innerHTML = "<p>Nenhuma notícia encontrada.</p>";
        return;
    }

    mural.innerHTML = lista.map(n => `
        <article class="card" onclick="abrirNoticiaCompleta('${n.id}')">
            ${n.imagem_url ? `<img src="${n.imagem_url}" class="card-img" alt="Capa">` : ''}
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
    `).join('');
}

// 2. FILTRAR E BUSCAR (Ajustado para não bugar)
function filtrar(cat, elemento) {
    // 1. Remove a classe active de todos os botões
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // 2. Adiciona active no botão clicado (usando o elemento passado)
    if (elemento) {
        elemento.classList.add('active');
    }

    // 3. Filtra a partir do "estoque" global
    if (cat === 'Todas') {
        renderizarMural(todasNoticias);
    } else {
        const filtradas = todasNoticias.filter(n => n.categoria === cat);
        renderizarMural(filtradas);
    }
}

function buscar() {
    const termo = document.getElementById('input-busca').value.toLowerCase();
    const filtradas = todasNoticias.filter(n => 
        n.titulo.toLowerCase().includes(termo) || 
        n.descricao_breve.toLowerCase().includes(termo)
    );
    renderizarMural(filtradas);
}

async function carregarGestaoAdmin() {
    const corpoAtivas = document.getElementById('tabela-ativas');
    const corpoExpiradas = document.getElementById('tabela-expiradas');
    if (!corpoAtivas || !corpoExpiradas) return;

    const { data: noticias, error } = await _supabase
        .from('notificacoes')
        .select('*')
        .order('criado_em', { ascending: false });

    if (noticias) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let listaAtivas = "";
        let listaExpiradas = "";
        let contAtivas = 0;
        let contExpiradas = 0;

        noticias.forEach(n => {
            const dataPost = n.criado_em ? new Date(n.criado_em).toLocaleDateString() : '---';
            let dataExpFormatada = 'Sem expiração';
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
        corpoAtivas.innerHTML = listaAtivas || '<tr><td colspan="5">Nenhuma notícia ativa.</td></tr>';
        corpoExpiradas.innerHTML = listaExpiradas || '<tr><td colspan="5">Nenhuma notícia expirada.</td></tr>';

        // Atualiza as estatísticas no topo
        document.getElementById('total-notif').innerText = noticias.length;
        document.getElementById('ativas-notif').innerText = contAtivas;
        document.getElementById('expiradas-notif').innerText = contExpiradas;
    }
}

function abrirNoticiaCompleta(id) {
    const noticia = todasNoticias.find(n => n.id === id);
    if (!noticia) return;

    const foco = document.getElementById('conteudo-noticia-foco');
    foco.innerHTML = `
        ${noticia.imagem_url ? `<img src="${noticia.imagem_url}" class="noticia-full-img">` : ''}
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

    document.getElementById('modal-leitura').style.display = 'flex';
}

function fecharNoticia() {
    document.getElementById('modal-leitura').style.display = 'none';
}

let idEmEdicao = null; // Guarda o ID da notícia que está sendo editada

// 1. FUNÇÃO DE DELETAR (O que você pediu)
async function deletarNoticia(id) {
    if (confirm("Deseja realmente excluir esta notícia? Esta ação não pode ser desfeita.")) {
        const { error } = await _supabase
            .from('notificacoes')
            .delete()
            .eq('id', id);

        if (error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            alert("Notícia removida com sucesso!");
            carregarGestaoAdmin(); // Atualiza a tabela
            if (typeof carregarMural === "function") carregarMural(); // Atualiza o mural
        }
    }
}

// LOGIN E LOGOUT
async function fazerLogin() {
    const { error } = await _supabase.auth.signInWithPassword({
        email: document.getElementById('email').value,
        password: document.getElementById('senha').value
    });
    if (error) alert(error.message);
    else window.location.href = 'admin.html';
}

async function fazerLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'index.html';
}

// 3. FUNÇÃO DE PUBLICAR/ATUALIZAR (Unificada)
async function publicar() {
    const { data: { user } } = await _supabase.auth.getUser();
    
    const payload = {
        titulo: document.getElementById('titulo').value,
        categoria: document.getElementById('categoria').value,
        descricao_breve: document.getElementById('descricao').value,
        conteudo_completo: document.getElementById('conteudo-completo').value,
        imagem_url: document.getElementById('imagem-url').value || null,
        data_expiracao: document.getElementById('data-expiracao').value || null,
        nome_autor: user.user_metadata.nome_completo,
        cargo_autor: user.user_metadata.cargo
    };

    let response;

    if (idEmEdicao) {
        // Se houver um ID, faz o UPDATE
        response = await _supabase
            .from('notificacoes')
            .update(payload)
            .eq('id', idEmEdicao);
    } else {
        // Se não houver ID, faz o INSERT (Novo post)
        payload.autor_id = user.id;
        response = await _supabase
            .from('notificacoes')
            .insert([payload]);
    }

    if (response.error) {
        alert("Erro na operação: " + response.error.message);
    } else {
        alert(idEmEdicao ? "Atualizado com sucesso!" : "Publicado com sucesso!");
        fecharModal();
        carregarGestaoAdmin();
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
        .from('notificacoes')
        .select('*')
        .eq('id', id)
        .single();

    if (noticia) {
        idEmEdicao = id; // Marca que estamos editando
        
        // Preenche o formulário com o que já existe no banco
        document.getElementById('titulo').value = noticia.titulo;
        document.getElementById('categoria').value = noticia.categoria;
        document.getElementById('descricao').value = noticia.descricao_breve;
        document.getElementById('conteudo-completo').value = noticia.conteudo_completo || '';
        document.getElementById('imagem-url').value = noticia.imagem_url || '';
        document.getElementById('data-expiracao').value = noticia.data_expiracao || '';

        // Muda o visual do modal para "Edição"
        document.querySelector('.modal-header h2').innerText = "Editar Notificação";
        document.querySelector('.btn-postar').innerText = "Salvar Alterações";
        
        // Abre o modal
        document.getElementById('modal').style.display = 'flex';
    }
}

function fecharModal() {
    idEmEdicao = null; // Reseta o estado
    document.getElementById('modal').style.display = 'none';
    document.querySelector('.modal-header h2').innerText = "Nova Notificação";
    document.querySelector('.btn-postar').innerText = "Publicar Notificação";
    // Limpa os campos
    document.querySelectorAll('.modal-body input, .modal-body textarea, .modal-body select').forEach(i => i.value = '');
}

async function cadastrarFuncionario() {
    const nome = document.getElementById('novo-nome').value;
    const cargo = document.getElementById('novo-cargo').value;
    const email = document.getElementById('novo-email').value;
    const password = document.getElementById('nova-senha').value;
    const msg = document.getElementById('msg-cadastro');

    if (!nome || !email || !password) {
        msg.innerText = "Preencha todos os campos!";
        msg.style.color = "red";
        return;
    }

    // Cria o usuário com os metadados
    const { data, error } = await _supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                nome_completo: nome,
                cargo: cargo
            }
        }
    });

    if (error) {
        msg.innerText = "Erro: " + error.message;
        msg.style.color = "red";
    } else {
        msg.innerText = "Funcionário cadastrado com sucesso!";
        msg.style.color = "green";
        // Limpa os campos
        document.querySelectorAll('#novo-nome, #novo-email, #nova-senha').forEach(i => i.value = '');
    }
}

async function exibirNomeHeader() {
    const nomeHeader = document.getElementById('nome-usuario-header');
    if (!nomeHeader) return;

    // Busca os dados do usuário atual na sessão do Supabase
    const { data: { user }, error } = await _supabase.auth.getUser();

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

async function verificarPermissoes() {
    const sessaoCadastro = document.getElementById('sessao-cadastro');
    if (!sessaoCadastro) return;

    // Busca o usuário logado e seus metadados
    const { data: { user } } = await _supabase.auth.getUser();

    if (user && user.user_metadata) {
        const cargo = user.user_metadata.cargo;
        
        // Se o cargo for exatamente 'Direção', mostramos a seção
        if (cargo === 'Direção') {
            sessaoCadastro.style.display = 'block';
            console.log("Acesso de administrador liberado para: " + user.user_metadata.nome_completo);
        } else {
            console.log("Usuário logado como: " + cargo + ". Acesso ao cadastro restrito.");
        }
    }
}

// Não esqueça de chamar essa função no carregamento da página
window.onload = () => {
    carregarMural();
    carregarGestaoAdmin();
    exibirNomeHeader();
    verificarPermissoes(); // Nova verificação de segurança
};

// Garante que o código rode apenas quando o HTML estiver pronto
window.addEventListener('DOMContentLoaded', iniciar);
