import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ONBOARDING_IDENTITY,
  ONBOARDING_INTRO,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  markOnboardingSeen,
  pickOnboardingHero,
} from "../lib/onboarding";
import type { Traveller } from "../lib/travellers";
import { getAllPlaces } from "../data/store";
import { cardImageUrl, resolvePlaceImages } from "../data/place-images";
import { Icon } from "../icons/Icon";
import { PersonToken } from "./PersonToken";

/**
 * `05 §1` — el explicador, en cinco pasos: Hola · Explora Japón · Marca lo que te gustaría ver ·
 * Después comparáis · ¿Quiénes sois?
 *
 * Deliberately never a gate: Escape, the backdrop, the × and «Saltar» all close it, and every one
 * of them marks it seen. Nosotros › Cómo funciona Nihon reopens it on demand.
 *
 * **El último paso escribe en el MISMO almacén de `useTravellers`** (nombre y persona activa),
 * a través de `onSaveIdentity`; no existe un segundo estado de nombres y no hay migración. Los
 * campos arrancan con lo que ya hay guardado, así que reabrirlo desde Nosotros nunca destruye
 * nombres ni preferencias.
 *
 * **Qué significa cerrar sin «Entrar».** Escape, ×, fondo y «Saltar» no escriben NADA, ni la
 * primera vez ni al reabrir. En la primera ejecución eso ya equivale a lo que pide `05 §1`
 * («saltar acepta los nombres por defecto y la persona A como activa»): el almacén nace con
 * «Persona 1 / Persona 2» y la primera persona activa, y «Saltar» los deja tal cual. Al
 * reabrirlo, «Saltar» conserva lo que la gente ya eligió; borrar o revertir nombres al saltar
 * sería una semántica destructiva que ningún documento pide. Sólo «Entrar» escribe.
 */

type Props = {
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  onSaveIdentity: (labels: Readonly<Record<string, string>>, activeId: string | null) => void;
  onClose: () => void;
};

export function Onboarding({ travellers, activeTravellerId, onSaveIdentity, onClose }: Props) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const total = ONBOARDING_TOTAL_STEPS;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  // Borradores locales del último paso, sembrados con lo que ya está guardado.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(travellers.map((traveller) => [traveller.id, traveller.label]))
  );
  const [holderId, setHolderId] = useState<string | null>(
    () => activeTravellerId ?? travellers[0]?.id ?? null
  );

  const hero = useMemo(
    () => pickOnboardingHero(getAllPlaces(), (place) => resolvePlaceImages(place.id, place.images)),
    []
  );

  const close = useCallback(() => {
    markOnboardingSeen();
    onClose();
  }, [onClose]);

  const enter = useCallback(() => {
    onSaveIdentity(drafts, holderId);
    close();
  }, [close, drafts, holderId, onSaveIdentity]);

  useEffect(() => {
    // En «¿Quiénes sois?» el foco va al primer nombre —es lo que hay que hacer—; en el resto, al
    // botón principal.
    const firstName = isLast
      ? dialogRef.current?.querySelector<HTMLElement>(".onboarding__input")
      : null;
    (firstName ?? primaryRef.current)?.focus();
  }, [step, isLast]);

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
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])"
      );
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

  const content = step >= 1 && step <= ONBOARDING_STEPS.length ? ONBOARDING_STEPS[step - 1] : null;
  const title = isFirst ? ONBOARDING_INTRO.title : isLast ? ONBOARDING_IDENTITY.title : content?.title;

  return (
    <div
      className="onboarding"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className={`onboarding__dialog ${isFirst ? "onboarding__dialog--hero" : ""} ${isLast ? "onboarding__dialog--identity" : ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <button
          type="button"
          className={`onboarding__close ${isFirst && hero ? "onboarding__close--on-photo" : ""}`.trim()}
          onClick={close}
          aria-label="Cerrar la introducción"
          title="Cerrar la introducción"
        >
          <Icon name="cerrar" size={20} />
        </button>

        {isFirst && (
          <div className="onboarding__hero">
            {hero && (
              <img
                className="onboarding__hero-image"
                src={cardImageUrl(hero.image.url) ?? hero.image.url}
                alt={hero.image.alt}
                decoding="async"
              />
            )}
            <div className="onboarding__hero-scrim" aria-hidden="true" />
            <div className="onboarding__hero-text">
              <h2 className="onboarding__display" id="onboarding-title">
                {ONBOARDING_INTRO.title}
              </h2>
              <p className="onboarding__tagline">{ONBOARDING_INTRO.tagline}</p>
            </div>
          </div>
        )}

        {content && (
          <div className="onboarding__art" aria-hidden="true">
            <Icon name={content.icon} size={24} />
          </div>
        )}

        {!isFirst && (
          <h2 className="onboarding__title" id="onboarding-title">
            {title}
          </h2>
        )}
        {/* B24 (P1-05, `03 §2.3`): el contador de pasos baja bajo el título, en caja de frase. */}
        <p className="onboarding__step-count">
          Paso {step + 1} de {total}
        </p>
        {content && <p className="onboarding__body">{content.body}</p>}

        {isLast && (
          <div className="onboarding__identity">
            <p className="onboarding__body">{ONBOARDING_IDENTITY.body}</p>

            <ul className="onboarding__people">
              {travellers.map((traveller, index) => {
                const draft = drafts[traveller.id] ?? traveller.label;
                const shown: Traveller = { ...traveller, label: draft.trim() || traveller.label };
                const inputId = `onboarding-name-${traveller.id}`;
                return (
                  <li key={traveller.id} className="onboarding__person">
                    <PersonToken
                      traveller={shown}
                      variant={index === 0 ? "a" : "b"}
                      size="md"
                      label={shown.label}
                    />
                    <label className="onboarding__name" htmlFor={inputId}>
                      <span className="onboarding__name-label">
                        Nombre de la persona {index + 1}
                      </span>
                      <input
                        id={inputId}
                        className="onboarding__input"
                        type="text"
                        autoComplete="off"
                        value={draft}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [traveller.id]: event.target.value }))
                        }
                      />
                    </label>
                  </li>
                );
              })}
            </ul>

            <fieldset className="onboarding__holder">
              <legend className="onboarding__holder-legend">
                {ONBOARDING_IDENTITY.whoHoldsLegend}
              </legend>
              <div className="onboarding__holder-options">
                {travellers.map((traveller, index) => {
                  const label = (drafts[traveller.id] ?? traveller.label).trim() || traveller.label;
                  const selected = holderId === traveller.id;
                  return (
                    <label
                      key={traveller.id}
                      className={`onboarding__holder-option ${selected ? "onboarding__holder-option--selected" : ""}`.trim()}
                    >
                      <input
                        type="radio"
                        name="onboarding-holder"
                        className="onboarding__holder-radio"
                        checked={selected}
                        onChange={() => setHolderId(traveller.id)}
                      />
                      <PersonToken
                        traveller={{ ...traveller, label }}
                        variant={index === 0 ? "a" : "b"}
                        size="sm"
                        label={label}
                      />
                      <span className="onboarding__holder-name">{label}</span>
                      {selected && <Icon name="confirmado" size={16} aria-hidden="true" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

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
            onClick={() => (isLast ? enter() : setStep(step + 1))}
          >
            {isFirst
              ? ONBOARDING_INTRO.cta
              : isLast
                ? ONBOARDING_IDENTITY.cta
                : "Siguiente"}
          </button>
        </div>
        {step > 0 && (
          <div className="onboarding__skip-row">
            <button type="button" className="link-button onboarding__skip" onClick={close}>
              Saltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
