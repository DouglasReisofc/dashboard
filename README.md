# StoreBot Dashboard

Projeto full-stack baseado em Next.js com autenticação integrada, landing page institucional e dashboards separados para administradores e usuários. O back-end utiliza rotas API do próprio Next.js com Node.js e MySQL, permitindo iniciar rapidamente sem a necessidade de serviços externos.

## Recursos principais

- ✅ **Landing page** pronta para apresentar o produto e direcionar para login/cadastro.
- 🔐 **Autenticação completa** com registro, login, cookies HttpOnly e hashing de senha com `bcryptjs`.
- 🗂️ **Dashboards separados** para perfis `admin` e `user`, incluindo navegação dinâmica e layout protegido.
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
APP_URL=http://localhost:3000
```

> **Importante:** altere `JWT_SECRET` em produção para um valor forte e mantenha as credenciais em local seguro.

## Instalação e execução

```bash
npm install
npm run dev
```

O servidor ficará disponível em `http://localhost:3000`.

## Estrutura de autenticação

- `app/api/auth/register` – registra usuários e cria sessão automaticamente.
- `app/api/auth/login` – valida credenciais e gera o cookie de sessão.
- `app/api/auth/logout` – remove o cookie de sessão.
- `app/api/auth/session` – retorna o usuário autenticado atual.
- `lib/db.ts` – conexão compartilhada com MySQL e criação automática da tabela `users`.
- `lib/auth.ts` – geração e validação de tokens JWT.

O layout em `app/(dashboard)/layout.tsx` garante o redirecionamento automático para `/sign-in` quando não há sessão ativa.

## Scripts úteis

- `npm run dev` – inicia o ambiente de desenvolvimento.
- `npm run build` – gera a versão de produção.
- `npm run start` – executa o build em modo produção.
- `npm run lint` – executa o linting do projeto.

## Licença

O projeto adapta o template original **Dasher UI** disponível sob licença MIT pela Codescandy/Themewagon. As adaptações e integrações adicionais são fornecidas sob a mesma licença.
