/**
 * Navegación del shell vigente, en un solo sitio.
 *
 * **Por qué existe.** Siete auditorías heredadas (`phase4c`…`phase4l`, `block5-travellers`)
 * llevaban cada una su propia copia de «entra a la ciudad, abre este lugar, cierra la ficha».
 * Cuando B18 sustituyó la portada nacional y el cromo de cuatro destinos, y B19 llevó la
 * búsqueda a su propia hoja, las siete copias se rompieron a la vez **en la navegación**, sin
 * que ninguna llegara a ejecutar la comprobación que protegía. Eso no es un fallo de siete
 * requisitos: es un fallo de un camino repetido siete veces.
 *
 * **Criterio (Art. 12 y `08`).** Las funciones de aquí se apoyan en **rol y nombre accesible**
 * siempre que el shell los ofrezca, y sólo bajan a una clase interna cuando no hay alternativa
 * —y entonces a la clase que el documento normativo nombra, no a una de maquetación—. Un gate
 * que se rompe porque cambió un `div` intermedio no está midiendo el producto.
 *
 * **Esto no relaja ninguna aserción.** Sólo lleva al lector hasta donde se mide.
 */

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * El explicador de la primera apertura (`05 §1`) se marca como visto y no vuelve. Un gate que
 * no lo hace mide la pantalla equivocada, o se queda esperando a un botón tapado por él.
 */
export async function dismissOnboarding(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      localStorage.setItem("nihon.onboarding.seen.v1", "1");
    } catch {
      /* almacenamiento bloqueado: el explicador se salta a mano más abajo */
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  const skip = page.getByRole("button", { name: /Saltar|Entrar/ });
  if (await skip.count()) await skip.first().click().catch(() => {});
  await page.waitForTimeout(250);
}

/**
 * Entra a una ciudad desde la portada nacional.
 *
 * B18 (`05 §2`) sustituyó el camino «prefectura → Explorar desde X» por los atajos de ciudad de
 * la sección «Empezar a explorar». El recorrido geográfico region → prefectura → hub sigue
 * existiendo debajo (`05 §3`) y lo comprueba `b17-regression-check`; aquí interesa llegar a la
 * lista, no recorrer el mapa, así que se usa el atajo.
 *
 * Se busca por rol y nombre DENTRO de esa sección: a secas, `^Tokio` empata con el atajo y con
 * la prefectura del navegador de regiones, y Playwright —con razón— se niega a elegir por ti.
 */
export async function enterHub(page, hub) {
  await page
    .getByRole("region", { name: "Empezar a explorar" })
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(hub)}\\b`) })
    .first()
    .click();
  await page.waitForSelector(".place-card", { timeout: 15000 });
  await page.waitForTimeout(400);
}

/**
 * Abre la ficha de un lugar por su nombre, desde la ciudad activa.
 *
 * Vía la hoja de búsqueda (`04 §12`), no la lista: la lista carga de 12 en 12 (`05 §4`), así que
 * un lugar que esté más abajo no existe todavía en el DOM. La búsqueda es además el camino que
 * un lector usa de verdad para encontrar un lugar concreto.
 *
 * El control que abre es el de DDR-02: cubre la tarjeta entera y lleva el nombre del lugar en su
 * `aria-label`, así que se pide por rol y nombre.
 */
export async function openPlace(page, name, hub) {
  /*
   * El único control cuyo nombre accesible NO sirve para encontrarlo. `04 §12` lo describe como
   * `[ ⌕ Buscar en Tokio ]`, pero su texto —y por tanto su nombre accesible— pasa a ser **la
   * consulta activa** en cuanto hay una (`App.tsx`: `filters.query.trim() || "Buscar en …"`), así
   * que tras la primera búsqueda deja de llamarse «Buscar en Tokio». Se pide por la clase del
   * componente que `04 §12` nombra —la barra única de ciudad—, que es estable, en vez de por un
   * nombre que cambia con lo que el lector escribió. Anotado como hallazgo en el handoff: que un
   * control no diga nunca qué hace es cosa de la superficie de Explorar, no de este bloque.
   */
  const opener = page.locator(".explorer-bar__search");
  if (await opener.count()) {
    await opener.first().click();
  } else {
    await page.getByRole("button", { name: new RegExp(`^Buscar en ${escapeRegExp(hub)}`) }).first().click();
  }
  await page.waitForSelector(".search-sheet", { timeout: 10000 });
  await page.locator(".search-sheet .search-field__input").fill(name);
  await page.waitForTimeout(700);
  /*
   * Anclado al PRINCIPIO del nombre accesible, que es `{nombre}. {nivel}. {categoría} en
   * {zona}.` — no al nombre completo. Las auditorías nombran los lugares como los nombra una
   * persona («Tokyo Marathon»), no como los guarda el dataset («Tokyo Marathon 2027»), y eso es
   * lo correcto: un gate que exige la cadena exacta del catálogo se rompe cada vez que alguien
   * corrige una errata editorial. Sigue siendo más preciso que el `hasText` de subcadena que
   * estas auditorías usaban antes, que empataba con cualquier parte de la tarjeta.
   */
  await page
    .locator(".search-sheet")
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}`) })
    .first()
    .click();
  await page.waitForSelector(".place-detail", { timeout: 15000 });
  await page.waitForTimeout(700);
}

/**
 * Cierra la ficha.
 *
 * B20 (`05 §5`, defecto D4) retiró el `×` flotante y la barra que lo contenía: queda un único
 * botón atrás flotante, que cierra cuando no hay a dónde volver. `Escape` sigue cerrando también
 * y es lo que usa el teclado, pero se pulsa el botón porque es lo que hace un dedo.
 */
export async function closePlace(page) {
  const back = page.locator(".place-detail__back");
  if (await back.count()) await back.first().click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

/**
 * Abre `CreditsSheet` y devuelve su localizador (`04 §7`).
 *
 * B20 sacó la atribución del flujo de lectura —defecto D2, `08` prohibición 9— y la puso detrás
 * del botón `ⓘ` de la galería. Los seis campos siguen ahí, ahora etiquetados uno a uno y por
 * cada imagen del lugar; lo que cambió es dónde se leen, no qué se exige.
 */
export async function openCredits(page) {
  await page.getByRole("button", { name: /^Créditos de las fotografías/ }).first().click();
  const list = page.locator(".credits-sheet__list");
  await list.waitFor({ timeout: 10000 });
  return list;
}

export async function closeCredits(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
}

/** `04 §6`: sin atribución que mostrar no hay botón `ⓘ` — un control que abre una hoja vacía
 * sería «UI de funciones que no existen» (`08` prohibición 8). */
export async function creditsButtonCount(page) {
  return page.getByRole("button", { name: /^Créditos de las fotografías/ }).count();
}
