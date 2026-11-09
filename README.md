# OmniPlay Mobile — React Native + TypeScript (Expo)

Aplicação mobile oficial do **OmniPlay** construída em **React Native + TypeScript** com **Expo**, pronta para **iOS** e **Android** (sem precisar de um Mac para testar ou jogar no iPhone) e ligada em tempo real à mesma base de dados **Supabase** do site.

---

## ✨ Funcionalidades Incluídas

- **100% Compatível com o Site (Cross-Play Web + Mobile):**
  - Ligação direta ao mesmo servidor **Supabase** (`https://phxzjlcqwbhmvpjodmjh.supabase.co`).
  - As salas online (`omni-room-XXXX`), a presença online (`omni-hub`), os convites em tempo real, as amizades e o ranking global são partilhados entre quem está na aplicação mobile (iOS/Android) e quem está no navegador!
- **Design & Animações Nativas:**
  - Fundo animado (`StarfieldBackground`) com estrelas e nebulosas néon.
  - **Mesa de Casino / Néon Central (`MexicanaBoard`)** com feltro verde-esmeralda, aro dourado/ciano, pilha de baralho 3D e monte de descarte com sombras.
  - **Animações sincronizadas em tempo real (`Animated`):**
    - Voo de cartas da mão ou do jogador adversário até ao monte central.
    - Explosão de fogo, ondas de choque (`Shockwave`) e partículas quando a mesa é limpa (`10`, `Joker` ou 4 cartas iguais).
    - Carimbo animado (`🚫 BLOQUEADO!`, `🔥 MESA LIMPA!`, `👁️ ESPIAR`, `🔄 RESET`, `⬇️ <= 7`) sobre a mesa e os lugares dos jogadores.
    - Viragem 3D (`Blind Card Flip`) ao jogar uma carta das cegas.
- **Hub, Amigos, Ranking & Perfil:**
  - Login / Registo (`@utilizador` + palavra-passe), edição de avatar/cor/moldura, roleta de escolha de jogo, pesquisa de amigos, estatísticas Frente-a-Frente (`H2H`) e convites diretos com 1 toque.

---

## 🚀 Como Correr no Windows (iOS & Android via Expo Go)

Não precisas de um Mac para correr a aplicação no iOS! Segue estes passos:

### 1. Instalar a aplicação **Expo Go** no telemóvel
- **iPhone / iPad (iOS):** Abre a **App Store** e instala o **Expo Go**.
- **Android:** Abre a **Google Play Store** e instala o **Expo Go**.

### 2. Instalar as dependências no computador (Windows)
Abre o terminal (PowerShell ou CMD) dentro da pasta `Omniplay (React)`:

```powershell
cd "Omniplay (React)"
npm install
```

### 3. Iniciar o servidor Expo
```powershell
npx expo start
```
*(Se o teu PC e o telemóvel estiverem em redes diferentes ou se a firewall bloquear a ligação local, usa `npx expo start --tunnel`)*

### 4. Abrir no Telemóvel
- **No iPhone (iOS):** Abre a aplicação **Câmara** normal do iPhone, aponta para o **código QR** que aparece no terminal e toca na notificação **"Abrir no Expo Go"**.
- **No Android:** Abre a aplicação **Expo Go**, toca em **"Scan QR code"** e lê o código QR do terminal.

---

## 📁 Estrutura do Projeto (`Omniplay (React)`)

```text
Omniplay (React)/
├── App.tsx                         # Navegação principal, Topbar, Banner de Convites e Toast
├── app.json                        # Configuração do Expo (iOS & Android)
├── package.json                    # Dependências (Expo SDK 52, React Native, Supabase, TypeScript)
├── tsconfig.json                   # Configuração TypeScript
├── babel.config.js                 # Configuração Babel para Expo
└── src/
    ├── config.ts                   # Credenciais Supabase (URL + Anon Key)
    ├── theme.ts                    # Paleta de cores, avatares, molduras, níveis e utilitários
    ├── services/
    │   ├── storage.ts              # Cache síncrona + persistência AsyncStorage
    │   ├── backend.ts              # Autenticação, Perfil, Amigos, Ranking, Presença e Convites Realtime
    │   └── session.ts              # Salas Online (omni-room-XXXX) e Sessão Local / Passa-o-Telemóvel
    ├── games/
    │   └── mexicanaEngine.ts       # Motor completo da Mexicana (56 cartas, poderes, cegas, eventos de animação)
    ├── components/
    │   ├── StarfieldBackground.tsx # Fundo espacial animado
    │   ├── AvatarView.tsx          # Componente de avatar com moldura e estado online
    │   ├── AuthModal.tsx           # Modal de Login e Criar Conta
    │   └── MexicanaBoard.tsx       # Mesa de Casino animada, voo de cartas, ondas de choque e partículas
    └── screens/
        ├── HubScreen.tsx           # Ecrã Principal (Hub, Ranking Global e Perfil)
        ├── MexicanaScreen.tsx      # Setup Online/Local, Lobby Online com Convites e Jogo Ativo
        └── FriendsScreen.tsx       # Gestão de Amigos, Pedidos, Pesquisa e Frente-a-Frente (H2H)
```

