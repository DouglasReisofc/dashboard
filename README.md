# StoreBot Dashboard

Projeto full-stack baseado em Next.js com autenticação integrada, landing page institucional e dashboards separados para administradores e usuários. O back-end utiliza rotas API do próprio Next.js com Node.js e MySQL, permitindo iniciar rapidamente sem a necessidade de serviços externos.

## Recursos principais

- ✅ **Landing page** pronta para apresentar o produto e direcionar para login/cadastro.
- 🔐 **Autenticação completa** com registro, login, cookies HttpOnly e hashing de senha com `bcryptjs`.
- 🗂️ **Dashboards separados** para perfis `admin` e `user`, incluindo navegação dinâmica e layout protegido.
- 🛒 **Gestão de catálogo digital** com criação de categorias (nome, preço, SKU, descrição, status e imagem) e produtos vinculados com texto secreto, anexo opcional e limite de revendas.
- 📡 **Webhook individual por usuário** já pronto para a Meta Cloud API, com endpoint dedicado, verify token e histórico de eventos.
- 🗄️ **Integração direta com MySQL** (`mysql2/promise`) usando variáveis de ambiente centralizadas.
- 🍪 **Sessões baseadas em JWT** armazenadas em cookie seguro para controlar acesso.
- 🎨 Base construída sobre componentes Bootstrap 5 já otimizados.

## Requisitos

- Node.js 18+
- Acesso a um banco MySQL (credenciais padrão configuradas em `.env`).

## Configuração do ambiente

Crie um arquivo `.env` na raiz (já incluso com os valores padrão fornecidos):

```env
DATABASE_HOST=150.230.85.70
DATABASE_PORT=3306
DATABASE_USER=storebot
DATABASE_PASSWORD=storebot
DATABASE_NAME=storebot
JWT_SECRET=super-secret-jwt-key-change-me
APP_URL=http://localhost:4478
PORT=4478
DEFAULT_ADMIN_EMAIL=contactgestorvip@gmail.com
DEFAULT_ADMIN_PASSWORD="Dev7766@#$%"
DEFAULT_ADMIN_NAME=Administrador StoreBot
```

> **Importante:** altere `JWT_SECRET` em produção para um valor forte e mantenha as credenciais em local seguro.

> A senha padrão está entre aspas porque contém `#`; sem as aspas o restante seria interpretado como comentário pelo parser de variáveis de ambiente.

As variáveis `DEFAULT_ADMIN_*` garantem que um administrador inicial seja provisionado automaticamente. Ajuste-as caso precise de outro e-mail ou senha.

## Instalação e execução

```bash
npm install
npm run dev
```

O servidor ficará disponível em `http://localhost:4478`.

> Para alterar a porta, execute `npm run dev -- -p <porta>` ou ajuste o script em `package.json` conforme necessário.

## Estrutura de autenticação

- `app/api/auth/register` – registra usuários e cria sessão automaticamente.
- `app/api/auth/login` – valida credenciais e gera o cookie de sessão.
- `app/api/auth/logout` – remove o cookie de sessão.
- `app/api/auth/session` – retorna o usuário autenticado atual.
- `app/api/webhooks/meta/[webhookId]` – endpoint dinâmico para verificar e receber notificações da Meta Cloud API por usuário.
- `lib/db.ts` – conexão compartilhada com MySQL e criação automática da tabela `users`.
- `lib/auth.ts` – geração e validação de tokens JWT.

O layout em `app/(dashboard)/layout.tsx` garante o redirecionamento automático para `/sign-in` quando não há sessão ativa.

### Perfis de acesso

- O primeiro administrador é criado automaticamente com o e-mail `contactgestorvip@gmail.com` e senha `Dev7766@#$%` (altere no `.env` se necessário).
- O formulário de cadastro cria apenas contas de usuário final; administradores adicionais devem ser configurados diretamente no banco de dados.

## Webhooks da Meta Cloud API

- Cada usuário recebe automaticamente um endpoint único disponível em `/api/webhooks/meta/{id}`.
- O painel do usuário exibe endpoint, verify token e API key, além do histórico dos últimos eventos recebidos.
- Durante a verificação do webhook na Meta, utilize o verify token fornecido pelo painel e informe o endpoint gerado.

## Scripts úteis

- `npm run dev` – inicia o ambiente de desenvolvimento.
- `npm run build` – gera a versão de produção.
- `npm run start` – executa o build em modo produção.
- `npm run lint` – executa o linting do projeto.

## Licença

O projeto adapta o template original **Dasher UI** disponível sob licença MIT pela Codescandy/Themewagon. As adaptações e integrações adicionais são fornecidas sob a mesma licença.
