# ARI CRAFT · 0.8.0

El mundo de Ari: un sandbox voxel para explorar, recoger y construir. Funciona como web estática en GitHub Pages, sin compilación. Texturas procedurales originales; no utiliza assets de Minecraft.

## Partido con futbolistas (0.8)

Ari juega junto a **Blanco 7**, con una equipación original blanca y dorada inspirada en el Real Madrid. Enfrente hay dos jugadores coral; cada equipo tiene portero. Entrar físicamente en el campo inicia el partido. Salir del césped o pausar detiene futbolistas, balón y marcador. La guía señala la portería coral, que es el objetivo del equipo blanco.

El compañero persigue el balón, se desmarca cuando Ari está cerca de él, pasa a Ari cuando está a distancia y chuta a portería. Los rivales atacan la portería blanca; los porteros siguen lateralmente el balón y despejan tiros bajos. Son personajes originales con dorsales, sin recreaciones de jugadores concretos. La IA es sencilla: no hay faltas, fuera de juego ni duración reglamentaria.

El antiguo marcador Azul pasa a llamarse Blanco sin cambiar sus goles. Chutar / F sigue funcionando; Balón al centro recoloca también a los jugadores sin borrar el marcador. Se conservan terreno, inventario, modo y construcciones.

El formato 8 guarda la plantilla y sus tiempos entre golpes. Al primer guardado, `backupBefore08` conserva la partida anterior atómicamente; los diarios previos quedan en `:before08-journal`, y las copias existentes no se reemplazan.

## Jugar y construir (0.7)

- Entrar con Google recupera la partida de la cuenta. La partida local solo pertenece a ese navegador.
- WASD / joystick para moverse, ratón / arrastrar a la derecha para mirar. Espacio / Saltar para saltar.
- Romper recoge bloques en modo **Con recursos**; Colocar consume una unidad. No permite colocar sin existencias ni dentro del jugador.
- El selector **Cómo quieres construir** cambia entre recursos y creativo sin borrar edificios ni cantidades. Al actualizar desde versiones anteriores se activa recursos; creativo sigue disponible a elección del jugador.
- **Materiales y taller** pausa el juego: elegir un hueco (1–9) y un material modifica la barra. **Volver al juego** reanuda.
- Hay 16 materiales colocables: césped, tierra, piedra, madera, hojas, ladrillo, ámbar, arena, cristal, tablones, adoquín y cinco piezas con salientes (blancas, azules, rojas, amarillas y verdes). Los salientes son decorativos; la colisión sigue siendo la celda cúbica.
- En recursos, las recetas muestran ingredientes y resultado, y solo se habilitan si hay existencias y espacio. Ejemplos: una madera → cuatro tablones; una piedra → un adoquín; dos adoquines y una hoja → cuatro piezas de color. Son recetas originales de ARI CRAFT.
- La arena se recoge también en las nuevas praderas; el cristal permite ver a través de su ventana central.

## Praderas de construcción y conservación (0.7)

La superficie pasa de 160 × 64 a **416 × 64 columnas** (26.624 frente a 10.240). Se añaden cuatro regiones de 64 × 64, dos a cada lado, con áreas niveladas, arena y una línea de árboles. La zona original y la aldea no se regeneran ni se desplazan. **Mirar hacia las praderas** apunta hacia el oeste: continuar y seguir la flecha hasta llegar andando.

El formato 7 guarda las cuatro regiones nuevas, la posición global, cantidades, modo y barra personalizable. Los identificadores antiguos de materiales permanecen iguales; los nuevos se añaden tras la roca base. Cada región nueva admite 1.500 modificaciones, además de los límites existentes; revertir un bloque a su estado original libera espacio.

Al primer guardado de una partida anterior, la transacción conserva su estado en `backupBefore07`, sin reemplazar `backupBefore05` ni `backupBefore06`. Los diarios locales anteriores quedan en `:before07-journal`. **Descargar copia anterior a la actualización** exporta el respaldo más reciente. Un fallo de escritura mantiene la partida original remota y la copia local pendiente; no se reinicia el mundo. No se han cambiado reglas ni configuración de Firebase.

Los futbolistas se añaden en 0.8. Los escenarios adicionales y más formas de piezas siguen pendientes.

## Pantalla completa y acceso desde el móvil (0.6.1)

El menú incluye **Añadir a pantalla de inicio**. Si Chrome ofrece instalación nativa, el botón la solicita; en otros casos abre una guía por dispositivo. Android: abrir en Chrome, menú ⋮ → Instalar aplicación o Añadir a pantalla de inicio. iPhone: Safari → Compartir → Añadir a pantalla de inicio; activar Abrir como app web si aparece. Abrir después desde el icono de ARI CRAFT.

El manifiesto solicita pantalla completa y permite ambas orientaciones; el juego conserva el aviso para girar y la opción de jugar en vertical. El botón ⛶ permite entrar a pantalla completa en navegadores compatibles. Se respetan los márgenes de cámaras e indicadores del sistema. No todos los dispositivos permiten ocultar esos indicadores.

Antes de cambiar al icono, guardar la partida en la nube y usar la misma cuenta de Google. Los datos locales pueden estar separados entre navegador y aplicación instalada. Esta actualización no modifica el formato, las claves ni las copias de seguridad. Requiere conexión para cargar los módulos e iniciar sesión; no incluye caché sin conexión.

## Mundo conectado (0.6)

El mundo original y Aldea Girasol forman una escena continua de 160 × 64 columnas. La aldea está al este, a 96 bloques de desplazamiento respecto a sus coordenadas antiguas. Entre ambas zonas hay 32 columnas nuevas, con un camino de piedra que enlaza sus bordes. No hay portales, cambios de escena ni teletransporte al cruzar.

- **Mirar hacia la aldea**, **Mirar hacia el campo** y **Mirar hacia mi mundo** orientan la cámara, sin mover al jugador. Continuar y seguir la flecha y la distancia del HUD.
- Se suben automáticamente desniveles de un bloque si hay espacio encima. Las paredes altas y los techos siguen bloqueando el paso.
- La aldea conserva sus tres casas, dos aldeanos y cinco animales. Acercarse y pulsar **F** o **Chutar / saludar** para interactuar.
- Para jugar al fútbol, acercarse al balón, mirar hacia una portería y pulsar **F** o **Chutar / saludar**. **Balón al centro** lo recupera sin borrar el marcador.
- El botón de acción móvil permanece a la izquierda, separado de Saltar. El campo sigue reservado para jugar; se puede construir fuera de él.

La unión de la aldea se conserva en 0.7. Los materiales nuevos y el modo con recursos se describen arriba; las aldeas adicionales siguen pendientes.

### Conservación de partidas

El generador 1 del mundo original no cambia. Los bloques modificados se mantienen en sus coordenadas de almacenamiento originales; la aldea se dibuja y consulta con un desplazamiento fijo. Una partida cerrada dentro de la aldea conserva su posición relativa, orientación, habitantes y marcador.

El formato de guardado pasa de 4 a **6**, para que una versión antigua no abra el mundo nuevo ignorando datos que desconoce. El campo `connected` almacena la posición global y los cambios del terreno de enlace. La entrada opcional de piedra se añade solo si su margen no contiene cambios previos ni al jugador; el resto de la aldea conserva su generación. Si Ari ya construyó en ese margen, podrá adaptar su propia entrada.

Antes de la primera escritura del formato 6, la misma transacción añade **`backupBefore06`** con la revisión, identificador y el estado anterior serializado como JSON. No sobrescribe esa copia ni `backupBefore05`. El diario local anterior queda además en `<clave>:before06-journal`. La copia real de una cuenta se crea al guardar con esa cuenta, no durante la publicación del código.

**Descargar copia anterior a la actualización** permite conservar el estado anterior fuera del navegador. Los archivos se recuperan mediante soporte; todavía no hay importador automático. Si la lectura, conversión, copia o escritura falla, el original remoto no se sustituye por una partida nueva. Los conflictos entre dispositivos siguen comprobando la revisión.

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
| `js/connected.js` | Mundo continuo, terreno de enlace, conversión de posiciones y vista conjunta |
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

Mundo finito de 64 × 64 columnas y 64 bloques de altura, relieve determinista, árboles, suelo irrompible en la capa 0 y límite de 10.000 modificaciones activas para mantener el documento acotado. La cámara puede quedar por encima del techo de construcción. La aldea ocupa otro tramo del mismo tamaño, unido mediante 32 columnas de terreno con un límite de 512 cambios, con un máximo de 2.000 modificaciones adicionales para acotar el guardado junto con la copia anterior. No hay daño por caída ni multijugador simultáneo.

En móvil aparecen controles táctiles: joystick izquierdo (hasta el borde para correr), cámara al arrastrar a la derecha y botones Saltar, Romper y Colocar. Se recomienda horizontal; el aviso permite continuar en vertical. La interfaz respeta las áreas seguras y la altura visible del navegador. Pantalla completa se solicita cuando el navegador lo admite; en iPhone se explica cómo añadir el juego a la pantalla de inicio. El crafting, los equipos y los retos pertenecen a las siguientes fases.

## GitHub Pages

Se conserva el uso de rutas relativas y dependencias CDN fijadas: Three.js 0.180.0 y Firebase 12.19.0. Publicar estos archivos en la rama que ya sirve GitHub Pages no requiere cambiar Firebase ni añadir un proceso de compilación. No se han modificado reglas, proveedores, credenciales ni dominios autorizados del proyecto.

Al estrenar 0.6 con una cuenta real, comprobar lectura y actualización del documento propio con el campo de copia nuevo y el mensaje «Guardado en la nube». No abrir permisos globales para solucionar un error. Las pruebas de nube de esta entrega usan un adaptador controlado, no la base de datos de producción.

Consulta `VALIDACION.md` para los resultados y las comprobaciones pendientes.
