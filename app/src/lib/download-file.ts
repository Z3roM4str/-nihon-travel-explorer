/**
 * Entrega un texto al navegador como archivo descargable. Devuelve `ok: false` si el navegador no deja crear
 * o entregar el archivo (sin Blob, sin URL de objeto, ancla rechazada…) en lugar de afirmar una descarga que
 * no ocurrió (auditoría final, ronda 2: «Exportar respaldo» y «Descargar copia» deben poder fallar a la vista).
 *
 * El `revoke` va diferido a una macrotarea: revocar en la misma tarea que el clic cancela la descarga en Safari
 * (riesgo documentado en `usePortableBackup`, Block 14).
 */
export function downloadTextFile(fileName: string, text: string): { ok: true } | { ok: false } {
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    // Se añade antes de pulsar a propósito: el clic sintético de un ancla suelta se ignora en algunos navegadores (iOS).
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
