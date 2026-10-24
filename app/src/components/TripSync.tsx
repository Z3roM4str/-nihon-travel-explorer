import { useEffect, useState } from "react";
import { firebaseConfig } from "../lib/firebase-config";
import type { SyncHoldPrompt } from "../lib/firebase-sync";

const config = firebaseConfig(import.meta.env);

export function SyncHoldActions({ hold }: { hold: SyncHoldPrompt }) {
  if (hold.kind === "who-are-you") {
    return (
      <fieldset className="trip-sync__who">
        <legend>¿Quién eres en este viaje?</legend>
        {hold.names.slice(0, 2).map((name, slot) => (
          <button key={slot} type="button" className="button button--secondary" onClick={() => hold.choose(slot as 0 | 1)}>
            {name}
          </button>
        ))}
      </fieldset>
    );
  }
  return (
    <div className="trip-sync__hold">
      <button type="button" className="button button--secondary" onClick={hold.approve}>
        Sí, quitar esos {hold.removed} «me gusta» en este teléfono
      </button>
      <button type="button" className="button button--secondary" onClick={hold.keep}>
        No, conservar los nuestros
      </button>
    </div>
  );
}

export function TripSync() {
  const [message, setMessage] = useState("Conectando el viaje… Sus datos locales se conservan.");
  const [hold, setHold] = useState<SyncHoldPrompt | null>(null);
  useEffect(() => {
    if (!config) return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void import("../lib/firebase-sync").then(({ connectFirebase, localSyncAdapter, syncJournalKey }) => {
      if (disposed) return;
      const connection = connectFirebase(config, (text) => { if (!disposed) setMessage(text); },
        localSyncAdapter(syncJournalKey(config)), (prompt) => { if (!disposed) setHold(prompt); });
      disconnect = connection.dispose;
    }).catch(() => {
      if (!disposed) setMessage("No se pudo conectar el viaje. Sus datos locales se conservan.");
    });
    return () => { disposed = true; disconnect?.(); };
  }, []);
  if (!config) return null;

  return (
    <section className="trip-backup__section" aria-labelledby="trip-sync-title">
      <h3 id="trip-sync-title">Viaje compartido</h3>
      <p role="status">{message}</p>
      {hold && <SyncHoldActions hold={hold} />}
      <p className="trip-backup__note">
        Pongan a las dos personas en el mismo orden (Persona 1 y Persona 2) en los dos teléfonos. Si no, los «me gusta» de
        una se asignan a la otra.
      </p>
    </section>
  );
}
