import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupProblem, RestoreSummary } from "../lib/portable-backup";
import type { ImportPreview, ImportState } from "../usePortableBackup";

/**
 * Block 13 — keeping a trip, and moving it to another browser.
 *
 * Nihon keeps every decision in this browser, which is what makes it private and what makes a lost
 * browser a lost trip. This is the whole of the answer: write the decisions to a file the person
 * keeps, and read that file back somewhere else.
 *
 * **The words matter more than usual here.** Nothing on this surface may suggest a service exists.
 * There is no "sincronizado", no "conectado", no "nube", no account and no "compartido": those
 * words would describe a thing that does not exist and would leave someone believing their trip is
 * safe somewhere it is not. What is offered is a file, and the copy says so.
 *
 * **Importing is destructive and is written as such.** It replaces; it does not merge. Merging two
 * trips means deciding whose route wins, which is a question nobody has answered, so it is not
 * attempted — and the sentence above the button says plainly what will be replaced, before the
 * button exists to press. The preview counts what is in the file in units a traveller recognises,
 * never a schema, and if anything in the file can no longer be restored it says how many and makes
 * the person confirm the reduced version deliberately.
 */
export function TripBackup({
  importState,
  onExport,
  onChooseFile,
  onConfirm,
  onReset,
  onFinishRestore,
  onClose,
}: {
  importState: ImportState;
  onExport: () => string;
  onChooseFile: (file: File) => void;
  onConfirm: (preview: ImportPreview) => void;
  onReset: () => void;
  onFinishRestore: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        // After a successful restore the app MUST reload before anything else is touched — see
        // `usePortableBackup.finishRestore`. Escape therefore finishes rather than dismisses:
        // there is no way out of this phase that leaves the stale in-memory trip in charge.
        if (importState.phase === "restored") {
          onFinishRestore();
          return;
        }
        // Otherwise Escape steps back out of a pending step first, so it can never be the key that
        // accidentally dismisses a decision the person was still reading.
        if (importState.phase !== "idle") {
          onReset();
          return;
        }
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([type='file'])"
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
  }, [close, onReset, onFinishRestore, importState.phase]);

  return (
    <div
      className="trip-backup"
      role="presentation"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (importState.phase === "restored") {
          onFinishRestore();
          return;
        }
        close();
      }}
    >
      <div
        className="trip-backup__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-backup-title"
        ref={dialogRef}
      >
        <header className="trip-backup__head">
          <div>
            <h2 id="trip-backup-title">Respaldo del viaje</h2>
            <p className="trip-backup__sub">
              Nihon guarda vuestras decisiones sólo en este navegador. Un archivo de respaldo os
              permite conservarlas o abrirlas en otro dispositivo.
            </p>
          </div>
          <button
            type="button"
            className="trip-backup__close tap-target-min"
            onClick={() => (importState.phase === "restored" ? onFinishRestore() : close())}
            ref={closeRef}
            aria-label="Cerrar el respaldo del viaje"
            title="Cerrar el respaldo del viaje"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <section className="trip-backup__section" aria-labelledby="trip-backup-export">
          <h3 id="trip-backup-export">Exportar respaldo</h3>
          <p className="trip-backup__note">
            Guarda vuestras decisiones de Nihon en un archivo que podéis conservar o abrir en otro
            dispositivo. No se envía a ningún sitio: el archivo queda en vuestro dispositivo.
          </p>
          <button
            type="button"
            className="button button--secondary trip-backup__export"
            onClick={() => setExported(onExport())}
          >
            Exportar respaldo
          </button>
          {exported && (
            <p className="trip-backup__result" role="status">
              Archivo generado: <strong>{exported}</strong>
            </p>
          )}
        </section>

        <section className="trip-backup__section" aria-labelledby="trip-backup-import">
          <h3 id="trip-backup-import">Importar respaldo</h3>
          <p className="trip-backup__note trip-backup__note--warning">
            Al confirmar, el respaldo <strong>sustituirá</strong> los datos de Nihon de este
            navegador: los «Quiero ir» de las dos personas y la planificación. No se combinan.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="trip-backup__file"
            aria-label="Elegir un archivo de respaldo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cancelling the picker fires change with no file on some browsers and not at all on
              // others; either way there is nothing to do and nothing has been touched.
              if (file) onChooseFile(file);
              event.target.value = "";
            }}
          />

          {importState.phase === "rejected" && (
            <div className="trip-backup__problem" role="alert">
              <p>
                No se ha podido leer <strong>{importState.fileName}</strong>.
              </p>
              <p>{problemText(importState.problem)}</p>
              <p className="trip-backup__reassure">
                No se ha cambiado nada en este navegador. Puedes elegir otro archivo.
              </p>
              <button type="button" className="button button--secondary" onClick={onReset}>
                Entendido
              </button>
            </div>
          )}

          {importState.phase === "preview" && (
            <div className="trip-backup__preview">
              <p className="trip-backup__preview-head">
                Esto es lo que contiene <strong>{importState.preview.fileName}</strong>:
              </p>
              <SummaryList summary={importState.preview.summary} />
              {importState.preview.summary.droppedPlaceCount > 0 && (
                <p className="trip-backup__warning" role="alert">
                  {importState.preview.summary.droppedPlaceCount === 1
                    ? "1 lugar del respaldo ya no existe en Nihon y no se podrá restaurar."
                    : `${importState.preview.summary.droppedPlaceCount} lugares del respaldo ya no existen en Nihon y no se podrán restaurar.`}{" "}
                  El resto sí.
                </p>
              )}
              <p className="trip-backup__confirm-line">
                Esto sustituirá los datos de Nihon de este navegador.
              </p>
              <div className="trip-backup__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onReset}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button trip-backup__apply"
                  onClick={() => onConfirm(importState.preview)}
                >
                  Sustituir con este respaldo
                </button>
              </div>
            </div>
          )}

          {importState.phase === "restored" && (
            <div className="trip-backup__restored" role="status">
              <p>Respaldo restaurado en este navegador.</p>
              <SummaryList summary={importState.summary} />
              <p className="trip-backup__note">
                Nihon se recargará para abrir el viaje restaurado.
              </p>
              <button
                type="button"
                className="button trip-backup__finish"
                onClick={onFinishRestore}
              >
                Continuar
              </button>
            </div>
          )}

          {importState.phase === "failed" && (
            <div className="trip-backup__problem" role="alert">
              <p>No se ha podido guardar el respaldo en este navegador.</p>
              <p>
                {importState.rolledBack
                  ? "Tus datos anteriores siguen como estaban."
                  : "Puede que los datos hayan quedado a medias. Vuelve a importar el archivo cuando haya espacio disponible."}
              </p>
              <button type="button" className="button button--secondary" onClick={onReset}>
                Entendido
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** The file's contents in units a traveller recognises. Never a schema, never a JSON dump. */
function SummaryList({ summary }: { summary: RestoreSummary }) {
  const rows: { label: string; value: string }[] = [
    { label: "Personas", value: summary.travellerLabels.join(" y ") || "—" },
    { label: "Lugares en «Quiero ir»", value: String(summary.shortlistCount) },
    { label: "Preferencias personales", value: String(summary.statedPreferenceCount) },
  ];
  if (summary.routeCount > 0) rows.push({ label: "Lugares en el recorrido", value: String(summary.routeCount) });
  if (summary.dayCount > 0) rows.push({ label: "Días planificados", value: String(summary.dayCount) });
  if (summary.startDate) {
    rows.push({
      label: "Fechas",
      value: summary.endDate ? `${summary.startDate} — ${summary.endDate}` : summary.startDate,
    });
  }
  if (summary.visitTimeCount > 0) rows.push({ label: "Horas de visita anotadas", value: String(summary.visitTimeCount) });
  if (summary.accommodationCount > 0) rows.push({ label: "Alojamientos", value: String(summary.accommodationCount) });
  if (summary.zoneChoiceCount > 0) rows.push({ label: "Zonas elegidas", value: String(summary.zoneChoiceCount) });
  if (summary.interHubSegmentCount > 0) rows.push({ label: "Trayectos entre zonas", value: String(summary.interHubSegmentCount) });

  return (
    <dl className="trip-backup__summary">
      {rows.map((row) => (
        <div className="trip-backup__summary-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One plain sentence per failure. No error codes, no stack, no schema vocabulary. */
function problemText(problem: BackupProblem): string {
  switch (problem.kind) {
    case "empty":
      return "El archivo está vacío.";
    case "not-json":
      return "El archivo no tiene el formato esperado; no se ha podido leer su contenido.";
    case "not-an-object":
    case "invalid-envelope":
      return "El archivo no parece un respaldo de Nihon.";
    case "wrong-format":
      return "Este archivo no es un respaldo de Nihon.";
    case "unsupported-version":
      return "Este respaldo se creó con una versión más reciente de Nihon. Actualiza la aplicación para poder abrirlo.";
    case "invalid-travellers":
      return "El respaldo tiene dañada la parte de las personas y sus «Quiero ir».";
    case "invalid-planning-draft":
      return "El respaldo tiene dañada la planificación del viaje.";
  }
}
