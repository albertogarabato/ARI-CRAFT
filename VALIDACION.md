# Validación de ARI CRAFT 0.4

## Comprobado

16 pruebas automatizadas con Node.js, sin dependencias:

- Terreno idéntico para la misma semilla, relieve, capas y árboles.
- Romper → recoger → colocar conserva las cantidades; recargar conserva las modificaciones.
- No se colocan bloques dentro del jugador ni sobre otros bloques; la roca base no se rompe.
- Selección del bloque más cercano, alcance y caras expuestas tras excavar.
- Gravedad, apoyo en terreno, carrera contra una pared sin atravesarla.
- Salto de más de un bloque, colisión con techo y caída al quitar el suelo.
- Velocidad diagonal normalizada y límite del mundo.
- Validación de datos dañados y recuperación de una posición dentro de un bloque.
- Migración de construcciones antiguas, conservando los datos originales.
- Límite de modificaciones sin pérdida de recursos.
- Recuperación de copia local, escritura completa y lectura posterior.
- Fallos de carga/escritura sin sustituir el mundo por uno nuevo.
- Conflicto de dos dispositivos sin sobrescritura.
- Cambios durante una escritura pendientes para la siguiente revisión.
- Reintentos idempotentes y errores de almacenamiento local detectables.
- Un documento 0.4 incompleto nunca se interpreta como una partida nueva.

Revisión visual en el navegador integrado:

- Carga del menú y mundo 3D con texturas originales.
- Apertura de partida local, guardado y recuperación tras recargar.
- Entrada con cámara alternativa cuando el navegador rechaza Pointer Lock.
- Interfaz de juego, selección de hotbar y pausa/inventario.

## Pendiente de validación externa

- Google Login y lectura/escritura de Firestore con una cuenta real, incluyendo continuar en otro dispositivo. No se han realizado escrituras de prueba sobre partidas de producción.
- Captura del ratón y recorrido completo de juego en Chrome/Firefox/Safari de escritorio. El navegador integrado rechaza Pointer Lock; la alternativa al arrastrar sí permite abrir el juego. Las colisiones y el ciclo de recursos se han probado en la lógica automatizada.
- Publicación en GitHub Pages tras revisar la propuesta de cambios. La validación local no certifica un despliegue de producción.

## Recorrido de aceptación en escritorio

1. Iniciar sesión con Google y abrir el mundo. Confirmar que una carga fallida no habilita jugar.
2. Caminar, correr y saltar; intentar atravesar un tronco o una pared.
3. Mantener pulsado sobre un bloque y comprobar el progreso y la cantidad recogida.
4. Seleccionarlo en la hotbar y colocarlo, comprobar que la cantidad baja en uno.
5. Intentar colocar un bloque sin existencias y dentro del propio cuerpo.
6. Guardar, esperar confirmación de nube, recargar y comprobar posición, inventario y construcción.
7. Abrir la misma cuenta en otro dispositivo y comprobar la misma partida.
8. Volver a una sesión anterior y editar: debe avisar del conflicto, conservar su copia y no sobrescribir la nube.
