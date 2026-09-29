# Bloque 26 — B8 «Nosotros» · Handoff

## Resultado

`Nosotros` contiene las cinco secciones de `05 §11`. Las dos tarjetas de Viajeros usan `PersonToken md`, permiten editar nombre, cambiar la persona activa mediante `setActiveTraveller`, reiniciar/quitar con confirmación y muestran el total real de posturas `interested` de cada persona. Se retiró el selector `TravellerBar` redundante de esta pantalla.

Copia del viaje conserva íntegros `usePortableBackup` y el formato/restore de Block 13. Sólo se hizo inequívoca la advertencia visual: «Esto sustituirá todo lo que hay en este navegador.»; sigue siendo reemplazo, no fusión.

El onboarding tiene los cinco pasos normativos, una fotografía existente, dos nombres y «¿Quién tiene este teléfono?». Trabaja sobre valores locales y sólo al pulsar «Entrar» actualiza el mismo documento mediante `renameTraveller`/`setActiveTraveller`; cerrar, Escape o Saltar no reescriben viajeros. Reabrir precarga nombres e identidad actuales y nunca toca preferencias ni planner.

Fuentes reutiliza `MlitAttribution` y agrupa las 244 entradas del registro fotográfico canónico por fuente/licencia, manteniendo cada obra, autor y enlaces individuales en desplegables. Dataset se identifica por el nombre versionado real del workbook (`docs/DATA_MODEL.md`); no existe una versión formal adicional. Acerca de lee `version` de `app/package.json`.

## Evidencia y límites

La prueba física Safari iPhone registrada en Blocks 15/16 sigue siendo evidencia histórica del mecanismo de backup. B26 no modificó `usePortableBackup`, schema, export, import, rollback o reload; la revalidación física de la nueva disposición queda pendiente porque este entorno no dispone de un iPhone. Chromium y, si está instalado, WebKit son comprobaciones suplementarias, no sustitutos de esa prueba física.

No se modificaron Astra, Claude, Vercel, datasets, fotografías ni planner; no se inició B9/B10. No fue necesaria una DDR: la ausencia de versión formal del dataset se declara explícitamente en vez de inventarla.
