# CKV Bot - WhatsApp Bot

Bot para WhatsApp con comandos de descargas, administración, diversión y más.

## Requisitos

- **Node.js 20+**
- **Git**
- **ffmpeg** (para stickers y conversión a mp4)
- **yt-dlp** (para descargas de YouTube/Spotify/TikTok)

## Instalación Local

```bash
git clone https://github.com/imndrugs/xybwp.git
cd xybwp
npm install
cp .env.example .env    # y rellena tus claves
```

## Variables de entorno

Copia `.env.example` a `.env`:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `RAPIDAPI_KEY` | no | RapidAPI para CURP y utilidades |
| `SOCIALKIT_KEY` | no | SocialKit para TikTok/Instagram |
| `OWNER_ID` | no | Números owner extra, separados por coma |
| `PORT` | no | Puerto del healthcheck HTTP (3000) |
| `LOG_LEVEL` | no | Log de Baileys: `silent`, `error`, `warn`, `info` |
| `AUTO_UPDATE_YTDLP` | no | `true` para actualizar yt-dlp al conectar |

## Railway

Despliega el repositorio con el `Dockerfile` y genera un dominio público en
**Settings → Networking**. Railway proporciona `PORT` y `RAILWAY_PUBLIC_DOMAIN`;
no necesitas definirlos manualmente. Para iniciar WhatsApp no hace falta ninguna
API key: `RAPIDAPI_KEY` (CURP/utilidades) y `SOCIALKIT_KEY` (TikTok/Instagram)
son opcionales, y debes pegar en Railway tus propias claves emitidas por esos
servicios si quieres usar esas funciones. `OWNER_ID` también es opcional.

En el primer arranque, abre el enlace `/qr/...` que aparece en los logs de Railway:
se mostrará directamente la imagen del QR y dejará de imprimirse en la consola.
El enlace solo funciona mientras haya un QR pendiente. Añade un volumen Railway
montado en `/app/sessions` para conservar la sesión de WhatsApp entre despliegues.

> ## ⚠️ Rotar claves (urgente)
>
> `RAPIDAPI_KEY` y `SOCIALKIT_KEY` estuvieron commiteadas en `.env` y **siguen
> visibles en el historial de git**. Quitarlas del árbol no basta si el
> repositorio es público.
>
> **Haz esto antes de deployar:**
> 1. Genera claves nuevas en RapidAPI y en SocialKit.
> 2. Pon las nuevas en tu `.env` local y en las variables de Railway.
> 3. Purga el historial:
>    ```bash
>    git filter-repo --invert-paths --path .env
>    git push --force --all
>    ```
>    (ver <https://github.com/newren/git-filter-repo>)

## Ejecutar

```bash
# 1. Genera el QR y guarda la sesión en sessions/
npm run login

# 2. Arranca el bot
npm start
```

Al arrancar sin sesión, el bot imprime el **QR en la terminal** y además lo
guarda como **`qr.png`** en la raíz del proyecto (se borra solo al conectar).
El QR se genera localmente: no se manda a ningún servicio externo.

El `qr.png` es lo más cómodo si escaneas desde la PC — ábrelo con doble clic
y escanéalo con el celular. En el celular:

**Ajustes → Dispositivos vinculados → Vincular un dispositivo**, y busca el
dispositivo en la lista.

## Estructura

```
src/
  index.js            # Entry point: conexión, reconexión, dispatch
  config/env.js       # Carga .env (debe importarse primero)
  commands/           # Un archivo por comando
  lib/
    guard.js          # requireStaff / requireGroupStaff
    perms.js          # Owners, admins, bans
    roles.js          # Sistema de roles
    serialize.js      # Normaliza mensajes de Baileys
    store.js          # Persistencia atómica de database.json
    ytdlp.js          # Wrapper de yt-dlp/ffmpeg (sin shell)
    socialkit.js      # Cliente de SocialKit
    sticker.js        # Sticker con wa-sticker-formatter
    gif.js            # Gif anime
database.json         # Datos persistentes (admins, bans, config)
sessions/             # Credenciales de WhatsApp (NO versionar)
```

## Comandos principales

| Categoría | Comandos |
|-----------|----------|
| Interactivos | `.hi`, `.love`, `.dado`, `.ppt`, `.encuesta` |
| Staff | `.makeowner`, `.deladmin`, `.setadmin`, `.bc`, `.restart`, `.savedata` |
| Admin | `.promote`, `.demote`, `.kick`, `.mute`, `.antilink`, `.group` |
| Descargas | `.tt`, `.ig`, `.play`, `.ytmp3`, `.spotify`, `.facebook`, `.mediafire` |
| Utilidades | `.ping`, `.translate`, `.wiki`, `.anime`, `.sticker`, `.s`, `.wm`, `.img`, `.globo` |

Prefijos: `.` `!` `xyb`

## Permisos

- **Owner** — hardcodeados en `src/lib/perms.js` + los de `OWNER_ID`.
- **Admin del bot** — añadidos con `.setadmin`, se guardan en `database.json`.
- **Admin del grupo** — para `.group`, `.setdesc`, `.invite`, `.link`,
  `.linkrevoke` hace falta ser owner/admin del bot **y** admin del grupo.
- `.ytcookies`, `.igcookies`, `.join`, `.everyone`, `.n`, `.altera`, `.kira`
  requieren owner o admin del bot.

`.mode private` deja el bot en modo restringido: solo owners y admins ejecutan
comandos.

## Cookies de YouTube / Instagram

Si `yt-dlp` devuelve error de login/bloqueo:

1. Chrome > extensión **Get cookies.txt LOCALLY**
2. Inicia sesión en youtube.com / instagram.com
3. Exporta las cookies
4. Envía el `.txt` al chat del bot y responde `.ytcookies` / `.igcookies`

Las cookies se guardan en `src/youtube_cookies.txt` e
`src/instagram_cookies.txt` (ambas fuera de git) con permisos `0600`.

## Visual Studio Code

Abrí la carpeta y VS Code detecta `src/index.js` como entry point.

**Tasks** (`Ctrl+Shift+B` o *Terminal → Run Task*):

| Task | Qué hace |
|------|----------|
| ▶ Iniciar bot | `npm start` (es la default, F5 no, usa Ctrl+Shift+B) |
| 🔑 Login (QR nuevo) | `npm run login` |
| 🧹 Limpiar sesiones y procesos | mata node, borra `sessions/`, `qr.png`, `temp/` |
| 🧪 Correr tests | los 56 tests |

**Depuración** (F5):

| Configuración | Para qué |
|---------------|----------|
| Iniciar bot | depura `src/index.js` |
| Debug comando | depura el archivo que tengas abierto |
| Tests | depura la suite |

Extensiones recomendadas: Error Lens, Prettier, ESLint, Path Intellisense. Se
instalan solas la primera vez que abres el proyecto.

## Requisitos del sistema

Además de Node 20+:

| Programa | Para qué | Sin él |
|----------|----------|--------|
| **ffmpeg** | `.sticker` de videos, `.img`, `.globo`, gifs | fallan |
| **yt-dlp** | `.play`, `.ytmp3`, `.spotify`, `.tt` | fallan |

En Windows se instalan con:

```powershell
winget install --id Gyan.FFmpeg -e
# yt-dlp
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\Programs\yt-dlp"
Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "$env:LOCALAPPDATA\Programs\yt-dlp\yt-dlp.exe"
```

Después **reinicia la terminal** (o VS Code) para que los tome el PATH.

En Linux:

```bash
sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

Para comprobar que todo está:

```bash
ffmpeg -version
yt-dlp --version
npm test
```

## Despliegue en Railway

1. [Railway](https://railway.app) → Nuevo proyecto → Deploy desde GitHub →
   `imndrugs/xybwp`
2. Variables de entorno: `RAPIDAPI_KEY`, `SOCIALKIT_KEY`, `OWNER_ID` (opcional)
3. Railway detecta el `Dockerfile` automáticamente

El `Dockerfile` incluye ffmpeg, yt-dlp (con checksum), python3, git,
`dumb-init` como PID 1 y healthcheck en `PORT` (3000).

### ⚠️ Sesión de WhatsApp en Railway

La sesión vive en `sessions/`, que **no se versiona**. Sin volumen persistente,
cada redeploy pide QR nuevo. Opciones:

- Montar un volumen en `/app/sessions`.
- O usar un flujo de pairing por código.

### Railway: comandos de mantenimiento

```bash
railway variables --set "RAPIDAPI_KEY=..." --set "SOCIALKIT_KEY=..."
railway up        # build manual
```

## La sesión no se guarda / pide QR siempre

Diagnostica:

```bash
npm run session
```

Imprime si `sessions/creds.json` existe y si la sesión está registrada.

| Lo que ves | Qué significa | Solución |
|------------|---------------|----------|
| `❌ creds.json AUSENTE` | El login nunca se completó | `npm run login` y **espera a ver "✅ Conectado"** |
| `⚠️ La sesión NO está registrada` | Hay credenciales pero sin login | `npm run login` otra vez |
| `❌ creds.json está CORRUPTO` | Se cortó al escribir | Borra `sessions/` y repite el login |
| `✅ Sesión válida` | Todo bien | `npm start` |

### Por qué antes perdía la sesión

Tres causas, ya corregidas:

1. **`login.js` hacía `process.exit(0)` justo tras conectar.** `saveCreds()`
   escribe `creds.json` de forma asíncrona; si el proceso moría antes de
   terminar, el archivo no existía. Ahora fuerza el guardado, lo verifica e
   imprime si se guardó.
2. **El bot borraba las credenciales tras 8 reintentos fallidos.** Con un
   corte de internet momentáneo, eso destruía una sesión perfectamente válida
   y el siguiente arranque pedía QR. Ahora espera indefinidamente y solo borra
   si WhatsApp revoca la sesión (401).
3. **`SESSION_DIR` usaba `process.cwd()`.** Si arrancabas el bot desde otra
   carpeta, buscaba la sesión en otro sitio y parecía perdida. Ahora está anclado
   a la raíz del proyecto.

### La sesión se pierde a propósito cuando

- **401** — desvinculaste el dispositivo desde el celular (Ajustes →
  Dispositivos vinculados → tocar el bot → *Desvincular*).
- **Borraste `sessions/`** — incluido `npm run clean -- --yes`.

Para que NO se borre nunca ante una revocación, pon esto en `.env`:

```
AUTO_RESET_SESSION=false
```

## Problemas frecuentes

### "Conexión cerrada (code: 515)"

**No es un baneo.** El 515 en Baileys es `restartRequired` — WhatsApp pide
reiniciar el socket. `npm run login` ahora reintenta solo hasta 40 veces y te
genera un QR nuevo cada vez, así que solo tienes que esperar a que te salga uno
que puedas escanear dentro de los ~30s que dura.

Si aun así insiste en bucle, casi siempre es que la versión de Baileys que
descarga de `master` ya no la acepta WhatsApp. Fíjala en `.env`:

```
BAILEYS_VERSION=2.3000.1028694800
```

Para ver la versión que corresponde a tu `node_modules`:

```bash
node -e "console.log(require('@whiskeysockets/baileys/package.json').version)"
```

Si se repite en bucle, suele haber sesiones viejas o procesos colgados:

```bash
npm run clean              # muestra qué encontró
npm run clean -- --yes     # mata procesos, borra sessions/, qr.png y temp/
npm run login              # QR nuevo
```

| Código | Significado | Qué hace el bot |
|--------|-------------|-----------------|
| 401 | Sesión revocada | Borra sesiones y sale (pide QR nuevo) |
| 403 | Baneo real | Sale, no reintenta |
| 428 | Conexión cerrada | Reconecta |
| 440 | Conexión reemplazada | Reconecta |
| 500 | Credenciales corruptas | Regenera la sesión |
| 515 | `restartRequired` | Reconecta con backoff |

Si tras 8 reintentos seguidos sigue fallando, el bot borra la sesión solo y
pide un QR nuevo.

### El QR no aparece o está desactualizado

`qr.png` se borra solo al conectar. Si quedó uno viejo, `npm run clean -- --yes`
lo elimina.

### "Puerto 3000 ya en uso"

Otro proceso del bot sigue vivo:

```bash
npm run clean -- --yes    # lo detecta y lo mata
```

## Notas de operación

- `database.json` se escribe de forma **atómica** (archivo temporal + rename)
  y con debounce de 1.5 s, así no se corrompe con escrituras concurrentes.
- Si `database.json` llega corrupto, el bot lo renombra a `database.json.bak`
  y arranca con la configuración por defecto.
- La reconexión usa **backoff exponencial con jitter**. Si WhatsApp revoca la
  sesión (401) o banea la cuenta (515), el proceso sale en lugar de reintentar
  en bucle.
- El healthcheck devuelve `200` solo cuando el bot está conectado a WhatsApp.

## Aviso

El uso de este bot es responsabilidad del usuario. WhatsApp banea cuentas que
hacen spam o abusan de la API. Los comandos de mención masiva y de cookies son
los que más riesgo de baneo traen; por eso están restringidos a owner/admin y
tienen cooldown.