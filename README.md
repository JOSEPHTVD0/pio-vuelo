# Pío Vuelo 2.5.0

Juego arcade de un pájaro que vuela entre tubos, con monedas, power-ups, tienda, misiones, récords y progresión. Funciona como aplicación web instalable (PWA) y también como APK Android mediante WebView.

## 🎮 Jugar online

**https://josephtvd0.github.io/pio-vuelo/**

El juego se publica automáticamente con GitHub Pages desde la rama `main`.

## Características

- Vuelo con física de aleteo y dificultad progresiva.
- Modos libre, diario, duelo, zen, boss, viento y replay.
- Monedas, combos, power-ups, jefes y obstáculos.
- Tienda de aves, sombreros, estelas, herramientas y cajas.
- Misiones, pase de temporada, mapas y progreso.
- Perfil local con nombre editable y récord persistente.
- Clasificación local por dispositivo (no requiere conexión ni cuentas).
- Sonido, efectos visuales y vibración opcional.
- PWA con caché offline mediante service worker.

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

También hay una prueba de humo en un navegador real (Chrome o Edge headless, sin dependencias npm):

```powershell
node tools/browser-smoke.js
```

Arranca el servidor local, juega una partida, pausa, compra el Pase Prémium, reclama sus 14 recompensas y revisa tienda, mapas e inventario buscando errores de JavaScript. Requiere Chrome o Edge instalado; se puede indicar otro ejecutable con `CHROME_PATH`.

## Limitaciones conocidas

- El APK Android **no se puede recompilar** en este entorno porque faltan JDK 17 y Android SDK configurados. `android/assets` se mantiene sincronizado con los assets web, pero el binario `dist/PioVuelo.apk` seguirá siendo el anterior hasta compilarlo en una máquina con esos requisitos.
- La verificación visual e interactiva se ha hecho con pruebas headless, comprobaciones de HTTP y servidor local. No se ha podido usar un navegador real en esta sesión, así que conviene revisar la portada, el Pase Prémium y los mapas nuevos en un dispositivo antes de darlas por cerradas.
- La música es procedural (WebAudio) y no usa archivos externos: suena distinta por familia de mapa, pero no son pistas grabadas. El audio requiere un gesto del usuario para desbloquearse en móvil.
- El Pase Prémium se paga con monedas del juego, no con dinero real; no hay pasarela de pago ni compras externas.
- El idioma está fijado en español y se muestra deshabilitado como “Español (único)”: no se simula un selector que no existe.
- El guardado es local al navegador o dispositivo; no hay cuentas, servidores ni sincronización entre dispositivos.
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

Esos binarios, los APK y las claves locales están excluidos del repositorio mediante `.gitignore`.

## Datos y privacidad

- El progreso se guarda en `localStorage` bajo la clave `piovuelo_v1`.
- No hay cuentas, servidor de perfiles ni clasificación online: los récords son locales al navegador o dispositivo.
- Borrar los datos del sitio elimina el progreso y los récords.
- Los anuncios son opcionales y tolerantes a fallos; si el proveedor no carga, el juego sigue funcionando.

## Estructura

```text
index.html              Interfaz principal
css/                    Estilos
js/                     Lógica del juego, datos, guardado, UI y audio
icons/                  Iconos de la PWA
tools/                  Pruebas, servidor local y utilidades
android/                Proyecto Android (WebView) y script de compilación
sw.js                   Service worker y caché offline
manifest.webmanifest    Manifiesto PWA
```
