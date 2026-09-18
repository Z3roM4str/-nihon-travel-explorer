import { INTEREST_LEVELS } from "../lib/interest-level";

/**
 * What the colours on the map and the badges on the cards actually mean.
 *
 * Collapsed by default and implemented as a native `<details>`: it answers the "what does this
 * colour mean?" question at the moment it is asked, without spending permanent map space on a
 * key most readers only need once.
 */
export function InterestLegend() {
  return (
    <details className="interest-legend">
      <summary className="interest-legend__summary">
        <span aria-hidden="true">🎨</span> ¿Qué significan los colores?
      </summary>
      <ul className="interest-legend__list">
        {INTEREST_LEVELS.map((level) => (
          <li key={level.level} className="interest-legend__item">
            <span className={`interest-legend__swatch badge--grade-${level.grade}`} aria-hidden="true">
              {level.glyph}
            </span>
            <span className="interest-legend__text">
              <span className="interest-legend__label">{level.label}</span>
              <span className="interest-legend__description">{level.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
