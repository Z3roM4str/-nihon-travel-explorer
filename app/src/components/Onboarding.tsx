import { useCallback, useEffect, useRef, useState } from "react";
import { ONBOARDING_STEPS, markOnboardingSeen } from "../lib/onboarding";
import { Icon } from "../icons/Icon";

/**
 * Three-card first-run explainer.
 *
 * Deliberately minimal: it says what Nihon is for in three sentences and gets out of the way.
 * It is not a tour, it never points at moving UI, and it never gates the application — Escape,
 * the backdrop, the × and "Saltar" all close it, and closing it marks it seen for good. The
 * header's "?" reopens it on demand, so dismissing it is never a one-way door.
 */

type Props = {
  onClose: () => void;
};

export function Onboarding({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const total = ONBOARDING_STEPS.length;
  const isLast = step === total - 1;

  const close = useCallback(() => {
    markOnboardingSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      // Minimal focus trap: the dialog's own controls are the only things reachable while it
      // is open, so Tab cannot wander into the application behind the backdrop.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  const current = ONBOARDING_STEPS[step];

  return (
    <div
      className="onboarding"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="onboarding__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <button
          type="button"
          className="onboarding__close"
          onClick={close}
          aria-label="Cerrar la introducción"
          title="Cerrar la introducción"
        >
          <Icon name="cerrar" size={20} />
        </button>

        <div className="onboarding__art" aria-hidden="true">
          <Icon name={current.icon} size={24} />
        </div>

        <h2 className="onboarding__title" id="onboarding-title">
          {current.title}
        </h2>
        {/* B24 (P1-05, `03 §2.3`): el contador de pasos baja bajo el título, en caja de frase —
            encima del título era un eyebrow. */}
        <p className="onboarding__step-count">
          Paso {step + 1} de {total}
        </p>
        <p className="onboarding__body">{current.body}</p>

        <div className="onboarding__dots" aria-hidden="true">
          {ONBOARDING_STEPS.map((entry, index) => (
            <span
              key={entry.title}
              className={`onboarding__dot ${index === step ? "onboarding__dot--active" : ""}`}
            />
          ))}
        </div>

        <div className="onboarding__actions">
          {step > 0 ? (
            <button type="button" className="button button--secondary" onClick={() => setStep(step - 1)}>
              Atrás
            </button>
          ) : (
            <button type="button" className="link-button onboarding__skip" onClick={close}>
              Saltar
            </button>
          )}
          <button
            type="button"
            className="button button--primary"
            ref={primaryRef}
            onClick={() => (isLast ? close() : setStep(step + 1))}
          >
            {isLast ? "Empezar a explorar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
