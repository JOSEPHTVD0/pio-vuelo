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

La suite ejecuta los scripts reales con DOM, canvas y `localStorage` simulados y comprueba tubos, objetos, cronómetros, escudos, identidad, récords, corrupción del guardado y reinicios.

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
