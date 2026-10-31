/* ==========================================================================
   PÍO VUELO · CONFIGURACIÓN DE FIREBASE
   --------------------------------------------------------------------------
   La nube es OPCIONAL. Con `enabled: false` el juego funciona exactamente
   igual que antes: todo se guarda en localStorage y no se hace ninguna
   petición de red.

   Proyecto: pio-vuelo (Firestore + Realtime Database + Authentication
   anónima). Ya está conectado y activado. Para volver al modo 100% local,
   pon `enabled: false` y sube la caché del service worker (ver
   docs/FIREBASE.md).

   NO pongas aquí claves de servicio (service account): esas van solo en
   firebase/seed.js mediante variables de entorno y nunca al navegador.
   ========================================================================== */
window.PIO_FIREBASE = {
  enabled: true,

  /* Versión del SDK modular de Firebase cargado desde gstatic. */
  sdkVersion: '11.0.2',

  config: {
    apiKey: 'AIzaSyBs-ztKuUX1bpIU9JXDKLqqYiaI_pal1xI',
    authDomain: 'pio-vuelo.firebaseapp.com',
    projectId: 'pio-vuelo',
    storageBucket: 'pio-vuelo.firebasestorage.app',
    messagingSenderId: '379032822709',
    appId: '1:379032822709:web:773e5540d6070fb8616ffc',
    databaseURL: 'https://pio-vuelo-default-rtdb.firebaseio.com'
  },

  options: {
    /* Ranking principal y tablero en tiempo real. */
    board: 'global',
    /* Presencia y ranking en vivo con Realtime Database. */
    presence: true,
    /* Guardar el historial de vuelos en Firestore. */
    runs: true,
    /* Latido de presencia (ms). */
    heartbeatMs: 60000
  }
};
