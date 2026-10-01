// 03 §6 and 08 precedence: descriptive inventories cannot add unnamed movements.
export function motionContractErrors(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const named = new Set(['sheet-rise', 'place-card-save-mark', 'card-shimmer']);
  const errors = [];
  for (const m of source.matchAll(/@keyframes\s+([\w-]+)/g)) if (!named.has(m[1])) errors.push(`unnamed keyframes: ${m[1]}`);
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    for (const d of m[2].split(';')) {
      const decl = d.trim().replace(/\s+/g, ' ');
      if (/^animation(?:-name)?:/.test(decl) && !/^animation(?:-name)?:\s*none/.test(decl)) {
        const name = decl.split(':')[1].trim().split(' ')[0];
        if (!named.has(name)) errors.push(`unnamed animation: ${selector}: ${decl}`);
        if (/infinite/.test(decl) && name !== 'card-shimmer') errors.push(`non-skeleton loop: ${selector}`);
      }
      if (/^transition(?:-property)?:/.test(decl) && !/^transition(?:-property)?:\s*none/.test(decl)) {
        if (!['.button', '.icon-button', '.place-card__save'].includes(selector) || !/^transition:\s*transform var\(--dur-fast\) var\(--ease-standard\)$/.test(decl)) errors.push(`unnamed transition: ${selector}: ${decl}`);
      }
    }
  }
  return errors;
}
