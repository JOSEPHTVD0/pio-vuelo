# 🔥 Firebase en Pío Vuelo

La nube es **opcional**. Si `js/firebase-config.js` tiene `enabled: false`, el
juego funciona exactamente igual que antes: guarda en `localStorage` y no hace
ninguna petición de red.

Con Firebase activado se añaden cuatro cosas:

| Función | Servicio | Colección / ruta |
|---|---|---|
| Perfil y progreso | Firestore | `players/{uid}` |
| Historial de vuelos | Firestore | `players/{uid}/runs/{runId}` |
| Ranking global | Firestore | `leaderboards/global/entries/{uid}` |
| Ranking en vivo | Realtime Database | `leaderboard_live/global/{uid}` |
| Presencia (conectado) | Realtime Database | `presence/{uid}` |
| Duelos por código | Realtime Database | `duels/{code}` |
| Catálogo, temporadas, semilla diaria | Firestore (solo lectura) | `catalog`, `seasons`, `dailyChallenges` |

---

## 0. Estado actual (proyecto ya creado)

El proyecto **`pio-vuelo`** ya existe y está conectado:

| Recurso | Estado |
|---|---|
| Firestore `(default)` | Creado en `us-central1`, catálogo cargado (515 documentos) |
| Realtime Database | `pio-vuelo-default-rtdb` en `us-central1` |
| Authentication | Proveedor **Anónimo** activo |
| App web | `PIO VUELO Web`, configuración en `js/firebase-config.js` |
| Reglas e índices | Desplegados con `npm run firebase:deploy` |

Con esto el juego ya sincroniza perfil, ranking, presencia y duelos. Los pasos
1 a 4 quedan como referencia por si algún día creas otro proyecto o necesitas
volver a cargar el catálogo.

---

## 1. Crear el proyecto (referencia)

1. Entra en <https://console.firebase.google.com> y pulsa **Crear proyecto**.
2. Nombre sugerido: `pio-vuelo`. Puedes desactivar Google Analytics.
3. Cuando termine, abre **Compilación → Authentication → Comenzar** y activa el
   proveedor **Anónimo**. Es el único que necesita el juego: no pide correo,
   contraseña ni datos personales.
4. Abre **Compilación → Firestore Database → Crear base de datos**.
   Elige **modo de producción** y una ubicación cercana (por ejemplo
   `southamerica-east1` o `us-central1`).
5. Abre **Compilación → Realtime Database → Crear base de datos**.
   Elige también **modo bloqueado** (las reglas del repo abren solo lo necesario).
6. En **Descripción general → Tus apps**, pulsa el icono **Web `</>`**,
   registra la app (por ejemplo `Pío Vuelo Web`) y copia el objeto
   `firebaseConfig`.

> No actives el plan Blaze hasta que lo necesites. El plan gratuito Spark
> incluye Firestore, Realtime Database y Authentication anónima con límites
> diarios más que suficientes para empezar.

---

## 2. Conectar el cliente

Abre `js/firebase-config.js` y sustituye los valores de ejemplo:

```js
window.PIO_FIREBASE = {
  enabled: true,                 // ← activa la nube
  sdkVersion: '11.0.2',
  config: {
    apiKey: 'AIza...',
    authDomain: 'pio-vuelo.firebaseapp.com',
    projectId: 'pio-vuelo',
    storageBucket: 'pio-vuelo.firebasestorage.app',
    messagingSenderId: '1234567890',
    appId: '1:1234567890:web:abcdef123456',
    databaseURL: 'https://pio-vuelo-default-rtdb.firebaseio.com'
  },
  options: {
    board: 'global',
    presence: true,
    runs: true,
    heartbeatMs: 60000
  }
};
```

`databaseURL` aparece en **Realtime Database → Datos** (pestaña superior).
Si tu base está en otra región, la URL cambia (por ejemplo
`https://pio-vuelo-default-rtdb.europe-west1.firebasedatabase.app`).

> La `apiKey` web **no es un secreto**: está pensada para ir en el navegador.
> Lo que protege los datos son las reglas. Nunca pongas aquí una cuenta de
> servicio (`serviceAccount.json`).

> **Service worker:** si ya habías abierto el juego antes de activar Firebase,
> sube el número de `CACHE` en `sw.js` (por ejemplo `piovuelo-v24`) para que el
> navegador descarte la copia antigua de `firebase-config.js`.

---

## 3. Desplegar reglas e índices

Instala la CLI una sola vez:

```powershell
npm install -g firebase-tools
firebase login
```

Comprueba que `.firebaserc` apunta a tu proyecto (por defecto `pio-vuelo`):

```powershell
firebase use --add        # elige tu proyecto y ponle el alias "default"
```

Despliega:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,database
```

También puedes hacerlo desde el repo con:

```powershell
npm run firebase:deploy
```

### Probar las reglas sin tocar producción

```powershell
npm run test:rules
```

Levanta los emuladores de Firestore, Realtime Database y Authentication en el
proyecto de demostración `demo-pio-vuelo`, ejecuta **26 comprobaciones** con el
SDK real del cliente (no con Admin) y los apaga al terminar. No necesita cuenta
ni credenciales de Firebase. Si no tienes la CLI instalada globalmente, el
equivalente es:

```powershell
npx --yes firebase-tools@13 emulators:exec --only firestore,database,auth `
  --project demo-pio-vuelo "node tools/firebase-rules-test.js"
```

---

## 4. Cargar catálogo y temporadas

El catálogo sale del **mismo** `js/data.js` que usa el juego, así no hay dos
listas que se puedan desincronizar.

```powershell
npm install
$env:FIREBASE_SERVICE_ACCOUNT = 'C:\ruta\a\serviceAccount.json'
$env:FIREBASE_DATABASE_URL    = 'https://pio-vuelo-default-rtdb.firebaseio.com'
npm run firebase:seed
```

Para añadir 12 récords de ejemplo y que el ranking no salga vacío:

```powershell
npm run firebase:seed:demo
```

La cuenta de servicio se descarga en **Configuración del proyecto → Cuentas de
servicio → Generar nueva clave privada**. Guárdala fuera del repo: `.gitignore`
ya bloquea `*serviceAccount*.json`.

### Alternativa: emuladores (sin crear nada en la nube)

```powershell
firebase emulators:start
# en otra terminal
npm run firebase:seed:emulator
```

Con los emuladores, en `js/firebase-config.js` usa el proyecto `pio-vuelo` y
añade `connectFirestoreEmulator`/`connectDatabaseEmulator`. La forma más
sencilla es ejecutar el juego contra el emulador con la CLI:

```powershell
firebase emulators:start --import=./.firebase-data --export-on-exit
```

---

## 5. Modelo de datos

### Firestore

#### `players/{uid}` (privado: solo su dueño)

```json
{
  "uid": "abc123",
  "name": "JugadorFenix482",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>",
  "level": 12,
  "xp": 340,
  "coins": 1250,
  "parts": 8,
  "shields": 2,
  "best": 87,
  "flights": 64,
  "pipes": 912,
  "distance": 18400,
  "coinsGot": 2100,
  "timePlayed": 5400,
  "equipped": { "skin": "classic", "hat": "", "fx": "fx-none", "map": "day" },
  "schema": 1,
  "app": "3.1"
}
```

#### `players/{uid}/runs/{runId}` (privado e inmutable)

```json
{
  "score": 42,
  "pipes": 42,
  "coins": 18,
  "dist": 640,
  "mode": "free",
  "seed": 123456789,
  "createdAt": "<serverTimestamp>",
  "verified": false
}
```

Modos válidos: `free`, `zen`, `boss`, `wind`, `challenge`, `duel`, `replay`.

#### `leaderboards/{boardId}/entries/{uid}` (lectura pública)

```json
{
  "uid": "abc123",
  "name": "JugadorFenix482",
  "best": 87,
  "last": 42,
  "games": 64,
  "level": 12,
  "updatedAt": "<serverTimestamp>"
}
```

`boardId` recomendados:

- `global`
- `daily-2026-10-30`
- `season-2026-autumn`
- `mode-free`, `mode-zen`, `mode-boss`

El cliente usa `options.board` para el tablero principal.

#### `catalog/{type}/items/{itemId}` (solo lectura)

Tipos sembrados: `skins`, `hats`, `effects`, `maps`, `tools`, `achievements`,
`missions`, `eggs`, `decor`, `difficulties`.

#### `seasons/{seasonKey}` y `seasons/current` (solo lectura)

Incluye los 14 niveles del pase gratuito, los 14 del prémium y las recompensas
de temporada.

#### `dailyChallenges/{YYYY-MM-DD}` (solo lectura)

```json
{
  "date": "2026-10-30",
  "seed": 1938475621,
  "mode": "challenge",
  "target": 30,
  "active": true
}
```

La semilla es estable por fecha, así todos los jugadores vuelan la misma
semilla sin necesidad de escribir en Firestore.

#### `config/app` (solo lectura)

Versión mínima, mantenimiento y banderas de funciones.

### Realtime Database

```text
presence/{uid}                     { name, level, online, lastSeen, board, best }
leaderboard_live/{board}/{uid}     { name, best, updatedAt }
duels/{CODE}                       { code, seed, state, createdAt, updatedAt,
                                     host: { uid, name, score },
                                     guest: { uid, name, score } | null }
```

Estados de duelo: `waiting`, `playing`, `finished`.

---

## 6. Reglas de seguridad

- `players/**` y `runs/**`: solo el UID autenticado puede leer y escribir.
- `leaderboards/**/entries/{uid}`: lectura pública; escritura solo de la propia
  entrada y con `best`/`games` no decrecientes.
- `catalog`, `seasons`, `dailyChallenges`, `config`: lectura pública y escritura
  denegada (solo Admin SDK / consola).
- `presence/{uid}` y `leaderboard_live/{board}/{uid}`: escritura solo del propio
  UID.
- `duels/{code}`: solo el anfitrión o el invitado pueden modificarlo.
- Cualquier ruta no listada queda denegada.

Puedes probar las reglas con el emulador:

```powershell
firebase emulators:start --only firestore,database,auth
```

---

## 7. Qué hace `js/cloud.js`

- Carga el SDK modular **solo** si `enabled: true`.
- Inicia sesión anónima y crea/actualiza `players/{uid}`.
- Engancha `SAVE.endRun` y `SAVE.rename` sin tocar la lógica del juego.
- Sube cada vuelo a `players/{uid}/runs` y actualiza el ranking.
- Mantiene una cola local (`piovuelo_cloud_queue`) para vuelos sin conexión.
- Publica presencia y ranking en vivo en Realtime Database.
- Expone `window.CLOUD` para la interfaz:

```js
await CLOUD.init();
const top = await CLOUD.leaderboard('global', 25);
CLOUD.watchLeaderboard('global', rows => console.log(rows));
const code = await CLOUD.createDuel();
await CLOUD.joinDuel(code);
CLOUD.watchDuel(code, duel => console.log(duel));
```

La pantalla **RÉCORDS** muestra automáticamente el ranking global cuando la
nube está configurada; si no, sigue mostrando el ranking local.

Comportamiento online:

- Solo se consultan y publican entradas con `best > 0`; las entradas vacías se
  filtran para no ensuciar la tabla.
- El top se guarda en `localStorage` bajo `piovuelo_cloud_board_v1` y se muestra
  como “última tabla” si falla la red.
- Si el navegador está offline se evita lanzar la consulta, se muestra la caché
  y el botón **Reintentar** vuelve a conectar.
- `CLOUD.retry()` reinicia la sesión tras un fallo; `CLOUD.cachedLeaderboard()` y
  `CLOUD.cachedLeaderboardAt()` exponen la caché a la interfaz.

---

## 8. Privacidad y límites

- La autenticación es anónima: Firebase genera un UID aleatorio. No se pide
  correo, teléfono ni nombre real.
- El nombre visible lo elige el jugador y se puede repetir. Si más adelante
  quieres nombres únicos, añade una colección `usernames/{slug}` con una
  transacción.
- El progreso local sigue siendo la fuente de verdad. Si borras los datos del
  sitio, se pierde el UID anónimo y el vínculo con la nube; el juego empieza de
  cero salvo que importes una copia JSON.
- Firestore y Realtime Database tienen cuotas gratuitas diarias. Revisa
  **Uso y facturación** antes de abrir el juego a muchos jugadores.
- No se guardan datos de pago: el Pase Prémium se compra con monedas del juego.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `auth/operation-not-allowed` | Falta activar Anónimo | Authentication → Sign-in method → Anónimo |
| `permission-denied` al leer el ranking | Reglas sin desplegar | `firebase deploy --only firestore:rules` |
| `database/permission-denied` | Reglas RTDB sin desplegar | `firebase deploy --only database` |
| El ranking sale vacío | No hay entradas o falta el índice | Ejecuta `firebase:seed:demo` y revisa los índices |
| `Firebase no está conectado` | `enabled: false` o config incompleta | Revisa `js/firebase-config.js` |
| La consola muestra error de importación | SDK bloqueado por la red | El juego sigue offline; revisa `sdkVersion` o el CSP |
| `Missing or insufficient permissions` al crear perfil | El documento no cumple `firestore.rules` | Revisa que `schema` sea `1` y el nombre tenga 2–16 caracteres |

---

## 10. Próximos pasos opcionales

- **Nombres únicos:** transacción sobre `usernames/{slug}`.
- **Anti-cheat:** validar los vuelos con una Cloud Function y marcar
  `verified: true`; el ranking puede filtrar solo verificados.
- **Cloud Functions:** recalcular `best` y limpiar la cola de vuelos.
- **App Check:** proteger Firestore/RTDB frente a clientes no oficiales.
- **Cuentas reales:** enlazar el usuario anónimo con Google/Apple para que el
  progreso viaje entre dispositivos.
