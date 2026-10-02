import { describe, it, expect } from 'vitest';
import { motionContractErrors } from './motion-contract.mjs';
describe('normative motion inventory guards', () => {
  it('accepts named press/mark/sheet and skeleton, with instantaneous reduced states', () => {
    expect(motionContractErrors('.button { transition: transform var(--dur-fast) var(--ease-standard); } @keyframes sheet-rise { from { transform: translateY(100%); } } .sheet { animation: sheet-rise var(--dur-sheet); } @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }')).toEqual([]);
  });
  it('rejects a new transition hidden in an extracted component stylesheet', () => {
    expect(motionContractErrors('.place-card { transition: opacity 1s ease; }')).not.toEqual([]);
  });
  it('rejects undeclared motion through either animation syntax and an infinite mark', () => {
    for (const css of ['@keyframes toast-in { from { opacity: 0; } }', '.toast { animation-name: toast-in; }', '.heart { animation: place-card-save-mark 1s infinite; }']) expect(motionContractErrors(css)).not.toEqual([]);
  });
});
