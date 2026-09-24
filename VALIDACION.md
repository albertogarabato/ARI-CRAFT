# Validación de ARI CRAFT 0.5.0

## Comprobado en esta entrega (24 de septiembre de 2026)

33 pruebas automatizadas con Node.js, sin dependencias. Las 23 regresiones de terreno, colisiones, recursos, creativo, guardado y multitáctil siguen pasando. Las diez pruebas nuevas cubren:

- Una partida 0.4 representativa conserva exactamente construcciones, inventario, semilla, terreno y posición tras crear la aldea, construir en ella, marcar goles, recargar y regresar.
- Generación de la aldea determinista, puertas transitables y campo protegido.
- Goles en ambas porterías, sin duplicación después del reinicio o recarga.
- Tiros altos y fuera de la portería, rebotes y rechazo de chutes demasiado lejanos o a través de una pared.
- Un minuto de simulación de habitantes, límites del prado/plaza y persistencia.
- Datos de aldea malformados o de versión futura rechazados sin alterar el original.
- Primera escritura con copia atómica, copia conservada en escrituras posteriores y conflictos de revisión.
- Fallo de escritura/copia conserva tanto el original remoto como el diario pendiente.
- Chut desde el saque hasta gol y recarga a mitad de trayectoria.
- Conservación separada del diario 0.4 que todavía no se había sincronizado.

El archivo `js/world.js` coincide byte por byte con la versión anterior. No se ha alterado su generador.

## Navegador

Verificado en una partida local del navegador integrado:

- Menú 0.5.0, carga de una partida existente y viaje a Aldea Girasol.
- Casas, aldeanos, señalización, campo, porterías y balón visibles.
- Botón «Jugar al fútbol», chut desde el saque y marcador Azul 1 · 0 Coral.
- Pausa, guardado local, regreso al mundo original y recarga; la aldea y el marcador permanecen.
- Controles táctiles y botón de acción. Límites DOM revisados en 844 × 390: botones dentro del área visible y sin solapamiento entre marcador, acción, hotbar y botones de construcción.
- Sin errores de consola en la sesión revisada.

## Límites de la validación

No se ha leído la partida privada de Ari ni se han realizado escrituras de prueba en su documento de Firestore. La conservación se ha probado con una partida representativa y adaptadores controlados. La copia de su documento se hará de forma atómica al primer guardado con 0.5; aún no se afirma que esa copia concreta exista.

El usuario había confirmado Google y guardado en 0.4. La transacción 0.5 con el nuevo campo `backupBefore05` necesita la comprobación real de «Guardado en la nube» al abrir su cuenta. Si es rechazada, no se sobrescribe el documento y no se permite viajar. No se han modificado las reglas, credenciales ni dominios de Firebase.

No se ha probado esta versión en un teléfono físico ni el gesto de varios dedos en hardware. La prueba automatizada de entradas cubre independencia de dedos, cancelación, normalización y liberación de acciones. No hay equipos, portero ni partidas multijugador.

## Recorrido para Ari

1. Abrir con su misma cuenta de Google y confirmar sus construcciones.
2. Pulsar Guardar ahora y esperar «Guardado en la nube». Descargar la copia anterior si se desea tenerla fuera del navegador.
3. Visitar la aldea, explorar las casas y acercarse a los habitantes para saludar.
4. Pulsar Jugar al fútbol en el menú; continuar, mirar a la portería y chutar con F o el botón.
5. Volver a mi mundo y comprobar la posición y las construcciones.
6. Esperar el guardado antes de cambiar de dispositivo.
