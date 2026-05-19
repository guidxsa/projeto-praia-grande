# Projeto Extensionista EMCEF Praia Grande

Sistema web desenvolvido para modernizar a comunicação entre a escola EMCEF Praia Grande e os responsáveis dos alunos.

---

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Objetivo](#objetivo)
- [Impacto Esperado](#impacto-esperado)
- [Acesso ao Sistema](#acesso-ao-sistema)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Protótipo](#protótipo)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Banco de Dados](#banco-de-dados)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Segurança](#segurança)
- [Execução Local para Desenvolvimento](#execução-local-para-desenvolvimento)
- [Cronograma Inicial](#cronograma-inicial)
- [Equipe](#equipe)

---

## Sobre o Projeto

Este projeto extensionista foi desenvolvido na disciplina de Projeto Integrador V da faculdade UCL que tem como objetivo ajudar a escola EMCEF Praia Grande, sem fins lucrativos e totalmente gratuito.

A escola relatou dificuldades no processo de comunicação com os responsáveis,
baseado majoritariamente em avisos impressos, gerando custos elevados com papel
e baixa eficiência na disseminação das informações.

O sistema atua como um elo de comunicação entre a equipe escolar e os responsáveis pelos alunos,
tornando a divulgação de informações mais rápida e acessível.

---

## Objetivo

Desenvolver uma plataforma digital simples e acessível para melhorar a comunicação
entre a escola e os responsáveis, reduzindo custos operacionais e modernizando
a divulgação de informações escolares.

## Impacto Esperado

- Redução do uso de papel
- Comunicação mais rápida com responsáveis
- Maior acessibilidade às informações escolares
- Modernização do processo informativo da escola

---

## Acesso ao Sistema

O sistema está hospedado utilizando GitHub Pages:

[Projeto Hospedado](https://guidxsa.github.io/projeto-praia-grande/)

---

## Tecnologias Utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla JS)

### Backend e Banco de Dados
- Supabase

### Hospedagem
- GitHub Pages

### Ferramentas
- GitHub
- Figma

O Supabase foi utilizado como Backend as a Service (BaaS),
fornecendo autenticação, banco de dados PostgreSQL
e integração via APIs REST.

O GitHub Pages foi escolhido para hospedagem devido à facilidade de integração
com o repositório e zero custo.

---

## Protótipo

[Protótipo Figma](https://www.figma.com/make/YW9oifjMRN9UUzMFJlyEQk/Escola-Notifica%C3%A7%C3%B5es-Site?p=f&fullscreen=1)

---

## Arquitetura do Sistema

O projeto utiliza uma arquitetura baseada em Frontend + Backend as a Service (BaaS).

- Frontend desenvolvido com HTML5, CSS3 e JavaScript puro
- Supabase responsável pela autenticação e persistência de dados
- GitHub Pages utilizado para hospedagem estática

---

## Banco de Dados

### Table `logs_atividades`

#### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `criado_em` | `timestamptz` |  Nullable |
| `noticia_id` | `uuid` |  Nullable |
| `usuario_nome` | `text` |  Nullable |
| `usuario_cargo` | `text` |  Nullable |
| `acao` | `text` |  Nullable |
| `item_titulo` | `text` |  Nullable |
| `detalhes` | `text` |  Nullable |
| `usuario_id` | `uuid` |  Nullable |

### Table `notificacoes`

#### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `titulo` | `text` |  |
| `categoria` | `text` |  |
| `descricao_breve` | `text` |  |
| `conteudo_completo` | `text` |  Nullable |
| `imagem_url` | `text` |  Nullable |
| `data_publicacao` | `date` |  |
| `nome_autor` | `text` |  |
| `cargo_autor` | `text` |  Nullable |
| `autor_id` | `uuid` |  |
| `criado_em` | `timestamptz` |  Nullable |
| `data_expiracao` | `date` |  Nullable |

### Table `notificacoes_arquivadas`

#### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `titulo` | `text` |  Nullable |
| `categoria` | `text` |  Nullable |
| `descricao_breve` | `text` |  Nullable |
| `conteudo_completo` | `text` |  Nullable |
| `imagem_url` | `text` |  Nullable |
| `data_publicacao` | `date` |  Nullable |
| `nome_autor` | `text` |  Nullable |
| `cargo_autor` | `text` |  Nullable |
| `autor_id` | `uuid` |  Nullable |
| `criado_em` | `timestamptz` |  Nullable |
| `data_expiracao` | `date` |  Nullable |
| `arquivado_em` | `timestamptz` |  Nullable |
| `arquivado_por_nome` | `text` |  Nullable |
| `arquivado_por_cargo` | `text` |  Nullable |
| `arquivado_por_id` | `uuid` |  Nullable |

### Table `perfis_usuarios`

#### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nome_completo` | `text` |  |
| `cargo` | `text` |  Nullable |
| `email` | `text` |  Nullable Unique |
| `status` | `text` |  Nullable |
| `criado_em` | `timestamptz` |  Nullable |

<img width="549" height="713" alt="image" src="https://github.com/user-attachments/assets/2dd073dc-507e-4bf0-9770-90789c7a0bd8" />

---

## Funcionalidades

- Sistema de login administrativo
- Publicação de avisos escolares
- Upload de informações
- Filtros por categoria e data
- Edição e exclusão de avisos
- Interface pública para responsáveis e alunos

---

## Estrutura do Projeto

```txt
├── admin.html        # Área administrativa
├── login.html        # Tela de autenticação
├── index.html        # Página principal
├── auditoria.html    # Página de auditoria
├── equipe.html       # Informações da equipe
├── app.js            # Lógica principal do sistema
├── style.css         # Estilização global
└── Fotos/            # Recursos visuais
```
---

## Segurança

- Controle de autenticação para administradores
- Restrição de acesso às funcionalidades administrativas
- Armazenamento seguro via Supabase
- Separação entre área pública e área administrativa

---

## Execução Local para Desenvolvimento

### 1. Clone o repositório

```bash
git clone https://github.com/guidxsa/projeto-praia-grande.git
```

### 2. Abra o projeto

Abra o projeto utilizando um editor como o VSCode.

### 3. Execute localmente

Utilize uma extensão de servidor local, como o Live Server.

---

## Cronograma Inicial
### Semana 0 (17/02 - 24/02):
- [x] Apresentacao inicial do projeto 
- [x] Escolha da instituicao alvo
- [x] Entendimento da necessidade da escola
- [x] Coleta de requisitos
- [x] Configuração do Repositório no GitHub e convite para o grupo
  
### Sprint 1 (25/02 - 03/03):
- [x] Criação do Protótipo no Figma
- [x] Termo de intenção
- [x] Escolha das tecnologias
  
### Sprint 2 (04/03 - 10/03):
- [x] Definição do modelo de dados
- [x] Configurar a hospedagem
- [x] Desenvolver a página principal

### Sprint 3 (11/03 - 17/03):
- [x] Implementar o Sistema de Login
- [x] Desenvolver o formulário administrativo para criar avisos

### Sprint 4 (18/03 - 24/03):
- [x] Infraestrutura de Dados

### Sprint 5 (25/03 - 31/03):
- [x] Implementar o upload de dados
- [x] Implementar abas de diferentes informes

### Sprint 6 (01/04 - 07/04):
- [x] Implementar filtros por data e por tipo de aviso
- [x] Implementar exclusão e edição de avisos

### Sprint 7 (08/04 - 14/04):
- [x] Testes de usabilidade

### Sprint 8 (15/04 - 21/04):
- [x] Melhorar o design (UI) com feedbacks visuais.
- [x] Criar um Manual de Uso em PDF simples para a secretaria da escola.

### Sprint 9 (22/04 - 28/04):
- [x] Assegurar a segurança do site

---

## Equipe

- Davi Motta
- Eduardo Pacífico
- Guilherme Rocha
- Kayque Fraga
