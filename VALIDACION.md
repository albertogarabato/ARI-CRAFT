# Validación de ARI CRAFT 0.7.0

53 pruebas pasan: las 44 regresiones anteriores y nueve casos nuevos de ampliación, inventario, recetas y copias.

- Se compararon todos los bytes del generador original contra 0.6.1 para la semilla por defecto, una alternativa y el modo heredado: idénticos.
- La ampliación conserva el terreno original, modificaciones, posición, habitantes y marcador.
- Todos los nuevos materiales se guardan y recuperan en las cuatro regiones nuevas, junto con modo y barra.
- Los ocho contadores antiguos se amplían con ceros sin perder cantidades o selección.
- Fabricar consume exactamente los ingredientes; falta de recursos o inventario lleno no causa cambios parciales. Recoger y colocar conservan unidades en modo con recursos.
- Recorrido continuo andando por el borde occidental y regreso, sin portales; límites y capacidad de modificaciones comprobados.
- La copia previa se conserva atómicamente; conflictos, diarios antiguos y fallos de escritura no sobrescriben el original.
- Los datos incompletos o inválidos de ampliación se rechazan; no se sustituyen por regiones vacías.

## Navegador

Probada una partida local anterior: carga en recursos, cambio a creativo, elección de una pieza azul, vuelta a recursos, guardado y recarga conservando selección y cantidad. Acceso al taller desde el juego, ingredientes sin existencias deshabilitados y lienzo ajustado a 844 × 390. Sin errores de consola en estas comprobaciones. Galería de prueba con salientes y ventanas revisada visualmente.

No se ha leído ni modificado la partida de Google de Ari para realizar estas pruebas. La copia real previa se crea al primer guardado de esa cuenta. No se ha probado en un móvil físico; se requiere comprobar rendimiento y autenticación en Android/iPhone reales.

## Validación de entregas anteriores

# Validación de ARI CRAFT 0.6.1

- Las 44 pruebas de lógica y persistencia continúan pasando.
- Revisados el diálogo de instalación y sus instrucciones de iPhone a 390 × 844, y la partida con controles táctiles a 844 × 390.
- Verificado en el navegador el botón de ampliar: pausa la partida, entra en pantalla completa y muestra «Pantalla completa activa».
- Sin errores de consola durante la carga y la partida local.
- Manifiesto con rutas relativas a /ARI-CRAFT/, iconos PNG 192/512 y Apple 180. No se añade un service worker que pueda retener módulos antiguos.
- Los módulos de Firebase, inventario, mundo, jugador y copias de seguridad no se modifican.
- Pendiente la instalación y el inicio de sesión en Android/iPhone físicos: la revisión de tamaño de pantalla no sustituye esa comprobación.

## Validación previa de 0.6.0


## Automatización

44 pruebas pasan con Node.js. Se mantienen las 33 regresiones anteriores de mundo, movimiento, creativo, recursos, guardado, móvil, habitantes y fútbol. Las 11 pruebas nuevas comprueban:

- Conservación del mundo original, edificios y eliminaciones de la aldea, cantidades, habitantes y marcador al unir.
- Conversión única de una posición guardada dentro de la aldea y estabilidad en recargas posteriores.
- Recorrido andando desde el borde del mundo original a la plaza y regreso, sin portales ni saltos.
- Raycast, romper y colocar con inventario finito en ambos bordes y en el camino; campo protegido en sus coordenadas nuevas.
- Recarga de una posición y modificaciones dentro del terreno de enlace.
- La entrada no se añade sobre construcciones previas; las nuevas escaleras minadas no reaparecen al recargar.
- Límites globales, paredes altas y techos bloquean el movimiento correctamente.
- Rechazo de estados incompletos o de versiones futuras, copia anterior atómica y conservación de copias existentes.
- Un jugador dentro del área de la entrada no es desplazado al convertir la partida.
- El balón sigue recibiendo chutes y guardando goles con el jugador en coordenadas globales.

`js/world.js`, el generador original, no ha cambiado. La copia de una partida real de Ari no se ha leído ni modificado durante estas pruebas.

## Navegador

- Carga y conversión de una partida local 0.5 que estaba dentro de la aldea; posición relativa y marcador recuperados.
- Menú 0.6, guía de dirección y distancia y controles táctiles; Chutar permanece a la izquierda.
- Vista de comprobación con el mundo original, camino y aldea dibujados al mismo tiempo, sin huecos entre zonas.
- Recorrido visual de ida y vuelta usando la misma física y los mismos módulos del juego, en un escenario de prueba sin datos de usuario.

## Comprobación real pendiente

La escritura nueva de Firestore y la copia `backupBefore06` se comprueban con la cuenta del usuario al primer guardado. Si las reglas rechazan esa escritura, la transacción completa falla y el original permanece. No se han cambiado reglas ni configuración de Firebase.

No se ha probado en un móvil físico. Se mantiene la validación previa del posicionamiento de controles en 844 × 390 y 390 × 844; la guía vertical se ha separado del botón de chutar.

## Alcance

Esta versión une la aldea existente. Conserva el modo creativo. Nuevos tipos de bloques, aldeas adicionales y recursos limitados quedan para la siguiente fase acordada.
