# DFL Events

Agenda compartilhada de eventos de tecnologia. É um frontend React/Vite publicado na Vercel que fala direto com o Supabase (Auth + Postgres com RLS). Não há backend próprio.

## Como funciona

- **Login**: contas do Supabase Auth criadas por você. Não existe cadastro público.
- **Eventos**: só o que ainda vai acontecer, com filtros Brasil / Fora do país, estado ou país, cidade, modalidade, preço, tema e fonte. Catálogo preenchido pelo botão **Atualizar eventos** (Agenda Tech Brasil, Even3 e Confs.tech, direto do navegador) ou por **+ Novo evento**.
- **Agenda da casa**: o que vocês marcaram com **Vamos nesse** ou criaram à mão. Todos os membros enxergam e editam a mesma agenda.
- **Link de inscrição**: cada evento da agenda ganha um link `/e/<token>`. Quem abre o link informa nome e e-mail e confirma presença ou recusa, sem login.
- **Convite por e-mail**: o botão abre o seu programa de e-mail com o link de inscrição já no texto. O envio sai do seu e-mail. Quando a pessoa responde pelo link, o status dela muda na lista.

## Configurar o Supabase (uma vez)

1. No SQL Editor do projeto, execute [`supabase/001_schema.sql`](supabase/001_schema.sql) e depois [`supabase/002_location_price.sql`](supabase/002_location_price.sql).
2. Em **Authentication → Users → Add user**, crie a conta de cada sócio.
3. Libere o acesso de cada conta à agenda:
   ```sql
   insert into public.members (user_id, name)
   select id, 'Nome' from auth.users where email = 'email@exemplo.com';
   ```
4. Recomendado: desligue **Allow new users to sign up** em Authentication → Sign In / Providers → Email. Mesmo ligado, contas fora de `members` não acessam nada.

## Configurar a Vercel

Em Project Settings → Environment Variables, defina:

- `VITE_SUPABASE_URL`: URL do projeto
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável (`sb_publishable_...`)

Faça um novo deploy. Essas variáveis vão para o navegador. Nunca use a chave `service_role`/secret nem a senha do banco com prefixo `VITE_`.

## Desenvolver

```powershell
npm install
npm run dev
```

O `.env` local precisa das mesmas variáveis `VITE_` (veja `.env.example`).

## Coleta completa (Eventbrite e Sympla)

Eventbrite e Sympla bloqueiam requisições do navegador (CORS), por isso rodam em um script local que entra com uma conta de membro:

```powershell
npm run collect
```

O script exige `COLLECT_EMAIL` e `COLLECT_PASSWORD` no `.env`. A Even3 ainda não tem extrator.

## Limites conhecidos

- Nenhuma fonte informa preço. Só o Eventbrite (lista de eventos gratuitos) chega marcado como gratuito; o resto fica "Não informado" até alguém marcar no cartão.
- A cobertura do Brasil depende da Agenda Tech Brasil (que publica o ano corrente) e da Even3 (lista pública da categoria Computação e TI, cerca de 18 eventos). Sympla e Eventbrite BR foram avaliados e não entram no botão: o Sympla usa uma API interna protegida contra robôs, com vitrine dominada por cursos pagos, e a listagem BR do Eventbrite traz poucos resultados e fora de tema.

- O link público aceita até 1000 respostas por evento e não tem proteção contra robôs. Se virar problema, dá para ativar CAPTCHA no Supabase ou trocar o token do evento.
- Confira sempre datas e inscrições no site do organizador. Confirmar presença aqui não faz a inscrição oficial no evento.
