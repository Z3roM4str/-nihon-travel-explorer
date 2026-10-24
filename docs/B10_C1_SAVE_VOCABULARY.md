# B10-C1 — «guardar / guardado» en la prosa

**Estado: CERRADO SIN CAMBIO DE COPY.** No existe una regla canónica que determine «marcar» como único vocabulario correcto, así que no se edita ninguna de las seis cadenas (una edición sería una preferencia editorial nueva).

## Qué dice realmente la regla
`03 §10` (léxico y reglas de copy):
* «No decir: **Guardar en Quiero ir** → decir: **Quiero ir**.»
* «**Una acción conserva su nombre en todo el flujo**: el botón «Quiero ir» produce el estado «Quiero ir», no «Guardado».»

Es una regla sobre el **nombre de la acción y del estado** (botón, `aria-label`, insignia), no sobre cada verbo de la prosa. Eso ya se cumple y el gate lo mantiene: el corazón se llama «Quiero ir: {lugar}», «Quitar {lugar} de Quiero ir», y las ocurrencias de «Guardar … en Quiero ir» son **0** (`b10-microcopy-check`).

## Lo que el propio texto normativo hace
* `05 §6` (Quiero ir, estado vacío; copy literal): «Todavía no habéis marcado nada. Pulsa el corazón en cualquier lugar que os llame; **guardad de más**, que luego se recorta.» — mezcla «marcado» (estado) y «guardad» (voz imperativa) **en la misma frase**; el gate B25 fija ese literal.
* `05 §8` (Dónde dormir): «Ordenadas por cercanía a **lo que habéis guardado**… sitios **guardados**».
* `03 §10` ejemplo: «Todavía no habéis **marcado** nada en Tokio».

Los documentos normativos usan ambos verbos; ninguno prescribe cuál para cada superficie. Unificar sería elegir.

## Las seis cadenas
| # | Cadena | Dónde | Veredicto |
|---|---|---|---|
| 1 | «…guardad de más, que luego se recorta» | `SelectionPanel` (vacío de Quiero ir) | **literal normativo** de `05 §6`; no se toca |
| 2 | «Las dos personas habéis guardado este lugar» | `InterestLegend` | prosa descriptiva; el nombre de estado sigue siendo «Quiero ir»; sin regla que prescriba otro verbo |
| 3 | «{n} guardados en {hub} están en …» | `SelectionAnalysis` | ídem |
| 4 | «Todavía no habéis guardado nada.» | `traveller-presentation` | ídem (el ejemplo de `03 §10` con «marcado» es un ejemplo, no un literal para esta superficie) |
| 5 | «Sólo {otra persona} lo guardó. Tú aún no has opinado.» | `divergence-presentation` | ídem |
| 6 | «Todavía no habéis guardado nada.» | `divergence-presentation` | ídem |

## Protección
`b10-microcopy-check` S03 sigue fijando el recuento **exacto** (una cadena «guardar/guardado» nueva falla): si alguna vez Producto escribe una regla que prescriba el verbo, se aplica en un solo lugar. Hasta entonces no hay nada pendiente que bloquee el cierre de la versión.

## Observación (no bloqueante)
`InterestLegend` mezcla en la misma tabla «Todavía nadie ha **marcado** este lugar» y «habéis **guardado**»: es coherente con la mezcla del texto normativo, pero si en un futuro se redacta una guía de voz conviene decidir un único verbo para el acto de elegir un lugar.
