import { useCallback, useEffect, useRef, useState } from "react";
import { ONBOARDING_STEPS, markOnboardingSeen } from "../lib/onboarding";
import { Icon } from "../icons/Icon";
import { PersonToken } from "./PersonToken";
import type { Traveller } from "../lib/travellers";

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
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  onCompleteIdentity: (names: readonly string[], activeTravellerId: string) => void;
};

export function Onboarding({ onClose, travellers, activeTravellerId, onCompleteIdentity }: Props) {
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(() => travellers.map((traveller) => traveller.label));
  const [selectedId, setSelectedId] = useState(activeTravellerId ?? travellers[0]?.id ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const total = ONBOARDING_STEPS.length + 1;
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
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button, input");
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
  const finish = () => {
    if (selectedId) onCompleteIdentity(names, selectedId);
    close();
  };

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

        {step === 0 ? <img className="onboarding__photo" src={`${import.meta.env.BASE_URL}images/places/JP-001/sensoji-temple.webp`} alt="Templo Sensō-ji en Tokio" /> : current && <div className="onboarding__art" aria-hidden="true"><Icon name={current.icon} size={24} /></div>}

        <h2 className="onboarding__title" id="onboarding-title">
          {isLast ? "¿Quiénes sois?" : current.title}
        </h2>
        {/* B24 (P1-05, `03 §2.3`): el contador de pasos baja bajo el título, en caja de frase —
            encima del título era un eyebrow. */}
        <p className="onboarding__step-count">
          Paso {step + 1} de {total}
        </p>
        {isLast ? (
          <div className="onboarding__identity">
            {travellers.map((traveller, index) => (
              <label key={traveller.id} className="onboarding__name">
                <PersonToken traveller={{ ...traveller, label: names[index] ?? traveller.label }} variant={index === 0 ? "a" : "b"} size="md" label={`Persona ${index + 1}`} />
                <span>Nombre de la persona {index + 1}</span>
                <input value={names[index] ?? ""} onChange={(event) => setNames((currentNames) => currentNames.map((name, nameIndex) => nameIndex === index ? event.target.value : name))} />
              </label>
            ))}
            <fieldset className="onboarding__phone"><legend>¿Quién tiene este teléfono?</legend>{travellers.map((traveller, index) => <label key={traveller.id}><input type="radio" name="onboarding-active" value={traveller.id} checked={selectedId === traveller.id} onChange={() => setSelectedId(traveller.id)} /> {names[index] || traveller.label}</label>)}</fieldset>
          </div>
        ) : <p className="onboarding__body">{current.body}</p>}

        <div className="onboarding__dots" aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
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
            onClick={() => (isLast ? finish() : setStep(step + 1))}
          >
            {isLast ? "Entrar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
