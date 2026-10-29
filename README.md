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

## Novedades de la versión 2.9

- **Portada rediseñada:** billetera de monedas y piezas, avisos contextuales, tutorial de bienvenida, botón **Continuar**, accesos rápidos con contadores y resumen del nido.
- **Navegación consistente:** cada botón abre una pantalla real; las acciones importantes piden confirmación y las opciones no disponibles se muestran deshabilitadas con su motivo.
- **Ajustes funcionales:** volumen general, efectos y música, sensibilidad, límite de FPS, pantalla completa, notificaciones, animaciones de interfaz, confirmación de compras y restauración de valores. Todo se aplica al instante y persiste.
- **Herramientas con durabilidad:** cada uso consume stock y desgasta la herramienta. Una herramienta rota no se consume ni se pierde hasta repararla. Se puede mejorar hasta nivel 5 y la pantalla muestra la comparativa antes/después.
- **Inventario:** filtros por tipo, equipar aves/sombreros/estelas/mapas, estado y reparación de herramientas e historial reciente de compras, mejoras, reparaciones y roturas.
- **Estadísticas y ayuda:** métricas de vuelo, mejores marcas, guía de modos, herramientas, economía y guardado.
- **Economía centralizada y reequilibrada:** los precios de catálogo suben entre un 10 % y un 20 % una sola vez al cargar los datos. Las compras validan saldo y no pueden dejarlo negativo ni cobrar dos veces.
- **Piezas 🔩:** material persistente para mejoras de nivel alto. Se gana 1 por vuelo, +1 al alcanzar 20 puntos y +1 al batir el récord.

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

La suite ejecuta los scripts reales con DOM, canvas y `localStorage` simulados y comprueba tubos, objetos, cronómetros, escudos, identidad, récords, corrupción del guardado, reinicios, economía, durabilidad, piezas, ajustes persistentes, historial, migración de guardados antiguos e integridad de la interfaz. Actualmente hay **275 pruebas** y todas deben pasar antes de publicar.

## Limitaciones conocidas

- El APK Android **no se puede recompilar** en este entorno porque faltan JDK 17 y Android SDK configurados. `android/assets` se mantiene sincronizado con los assets web, pero el binario `dist/PioVuelo.apk` seguirá siendo el anterior hasta compilarlo en una máquina con esos requisitos.
- La verificación visual e interactiva se ha hecho con pruebas headless, comprobaciones de HTTP y servidor local. No se ha podido usar un navegador real en esta sesión, así que conviene revisar la portada y las pantallas nuevas en un dispositivo antes de darlas por cerradas.
- El idioma está fijado en español y se muestra deshabilitado como “Español (único)”: no se simula un selector que no existe.
- El guardado es local al navegador o dispositivo; no hay cuentas, servidores ni sincronización entre dispositivos.

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
