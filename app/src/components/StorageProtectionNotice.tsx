import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "../icons/Icon";
import { deviceStorage } from "../lib/device-storage";
import {
  collectOriginals,
  getProtectionSnapshot,
  notifyStorageReplaced,
  refreshProtection,
  serializeOriginals,
  startFresh,
  subscribeProtection,
  subscribeStorageReplaced,
  type ProtectedDocument,
} from "../lib/stored-document";
import { PLANNING_DRAFT_STORAGE_KEY } from "../lib/planning-draft-v8";
import { TRAVELLERS_STORAGE_KEY } from "../lib/travellers";
import { todayCivilDate } from "../lib/today";

import "./StorageProtectionNotice.css";

/**
 * Auditoría final (H04) — el aviso de que hay datos guardados que Nihon no ha podido leer.
 *
 * Los dos documentos canónicos se cargaban con un valor inicial escrito encima cuando no se
 * entendían, y esa sustitución era invisible. Ahora el original se conserva intacto y este aviso
 * —una sola vez, en la raíz, como `PersistenceNotice`— dice qué ocurre y ofrece la única salida:
 *
 *  1. «Descargar copia» entrega el contenido original tal cual, sin tocar nada;
 *  2. «Empezar de nuevo» guarda primero una copia aparte de todo lo que hay y sólo después retira
 *     los documentos protegidos. Pide confirmación, y si la copia no se puede escribir no cambia nada.
 *
 * `role="alert"`: aparece al detectarse y se anuncia sin mover el foco. No se va solo: durará hasta
 * que la persona elija, porque mientras dure sus cambios NO se están guardando.
 */

const DOCUMENT_NAME: Record<string, string> = {
  [TRAVELLERS_STORAGE_KEY]: "La lista de viajeros y de lugares de Quiero ir",
  [PLANNING_DRAFT_STORAGE_KEY]: "El itinerario",
};

function describe(entry: ProtectedDocument): string {
  const name = DOCUMENT_NAME[entry.key] ?? "Un documento de datos";
  return entry.status === "incompatible"
    ? `${name}, almacenado en este navegador, es de una versión más reciente de Nihon y esta no sabe leerlo.`
    : `${name}, almacenado en este navegador, no se reconoce: puede estar dañado.`;
}

function downloadOriginals(): void {
  const text = serializeOriginals(collectOriginals(deviceStorage), new Date().toISOString());
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nihon-datos-conservados-${todayCivilDate()}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function StorageProtectionNotice() {
  const documents = useSyncExternalStore(subscribeProtection, getProtectionSnapshot, getProtectionSnapshot);

  // La clasificación de arranque y las escrituras externas (otras pestañas, restauración) pueden
  // poner o quitar la protección; esta es la única fuente que la publica, junto a los hooks.
  useEffect(() => {
    const refresh = () => refreshProtection(deviceStorage);
    refresh();
    window.addEventListener("storage", refresh);
    const unsubscribe = subscribeStorageReplaced(refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      unsubscribe();
    };
  }, []);

  // El panel vive en su propio componente: al desaparecer la protección se desmonta y su estado
  // (paso de confirmación, mensaje de error, colapsado) se descarta solo.
  if (documents.length === 0) return null;
  return <ProtectionPanel documents={documents} />;
}

function ProtectionPanel({ documents }: { documents: readonly ProtectedDocument[] }) {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const restart = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outcome = startFresh(
      deviceStorage,
      documents.map((entry) => entry.key),
      stamp
    );
    if (!outcome.ok) {
      setStep("idle");
      setProblem(
        outcome.reason === "copy-failed"
          ? "No se ha podido crear una copia aparte, así que no se ha cambiado nada: tus datos siguen conservados. Descarga la copia y vuelve a intentarlo cuando haya espacio."
          : "Se creó una copia aparte, pero no se han podido retirar los datos dañados: siguen conservados y no se ha cambiado nada más."
      );
      return;
    }
    setProblem(null);
    setStep("idle");
    refreshProtection(deviceStorage);
    notifyStorageReplaced();
  };

  if (collapsed) {
    return (
      <div className="storage-protection storage-protection--collapsed" role="alert" data-storage-protection>
        <span className="storage-protection__icon" aria-hidden="true">
          <Icon name="aviso" size={20} />
        </span>
        <p className="storage-protection__text">Datos almacenados protegidos: los cambios no se conservan.</p>
        <button
          type="button"
          className="button button--quiet storage-protection__action tap-target-min"
          onClick={() => setCollapsed(false)}
        >
          Ver opciones
        </button>
      </div>
    );
  }

  return (
    <section
      className="storage-protection"
      role="alert"
      aria-labelledby="storage-protection-title"
      data-storage-protection
    >
      <h2 className="storage-protection__title" id="storage-protection-title">
        <span className="storage-protection__icon" aria-hidden="true">
          <Icon name="aviso" size={20} />
        </span>
        Hay datos almacenados que Nihon no puede leer
      </h2>
      {documents.map((entry) => (
        <p className="storage-protection__text" key={entry.key}>
          {describe(entry)}
        </p>
      ))}
      <p className="storage-protection__text">
        Los hemos dejado exactamente como estaban: no se ha borrado ni cambiado nada. Mientras tanto la
        aplicación empieza en blanco y lo que hagas no se conservará.
      </p>
      {problem && (
        <p className="storage-protection__problem" data-storage-protection-problem>
          {problem}
        </p>
      )}
      {step === "confirm" ? (
        <div className="storage-protection__actions">
          <p className="storage-protection__text">
            Se creará una copia aparte de todo lo que hay y después se empezará de cero.
          </p>
          <button
            type="button"
            className="button button--primary storage-protection__action tap-target-min"
            onClick={restart}
          >
            Confirmar: empezar de nuevo
          </button>
          <button
            type="button"
            className="button button--quiet storage-protection__action tap-target-min"
            onClick={() => setStep("idle")}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="storage-protection__actions">
          <button
            type="button"
            className="button button--secondary storage-protection__action tap-target-min"
            onClick={downloadOriginals}
          >
            Descargar copia de lo conservado
          </button>
          <button
            type="button"
            className="button button--quiet storage-protection__action tap-target-min"
            onClick={() => setStep("confirm")}
          >
            Empezar de nuevo (con copia aparte)
          </button>
          <button
            type="button"
            className="button button--quiet storage-protection__action tap-target-min"
            onClick={() => setCollapsed(true)}
          >
            Ahora no
          </button>
        </div>
      )}
    </section>
  );
}
