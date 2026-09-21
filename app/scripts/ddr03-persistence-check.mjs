import { chromium } from "playwright";

/**
 * DDR-03 / `04 §17` / `08` §«Invariantes verificables de la persistencia» — gate permanente del
 * aviso de fallo de persistencia, contra un build real.
 *
 * El fallo se induce como ocurre de verdad: `localStorage.setItem` lanza. Se parchea en el propio
 * navegador antes de que cargue la aplicación, de modo que lo que se prueba es la aplicación
 * entera reaccionando a un almacenamiento que no acepta escrituras — no un doble de test.
 *
 * Las once comprobaciones que exige la decisión, en orden:
 *   1. persistencia normal → no hay aviso;
 *   2. fallo de escritura → aparece el aviso;
 *   3. durante el error, ninguna superficie afirma que los cambios están guardados;
 *   4. el aviso es visible en Explorar;
 *   5. sigue visible y accesible con la ficha abierta (incluida pantalla completa en teléfono);
 *   6. está disponible desde Quiero ir y desde Viaje;
 *   7. nunca hay dos avisos;
 *   8. un reintento que vuelve a fallar conserva el error;
 *   9. un reintento con éxito recupera el estado normal;
 *  10. «Reintentar» mide ≥44×44;
 *  11. teclado y anuncio accesible, sin robar el foco.
 */

const BASE_URL = process.env.NIHON_BASE_URL ?? "http://localhost:4181";
const NOTICE = ".persistence-notice";
const COPY = "No pudimos guardar los cambios en este dispositivo. Pueden perderse al cerrar la app.";
const MIN_TAP = 44;

/**
 * Hace que `localStorage.setItem` lance para las claves de datos de la persona, dejando pasar la
 * de onboarding: así el escenario es el real (no se puede guardar el viaje) sin que la explicación
 * de primera apertura se interponga, y sin que el aviso aparezca por una preferencia de interfaz.
 */
const FAIL_WRITES = () => {
  const real = Storage.prototype.setItem;
  // eslint-disable-next-line func-names
  Storage.prototype.setItem = function (key, value) {
    if (typeof key === "string" && key.startsWith("nihon.") && !key.includes("onboarding")) {
      if (window.__nihonStorageFails !== false) throw new DOMException("quota", "QuotaExceededError");
    }
    return real.call(this, key, value);
  };
  window.__nihonStorageFails = true;
};

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const results = [];
  const check = (label, ok, extra) => {
    results.push({ label, ok });
    console.log(`${ok ? "OK  " : "FAIL"} ${label}${extra !== undefined ? ` (${extra})` : ""}`);
  };

  const openTokio = async (page) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("nihon.onboarding.seen.v1", "1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.click(".national-start__hub:has-text('Tokio')");
    await page.waitForSelector(".place-card", { timeout: 15000 });
    await page.waitForTimeout(300);
  };
  const goTo = async (page, name) => {
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name })
      .click();
    await page.waitForTimeout(350);
  };
  /** Marca un lugar, que es la escritura más común de la persona. */
  const saveFirstPlace = async (page) => {
    await page.locator(".place-card__save").first().click();
    await page.waitForTimeout(400);
  };

  // ---------- 1. Persistencia sana: silencio absoluto ----------
  for (const width of [390, 1200]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await openTokio(page);
    await saveFirstPlace(page);
    check(`${width}: con la persistencia sana no hay aviso`, (await page.locator(NOTICE).count()) === 0);
    await context.close();
  }

  // ---------- 2-7, 10-11: el escenario de error ----------
  for (const [label, width, height] of [
    ["teléfono 390", 390, 844],
    ["escritorio 1200", 1200, 900],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.addInitScript(FAIL_WRITES);
    await openTokio(page);

    /*
     * Con el almacenamiento roto, el aviso aparece ANTES de que la persona toque nada: Nihon
     * escribe su documento de viajeros al montar, y esa escritura ya falla. No es un falso
     * positivo —es verdad que no se va a poder guardar nada— y avisar entonces es más honesto que
     * esperar a que la persona haya hecho trabajo que va a perder. Lo que garantiza que no hay
     * falsos positivos es la comprobación de arriba: con la persistencia sana no aparece nunca.
     */
    check(
      `${label}: el fallo se anuncia en cuanto la aplicación intenta persistir, sin esperar a la persona`,
      (await page.locator(NOTICE).count()) === 1
    );

    // El foco antes de provocar otra escritura, para probar que el aviso no lo roba. Se compara
    // la IDENTIDAD del elemento, no su `className`: marcar un lugar le añade `--on`, así que
    // comparar cadenas daría un falso negativo sobre el mismo botón.
    await page.locator(".place-card__save").first().focus();
    await page.evaluate(() => {
      document.activeElement?.setAttribute("data-focus-probe", "1");
    });
    await saveFirstPlace(page);
    const focusKept = await page.evaluate(
      () => document.activeElement?.getAttribute("data-focus-probe") === "1"
    );

    check(`${label}: un fallo de escritura hace aparecer el aviso`, (await page.locator(NOTICE).count()) === 1);
    check(
      `${label}: el aviso dice exactamente el copy aprobado`,
      (await page.locator(`${NOTICE} .persistence-notice__text`).innerText()).trim() === COPY
    );
    check(`${label}: el aviso es visible en Explorar`, await page.locator(NOTICE).isVisible());
    check(
      `${label}: se anuncia accesiblemente (role=alert) y no roba el foco`,
      (await page.locator(NOTICE).getAttribute("role")) === "alert" && focusKept,
      `foco conservado: ${focusKept}`
    );

    // 10. Área táctil de «Reintentar».
    const retry = page.getByRole("button", { name: "Reintentar" });
    const box = await retry.boundingBox();
    check(
      `${label}: «Reintentar» mide ≥${MIN_TAP}×${MIN_TAP}`,
      Boolean(box) && box.width >= MIN_TAP - 0.5 && box.height >= MIN_TAP - 0.5,
      box ? `${box.width.toFixed(1)}×${box.height.toFixed(1)}` : "sin caja"
    );

    // 11. Alcanzable por teclado.
    check(
      `${label}: «Reintentar» es alcanzable y enfocable por teclado`,
      await retry.evaluate((el) => {
        el.focus();
        return el === document.activeElement && el.tabIndex >= 0;
      })
    );

    // 3. Ninguna afirmación de «guardado» mientras hay error.
    const claims = await page.evaluate(() => {
      const text = document.body.innerText;
      const patterns = [
        /guardad[oa]s? en este dispositivo/i,
        /se guarda autom[áa]ticamente en este navegador/i,
        /vive s[óo]lo en este navegador/i,
      ];
      return patterns.filter((p) => p.test(text)).map(String);
    });
    check(
      `${label}: con error, ninguna superficie afirma que los cambios están guardados`,
      claims.length === 0,
      claims.join(" | ") || "ninguna"
    );

    // 5. Con la ficha abierta — en teléfono cubre el 100 % de la altura (05 §5).
    await page.locator(".place-card__open").first().click();
    await page.waitForSelector(".place-detail", { timeout: 10000 });
    await page.waitForTimeout(400);
    const withDetail = await page.evaluate((selector) => {
      const nodes = [...document.querySelectorAll(selector)];
      if (nodes.length !== 1) return { count: nodes.length };
      const el = nodes[0];
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const centre = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const detail = document.querySelector(".place-detail");
      const detailBox = detail?.getBoundingClientRect();
      // TODA la navegación que esté realmente pintada, no la primera que encuentre el selector:
      // en teléfono manda `.tab-bar` y en `md`+ `.nav-rail`, y `querySelector` devolvía la
      // primera en orden de documento aunque estuviese en `display: none`.
      const overlaps = (a, b) =>
        a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const navBoxes = [...document.querySelectorAll(".tab-bar, .nav-rail")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        })
        .map((node) => node.getBoundingClientRect());
      // El z-index de la ficha lo lleva su CONTENEDOR posicionado (`.app__detail`), no
      // `.place-detail`, que es el componente de dentro y no se apila.
      const detailWrapper = document.querySelector(".app__detail");
      const detailZ = detailWrapper ? Number(getComputedStyle(detailWrapper).zIndex) : 0;
      return {
        count: nodes.length,
        visible: cs.visibility !== "hidden" && cs.display !== "none" && r.width > 0 && r.height > 0,
        onTop: Boolean(centre && (centre === el || el.contains(centre))),
        aboveDetail: Number.isFinite(detailZ) ? Number(cs.zIndex) > detailZ : true,
        detailZ,
        noticeZ: Number(cs.zIndex),
        coversNav: navBoxes.some((box) => overlaps(r, box)),
        detailCovers: Boolean(detailBox),
      };
    }, NOTICE);
    check(
      `${label}: con la ficha abierta sigue habiendo UN solo aviso`,
      withDetail.count === 1,
      `avisos=${withDetail.count}`
    );
    check(
      `${label}: con la ficha abierta el aviso sigue visible y por encima de ella`,
      withDetail.visible === true && withDetail.onTop === true && withDetail.aboveDetail === true,
      JSON.stringify(withDetail)
    );
    check(`${label}: el aviso no tapa la navegación`, withDetail.coversNav === false);

    // Cerrar la ficha y recorrer los demás destinos.
    await page.locator(".place-detail__bar .icon-button").click();
    await page.waitForTimeout(400);

    // 6. Disponible desde Quiero ir y Viaje.
    for (const destination of ["Quiero ir", "Viaje", "Nosotros", "Explorar"]) {
      await goTo(page, destination);
      const count = await page.locator(NOTICE).count();
      const visible = count === 1 ? await page.locator(NOTICE).isVisible() : false;
      check(
        `${label}: el aviso sigue presente y único en ${destination}`,
        count === 1 && visible,
        `avisos=${count}`
      );
    }

    // 8. Reintento que vuelve a fallar: el error permanece.
    await page.getByRole("button", { name: "Reintentar" }).click();
    await page.waitForTimeout(500);
    check(
      `${label}: un reintento que vuelve a fallar conserva el aviso`,
      (await page.locator(NOTICE).count()) === 1
    );

    // 9. Reintento con éxito: estado normal, y el dato queda escrito de verdad.
    await page.evaluate(() => {
      window.__nihonStorageFails = false;
    });
    await page.getByRole("button", { name: "Reintentar" }).click();
    await page.waitForTimeout(600);
    check(
      `${label}: un reintento con éxito retira el aviso`,
      (await page.locator(NOTICE).count()) === 0
    );
    const persisted = await page.evaluate(() => localStorage.getItem("nihon.travellers.v1"));
    check(
      `${label}: y la carga que había fallado queda realmente escrita`,
      typeof persisted === "string" && persisted.includes("interests"),
      persisted ? `${persisted.slice(0, 48)}…` : "nada"
    );

    await context.close();
  }

  // ---------- Responsive: base/sm/md/lg/xl ----------
  /*
   * `04 §17` exige que el aviso funcione en los cinco tramos de `02 §D5`. Lo que puede romperse al
   * cambiar de ancho es geométrico: que desborde a lo horizontal, que tape la navegación (que
   * cambia de sitio en `md`, de `TabBar` abajo a `NavRail` a la izquierda) o que se duplique.
   */
  for (const [name, width] of [
    ["base 360", 360],
    ["sm 600", 600],
    ["md 840", 840],
    ["lg 1200", 1200],
    ["xl 1600", 1600],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(FAIL_WRITES);
    await openTokio(page);
    await saveFirstPlace(page);
    const geometry = await page.evaluate((selector) => {
      const nodes = [...document.querySelectorAll(selector)];
      if (nodes.length !== 1) return { count: nodes.length };
      const r = nodes[0].getBoundingClientRect();
      const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const navBoxes = [...document.querySelectorAll(".tab-bar, .nav-rail")]
        .filter((node) => {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        })
        .map((node) => node.getBoundingClientRect());
      return {
        count: nodes.length,
        insideViewport: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
        coversNav: navBoxes.some((box) => overlaps(r, box)),
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: Math.round(r.width),
      };
    }, NOTICE);
    check(
      `${name}: un solo aviso, dentro del viewport, sin tapar navegación ni desbordar`,
      geometry.count === 1 &&
        geometry.insideViewport === true &&
        geometry.coversNav === false &&
        geometry.pageOverflow <= 0,
      JSON.stringify(geometry)
    );
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK.`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  FAIL ${f.label}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
