# Nihon — Sistema de diseño y producto

Fuente de verdad de diseño para Nihon a partir de v1.1.0.

Esta carpeta es **normativa**. Los agentes de ingeniería (Claude Code, Codex, ChatGPT)
implementan lo que aquí se especifica y **no reinterpretan** las decisiones de UX/UI.
Si una decisión necesaria no está definida, se detienen y devuelven
`DESIGN DECISION REQUIRED` (ver `08_GUARDRAILS_DE_INGENIERIA.md`).

## Orden de lectura

| # | Documento | Para qué sirve |
|---|---|---|
| 00 | [Constitución de diseño](00_CONSTITUCION_DE_DISENO.md) | Las 12 reglas que nadie puede romper sin consultar. Léelo siempre. |
| 01 | [Visión y diagnóstico](01_VISION_Y_DIAGNOSTICO.md) | Qué falla hoy, hacia dónde va Nihon, principios. |
| 02 | [Arquitectura y navegación](02_ARQUITECTURA_Y_NAVEGACION.md) | Estructura de la app, shell, mapa de pantallas, responsive. |
| 03 | [Sistema de diseño](03_SISTEMA_DE_DISENO.md) | Tokens: color, tipografía, espaciado, radios, sombras, motion, iconos. |
| 04 | [Reglas de componentes](04_REGLAS_DE_COMPONENTES.md) | Contrato de cada componente reutilizable. |
| 05 | [Especificaciones de pantalla](05_ESPECIFICACIONES_DE_PANTALLA.md) | Pantalla por pantalla, con criterios de aceptación. |
| 06 | [Estrategia fotográfica](06_ESTRATEGIA_FOTOGRAFICA.md) | Cobertura, roles de imagen, galería, créditos, rendimiento. |
| 07 | [Viaje compartido (futuro)](07_VIAJE_COMPARTIDO_FUTURO.md) | Cómo preparar la UX para la sincronización v1.2.0. |
| 08 | [Guardrails de ingeniería](08_GUARDRAILS_DE_INGENIERIA.md) | Qué decide ingeniería y qué requiere revisión de diseño. |
| 09 | [Decisiones de diseño](09_DECISIONES_DE_DISENO.md) | Registro append-only. Aquí se añaden decisiones nuevas. |
| 10 | [Roadmap de bloques](10_ROADMAP_DE_BLOQUES.md) | Implementación incremental, dependencias, criterios de cierre. |

## Regla de oro

Nihon **no se reconstruye**. Todo lo que existe en v1.1.0 —214 lugares, mapa nacional,
filtros, dos viajeros, planner manual, zonas de alojamiento, provenance, freshness,
respaldo JSON, 91 ficheros de test— se conserva. Este sistema **reubica, reencuadra y
reviste** ese trabajo. Ninguna capacidad se elimina; si se mueve, este documento dice
adónde.

## Estado

- Base auditada: `v1.1.0` (commit de `main`, 661 commits, 214 lugares, 163 imágenes).
- Auditoría realizada sobre el código y sobre la app desplegada, en viewport iPhone
  (393×852) y escritorio (1440×900).
- Esta versión del sistema: **1.0 — congelada para implementación**.
