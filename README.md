# Pokédex TCG BR

Sistema de gestão de portfólio para colecionadores de Pokémon TCG no Brasil.
O app usa catálogo local em PT-BR, autenticação Firebase, Firestore para a
coleção do usuário e uma Cloud Function para consultar/cachar preços da Liga
Pokémon por 44 horas.

## Stack

- React + Vite + TypeScript
- Firebase Auth
- Firestore
- Cloud Functions Node.js
- Scraping backend com `cheerio`

## Rodando localmente

```bash
npm install
npm --prefix functions install
cp .env.example .env.local
npm run dev
```

Sem variáveis Firebase preenchidas, o app entra em modo demo e persiste as
cartas no `localStorage`. Com Firebase configurado, ele usa Auth, Firestore e a
Function `getCardMarketPrice`.

Se aparecer `Missing or insufficient permissions`, as regras do Firestore ainda
não foram publicadas no projeto selecionado:

```bash
firebase use <project-id>
firebase deploy --only firestore:rules
```

Para usar os emuladores, defina `VITE_USE_FIREBASE_EMULATORS=true` em
`.env.local` e rode, em terminais separados:

```bash
npm run emulators
npm run dev
```

## Variáveis

Preencha `.env.local` com os dados do app web Firebase:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_FUNCTIONS_REGION=southamerica-east1
```

## Modelo Firestore

- `users/{uid}`: perfil básico do usuário.
- `users/{uid}/cards/{cardId}`: cartas salvas na coleção.
- `priceCache/{cardId}`: última cotação, variantes de preço e expiração.

O frontend lê `priceCache` primeiro. Se a cotação estiver vencida ou ausente, a
Cloud Function consulta a Liga Pokémon, atualiza o cache e retorna o valor.
Ao adicionar uma carta, ou ao abrir os detalhes de uma carta já salva que ainda
não tenha cotação fresca, o app grava a `priceQuote` também em
`users/{uid}/cards/{cardId}` para reutilizar o preço salvo antes de chamar a API.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run pwa:icons
npm run emulators
firebase deploy --only hosting,functions,firestore
```

## Instalação no celular

O app está configurado como PWA. Depois de publicar em HTTPS, o Android/Chrome
mostra a opção de instalação e o iPhone/Safari permite adicionar o app à Tela de
Início pelo menu de compartilhamento. Ao abrir pelo ícone instalado, ele roda em
modo standalone, com ícone próprio e cache básico para carregar a interface.

## Catálogo

O catálogo local fica em `public/catalog`: `sets.json` lista as coleções e
`sets/{id}.json` guarda as cartas de cada coleção. A base atual foi gerada com
194 coleções, usando dados em português quando disponíveis e completando com o
catálogo em inglês para coleções ainda sem tradução.

Para sincronizar novamente:

```bash
npm run catalog:sync
```

O app lê esses arquivos locais na interface. Ao adicionar uma carta, ele tenta
hidratar os detalhes pela TCGdex para salvar HP, tipo, raridade e ataques no
documento do usuário.
