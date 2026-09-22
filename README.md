# ARI CRAFT · 0.4.1

El mundo de Ari: un sandbox voxel para explorar, recoger y construir. Funciona como web estática en GitHub Pages, sin compilación. Texturas procedurales originales; no utiliza assets de Minecraft.

## Jugar

- **Entrar con Google** abre la partida de la cuenta y la sincroniza en Firestore.
- **Explorar una partida local** permite probar sin iniciar sesión. Esa partida solo se conserva en este navegador; no se convierte automáticamente en una partida de Google.
- WASD para caminar, ratón para mirar, Espacio para saltar, Mayús para correr.
- Mantener clic izquierdo para romper y recoger. Clic derecho para colocar.
- 1–9 o rueda del ratón para seleccionar. Solo se pueden colocar bloques disponibles.
- Esc o E para pausar. El menú muestra el inventario completo y permite guardar o descargar una copia.
- Si el navegador no permite capturar el ratón, aparece **Jugar con cámara al arrastrar**: arrastrar con el botón derecho para mirar; clic derecho sin arrastrar para colocar.

El inventario nuevo empieza vacío: recoge césped, tierra, piedra, madera u hojas. Ladrillo y ámbar permiten conservar construcciones del prototipo. Los dos últimos espacios quedan reservados.

## Desarrollo local

Desde esta carpeta, con Python 3:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4173`. No abrir `index.html` como archivo: los módulos requieren HTTP. El acceso a Google en localhost requiere que ese dominio esté autorizado en Firebase; la partida local permite probar sin cambiar esa configuración.

Pruebas de lógica y persistencia con Node.js 20 o posterior, sin instalar dependencias:

```sh
npm test
# También: node --test tests/*.test.js
```

## Organización

| Archivo           | Responsabilidad                                                       |
| ----------------- | --------------------------------------------------------------------- |
| `index.html`      | Menú, ayuda, inventario y HUD accesibles                              |
| `css/game.css`    | Identidad visual, estilos y adaptación de la interfaz                 |
| `js/game.js`      | Escena, interacción, estados de juego y coordinación del guardado     |
| `js/world.js`     | Terreno, árboles, modificaciones, selección DDA y mallas por regiones |
| `js/player.js`    | Movimiento, gravedad, salto, cámara y colisiones AABB                 |
| `js/touch.js`     | Controles multitáctiles y propiedad independiente de cada dedo        |
| `js/inventory.js` | Cantidades, hotbar y operaciones de recoger/colocar                   |
| `js/firebase.js`  | Google Auth, lectura, transacciones, copia local, formato y migración |

La simulación utiliza pasos fijos de 1/120 s y movimientos cortos por eje. Los bloques se consultan en una cuadrícula; el renderizador dibuja únicamente las caras expuestas en 16 regiones. Una edición reconstruye la región afectada y, si corresponde, las vecinas. Las entradas de movimiento y cámara están separadas de la física para poder añadir controles táctiles después.

## Guardado y compatibilidad

Se mantienen la configuración web de Firebase, Google Authentication, el SDK 12.19.0 y la ruta `players/{uid}` del prototipo. La versión nueva utiliza un campo `sandbox04` con revisión, identificador de escritura y estado:

- versión del formato y del generador, semilla y modo de terreno;
- posición del jugador (pies), orientación y selección de la hotbar;
- cantidades del inventario;
- modificaciones respecto al terreno base, incluidos bloques eliminados.

Las modificaciones usan una lista plana de enteros `x,y,z,tipo,…` porque Firestore no admite arrays anidados. El valor 0 elimina un bloque del mundo generado. Si un bloque vuelve a su tipo original se elimina su modificación.

Los campos antiguos `version`, `player` y `blocks` se conservan. En la primera carga del prototipo se crea una plataforma a altura 8 que conserva la distribución de las construcciones, se trasladan los bloques colocados y se adaptan sus tipos. La posición antigua de la cámara se convierte a la posición de los pies. Si una construcción no cabe, se detiene la migración y se conserva el original. El prototipo no guardaba árboles rotos, por lo que esas eliminaciones no se pueden recuperar.

No se permite jugar sobre una carga de nube fallida. El juego guarda una copia local por usuario al construir, al pausar y cada cinco segundos cuando hay movimiento. Una transacción comprueba la revisión antes de escribir: otra pestaña o dispositivo no puede sobrescribir silenciosamente una partida más reciente. Los fallos de red conservan la copia pendiente y se reintentan. Las escrituras repetidas tras perder la respuesta del servidor son idempotentes.

Ante un conflicto, el menú permite descargar el estado local y **Cargar nube y conservar copia aparte**. La copia anterior también queda en una clave local con fecha. Los archivos exportados son copias de recuperación para soporte; esta versión aún no tiene importador de archivos.

Espera a **Guardado en la nube** antes de cambiar de dispositivo. No se depende de una escritura de red al cerrar la pestaña.

## Alcance de esta versión

Mundo finito de 64 × 64 columnas y 64 bloques de altura, relieve determinista, árboles, suelo irrompible en la capa 0 y límite de 10.000 modificaciones activas para mantener el documento acotado. La cámara puede quedar por encima del techo de construcción. No hay daño por caída ni multijugador simultáneo.

En móvil aparecen controles táctiles: joystick izquierdo (hasta el borde para correr), cámara al arrastrar a la derecha y botones Saltar, Recoger y Colocar. Se recomienda horizontal; el aviso permite continuar en vertical. La interfaz respeta las áreas seguras y la altura visible del navegador. Pantalla completa se solicita cuando el navegador lo admite; en iPhone se explica cómo añadir el juego a la pantalla de inicio. El balón, porterías, marcador, crafting y retos pertenecen a las siguientes fases.

## GitHub Pages

Se conserva el uso de rutas relativas y dependencias CDN fijadas: Three.js 0.180.0 y Firebase 12.19.0. Publicar estos archivos en la rama que ya sirve GitHub Pages no requiere cambiar Firebase ni añadir un proceso de compilación. No se han modificado reglas, proveedores, credenciales ni dominios autorizados del proyecto.

Antes de publicar, comprobar el acceso real con Google y las reglas actuales con una cuenta autorizada: lectura y actualización del documento propio con el campo nuevo. No abrir permisos globales para solucionar un error. Las pruebas de nube de esta entrega usan un adaptador controlado, no la base de datos de producción.

Consulta `VALIDACION.md` para los resultados y las comprobaciones pendientes.
