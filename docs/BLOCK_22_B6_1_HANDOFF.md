# Handoff específico — Bloque 22 B6.1

## Estado

**CERRADO.** La rama `codex/block-22-b6-1-grade-s-photography` parte exactamente de
`e3fca24a362efcfa99bd141599972944c0fabb99`. La cobertura grado S es 32/32: los cuatro objetivos
del baseline (`JP-033`, `JP-126`, `JP-203`, `JP-204`) tienen una única fotografía `identity`
licenciada y adquirida por el pipeline.

El informe probatorio completo está en `docs/BLOCK_22_B6_1_REPORT.md`.

## Checkpoints

1. `2d2a5e2` — foundation B6: baseline, roles, LQIP, `-400w`, validadores y gates.
2. `e0a885b` — cuatro adquisiciones S, metadatos, assets, derivados y tests de consumo.
3. El commit que contiene este handoff cierra validación, pesos e informe.

Los dos primeros checkpoints ya están publicados. El tercero debe permanecer sobre la misma rama
y revisarse contra `claude/block-20-b4-place-detail-photography`, nunca contra `main`.

## Hechos que debe preservar la revisión

- `app/src/data/place-images.ts` no se editó y conserva SHA-256
  `0326a91c42b5f46027c1ce74eea93895eb5a8053a07a6f2025abe022009270fb`.
- Registro final: 167 imágenes / 161 lugares; cada objetivo B6.1 tiene exactamente una imagen.
- Presupuesto real de lista: Tokio 3.143.702 B; Osaka 3.096.870 B, ambos <3.500.000 B.
- Derivadas/LQIP: 167 registros verificados con `-400w`, `-800w` y LQIP generado.
- Tests fotográficos Python: 38 + 28 + 8 pasan; Vitest enfocado 48/48; build/lint pasan;
  auditoría Edge phone/tablet/desktop 81/81.
- La suite Vitest completa ejecutó 3315 tests: 3301 pasan y 14 fallan por problemas heredados de
  paths/CRLF en Windows, detallados en el informe; ningún fallo pertenece a B6.1.

## Fuera de alcance

- No iniciar B6.2 ni adquirir los 35 lugares grado A desde esta rama.
- No añadir `experience` ni tercera imagen a estos cuatro lugares; corresponden a B6.4/B6.5.
- No mezclar B21, no modificar `docs/CURRENT_WORK_HANDOFF.md`, y no usar Astra.
- No hay una decisión de diseño pendiente: este bloque sólo cambió datos, pipeline y tests.
