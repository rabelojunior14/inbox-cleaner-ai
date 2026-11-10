# Inbox Cleaner AI — PWA MVP

Versão web instalável para iPhone (Safari → Compartilhar → Adicionar à Tela de Início).

## Estado real deste MVP
- Interface responsiva em português e tema escuro.
- Manifest e service worker para instalação PWA.
- Fluxo de conexão Google OAuth usando Google Identity Services.
- Leitura paginada de mensagens Gmail e classificação heurística local no navegador.
- Seleção manual e envio à lixeira do Gmail somente após confirmação explícita.

## Limitações importantes
- A classificação atual é baseada em regras locais/termos, NÃO é um modelo de IA semântico. É um primeiro filtro demonstrativo e pode errar.
- Mensagens que parecem pessoais, financeiras, de segurança, compras ou documentos ficam protegidas por padrão; ainda assim, revise tudo.
- O app não envia o corpo dos e-mails a um serviço de IA externo.
- Esta é uma base técnica. Antes de uso com conta real, faça testes com uma conta secundária e revise permissões, política de privacidade, tratamento de erros e limites de API.
- O escopo `gmail.modify` é sensível/restrito e pode exigir verificação OAuth e avaliação de segurança dependendo do modo de publicação/uso.
- O app não pode ser hospedado em `file://`. PWA exige hospedagem HTTPS.

## Configuração Google
1. Crie um projeto no Google Cloud Console.
2. Ative Gmail API.
3. Configure OAuth consent screen.
4. Crie OAuth Client ID do tipo **Web application**.
5. Cadastre a origem HTTPS do domínio em Authorized JavaScript origins.
6. Não crie nem cole Client Secret no front-end. O Client ID pode ser público.
7. Adicione o Client ID em Ajustes dentro do app.
8. Em fase de teste, adicione seu próprio Gmail como usuário de teste na tela de consentimento.
9. Autorize os escopos `gmail.readonly` e `gmail.modify`.

## Hospedar sem Mac
Você pode publicar estes arquivos por um serviço de hospedagem estática que aceite upload pelo navegador do iPhone. A hospedagem precisa fornecer HTTPS e domínio/origem estável. Configure essa origem no OAuth.

## Instalar no iPhone
1. Abra a URL HTTPS no Safari.
2. Toque em Compartilhar.
3. Escolha Adicionar à Tela de Início.
4. Abra pelo novo ícone.

## Segurança e privacidade
- Nunca peça senha Google; use somente OAuth oficial.
- O token de acesso fica apenas em memória nesta implementação e expira; conecte novamente quando necessário.
- A leitura percorre mensagens da conta (exceto Spam/Lixeira por padrão), o que pode ser demorado e sujeito a limites da Gmail API.
- A classificação é feita localmente no dispositivo.
- O usuário precisa selecionar mensagens e confirmar antes da chamada `messages/{id}/trash`.
- Não há exclusão permanente implementada.
- Antes de publicar para terceiros, adicione política de privacidade, consentimento claro, tratamento robusto de tokens, testes de segurança e revisão de escopos.
