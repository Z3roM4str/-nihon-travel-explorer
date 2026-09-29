import type { ReactNode } from "react";
import type { Traveller } from "../lib/travellers";
import type { ImportPreview, ImportState } from "../usePortableBackup";
import { TravellerManager } from "./TravellerManager";
import { TripBackup } from "./TripBackup";
import { SourcesAndLicences } from "./SourcesAndLicences";
import { APP_VERSION } from "../lib/app-version";

/**
 * B26 (B8, `05 §11`) — «Nosotros»: la casa permanente de la identidad, el respaldo, la
 * explicación de Nihon, las fuentes y la versión.
 *
 * Es una pantalla, no un panel de modales: cinco secciones en el orden del contrato, todas en
 * el flujo de lectura. Lo único genuinamente modal que queda son las confirmaciones destructivas,
 * y viven dentro de cada sección.
 */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="nosotros-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 className="nosotros-section__title" id={`${id}-title`} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NosotrosScreen({
  travellers,
  activeTravellerId,
  placesOnlyWantedBy,
  placesMarkedBy,
  onSelectTraveller,
  onRenameTraveller,
  onResetTraveller,
  onRemoveTraveller,
  onAddTraveller,
  importState,
  onExport,
  onChooseFile,
  onConfirmImport,
  onResetImport,
  onFinishRestore,
  onOpenOnboarding,
}: {
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  placesOnlyWantedBy: (travellerId: string) => number;
  placesMarkedBy: (travellerId: string) => number;
  onSelectTraveller: (travellerId: string) => void;
  onRenameTraveller: (travellerId: string, label: string) => void;
  onResetTraveller: (travellerId: string) => void;
  onRemoveTraveller: (travellerId: string) => void;
  onAddTraveller: (label: string) => void;
  importState: ImportState;
  onExport: () => string;
  onChooseFile: (file: File) => void;
  onConfirmImport: (preview: ImportPreview) => void;
  onResetImport: () => void;
  onFinishRestore: () => void;
  onOpenOnboarding: () => void;
}) {
  return (
    <div className="nosotros">
      <Section id="nosotros-viajeros" title="Viajeros">
        <TravellerManager
          travellers={travellers}
          activeTravellerId={activeTravellerId}
          placesOnlyWantedBy={placesOnlyWantedBy}
          placesMarkedBy={placesMarkedBy}
          onSelect={onSelectTraveller}
          onRename={onRenameTraveller}
          onReset={onResetTraveller}
          onRemove={onRemoveTraveller}
          onAdd={onAddTraveller}
        />
      </Section>

      <Section id="nosotros-copia" title="Copia del viaje">
        <TripBackup
          importState={importState}
          onExport={onExport}
          onChooseFile={onChooseFile}
          onConfirm={onConfirmImport}
          onReset={onResetImport}
          onFinishRestore={onFinishRestore}
        />
      </Section>

      <Section id="nosotros-como-funciona" title="Cómo funciona Nihon">
        <p className="nosotros-section__text">
          Vuelve a ver la explicación de qué es Nihon y cómo marcar lo que os gustaría ver. Reabrirla
          no borra nombres ni preferencias.
        </p>
        <button type="button" className="button button--secondary" onClick={onOpenOnboarding}>
          Ver de nuevo
        </button>
      </Section>

      <Section id="nosotros-fuentes" title="Fuentes y licencias">
        <SourcesAndLicences />
      </Section>

      <Section id="nosotros-acerca" title="Acerca de">
        <p className="nosotros-section__text">
          Nihon, versión{" "}
          <span className="nosotros-section__version">{APP_VERSION ?? "no disponible"}</span>.
        </p>
        <p className="nosotros-section__text">
          Todo vive sólo en este navegador: no hay cuentas, ni servidor, ni sincronización entre
          dispositivos.
        </p>
      </Section>
    </div>
  );
}
