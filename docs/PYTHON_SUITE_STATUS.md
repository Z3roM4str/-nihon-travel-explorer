# Estado de la suite Python (`pytest scripts/`)

**Fecha:** 2026-09-26 · **Rama:** `claude/integration-b24-b23-b65-b67` (PR #152) · **Misión:** merge-readiness §3

## Resultado

| Momento | Commit | Resultado |
|---|---|---|
| `main` | `8eb725e` | 572 passed, 0 failed |
| Inicio de merge-readiness | `fac2e9e` | **19 failed, 590 passed, 9 errors** (150 subtests) |
| Tras `4e82d05` (B6.4) | — | 19 failed, 599 passed, 0 errors |
| Tras `2cca972` (baselines) | — | **618 passed, 0 failed, 0 errors** (156 subtests) |

Ejecución limpia de referencia (sin cachés ni bytecode):

```bash
find . -name __pycache__ -prune -exec rm -rf {} + ; rm -rf .pytest_cache
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest scripts/ -q -p no:cacheprovider
```

Requisitos de entorno: `pytest` y `Pillow` (`scripts/requirements.txt`). Sin ellos la colección
falla por import; eso sería categoría E y no se da con los requisitos instalados.

**Nada se ha marcado `skip`/`xfail`, ningún test se ha borrado, ningún assert se ha comentado o
debilitado, y ni la fotografía ni el dataset se han tocado.** Los 28 casos quedan activos.

## Clasificación

Categorías: A regresión real · B test obsoleto · C script/helper vigente roto · D fixture
histórica que ya no representa el pipeline · E entorno · F otro.

### G1 — B6.4: `NameError: BATCH_LIMIT` (9 errors) — **C**

Tests (todos en `setUpClass`): `scripts/test_block22_b6_4_photography.py::B64PhotographyTests::`
`test_a_b_coverage_and_exceptions_are_unchanged`, `test_base_sha_initial_matrix_and_place_images_hash`,
`test_grade_s_experience_coverage_matches_decisions`, `test_initial_grade_s_identity_and_roles_are_preserved`,
`test_list_identity_budgets_remain_under_contract`, `test_new_records_partition_and_experience_role`,
`test_plan_uses_stable_data_derived_batches`, `test_registry_sync_duplicates_and_identity_ordering`,
`test_rejected_prepared_candidates_are_not_in_registry`.

- **Causa.** `BATCH_LIMIT` sólo se asignaba dentro de `if __name__ == "__main__":` (CLI
  `--through-batch`). Bajo pytest el módulo se importa, ese bloque no corre y `setUpClass` leía un
  nombre inexistente.
- **Resolución (`4e82d05`).** `BATCH_LIMIT = None` a nivel de módulo (= todos los lotes); la CLI
  lo sigue acotando. Ningún assert cambia.
- **Estado:** activo. **Evidencia:** 9/9 passed; `python3 scripts/test_block22_b6_4_photography.py`
  → OK. Nota: `--through-batch 1` contra el registro final falla 2 checks *por diseño* (certifica
  el estado tras el lote 1, cuando los lotes posteriores aún no existían); no forma parte de la
  suite activa y no se ha cambiado.

### G2 — Réplicas de selectores históricos sobre baselines reconstruidas (19 failed) — **C** (causa raíz única)

| Fichero | Tests | Baseline |
|---|---|---|
| `test_a_grade_photography_selector.py` | 5: `test_all_targets_are_a_grade_uncovered_and_unique`, `test_checked_in_manifest_is_exact_selector_output`, `test_design_comparison_category_breadth_reproduces`, `test_exact_phase4e_fixture_is_reproduced`, `test_temporal_risk_is_delayed_but_not_excluded` | phase4e (36) |
| `test_a_grade_photography_selector_ii.py` | 6: `test_24_32_40_all_reach_19_eligible_categories`, `test_all_targets_are_a_grade_uncovered_and_unique`, `test_carried_fail_closed_ids_never_reenter`, `test_checked_in_manifest_is_exact_selector_output`, `test_exact_phase4g_fixture_is_reproduced`, `test_temporal_risk_flags_are_exact` | phase4g (58) |
| `test_ab_photography_selector.py` | 7: `test_all_targets_are_ab_uncovered_unique_and_not_failed`, `test_baseline_prefix_survives_future_appends`, `test_carried_fail_closed_ids_never_reenter`, `test_checked_in_manifest_is_exact_selector_output`, `test_exact_phase4i_fixture_is_reproduced`, `test_fixture_contains_fukuoka_and_architecture_b_targets`, `test_temporal_risk_flags_are_exact` | phase4i (85) |
| `test_phase4m_stop_vs_continue.py` | 1: `PolicyFidelityTests::test_replaying_the_phase_4k_baseline_reproduces_its_pinned_fixture` | phase4k (113) |

- **Causa.** Estos tests reproducen byte a byte lo que un selector histórico eligió sobre el
  catálogo de su época. `scripts/photography_baseline.py` reconstruye esa época quitando lo que
  añadieron los lotes posteriores y exige que coincida con el prefijo append-only del registro.
  Block 22 (B6.1–B6.7) añadió **81 registros** mediante *planes de adquisición*
  (`block22-b6-N-acquisition-plan.json`), que el helper no conocía (su guarda sólo buscaba
  `*-batch*.json`), y desde B6.5 los **inserta junto a su lugar** (orden de galería identity →
  experience → complementaria, `docs/BLOCK_22_B6_5_REPORT.md`) en lugar de añadirlos al final.
  Resultado: phase4k se reconstruía con 191 registros en vez de 113, y el prefijo de phase4i
  contenía placeIds duplicados.
- **Por qué es C y no B/D.** Los selectores y sus fixtures siguen siendo correctos —son la prueba
  de que el histórico de adquisición es reproducible—; lo que estaba roto era la herramienta
  vigente que reconstruye su entrada. Se comprobó que el orden de los 163 registros de `main` se
  conserva como subsecuencia exacta del registro actual y que los 7 planes explican exactamente
  los 81 registros nuevos (ni uno más, ni uno menos).
- **Resolución (`2cca972`).** `photography_baseline.py` registra los 7 planes B22 (con guarda que
  falla si aparece un plan no registrado), identifica sus registros por `originalTitle` y aplica
  las dos derivaciones (semántica y posicional) sobre el registro sin ellos, que vuelve a ser
  append-only. `test_ab_photography_selector.py`, que tenía su propia reconstrucción, usa la misma
  regla del helper. Ningún assert, fixture, manifiesto ni dato cambia.
- **Estado:** activo. **Evidencia:** 19/19 passed; baselines reconstruidas 36/58/113 exactas;
  control de mutación: desregistrar `b6-7` → `AssertionError: unregistered Block 22 acquisition
  plan(s)`; desactivar la exclusión B22 → vuelve a fallar phase4m.

### Categorías A, B, D, E, F

Ningún caso. No se encontró regresión de producto (A), test obsoleto (B), fixture a retirar (D),
fallo sólo de entorno (E) ni otro (F).
