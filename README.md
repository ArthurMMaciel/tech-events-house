# DFL Events

Primeira versão local para descobrir eventos e acompanhar os que você marcou como inscrito.

## Executar

É necessário Node.js 22.13 ou superior e `curl` disponível no PATH. No terminal:

```powershell
npm install
npm run user
npm run build
npm start
```

O comando de criação pede e-mail e senha e grava somente o hash da senha no banco SQLite local `agenda.sqlite`. Atenção: por enquanto a senha digitada aparece no terminal. Acesse http://localhost:3000 e faça login. Não existe cadastro público.

O frontend usa React e Vite. Para desenvolver com atualização automática, inicie o backend com `npm start` em um terminal e, em outro, execute `npm run dev`. Acesse o endereço informado pelo Vite (normalmente http://127.0.0.1:5173); as chamadas `/api` são encaminhadas ao backend na porta 3000. Para usar apenas `npm start`, execute `npm run build` após alterar o frontend: o Express serve os arquivos gerados em `dist`.

Na página Eventos, clique em **Atualizar eventos**. É necessária conexão com a internet. Os resultados de cada fonte são exibidos após a coleta; a Even3 ainda não tem extrator implementado e será reportada como indisponível. Os eventos são guardados localmente. A coleta é manual nesta versão, não há agendamento nem integração com Telegram.

Clique em **Ver evento** para abrir o site e realizar a inscrição. Depois, **Marcar inscrito** adiciona o evento à tela Calendário; o aplicativo não faz inscrições por você. A lista é filtrada pelo mês selecionado e não garante que todos os eventos publicados nas plataformas foram encontrados.

Este projeto é para execução local, ouvindo apenas em `127.0.0.1`. Antes de expor na internet é necessário planejar hospedagem, HTTPS, proteção adicional de login, cópias de segurança e revisar as condições de uso das fontes de dados.


## Fontes adicionais

A atualização consulta a [Agenda Tech Brasil](https://github.com/agenda-tech-brasil/agenda-tech-brasil) e os dados abertos do [Confs.tech](https://github.com/tech-conferences/conference-data), além das fontes existentes. O catálogo inclui eventos internacionais. Confira sempre datas, inscrições e disponibilidade no site do organizador. A Agenda Tech Brasil informa os dias de cada evento; a coleta usa o primeiro dia. A disponibilidade de cada fonte aparece no resultado da atualização. O extrator Even3 ainda não está implementado.

## Convites por Gmail

O aplicativo registra respostas como aguardando, confirmou ou não vai; elas também podem ser alteradas manualmente. O envio de convites está preparado, mas só funciona após configurar no ambiente do servidor `GMAIL_USER` (endereço Gmail), `GMAIL_APP_PASSWORD` (senha de aplicativo Google) e `PUBLIC_URL` (URL pública do aplicativo). Nunca coloque a senha no repositório. Reinicie o servidor após a configuração. Novos participantes recebem um convite ao salvar; convites com falha ou ainda não enviados podem ser enviados pelo botão no cartão. O link permite responder, mas não faz inscrição na plataforma do evento. A publicação em rede requer planejamento de hospedagem e segurança descrito acima.
