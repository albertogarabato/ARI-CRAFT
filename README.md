# ARI CRAFT · 0.5.0

El mundo de Ari: un sandbox voxel para explorar, recoger y construir. Funciona como web estática en GitHub Pages, sin compilación. Texturas procedurales originales; no utiliza assets de Minecraft.

## Jugar

- **Entrar con Google** abre la partida de la cuenta y la sincroniza en Firestore.
- **Explorar una partida local** permite probar sin iniciar sesión. Esa partida solo se conserva en este navegador; no se convierte automáticamente en una partida de Google.
- WASD para caminar, ratón para mirar, Espacio para saltar, Mayús para correr.
- Mantener clic izquierdo para romper. Clic derecho para colocar.
- 1–9 o rueda del ratón para seleccionar. Modo creativo: todos los materiales tienen cantidades ilimitadas y colocarlos no consume recursos.
- Esc o E para pausar. El menú muestra el inventario completo y permite guardar o descargar una copia.
- Si el navegador no permite capturar el ratón, aparece **Jugar con cámara al arrastrar**: arrastrar con el botón derecho para mirar; clic derecho sin arrastrar para colocar.

El modo creativo ofrece césped, tierra, piedra, madera, hojas, ladrillo y ámbar desde el principio, señalados con ∞. No hace falta recoger materiales. Las partidas antiguas conservan sus bloques y cantidades históricas y pasan a creativo al cargarse. Los dos últimos espacios quedan reservados.

## Aldea Girasol, animales y fútbol

Desde el menú, **Visitar aldea, animales y fútbol** abre una región independiente: tres casas visitables y modificables, una plaza, dos aldeanos y un prado con dos ovejas, un cerdo y dos gallinas. Los habitantes caminan y se detienen ante los bloques; al acercarse, **Chutar / saludar** o **F** permite saludar. Los animales acompañan brevemente al jugador dentro de su prado.

**Jugar al fútbol** coloca al jugador ante el balón y lo devuelve al centro sin borrar el marcador. Mirar hacia la portería y pulsar **F** o **Chutar / saludar**, a menos de 2,7 bloques del balón. Hay rebote, rozamiento, dos porterías y detección de goles; cada gol devuelve el balón al centro. El marcador cuenta goles en la portería azul y coral; no simula dos equipos. **Balón al centro** permite recuperarlo durante una partida.

**Volver a mi mundo** devuelve al jugador a su posición anterior. El terreno y las construcciones originales no se regeneran. El campo está reservado para el fútbol; fuera de él se puede construir y modificar las casas. Todavía no hay portero, equipos, comercio, cría ni multijugador.

### Protección de la partida anterior

- Se conserva exactamente el generador 1 y la semilla del mundo original. La región nueva tiene su propio generador fijo, modificaciones, posición, habitantes y balón.
- Se mantiene `sandbox04`, formato 4, con `village` y `location` opcionales. Una partida 0.4 válida funciona sin tener estos campos. Los datos nuevos malformados o de versión desconocida impiden la carga: no se sustituyen por un mundo nuevo.
- La primera escritura con 0.5 añade **`backupBefore05`** al mismo documento, con el `sandbox04` anterior. Copia y actualización se escriben en la misma transacción. La copia existente no vuelve a sobrescribirse. No se crea una copia de datos de producción durante el despliegue: se crea al guardar por primera vez con la cuenta correspondiente.
- En local, copia y actualización se escriben juntas en `ari-craft:04:demo-world`. Un diario pendiente anterior se conserva además en `<clave-del-diario>:before05-journal` antes de consumirlo.
- **Descargar copia anterior a 0.5** exporta la copia cargada al iniciar la sesión. **Descargar copia local** exporta el estado actual o pendiente. La restauración de archivos sigue siendo una operación de soporte; no hay importador automático.
- El viaje exige terminar el guardado. Si las reglas de Firestore rechazan el campo de copia, la transacción completa falla, el original permanece y se conserva el diario local; no se desactivan las reglas.

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
| `js/village.js` | Región nueva, habitantes, balón y formato de la expansión |
| `js/village-view.js` | Modelos originales, campo, porterías y animación |
| `js/firebase.js`  | Google Auth, lectura, transacciones, copia local, formato y migración |

La simulación utiliza pasos fijos de 1/120 s y movimientos cortos por eje. Los bloques se consultan en una cuadrícula; el renderizador dibuja únicamente las caras expuestas en 16 regiones. Una edición reconstruye la región afectada y, si corresponde, las vecinas. Las entradas de movimiento y cámara están separadas de la física y se comparten con los controles táctiles.

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

Mundo finito de 64 × 64 columnas y 64 bloques de altura, relieve determinista, árboles, suelo irrompible en la capa 0 y límite de 10.000 modificaciones activas para mantener el documento acotado. La cámara puede quedar por encima del techo de construcción. La aldea es otra región del mismo tamaño, con un máximo de 2.000 modificaciones adicionales para acotar el guardado junto con la copia anterior. No hay daño por caída ni multijugador simultáneo.

En móvil aparecen controles táctiles: joystick izquierdo (hasta el borde para correr), cámara al arrastrar a la derecha y botones Saltar, Romper y Colocar. Se recomienda horizontal; el aviso permite continuar en vertical. La interfaz respeta las áreas seguras y la altura visible del navegador. Pantalla completa se solicita cuando el navegador lo admite; en iPhone se explica cómo añadir el juego a la pantalla de inicio. El crafting, los equipos y los retos pertenecen a las siguientes fases.

## GitHub Pages

Se conserva el uso de rutas relativas y dependencias CDN fijadas: Three.js 0.180.0 y Firebase 12.19.0. Publicar estos archivos en la rama que ya sirve GitHub Pages no requiere cambiar Firebase ni añadir un proceso de compilación. No se han modificado reglas, proveedores, credenciales ni dominios autorizados del proyecto.

Al estrenar 0.5 con una cuenta real, comprobar lectura y actualización del documento propio con el campo de copia nuevo y el mensaje «Guardado en la nube». No abrir permisos globales para solucionar un error. Las pruebas de nube de esta entrega usan un adaptador controlado, no la base de datos de producción.

Consulta `VALIDACION.md` para los resultados y las comprobaciones pendientes.
