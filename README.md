# Pío Vuelo 3.1

Juego arcade de un pájaro que vuela entre tubos, con monedas, power-ups, tienda, misiones, récords y progresión. Funciona como aplicación web instalable (PWA) y también como APK Android mediante WebView.

## 🎮 Jugar online

**https://josephtvd0.github.io/pio-vuelo/**

El juego se publica automáticamente con GitHub Pages desde la rama `main`.

## 🏆 Récords online

La pantalla **Récords** muestra primero el ranking online real y debajo la tabla
local del dispositivo:

- El ranking global usa **Firestore** (`leaderboards/global/entries`) con una
  sesión anónima de Firebase. Solo se publican **nombre, nivel y mejor marca**;
  el progreso completo sigue guardado en `localStorage`.
- Solo aparecen marcas con **más de 0 puntos**, para que la tabla no se llene de
  entradas vacías al abrir el juego.
- Si no hay red, el juego sigue funcionando y muestra la **última tabla
  guardada** en caché. El botón **Reintentar** vuelve a conectar de verdad.
- Los vuelos que no se pueden subir se guardan en una cola local y se reintentan
  al recuperar la conexión.
- Si Firebase no está configurado o se pone `enabled: false`, la pantalla sigue
  mostrando el ranking local sin hacer ninguna petición de red.

## ☁️ Nube opcional (Firebase)

El juego sigue funcionando **sin conexión y sin cuentas** por defecto. Si quieres
ranking global, presencia, historial en la nube y duelos por código, hay una
capa opcional de Firebase (Firestore + Realtime Database) ya preparada:

- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` y
  `database.rules.json`: configuración, seguridad e índices.
- `js/firebase-config.js`: credenciales del cliente. En este proyecto está
  **activado**; con `enabled: false` el juego vuelve a ser 100 % local.
- `js/cloud.js`: sesión anónima, sincronización del perfil, vuelos, ranking,
  presencia y duelos. Si algo falla, el juego continúa offline.
- `firebase/seed.js`: carga el catálogo real de `js/data.js`, la temporada, la
  semilla diaria y récords de ejemplo.
- `docs/FIREBASE.md`: guía paso a paso (crear proyecto, reglas, emuladores,
  modelo de datos, solución de problemas).

Para activarla: crea el proyecto, pega la configuración en
`js/firebase-config.js`, pon `enabled: true` y despliega las reglas. La guía
completa está en [`docs/FIREBASE.md`](docs/FIREBASE.md).

## Características

- Vuelo con física de aleteo y dificultad progresiva.
- Modos libre, diario, duelo, zen, boss, viento y replay.
- Monedas, combos, power-ups, jefes y obstáculos.
- Tienda de aves, sombreros, estelas, herramientas y cajas.
- Misiones, pase de temporada, mapas y progreso.
- Perfil local con nombre editable y récord persistente.
- Clasificación local por dispositivo y ranking online opcional con Firebase.
- Sonido, efectos visuales y vibración opcional.
- PWA con caché offline mediante service worker.

## Novedades de la versión 3.1

- **Récords online reales:** ranking global con Firebase, sesión anónima y lectura pública. Solo se publican nombre, nivel y mejor marca; las entradas con 0 puntos se filtran.
- **Modo offline que no rompe el juego:** si falla la red se muestra la última tabla guardada, un estado claro de “Sin conexión” y un botón **Reintentar** que vuelve a conectar de verdad.
- **Caché y cola local:** el top del ranking se guarda en el dispositivo y los vuelos pendientes se reintentan al recuperar la conexión.
- **Service worker más seguro:** solo cachea archivos estáticos del propio juego; Firebase, gstatic y APIs externas van siempre a la red para no servir un ranking congelado.
- **Acceso directo:** **Récords** ocupa el acceso rápido de la portada y Estadísticas pasa a “Más”.

## Novedades de la versión 3.0

- **Pase Prémium por temporada:** segunda línea de 14 recompensas exclusivas que se desbloquea con **3000 🪙** del juego (sin pagos reales). Incluye 3 aves, 2 sombreros, 2 estelas, el mapa **Cielo Prémium** y la herramienta **Reliquia del Pase**. Al cambiar de estación hay que volver a comprarlo y las recompensas repetidas se convierten en 250 🪙.
- **Exclusividad real:** los artículos prémium nunca aparecen en la tienda ni salen en la Caja Sorpresa (tampoco en su variante dorada). Solo se obtienen reclamando la línea prémium.
- **Mapas con mecánicas propias:** cada escenario aplica velocidad, gravedad, tamaño de hueco, frecuencia de tubos, multiplicador de monedas y viento mediante `DAT.mapCfg()`. Cielo Prémium duplica monedas y activa rachas de viento; Glitch acelera y estrecha huecos; Dulcelandia multiplica monedas.
- **Música distinta por mapa:** el motor procedural elige progresión, timbre y bajo según la familia del escenario (día, noche, espacio, agua, fuego, hielo, dulce, bosque, synth y prémium).
- **Fondos con identidad:** ciudades con ventanas, bosques, volcanes, dunas, picos de hielo, agujas de cristal y auroras para el mapa prémium.
- **Generación segura:** las monedas y power-ups se recolocan o retiran si un tubo nuevo los invade, y las monedas cercanas a un tubo respetan su separación.
- **Logros con descripción:** la notificación superior muestra nombre, descripción y recompensa, con cola de una en una y auto-cierre.
- **Portada rediseñada:** billetera de monedas y piezas, avisos contextuales, tutorial de bienvenida, botón **Continuar**, accesos rápidos con contadores y resumen del nido.
- **Navegación consistente:** cada botón abre una pantalla real; las acciones importantes piden confirmación y las opciones no disponibles se muestran deshabilitadas con su motivo.
- **Ajustes funcionales:** volumen general, efectos y música, sensibilidad, límite de FPS, pantalla completa, notificaciones, animaciones de interfaz, confirmación de compras y restauración de valores. Todo se aplica al instante y persiste.
- **Herramientas con durabilidad:** cada uso consume stock y desgasta la herramienta. Una herramienta rota no se consume ni se pierde hasta repararla. Se puede mejorar hasta nivel 5 y la pantalla muestra la comparativa antes/después.
- **Inventario:** filtros por tipo, equipar aves/sombreros/estelas/mapas, estado y reparación de herramientas e historial reciente de compras, mejoras, reparaciones y roturas.
- **Estadísticas y ayuda:** métricas de vuelo, mejores marcas, guía de modos, herramientas, economía y guardado.
- **Economía centralizada y reequilibrada:** los precios de catálogo suben entre un 10 % y un 20 % una sola vez al cargar los datos. Las compras validan saldo y no pueden dejarlo negativo ni cobrar dos veces.
- **Piezas 🔩:** material persistente para mejoras de nivel alto. Se gana 1 por vuelo, +1 al alcanzar 20 puntos y +1 al batir el récord.
- **Copia de seguridad manual:** desde Ajustes → Datos puedes exportar el progreso a un archivo JSON e importarlo en otro navegador o tras borrar los datos. Antes de importar se guarda una copia del progreso anterior.
- **Reparación masiva:** el inventario permite reparar todas las herramientas dañadas de una vez, mostrando el coste total y cobrando solo las que se completen.

## Pase Prémium

- La línea gratuita y la prémium comparten la XP del jugador y sus 14 niveles.
- El Pase Prémium se compra por temporada (3000 🪙), se activa al instante y no caduca a mitad de temporada.
- Sus recompensas están marcadas con `exclusive: true` y nunca se venden en la tienda ni entran en cajas.
- Si ya posees una recompensa exclusiva, reclamarla de nuevo la convierte en 250 🪙 en lugar de duplicarla.
- Al cambiar la estación se reinician las reclamaciones y hay que desbloquear el pase de la nueva temporada.
- El catálogo prémium actual: `p-aurora`, `p-crono`, `p-sombra`, `hat-corona-eterna`, `hat-sello-estelar`, `fx-prisma`, `fx-supernova`, `premium` (mapa) y `tool-legend` (herramienta).
- La **Reliquia del Pase** es permanente: no consume stock al usarse, solo pierde durabilidad y se repara con monedas. Si vuelve a salir como recompensa, se convierte en 250 🪙 en lugar de acumular copias.

## Mapas y audio

- `DAT.MAP_CFG` define las mecánicas de cada mapa y `DAT.mapCfg(id)` devuelve una copia con valores por defecto seguros.
- La velocidad, gravedad, hueco, frecuencia de tubos, multiplicador de monedas y viento se aplican en `game.js` al iniciar cada vuelo.
- `SND.setMapTheme(id)` cambia la música procedural según el mapa; `SND.themeFor(id)` devuelve la familia sonora.
- Los fondos de `bg.js` añaden estructuras y partículas propias por escenario sin tapar tubos ni al ave.
- La herramienta `legend` (Reliquia del Pase) da +1 punto por tubo y +25 % de monedas durante toda la partida. Es permanente: no se gasta al usarla, pero sí se desgasta y hay que repararla.

## Economía de la Temporada 2026

Los precios se definen una sola vez en `DAT.ECONOMY` a partir de `basePrice` y se redondean a múltiplos de 5. Los tramos aplicados son ×1.10, ×1.13, ×1.16 y ×1.20 según el artículo, por lo que el conjunto queda en torno a un +10–20 % respecto a los valores anteriores.

- La Caja Sorpresa pasa de 500 a 580 monedas.
- Las mejoras de herramienta cuestan monedas y, desde el nivel 2→3, también piezas.
- La reparación cuesta una fracción del precio de la herramienta según la durabilidad que falte.
- Las compras, mejoras y reparaciones se registran en el historial y en las estadísticas.

## Herramientas y durabilidad

- Las herramientas automáticas se consumen al empezar el vuelo; las manuales se usan desde la bolsa del HUD.
- Cada uso resta 1 unidad de stock y desgasta la durabilidad. La durabilidad máxima base es 12 y sube +3 por nivel de mejora.
- El desgaste por uso baja con el nivel (`max(0.4, 1 − nivel × 0.1)`).
- A 0 de durabilidad la herramienta queda rota: no se gasta, no se borra y no se puede usar hasta repararla.
- Mejorar una herramienta aplica la nueva durabilidad máxima al momento; reparar cuesta monedas y no se permite si ya está completa.

## Escudos

- **Escudos guardados:** se compran o se obtienen en la tienda. Se acumulan sin tope, pero cada partida consume como máximo **1** al bloquear un choque. Si no se usan, siguen disponibles para otro vuelo.
- **Escudos de partida:** se recogen con el power-up 🛡️ durante el vuelo. Se acumulan solo en esa partida, se gastan antes que los guardados y desaparecen al terminar.
- Prioridad al recibir un golpe: escudo de partida → 1 escudo guardado → rescate/Flotador/Fénix → muerte.

## Cómo ejecutarlo

Abre `index.html` en un navegador moderno. Para probar la PWA y el service worker conviene usar un servidor local:

```powershell
node tools/test-server.js
```

Después abre `http://127.0.0.1:8123/`.

No hay dependencias de npm para jugar. Node solo se usa para las pruebas y el servidor local.

## Pruebas

```powershell
node tools/test-game.js
```

La suite ejecuta los scripts reales con DOM, canvas y `localStorage` simulados y comprueba tubos, objetos, cronómetros, escudos, identidad, récords, corrupción del guardado, reinicios, economía, durabilidad, piezas, ajustes persistentes, historial, migración de guardados antiguos, Pase Prémium, exclusividad en tienda y cajas, mecánicas de mapas, logros y temas de audio. Actualmente hay **369 pruebas** y todas deben pasar antes de publicar.

La configuración de Firebase también se valida sin red:

```powershell
npm run test:firebase
```

Comprueba que `firebase.json`, reglas, índices y la configuración del cliente
sean válidos, que `cloud.js` no tenga errores de sintaxis y que las credenciales
sean coherentes con el estado de `enabled`.

Las reglas de seguridad se prueban contra los emuladores (sin tocar la nube):

```powershell
npm run test:rules
```

También hay una prueba de humo en un navegador real (Chrome o Edge headless, sin dependencias npm):

```powershell
node tools/browser-smoke.js
```

Arranca el servidor local, juega una partida, pausa, compra el Pase Prémium,
reclama sus 14 recompensas y revisa tienda, mapas e inventario. Además comprueba
la conexión real con Firebase, la pantalla de récords online, un **corte de red
real** (sin conexión, caché y reintento) y que el juego sigue funcionando offline.
Actualmente son **35 comprobaciones** y no debe haber errores de JavaScript.
Requiere Chrome o Edge instalado; se puede indicar otro ejecutable con
`CHROME_PATH`. En un entorno sin red, `SKIP_ONLINE=1` omite solo el bloque online.

## Limitaciones conocidas

- El APK Android se recompila con `powershell -File android\build.ps1`. En esta máquina están disponibles JDK 17 (`C:\Program Files\Java\jdk-17`) y Android SDK (`C:\AndroidSDK`); `dist/PioVuelo.apk` se ha regenerado como **v3.1 (versionCode 31)** con el código actual: **7.022.958 bytes** y SHA-256 `B1479C4E5C87C57DD10768DDD0CCED9C14447C408121C8763E63732150460820`. No hay un dispositivo Android conectado por ADB, así que falta probar la instalación y apertura en un móvil real.
- La verificación incluye pruebas headless, comprobaciones HTTP, reglas con emuladores (26/26) y una prueba real en Chrome headless (`node tools/browser-smoke.js`, 35/35, incluido el modo offline). Aun así, conviene revisar la portada, el Pase Prémium, los mapas nuevos y el ranking online en un dispositivo Android real antes de darlos por cerrados.
- El ranking global solo muestra marcas con más de 0 puntos. Las entradas antiguas con 0 puntos que ya existan en Firestore no se muestran y no se pueden borrar desde el cliente porque las reglas lo impiden; para limpiarlas hace falta la consola de Firebase o el Admin SDK.
- La primera carga del ranking online necesita red. Si se abre sin conexión y nunca se ha visto la tabla, se muestra un aviso y se puede reintentar; el juego local no se bloquea.
- La música es procedural (WebAudio) y no usa archivos externos: suena distinta por familia de mapa, pero no son pistas grabadas. El audio requiere un gesto del usuario para desbloquearse en móvil.
- El Pase Prémium se paga con monedas del juego, no con dinero real; no hay pasarela de pago ni compras externas.
- El idioma está fijado en español y se muestra deshabilitado como “Español (único)”: no se simula un selector que no existe.
- El guardado es local al navegador o dispositivo. La nube es un espejo opcional: no hay cuentas con correo ni contraseña, y borrar los datos del sitio pierde el vínculo con el UID anónimo de Firebase.
- El autoguardado está siempre activo para evitar pérdidas: no se ofrece un interruptor que pudiera desactivarlo por accidente. La sincronización vertical y la resolución las controla el navegador o el dispositivo; el límite de FPS sí se aplica y se documenta esa limitación en Ajustes.

## Android

El APK se compila sin Gradle:

```powershell
powershell -File android\build.ps1
```

Requisitos en la máquina de compilación:

- JDK 17 o superior.
- Android SDK con `platforms;android-34` y `build-tools;34.0.0`.
- Ejecutar antes `powershell -File android\fetch-libs.ps1` para descargar las librerías de `android/libs` y `android/tools/r8.jar`.

Variables de entorno necesarias (defínelas en la consola antes de compilar):

```powershell
$env:JAVA_HOME    = 'C:\Program Files\Java\jdk-17'
$env:ANDROID_HOME = 'C:\AndroidSDK'
```

El SDK se instala en `C:\AndroidSDK` y no bajo el perfil de usuario porque la ruta del perfil contiene paréntesis (`C:\Users\PC-3 (ABANICO)`) y eso rompe los `.bat` de `sdkmanager`/`d8`. Para reinstalar paquetes del SDK:

```powershell
sdkmanager "platform-tools" "platforms/android-34" "build-tools/34.0.0"
```

Esos binarios, los APK y las claves locales están excluidos del repositorio mediante `.gitignore`.

## Datos y privacidad

- Por defecto el progreso se guarda solo en `localStorage` bajo la clave `piovuelo_v1`.
- No hay cuentas con correo ni contraseña. Con Firebase activo se usa una **sesión anónima** para sincronizar perfil, vuelos, ranking global, presencia y duelos. El progreso local sigue siendo la fuente de verdad y solo se publica el nombre, nivel y mejor marca en el ranking.
- Borrar los datos del sitio elimina el progreso local y el vínculo con el UID anónimo de Firebase.
- Los anuncios son opcionales y tolerantes a fallos; si el proveedor no carga, el juego sigue funcionando.
- La `apiKey` web de Firebase no es un secreto; la protección real son las reglas de `firestore.rules` y `database.rules.json`. Las cuentas de servicio nunca se incluyen en el cliente.

## Estructura

```text
index.html              Interfaz principal
css/                    Estilos
js/                     Lógica del juego, datos, guardado, UI, audio y nube
icons/                  Iconos de la PWA
tools/                  Pruebas, servidor local y utilidades
android/                Proyecto Android (WebView) y script de compilación
docs/FIREBASE.md        Guía de la base de datos en Firebase
firebase/seed.js        Semilla del catálogo y datos de Firebase
firestore.rules         Reglas de Firestore
firestore.indexes.json  Índices de Firestore
database.rules.json     Reglas de Realtime Database
firebase.json           Configuración de la CLI de Firebase
sw.js                   Service worker y caché offline
manifest.webmanifest    Manifiesto PWA
```
