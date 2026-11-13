# Pío Vuelo 3.5.1

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
  presencia, duelos y avisos. Si algo falla, el juego continúa offline.
- `functions/`: backend dedicado con **Cloud Functions v2** (trigger de récord y
  envío de avisos del panel). Es opcional y exige el plan Blaze.
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
- **Multijugador online 1v1** con salas privadas por código, reglas personalizadas y **supervivencia real**.
- **Modo Rompe récords:** compite por la mayor cantidad de eliminaciones, con récords locales, globales y notificaciones.
- Monedas, combos, power-ups, jefes y obstáculos.
- Tienda de aves, sombreros, estelas, herramientas y cajas.
- Misiones diarias, semanales y especiales, pase de temporada, mapas y progreso.
- Panel de administración con roles, auditoría, tuning, eventos y sanciones.
- Render adaptativo con presupuesto de partículas y calidad automática por FPS.
- Perfil local o cuenta con usuario/contraseña y récord persistente.
- Clasificación local por dispositivo y ranking online opcional con Firebase.
- Sonido, efectos visuales y vibración opcional.
- PWA con caché offline mediante service worker.

## Novedades de la versión 3.5.1

- **Notificaciones reales entre cuentas:** nuevo backend en `functions/` con Cloud Functions v2 y Admin SDK. `onKillRecord` avisa en tiempo real al jugador cuyo récord de eliminaciones se supera, con el nombre del nuevo líder y la marca; el aviso llega a su buzón privado con un ID determinista para no duplicarse. `sendAdminNotification` permite al panel enviar avisos a cualquier cuenta y `getAdminStatus` comprueba los permisos del operador.
- **Panel honesto:** el botón **«Comprobar backend»** consulta el estado real de las Functions; si aún no están desplegadas, el panel lo indica y no simula un envío. La autorización se valida en el servidor (custom claim o documento `admins/{uid}`), con límite de 30 avisos/minuto y auditoría en Firestore.
- **Avisos en el juego:** los avisos nuevos aparecen como toast, se marcan como leídos y la suscripción se renueva al cambiar de cuenta.
- **Caché renovada:** la PWA actualiza a `piovuelo-v34` para que los jugadores reciban los cambios al recargar.
- **Despliegue:** las Functions exigen el plan Blaze; el resto del juego y el panel siguen funcionando sin ellas.
- **Pruebas:** `npm test` 500/500, reglas 89/89, backend 41/41, backend con emuladores 21/21 y humo de navegador 55/55 sin conexión y 99/99 con emuladores.

## Novedades de la versión 3.5.0

- **Supervivencia real en multijugador:** gana el último jugador vivo y pierde el primero que muere. Cuando un jugador cae pasa a espectador y la carrera sigue hasta que el rival también muere; solo entonces se registran ganador, perdedor, tiempo de supervivencia, causa de la caída y récord personal. Ambos jugadores reciben el mismo resultado.
- **Salas más personalizables:** regla de victoria (supervivencia, meta o puntuación), duración, mapa, dificultad, semilla y toggles reales de herramientas, enemigos y poderes. Las salas antiguas siguen funcionando y se interpretan con su regla original.
- **Progresión más exigente:** curva de XP revisada, recompensas por nivel con monedas, piezas y objetos, bono por jugar, misiones diarias/semanales/especiales y tuning de economía. Todo se ajusta desde el panel de administración.
- **Modo Rompe récords:** carrera centrada en eliminar enemigos con proyectiles. Guarda la mejor marca personal, el nombre del récord, el acumulado y el historial; publica el récord global, muestra la clasificación de los mejores jugadores y avisa al jugador superado mediante notificaciones en tiempo real.
- **Panel de administración ampliado:** roles admin/moderador/soporte, auditoría de acciones, tuning de XP y recompensas, historial de partidas, estadísticas de jugadores locales, temporada y pase, récords local/global con clasificación, notificaciones, eventos, sanciones y reportes. Las acciones importantes quedan registradas.
- **Ambos jugadores en pantalla:** el radar táctico muestra posición, estado vivo/caído, tiempo y eliminaciones de los dos jugadores, con marcador de caído y etiquetas adaptadas a móvil y PC.
- **Rendimiento multiplataforma:** DPR adaptativo según memoria, núcleos y calidad gráfica; caché de tamaño; presupuesto de partículas recortado automáticamente cuando bajan los FPS; controles táctiles, teclado (espacio/flechas, F/J) y ratón (clic derecho) para disparar.
- **Seguridad:** reglas de Realtime Database para salas de supervivencia, récords globales monotónicos, tableros por jugador, historial de récords y buzones de notificación privados. El servidor rechaza configuraciones inventadas, resultados fuera de rango y escrituras cruzadas.
- **Backend de notificaciones:** Cloud Functions v2 con Admin SDK. El trigger `onKillRecord` avisa al jugador cuyo récord se supera (con nombre del nuevo líder, nueva marca y un ID determinista para no duplicar); `sendAdminNotification` permite al panel enviar avisos reales a cualquier cuenta con permisos de administrador, límite de 30/minuto y auditoría en Firestore; `getAdminStatus` muestra en el panel, con el botón **«Comprobar backend»**, si la cuenta tiene permisos reales. Requiere plan Blaze: sin desplegar, el juego sigue funcionando y el panel lo indica sin simular envíos.
- **Pruebas:** `npm test` 500/500, reglas contra emuladores 89/89, backend 41/41 y backend con emuladores 21/21.
- **Compatibilidad:** los guardados anteriores se migran sin perder datos y las salas antiguas conservan su comportamiento.

## Novedades de la versión 3.4.2

- **Modo Con metas:** elige una meta exacta de **8, 10, 12, 15, 20 o 30 tubos**. El HUD muestra el progreso y la carrera termina al alcanzarla; el modo **Libre** mantiene el vuelo sin meta (∞).
- **Multijugador libre o con metas:** al crear la sala puedes jugar sin meta o fijar una. Ambos jugadores vuelan exactamente la misma carrera y comparten mapa, dificultad, tiempo y semilla.
- **Solo mapas desbloqueados:** el lobby y las salas online usan únicamente escenarios comprados. La propiedad se publica en `entitlements/{uid}/maps` y las reglas de Realtime Database comprueban que el anfitrión y el invitado tengan el mapa antes de crear o unirse.
- **Radar / mapa táctico:** overlay 2D con la posición de ambos jugadores, estela, línea de seguimiento, tubos y brújula. Se puede personalizar tamaño, posición, transparencia, estilo, colores y elementos visibles; la configuración se guarda en el dispositivo.
- **Récords separados por modo:** cada carrera (individual u online) registra jugador, fecha, modo, mapa, tubos configurados, resultado, tiempo, estadísticas y participantes. La pantalla de récords permite filtrar por modo y ver el resumen de cada uno.
- **Validación en servidor:** las reglas aceptan `mode` libre/metas, limitan `pipes` a 0..100, validan `dist` y `alt` en ambos lados y exigen los mapas adquiridos. Solo el anfitrión puede crear la sala y cada jugador escribe su propio lado.
- **Pruebas:** `npm test` 500/500, reglas contra emuladores 89/89, humo de navegador sin conexión 53/53 y humo online real 97/97.

## Correcciones de la versión 3.4.1

- **Multijugador accesible desde el móvil:** el botón **Multijugador** ya abre el lobby. Antes la pantalla de elección de modo se quedaba por encima y parecía que el botón no hacía nada.
- **Caché renovada:** la PWA actualiza a `piovuelo-v31`, así los jugadores que ya tenían abierta la 3.4.0 reciben la corrección al recargar.

## Novedades de la versión 3.4

- **Carrera online 1v1:** crea una sala privada y comparte su código de 6 caracteres; el rival se une desde otro dispositivo. Los dos jugadores vuelan la misma semilla, mapa, dificultad, meta y tiempo, y la carrera arranca a la vez con una cuenta atrás de 3,5 s.
- **Partidas personalizadas:** el anfitrión elige la meta de tubos, el límite de tiempo, el mapa, la dificultad, si se permiten herramientas y una semilla diaria o manual. Las reglas quedan fijadas y no pueden cambiarse a mitad de partida.
- **Resultado en vivo:** la interfaz muestra el progreso del rival, el ganador se decide al llegar a la meta, al agotarse el tiempo, al chocar o si un jugador abandona. La sala se resuelve en el servidor y libera el código al salir.
- **Estadísticas y misiones:** se añaden partidas y victorias online a las estadísticas y dos misiones semanales nuevas. Las recompensas se cobran una sola vez al terminar.
- **Seguridad en Realtime Database:** solo los dos jugadores de la sala pueden escribirla, cada uno únicamente su propio lado; la configuración y la semilla son inmutables y el progreso tiene límites validados.

## Novedades de la versión 3.3.3

- **Tienda ampliada:** 6 aves nuevas (Loro, Flamenco, Cóndor, Cisne, Pingüino Emperador y Martín Pescador), 5 sombreros, 6 estelas, 3 mapas con mecánica propia (Cascada, Metrópolis y Mar de Estrellas), 5 herramientas y 5 decoraciones. Todo el contenido nuevo está disponible ya en la tienda.
- **Herramientas nuevas con efecto real:** Aura Mayor (+1 punto por tubo durante 30 s), Cohete Pro (turbo durante 7 s), Triple Escudo (suma 3 escudos), Sabiduría (+30 XP y más con mejoras) y Tesoro Real (+15 🪙 y +2 puntos). Se mejoran hasta nivel 8 como el resto.
- **Más misiones diarias y semanales:** 12 diarias y 10 semanales nuevas, con recompensas de hasta 450 🪙, usando métricas reales de vuelo (monedas, tubos, oro, gemas, jefes, escudos, viento, gigantes y tiempo).
- **Pase un poco más exigente:** los 20 umbrales de XP suben alrededor de un 14 % (el último pasa de 12.350 a 14.100 XP). Las 20 recompensas gratuitas y las 20 prémium se mantienen.

## Novedades de la versión 3.3.2

- **Aviso de registro en el primer vuelo:** un usuario nuevo ve la opción de crear cuenta para guardar su progreso en la nube antes de empezar a jugar. Puede elegir «Seguir como invitado» y el aviso no vuelve a aparecer; en ese caso el progreso se queda solo en el dispositivo.
- **Acceso privado al panel de administración en PC:** tocar la moneda de la esquina superior abre el panel y pide la clave. La clave no se muestra en pantalla y se retiró la pista visible.
- **Primer vuelo más claro:** el aviso también cubre los botones Continuar y el desafío diario de la portada.
- **Restauración de cuenta más fiable:** al abrir el juego se espera a que Firebase recupere la sesión guardada antes de decidir. Así una recarga ya no puede confundir la cuenta con un invitado nuevo ni sustituir el progreso de la nube por uno vacío.

## Novedades de la versión 3.3.1

- **Se retiró la sección «TU NOMBRE» del perfil:** el nombre ya no se puede cambiar desde el juego. Solo se define al crear la cuenta; los invitados conservan un nombre local aleatorio no editable.
- **Limpieza de récords:** se eliminaron los rankings, el historial de vuelos, los perfiles y los nombres reservados anteriores para empezar de cero. Se conservan catálogo, temporadas, retos diarios y configuración.
- **Sin reserva automática para invitados:** los nombres solo se reservan al registrar una cuenta, así que la colección `names` no se vuelve a llenar con nombres de invitados.

## Novedades de la versión 3.3

- **Cuenta con usuario y contraseña:** el nombre del jugador pasa a ser su usuario. Al crear la cuenta se vincula la sesión anónima actual, así que se conservan el nombre, el progreso y el `uid` sin empezar de cero.
- **Progreso completo en la nube:** cada cuenta guarda una copia JSON de todo el progreso (`accounts/{uid}`) y la actualiza sola al jugar. En un dispositivo nuevo se descarga automáticamente al entrar.
- **Elección si hay dos progresos:** si el dispositivo ya tenía partidas y la cuenta tiene otro progreso distinto, el juego pregunta cuál conservar (cuenta o dispositivo) antes de descargar o subir nada.
- **Cierre de sesión seguro:** al salir se guarda una última copia en la cuenta y el dispositivo sigue jugando en modo local, sin crear un invitado nuevo.
- **Nombre fijo:** la sección para cambiar el nombre se retiró del perfil. El nombre solo se define al crear la cuenta y la unicidad global la garantizan la cuenta y la reserva `names/{clave}`. Los invitados conservan un nombre local aleatorio que no se puede editar.
- **Reglas privadas:** solo el dueño puede leer o escribir `accounts/{uid}`; la copia no se puede borrar desde el cliente y tiene un límite de tamaño.

## Novedades de la versión 3.2

- **Nombres únicos globales:** cada nombre de cuenta se reserva en Firestore con una transacción (`names/{clave}`). Si otro jugador ya lo tiene, la creación de la cuenta se rechaza con un mensaje explícito. La clave ignora mayúsculas y tildes y los nombres históricos se siembran con el Admin SDK.
- **Pase de Vuelo más largo y exigente:** sube de 14 a **20 niveles**, con umbrales de XP más altos (hasta 12.350 XP), 9 recompensas de herramienta, piezas, escudos y un cosmético de temporada.
- **Pase Prémium más costoso:** ahora cuesta **6000 🪙** e incluye 20 recompensas exclusivas, con el ave **Eterna**, los sombreros **Aurora Boreal** y **Yelmo Cósmico**, la estela **Cuásar** y el mapa **Cielo de Cuásar**.
- **Tienda ampliada:** 6 aves nuevas (Tucán, Búho, Colibrí, Pavo Real, Garza y Pelícano), 4 mapas con mecánicas propias (Jardín Secreto, Distrito Industrial, Sabana Dorada y Arrecife), 6 herramientas, 5 sombreros, 6 estelas, 2 huevos y 8 decoraciones.
- **Herramientas hasta nivel 8:** cada mejora añade **4 puntos de durabilidad** (base 14) y reduce el desgaste por uso. El coste y las piezas suben por nivel y la interfaz muestra la comparativa antes/después.

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

- La línea gratuita y la prémium comparten la XP del jugador y sus 20 niveles.
- El Pase Prémium se compra por temporada (6000 🪙), se activa al instante y no caduca a mitad de temporada.
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

La suite ejecuta los scripts reales con DOM, canvas y `localStorage` simulados y comprueba tubos, objetos, cronómetros, escudos, identidad, récords, corrupción del guardado, reinicios, economía, durabilidad, piezas, ajustes persistentes, historial, migración de guardados antiguos, Pase Prémium, exclusividad en tienda y cajas, mecánicas de mapas, logros, temas de audio, salas multijugador, supervivencia, Rompe récords, tuning y panel de administración. Actualmente hay **500 pruebas** y todas deben pasar antes de publicar.

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

El backend de notificaciones tiene dos niveles de prueba:

```powershell
npm run test:functions       # lógica pura de validación y formato (41)
npm run test:functions:emu   # trigger + callables + auditoría con emuladores (21)
```

También hay una prueba de humo en un navegador real (Chrome o Edge headless, sin dependencias npm):

```powershell
node tools/browser-smoke.js
```

Arranca el servidor local, juega una partida, pausa, compra el Pase Prémium,
reclama sus 20 recompensas y revisa tienda, mapas e inventario. Además comprueba
la conexión real con Firebase, la pantalla de récords online, un **corte de red
real** (sin conexión, caché y reintento) y que el juego sigue funcionando offline.
Con `PIO_EMULATORS=1` añade el flujo completo de cuentas: aviso del primer vuelo,
registro, restauración en un dispositivo nuevo, cierre de sesión y elección entre
los dos progresos.
Actualmente son **99 comprobaciones** y no debe haber errores de JavaScript. Con los emuladores también se prueban las salas online: crear, unirse, cuenta atrás sincronizada, progreso del rival, reglas de supervivencia, abandono y resolución final. Además se valida el panel de administración (roles, auditoría, tuning, estadísticas de jugadores, temporada, envío de avisos y comprobación manual del backend), el modo Rompe récords con disparos reales, la publicación del récord global y la clasificación.
Requiere Chrome o Edge instalado; se puede indicar otro ejecutable con
`CHROME_PATH`. En un entorno sin red, `SKIP_ONLINE=1` omite solo el bloque online.

## Limitaciones conocidas

- El APK Android se recompila con `powershell -File android\build.ps1`. En esta máquina están disponibles JDK 17 (`C:\Program Files\Java\jdk-17`) y Android SDK (`C:\AndroidSDK`); `dist/PioVuelo.apk` se ha regenerado como **v3.5.1 (versionCode 41)**: **7.084.523 bytes** y SHA-256 `46939C9F771798262A081656E20BB058201D58CAE4107D1B440AB30221C4F332`. No hay un dispositivo Android conectado por ADB, así que falta probar la instalación y apertura en un móvil real.
- La verificación incluye pruebas headless (500/500), comprobaciones HTTP, reglas con emuladores (89/89), backend (41/41 y 21/21 con emuladores) y una prueba real en Chrome headless (`node tools/browser-smoke.js`, 99/99 con emuladores y 55/55 en modo offline, incluido el modo offline, las cuentas, las salas online, la supervivencia, la clasificación de eliminaciones y el panel ampliado). Aun así, conviene revisar la portada, el Pase Prémium, los mapas nuevos, el ranking online y una carrera 1v1 en dos dispositivos Android reales antes de darlos por cerrados.
- **Notificaciones entre jugadores:** el buzón `notifications/{uid}` es privado y las reglas solo permiten escribir en el propio. La entrega real la hace el backend de `functions/` con Admin SDK. Para desplegarlo hay que activar el plan Blaze (Cloud Functions lo exige); mientras no esté desplegado, el récord global y el historial sí se publican y el panel muestra el estado real en lugar de simular un envío que fallaría.
- El ranking global solo muestra marcas con más de 0 puntos. Las entradas antiguas con 0 puntos que ya existan en Firestore no se muestran y no se pueden borrar desde el cliente porque las reglas lo impiden; para limpiarlas hace falta la consola de Firebase o el Admin SDK.
- La primera carga del ranking online necesita red. Si se abre sin conexión y nunca se ha visto la tabla, se muestra un aviso y se puede reintentar; el juego local no se bloquea.
- La música es procedural (WebAudio) y no usa archivos externos: suena distinta por familia de mapa, pero no son pistas grabadas. El audio requiere un gesto del usuario para desbloquearse en móvil.
- El Pase Prémium se paga con monedas del juego, no con dinero real; no hay pasarela de pago ni compras externas.
- El idioma está fijado en español y se muestra deshabilitado como “Español (único)”: no se simula un selector que no existe.
- El guardado es local al navegador o dispositivo. La nube es un espejo opcional: las cuentas usan usuario y contraseña (sin correo real) y el progreso se puede recuperar en otro dispositivo; borrar los datos del sitio cierra la sesión, pero se puede volver a entrar. Los invitados conservan el vínculo con su UID anónimo de Firebase.
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
- Con Firebase activo se usa una **sesión anónima** para invitados y una **cuenta con usuario y contraseña** para quienes quieran guardar su progreso en la nube. El progreso local sigue siendo la fuente de verdad y solo se publica el nombre, nivel y mejor marca en el ranking.
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
functions/              Backend de notificaciones (Cloud Functions v2)
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
