```
MISIÓN B31 — B9.5 «Reservas y Resumen» · Nihon (línea Claude)

══════════════════════════════════════════════════════════════
0. LÍNEA, BASE Y PROHIBICIONES
══════════════════════════════════════════════════════════════
LÍNEA: Claude exclusivamente. PROHIBIDO usar, consultar o mezclar Codex, Astra, Vercel, main,
ramas o PR de otras líneas, o trabajo posterior de main.
RAMA: claude/b31-viaje-b9-5-reservas-resumen
BASE: 1444e67805c60cf9a33f4be5c1a3808b900e505b (= HEAD de claude/b30-viaje-b9-4-donde-dormir).
  Verificar con git fetch + git rev-parse ANTES de tocar nada. Si no coincide: PARAR.
PR: borrador, base claude/b30-viaje-b9-4-donde-dormir ← head claude/b31-viaje-b9-5-reservas-resumen.
  NO merge. NO main. NO B10. NO empezar ningún bloque posterior.
Antes de la rama: clonar/actualizar y confirmar que la sesión NO arranca en una rama de otra línea.
  Si arranca en una, no usarla; trabajar solo en la rama de la misión.

══════════════════════════════════════════════════════════════
1. FUENTE DE VERDAD (normativa, no reinterpretar)
══════════════════════════════════════════════════════════════
docs/design/05 §9 y §10, 10 §B9.5, 09 (DDR-05, DD-015, DD-016), 03 §1.4 y §10, 04 §2 (EvidenceMark,
DDR-06), 00 (Art. 3, 4, 5, 7, 10, 12), 02 (§D3), 07 (DS-2), y las resoluciones DDR-1…DDR-7 de esta misión
(normativas; se registran en docs/design/09, ver §9).
REGLA: si falta una decisión necesaria y no está cubierta por la normativa ni por DDR-1…DDR-7,
PARAR y marcar DESIGN DECISION REQUIRED. NO debe aparecer DESIGN DECISION REQUIRED por DDR-1…DDR-7.

══════════════════════════════════════════════════════════════
2. OBJETIVO
══════════════════════════════════════════════════════════════
Dar a Reservas y Resumen superficies propias y diseñadas (05 §9–10): retirar «Dato:» en sus 4
apariciones con la sustitución de 03 §10 (DDR-05), y añadir la línea de tiempo comprimida del viaje.
SOLO presentación. Cero cambios de cálculo, datos, persistencia o mecanismos de reserva.
Las sub-pestañas Días · Dónde dormir · Reservas · Resumen ya existen desde B27: no se recrean.

══════════════════════════════════════════════════════════════
3. DECISIONES CERRADAS (normativas)
══════════════════════════════════════════════════════════════
DDR-1 — Orden de Reservas.
 · Información oficial con fecha: orden cronológico ascendente. Empate: desempate estable por el orden
   existente (hoy: planOrdinal, luego recordSourceIndex). Ya lo implementa lib; NO modificarlo.
 · Información editorial/registrada de antelación: lista separada, orden estable y neutral (el que ya
   produce buildReservationPreparationSummary: orden de ruta). NO ordenar por urgencia, prioridad,
   importancia ni recomendación. NO re-ordenar en la vista.
 · No inventar ni derivar fechas límite que no existan en la fuente.
 · Prohibido el lenguaje «urgente», «primero reserva esto», «prioridad», «más importante» o equivalentes.
 · Esto sustituye la literalidad «urgencia real» de 05 §9 (Art. 4 y 5).
 · Si comprobaras que alguna de las dos listas NO sale en ese orden, PARAR (DESIGN DECISION REQUIRED);
   no arreglar lib/.

DDR-2 — Separación entre fuentes (opción A).
 · Reservas = DOS listas visualmente separadas: (1) información/calendario oficial; (2) información
   editorial/registrada de preparación y antelación.
 · NO fusionarlas en una fila. Cada registro conserva su EvidenceMark: oficial ◼ Verificado; editorial
   ◧ Registrado.
 · Cada lista lleva su propio encabezado h3. La separación es visible sin leer el texto (marcador +
   encabezado + superficie), no solo por color.

DDR-3 — Horarios y calendario feb–mar 2027.
 · HoursPlanningSection permanece en Reservas como subsección (después de las dos listas).
 · «Calendario de la ventana febrero–marzo 2027» = el calendario oficial ya existente. NO crear un
   segundo calendario. NO añadir contenido nuevo. NO mover Horarios a Resumen.

DDR-4 — Nota única por sección (opción B).
 · Reservas: UNA sola nota visible de encuadre. Resumen: UNA sola nota visible de encuadre.
 · La nota se compone SOLO con información y advertencias ya existentes en el código; sin afirmaciones
   nuevas; sin redundancias. Fuentes de texto: los descargos hoy presentes (official-reservation-
   calendar__disclaimer, reservation-prep__disclaimer, hours-planning__disclaimer; en Resumen
   whole-trip-composition__intro y los avisos __incomplete).
 · El detalle específico que hoy vive en cada descargo se conserva en el `detail` del EvidenceMark
   correspondiente (DDR-06, 04 §2): por elemento, recuperable por lector de pantalla (aria-label/title
   cuando label es falso).
 · En Resumen se conserva como idea central que la superficie describe el viaje y no puntúa ni
   recomienda.
 · Prohibido crear banners/avisos adicionales. No eliminar información necesaria para interpretar una
   fuente o un cálculo: si una frase no cabe en la nota, va al detail del marcador.
 · Alcance: SOLO Reservas y Resumen. Los descargos de las tarjetas de día en Días NO se tocan.
 · Si al componer no se puede conservar una advertencia sin una afirmación nueva: PARAR.

DDR-5 — Línea de tiempo comprimida (opción A, cerrada).
 · SIN tokens de color por ciudad. Solo tokens neutros existentes (Art. 10). No crear tokens nuevos.
 · Cada día se identifica también por texto; nunca solo por color.
 · Segmentos de ancho igual por día. NO interactiva. NO escribe estado.
 · Día con más de una ciudad: etiqueta textual compuesta con las ciudades.
 · Móvil: banda horizontal comprimida sin scroll horizontal (320–430 px incluidos).
 · Si no cabe el nombre completo, la alternativa textual accesible conserva la información completa.
 · Alternativa textual obligatoria del tipo «Día N · ciudad» (lista visualmente oculta o equivalente
   accesible, no solo atributos de la banda).
 · prefers-reduced-motion no cambia contenido ni funcionalidad (la banda no anima).
 · «Color de la ciudad» de 05 §10 queda resuelto para B31 por texto + superficie neutral.
 · Ciudad de un día: derivar del hub de sus lugares con los datos existentes (sin inventar); día vacío:
   etiqueta textual «Día N · sin lugares» (texto derivable, no contenido nuevo de producto).
 · Marcador ◇ Estimado/Calculado en la banda (es derivada por la aplicación, Art. 4).

DDR-6 — «Alojamientos y traslados entre ciudades»: NO se mueve. Permanece al final de Días
(<details> dias__logistics). No dividir alojamiento/traslados. La atribución del handoff B30 a B9.5 no
tiene respaldo normativo y no es alcance.

DDR-7 — Enlaces de navegación.
 · Cuatro tarjetas de Resumen enlazan entre sub-pestañas, SIN nueva pila de historial:
     Visitas → Días · Traslados registrados → Días · Alojamiento → Dónde dormir · Rango del viaje → Días.
 · Los nombres de lugar de Reservas NO son enlaces a ficha. B31 NO introduce flujo DD-015 desde Reservas.
 · Los enlaces: operables con teclado, nombre accesible explícito (p. ej. «Ver Visitas en Días»),
   foco lógico tras navegar, sin escritura en storage.
 · Foco lógico (lectura mínima de la norma): tras la navegación el foco va al encabezado h2 de la
   superficie de destino (tabIndex -1). Nada más.
 · Naturaleza del enlace: es navegación, no acción → <button type="button"> con aspecto de enlace,
   sin flecha final (03 §10: prohibido «→» al final de botón/enlace). Objetivo táctil ≥ 44×44.

══════════════════════════════════════════════════════════════
4. HACER
══════════════════════════════════════════════════════════════
H1. RETIRAR «Dato:» (DDR-05, 03 §10). Cuatro apariciones en app/src/components/OrderedSequenceBuilder.tsx:
    · recorded-interval-fit__raw   (Días, tarjeta de día)
    · reservation-deadline__raw    (Días, tarjeta de día)
    · reservation-prep__raw        (Reservas)
    · hours-planning__raw          (Reservas)
    Sustitución: «{texto íntegro sin reescribir}» entre comillas + <EvidenceMark level="registrado"
    label /> con etiqueta visible «Registrado», situado tras el texto. El texto de la fuente se muestra
    íntegro o no se muestra (Art. 4). En las dos de Días el cambio es SOLO esa sustitución: no se
    tocan sus descargos, campos ni estructura. Resultado: 0 apariciones de la cadena «Dato:» en la
    interfaz y en app/src (excluidos comentarios de test que documenten la retirada, si los hay).
H2. RESERVAS (05 §9 + DDR-1/2/3/4):
    · h2 «Reservas»; UNA nota de encuadre (DDR-4) justo bajo el encabezado.
    · Lista 1 «Fechas oficiales» (OfficialReservationCalendarSection): orden cronológico existente,
      EvidenceMark ◼ por fila con detail (procedencia, alcance, relación con fecha de referencia como
      hoy); enlace «Ver fuente oficial» con nombre accesible que incluya el lugar
      («Ver fuente oficial de {lugar}»).
    · Lista 2 «Reservas por preparar» (ReservationPreparationSection): orden existente, cada fila con
      lugar, qué reservar, antelación registrada con ◧ y el texto entre comillas (H1).
    · Subsección «Horarios registrados» (HoursPlanningSection), con ◧ en cada fila según H1.
    · Se eliminan los tres descargos en prosa (calendar, prep, hours) sustituidos por la nota única +
      detail de marcadores. Cada frase eliminada debe tener destino (nota o detail) y quedar
      trazada en BLOCK_31_HANDOFF.md en una tabla «descargo → destino».
    · Conservar: toda la lógica reservation-*, el calendario oficial, la fecha de referencia única,
      las relaciones de fecha, la separación oficial/editorial («Nihon no combina ambas fuentes»
      pasa al detail/nota, no se pierde).
    · Las listas conservan la semántica <ul>/<li>. Sin lenguaje de urgencia/prioridad.
H3. RESUMEN (05 §10 + DDR-4/5/7):
    · h2 «Resumen»; UNA nota de encuadre (idea central: describe el viaje, no puntúa ni recomienda).
    · Cuatro tarjetas (h3 cada una): Visitas · Traslados registrados · Alojamiento · Rango del viaje,
      con los MISMOS datos de WholeTripCompositionSection (sin nuevas cifras ni nuevos cálculos).
      Cada tarjeta: EvidenceMark (◇ en cifras calculadas; ◼/◧ solo donde el dato ya tenga ese nivel),
      el aviso «incompleto» existente como texto de la tarjeta (no banner), y un control de navegación
      (DDR-7). Estado «unavailable» de la composición: una sola tarjeta/estado con el texto existente
      (wholeTripUnavailableText), sin banda ni enlaces.
    · Léxico 03 §10 / Art. 7: «traslado» en lugar de «tramo(s)»; retirar «posiciones de movimiento
      modeladas» y vocabulario de repositorio por su equivalente de viajero SIN cambiar el significado
      ni el número mostrado. Cada sustitución léxica registrada en el handoff.
    · Rejilla de tarjetas: columnas resueltas por el ancho del contenedor (DD-016), tarjeta mínima
      264 px; 1 columna en teléfono. No introducir geometría nueva.
    · Banda de línea de tiempo comprimida (DDR-5), arriba o bajo la nota, antes de las tarjetas.
H4. NAVEGACIÓN (DDR-7): implementar el salto entre sub-pestañas reutilizando el estado existente
    (viajeSection en App.tsx). Primero comprobar si OrderedSequenceBuilder ya recibe un callback
    utilizable. Si hace falta, se permite EXCLUSIVAMENTE pasar un callback que invoque el setter
    existente (p. ej. onNavigateSection) — cableado mínimo, sin estado nuevo, sin lógica nueva, sin
    historial. Cualquier otro cambio en App.tsx: PARAR. Si App.tsx cambia, actualizar
    b30-invariants-scope.test.ts (que hoy exige App.tsx idéntico a 52fbc6b) con una excepción
    explícita y citada, sin relajar nada más.
H5. ESTILOS: CSS nuevo junto al componente nuevo o en App.css solo con tokens existentes (Art. 10).
    Sin @media nuevos ad hoc si una regla de contenedor lo resuelve (08).

══════════════════════════════════════════════════════════════
5. FUERA DE ALCANCE
══════════════════════════════════════════════════════════════
lib/, data/, esquema V8 y su clave, cálculos, mecanismos de reserva, fechas oficiales, composición;
ZoneComparison, DayTimeline, DayOrderSheet, TripStop, UnassignedDrawer, PlaceDetail; App.tsx salvo H4;
descargos internos de las tarjetas de día en Días; mover «Alojamientos y traslados entre ciudades»;
nombres de lugar de Reservas como enlaces; tokens de color por ciudad; segundo calendario; fotografía
nueva; proponer, ordenar o puntuar; sincronización/backend; B10; despliegue, merge, main, Codex, Astra,
Vercel.

══════════════════════════════════════════════════════════════
6. ARCHIVOS PREVISIBLES
══════════════════════════════════════════════════════════════
MODIFICAR: app/src/components/OrderedSequenceBuilder.tsx; app/src/App.css;
  app/src/block20-place-detail.test.ts (L126–136: de =4 a 0, con cita de 10 §B9.5/DDR-05);
  app/src/b30-donde-dormir-wiring.test.ts (L103–105: de 4 a 0, con cita);
  app/src/components/OrderedSequenceBuilder.reservation-window-reference.test.ts (L56: espera la
  nueva forma «texto» + registrado);
  app/scripts/b27-viaje-dias-check.mjs (K04 y K05: de «sigue presente» a «0 apariciones», con cita);
  app/scripts/phase5a-rc-browser-audit.mjs (L809: espera «texto» + marcador registrado en lugar de /Dato: «.+»/);
  tests que fijen textos de descargos o «tramo(s)» de Resumen (localizar con grep y justificar cada uno);
  docs/CURRENT_WORK_HANDOFF.md.
POSIBLE: app/src/App.tsx (solo H4) y b30-invariants-scope.test.ts (solo si App.tsx cambia).
CREAR: componentes presentacionales puros (p. ej. TripSummaryCards.tsx, TripTimelineBand.tsx), sin
  estado de planificación ni escrituras; app/src/b31-*.test.ts; app/scripts/b31-reservas-resumen-check.mjs;
  docs/BLOCK_31_MISSION.md; docs/BLOCK_31_HANDOFF.md; entradas en docs/design/09 (§9).
MANTENER SIN CAMBIO: app/scripts/block20-place-detail-check.mjs (la ficha sigue sin «Dato:»).

══════════════════════════════════════════════════════════════
7. INVARIANTES A PROTEGER (B27–B30)
══════════════════════════════════════════════════════════════
B27: Días abre Viaje; estructura DayTimeline/TripStop, pies de día, filas InterHubSegment, «Sin asignar»;
  UNA sola instancia de OrderedSequenceBuilder («un escritor del borrador»).
B28: mutaciones V8 withPlaceMovedToPosition / withPlaceAddedToDay / withPlaceRemovedFromDay y
  «Mover a…» intactos.
B29: DayOrderSheet único escritor de orden; solo «Usar este orden» escribe; nada se auto-aplica.
B30: chooseZone/clearZone únicas escrituras de Dónde dormir; V8 y clave intactos; sin numerales ni
  ranking; 16 zonas; máx. 4 en comparación; DD-015 (ficha apilada, chevron «‹ Dónde dormir»,
  retorno exacto); pie «Dormís en …».
Transversales: identidad estable de día, anclaje de calendario, fecha de referencia capturada al abrir,
límites del viaje, alternativas verificadas; sin «mejor/recomendada/ranking/ganador»; Art. 3 (una nota
por pantalla en Reservas y Resumen), Art. 4, Art. 5, Art. 12.

══════════════════════════════════════════════════════════════
8. ESCRITURAS Y PERSISTENCIA
══════════════════════════════════════════════════════════════
CERO escrituras nuevas. Abrir Reservas o Resumen, leer la banda, navegar por los enlaces y volver NO
escriben (contador de setItem = 0). Vistas derivadas en memo a partir del estado existente. Sin claves
de storage nuevas, sin cambios de esquema, sin estado persistido. Las horas de inicio de Días siguen
siendo la escritura existente, sin cambios.

══════════════════════════════════════════════════════════════
9. DOCUMENTACIÓN NORMATIVA
══════════════════════════════════════════════════════════════
docs/design/09: registrar DDR-B31-01 … DDR-B31-07 (una por DDR-1…DDR-7, con estado RESUELTA, fecha,
afecta: 05 §9/§10, 10 §B9.5, y «alternativa descartada» donde corresponda), en el mismo formato que
DDR-B21-01…06. Usar prefijo propio; NO inventar numeración DD-0xx. Enmiendas justificadas:
  · 05 §9: «por urgencia real» → orden de DDR-1; «una sola nota al pie por sección» → DDR-4.
  · 05 §10: «color de la ciudad» → DDR-5 (texto + neutro).
  · 10 §B9.5: dejar constancia de que «Alojamientos y traslados entre ciudades» NO se mueve (DDR-6).
docs/BLOCK_31_MISSION.md = este texto. docs/BLOCK_31_HANDOFF.md: cambios, tabla «descargo → destino»,
tabla de sustituciones léxicas, cambios a tests con sección, resultados medidos, deuda heredada.
docs/CURRENT_WORK_HANDOFF.md: entrada B31 al inicio.

══════════════════════════════════════════════════════════════
10. ACCESIBILIDAD
══════════════════════════════════════════════════════════════
· Jerarquía: h2 superficie → h3 secciones/tarjetas → h4 solo si hace falta.
· Evidencia y ciudad nunca solo por color (03 §1.4). EvidenceMark con etiqueta visible o aria-label/
  title con el detail.
· Banda: alternativa textual «Día N · ciudad» (lista accesible) + aria-label de la banda; no interactiva,
  sin tabstops.
· Enlaces de Resumen: <button>, nombre accesible explícito, foco visible, ≥ 44×44, Intro/Espacio;
  tras navegar el foco va al h2 de destino (tabIndex -1).
· Enlaces «Ver fuente oficial de {lugar}» con rel="noreferrer" y target existente.
· Conservar el anunciador role="status" existente. Sin aviso en vivo nuevo.
· prefers-reduced-motion: sin animación nueva; contenido idéntico.

══════════════════════════════════════════════════════════════
11. RESPONSIVE
══════════════════════════════════════════════════════════════
Mobile first. Verificar 320/360/390/430/768/840/1200/1440 sin scroll horizontal. Banda: compacta en
teléfono; etiquetas truncadas visualmente solo si la alternativa textual conserva todo. Tarjetas de
Resumen según DD-016. Reservas: una columna en teléfono, las dos listas apiladas; en md+ pueden
mantenerse apiladas (no se exige paralelo).

══════════════════════════════════════════════════════════════
12. TESTS Y GATES
══════════════════════════════════════════════════════════════
Base de comparación: 1444e67. Todo fallo debe medirse TAMBIÉN allí.
ESTÁTICOS: tsc -b y oxlint con 0 errores (se tolera el aviso heredado de PlaceMap.tsx).
VITEST: los 3508 actuales (base B30) + nuevos, en verde. Cada cambio a un test existente justificado
  con documento y sección.
TESTS NUEVOS b31-*.test.ts (mínimo):
  · 0 ocurrencias de «Dato:» en app/src (código) y las 4 sustituciones presentes con registrado;
  · las dos listas de Reservas en componentes/encabezados distintos; oficial ◼, editorial ◧;
  · la lista oficial no se re-ordena en la vista; la de preparación no se re-ordena; ninguna palabra del
    léxico prohibido (urgente, prioridad, primero, importante, recomendad*, mejor) en las superficies
    nuevas;
  · una sola nota de encuadre por superficie (Art. 3);
  · cuatro tarjetas y mapeo de destinos (Visitas→dias, Traslados→dias, Alojamiento→dormir, Rango→dias);
  · banda: segmentos iguales, sin tokens de color de ciudad, etiqueta compuesta multiciudad, alternativa
    textual; sin «tramo(s)» en Resumen;
  · invariants-scope: lib/, data/, hooks, DayTimeline, DayOrderSheet, ZoneComparison, PlaceDetail sin
    cambios frente a 1444e67 (App.tsx solo con la excepción H4).
GATE NUEVO app/scripts/b31-reservas-resumen-check.mjs — Chromium 1194; NIHON_BROWSER=webkit; y reduced-motion:
  · «Dato:» = 0 en Días, Reservas, Resumen; texto íntegro + marcador registrado en las 4 superficies;
  · Reservas: dos listas, orden cronológico ascendente oficial y orden de ruta editorial, una sola nota,
    Horarios presente, sin segundo calendario;
  · Resumen: cuatro tarjetas con marcador, una nota, banda con alternativa «Día N · ciudad», día
    multiciudad, día vacío, estado unavailable;
  · enlaces: teclado, nombre accesible, destino correcto, foco en el h2 de destino, sin pila de
    historial (back del navegador no retrocede entre sub-pestañas de un modo nuevo), retorno a
    sub-pestañas previas intacto;
  · contador de setItem = 0 al abrir/navegar;
  · sin scroll horizontal en 320/360/390/430/768/840/1200/1440;
  · consola limpia; el chevron y DD-015 de Dónde dormir no cambian.
REGRESIÓN: B27 (48), B28 (43), B29 (36 medidos; el «40» documentado es erróneo, idéntico en base),
B30 (48); block20-place-detail-check; Phase 5A actualizado (L809).
DEUDA HEREDADA (NO arreglar, comparar contra 1444e67): block3/4/7 de zonas; phase5a (carrera de
decodificación de foto, solo si falla idéntico en base); b18-regression-check; b24-real-input P0-2;
block1/3/4/13/14 con selectores legacy; B28 T02 con Chromium 1234 (declarar siempre el binario usado).
CAMBIOS DE CONTRATO (no heredados): «Dato: = 4» → 0 en los tests/scripts de §6.
LÍMITE: iPhone Safari físico NO medido (declararlo, no es bloqueo).

══════════════════════════════════════════════════════════════
13. ENTREGA Y CIERRE
══════════════════════════════════════════════════════════════
Commits pequeños por tema. Push solo a la rama B31. Abrir PR en borrador con base B30; si no hay
credenciales, declarar «IMPLEMENTACIÓN CERTIFICABLE / CIERRE REMOTO BLOQUEADO» y no inventar estado.
Veredicto final exacto: «B31 CLAUDE: CERTIFICADO» o «NO CERTIFICADO» con causa exacta. No fusionar. No
empezar B10 ni ningún bloque posterior.
```
