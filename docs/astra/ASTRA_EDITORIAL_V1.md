# Astra editorial v1 — «Japón, a su manera»

Esta especificación rige el pulido de la línea Astra de Nihon Travel Explorer. Se trabaja sobre la aplicación React/Vite/TypeScript/Leaflet existente, preservando datos, funciones y el plan V7. Claude/B21, `main`, integración, publicación y nuevas funciones quedan fuera del alcance. La experiencia sigue este orden: descubrir, entender, guardar e indicar el interés personal, comparar y planificar. Frase editorial: **«Marca lo que te gusta. El viaje lo armamos después.»**

## Protección y continuidad

Partir del HEAD Astra corregido y verificado `1d4c9cee7ad9ee864b7d4d4b3fdd79e0fd0625e4`, que incluye la corrección CSS `95377a20ab06868ac0e5e631a92109a15f08686c` para apilar selectores hasta 480 px. Mantener una rama y worktree aislados. No modificar los checkouts, commits ni documentación de Claude/B21. No hacer reset, stash automático, limpieza destructiva ni sobrescribir avances posteriores. La continuidad operativa única es `docs/astra/CONTINUAR_CON_SOL.md` y debe actualizarse al terminar cada sesión.

## Identidad y navegación

Tokens: fondo `#f7f5f0`, superficie `#ffffff`, secundaria `#efebe3`, texto `#202621`, secundario `#5f685f`, línea `#d9ddd5`, borde `#788277`, terracota `#a83727`, hover `#85291e`, selección `#fbece6`, foco `#175ea8`, aviso `#774a10` sobre `#fff1d6`; conservar error de persistencia rojo accesible. Tipografía de sistema, base 16/24, metadatos 14/20, créditos 13/18, título 30/34 móvil y 42/46 escritorio, títulos de tarjeta 20/26. Espaciado 4/8/12/16/24/32/48; radios 12 controles, 20 tarjetas, 24 diálogo; sombras discretas. Objetivos táctiles de al menos 44×44 y acciones principales de 48 px. Foco visible, estado comprensible sin solo color, contraste 4.5:1 texto normal y 3:1 texto grande/controles, movimiento reducido respetado.

Dos destinos principales: **Explorar** y **Nuestro viaje**. Mapa es una vista de Explorar. Regiones conserva acceso y retorno al contexto. Cabecera de 72/64/56 px y márgenes de 40/24/16 px en escritorio/tableta/móvil; contenido centrado hasta unos 1280 px. Navegación inferior móvil con safe area y espacio reservado. Cuadrícula de 1 columna bajo 768 px, 2 entre 768–1199, 3 desde 1200. Selectores en una columna hasta 480, dos entre 481–767 solo si caben, flexibles sobre 768. Priorizar legibilidad a zoom 200 %. «Mis gustos ▾» solo puede mostrarse si tiene interacción real; de otro modo identificar discretamente «Viaje de Fernando y Lorena».

## Explorar

Orden: encabezado y explicación, búsqueda, selectores **Destino** y **Experiencia**, Filtros con contador, cantidad y modo Lista/Mapa, tarjetas y «Ver 12 más». Mantener orden, categorías, búsqueda, filtros, paginación, URL, historial, mapa y acceso geográfico. No duplicar resultados ni inventar popularidad, reseñas, puntuaciones o personalización. Con filtros activos, mostrar resumen y limpiar mediante la semántica existente. La zona completa de filtros no queda fija en móvil.

## Tarjetas y fotografía

Foto real 4:3, galería cuando haya varias imágenes, crédito desplegable de la imagen activa, recomendación comprensible, nombre completo, zona/categoría, descripción de hasta tres líneas si íntegra en ficha, duración/reserva, aviso estacional visible y guardado general. Nombre y foto abren la ficha; guardar, fotos y crédito no. Galería con anterior, contador «1 / N», siguiente, objetivos táctiles accesibles, sin autoplay, fallo con Reintentar y navegación persistente. No repetir/fabricar fotografías ni autorías. «Me gustaría ir» / «Me gustaría ir ✓» expresa guardado general y usa `aria-pressed`. Estado normal blanco con borde y texto terracota; seleccionado terracota suave. Relleno terracota sólido para la acción dominante.

## Ficha

Pantalla completa móvil; diálogo centrado hasta unos 1040 px en escritorio, una zona principal de scroll. Orden: cerrar/volver, aviso de persistencia dentro del diálogo, galería, nombre y nombre japonés existente, ubicación/categoría, descripción/experiencia, duración/precio/reserva/temporada, información práctica, cercanos/traslados, fuentes y detalles. Advertencias críticas siempre visibles. No interpretar desconocido como gratis, abierto o sin reserva; mantener confianza de estimaciones. Guardado en flujo tras los datos de decisión salvo sticky probado sin obstrucción. Preservar Escape, foco inicial y atrapado, `inert`, retorno al disparador, historial y prioridad de cierre de lightbox.

## Nuestro viaje

Un viaje compartido. Texto: «Aquí reunimos lo que nos interesa. Guardar un lugar no lo añade todavía al itinerario.» Indicar almacenamiento local real sin afirmar sincronización entre dispositivos. Mantener Todos, Fernando, Lorena, Coincidencias, contadores y unión sin duplicados. Controles móviles pueden envolver. Filas compactas con miniatura si existe, nombre, ciudad, duración, intereses de ambos y guardado general. Interés personal y guardado general son distintos; desmarcar uno no borra otros ni plan. Llamar «Quitar de guardados generales» al antiguo guardado heredado y explicar «Los intereses de Fernando y Lorena se mantienen». Conservar protección de lugares planificados. «Comparar selección» secundaria y «Planificar con mis guardados» principal. Vacío: «Empiecen por un lugar que les emocione» y «Explorar lugares». Coincidencias vacías: «Todavía no han marcado el mismo lugar. Sus elecciones individuales siguen guardadas».

## Otras superficies y límites técnicos

Mapa conserva Leaflet, filtros, marcadores, carga diferida y apertura de ficha. Regiones no reduce catálogo ni navegación. Comparación puede desplazarse horizontalmente dentro de su propio contenedor, sin desbordar la página. Planificador solo recibe pulido visual de contenedores, botones, títulos y avisos; no cambia secuencias, horarios, reservas ni traslados. No añadir vuelos, hospedaje, integraciones ni funciones Claude/B21. Reutilizar componentes, helpers y datos. No instalar dependencias salvo necesidad demostrada y autorización. CSS acotado; los portales requieren contexto explícito. Agrupar reglas responsive, evitar cascadas contradictorias y `!important`. No migrar almacenamiento, versiones, IDs, unión, aislamiento entre viajes ni recuperación.

## Verificación y cierre

Ejecutar lint, build, pruebas Astra, suite completa y auditoría de navegador del repositorio; distinguir regresión, problema preexistente y entorno con evidencia. Revisar capturas reales a 320, 375, 390, 430, 768, 1024 y 1440 px, además de zoom 200 %. En Explorar, ficha y viaje revisar overflow, textos, controles, imágenes/créditos, vacíos/carga/error, teclado/foco y contenido no tapado. Probar filtros, mapa, planificador, guardados generales, intereses, unión/coincidencias, protección del plan, URL/atrás/adelante, galería y fallo/reintento de persistencia con una sola alerta pertinente. Registrar SHA, comandos, resultados y capturas; repetir verificación pertinente tras cambios. No llamar PASS a lo bloqueado. Commits locales coherentes, sin push, merge, PR, despliegue, cambios en `main`, credenciales, TLS o seguridad. Solo declarar la línea lista para revisión independiente si todo el alcance y las verificaciones esenciales pasan.
