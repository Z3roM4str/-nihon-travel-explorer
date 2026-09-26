// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { REVIEW_SCHEMA, REVIEW_STORAGE_KEY, REVIEW_VERSION, type ReviewStore } from "./review";

const store = (places: ReviewStore["places"] = {}): ReviewStore => ({ schema:REVIEW_SCHEMA, version:REVIEW_VERSION, activeReviewer:"fernando", places });
const record = (id:string, fernando:"yes"|"no"|"unreviewed", ella:"yes"|"no"|"unreviewed", extra:Partial<ReviewStore["places"][string]>={}) => ({ placeId:id, votes:{fernando,ella}, inReviewQueue:true, legacy:false, ...extra });

describe("SOL-5 Our Trip UI", () => {
  beforeEach(() => { localStorage.clear(); location.hash="#/viaje"; });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("renders the real Todos empty state instead of an empty group list", () => {
    const view=render(<App />);
    expect(view.getByRole("heading",{name:"Su viaje empieza con un lugar"})).not.toBeNull();
    expect(view.getByRole("button",{name:"Explorar Japón"})).not.toBeNull();
  });

  it("keeps empty states specific and non-destructive", () => {
    localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify(store({"JP-001":record("JP-001","yes","no")})));
    const view=render(<App />);
    fireEvent.click(view.getByRole("button",{name:"Ambos",exact:true}));
    expect(view.getByText("Todavía no hay coincidencias. Revisen lo que le gusta al otro.")).not.toBeNull();
    fireEvent.click(view.getByRole("button",{name:"Descartados",exact:true}));
    expect(view.getByText("No han descartado lugares.")).not.toBeNull();
    fireEvent.click(view.getByRole("button",{name:"Ella",exact:true}));
    expect(view.getByRole("button",{name:"Quitar filtros"})).not.toBeNull();
  });

  it("takes a stable queue, navigation emits no vote, and restores exact focus", async () => {
    localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify(store({"JP-001":record("JP-001","yes","unreviewed"),"JP-002":record("JP-002","unreviewed","unreviewed")})));
    const view=render(<App />);const opener=view.getByRole("button",{name:"Revisar pendientes"});opener.focus();fireEvent.click(opener);
    const dialog=view.getByRole("dialog",{name:"Revisar pendientes"});expect(within(dialog).getByText("1 de 2")).not.toBeNull();
    const before=localStorage.getItem(REVIEW_STORAGE_KEY);fireEvent.click(within(dialog).getByRole("button",{name:"Siguiente"}));expect(within(dialog).getByText("2 de 2")).not.toBeNull();expect(localStorage.getItem(REVIEW_STORAGE_KEY)).toBe(before);
    fireEvent.keyDown(document,{key:"Escape"});await waitFor(()=>expect(view.queryByRole("dialog",{name:"Revisar pendientes"})).toBeNull());await waitFor(()=>expect(document.activeElement).toBe(opener));
  });

  it("routes discarded positive intent through SOL-4 reconsideration", () => {
    localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify(store({"JP-001":record("JP-001","unreviewed","yes",{disposition:"discarded"})})));
    const view=render(<App />);fireEvent.click(view.getByRole("button",{name:"Descartados",exact:true}));fireEvent.click(view.getByRole("button",{name:/Quiero ir a Shibuya Crossing/}));
    const modal=view.getByRole("alertdialog",{name:"¿Volver a considerar este lugar?"});fireEvent.click(within(modal).getByRole("button",{name:"Cancelar"}));expect(JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY)!).places["JP-001"].disposition).toBe("discarded");
  });

  it("keeps a failed batch modal active and creates exact Undo only after Retry", async () => {
    localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify(store({"JP-001":record("JP-001","yes","yes")})));
    const original=Storage.prototype.setItem;let fail=false;vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key:string,value:string){if(fail&&key===REVIEW_STORAGE_KEY)throw new DOMException("test failure","QuotaExceededError");return original.call(this,key,value);});
    const view=render(<App />);fireEvent.click(view.getByRole("button",{name:"Seleccionar"}));fireEvent.click(view.getByRole("checkbox",{name:/Seleccionar Shibuya Crossing/}));const opener=view.getByRole("button",{name:"Preseleccionar"});fireEvent.click(opener);
    const modal=view.getByRole("dialog",{name:/Confirmar preselección/});expect(within(modal).getByText("1 lugares")).not.toBeNull();fail=true;fireEvent.click(within(modal).getByRole("button",{name:"Confirmar"}));expect(within(modal).getByRole("alert")).not.toBeNull();expect(view.queryByText("Cambios guardados")).toBeNull();
    fail=false;fireEvent.click(within(modal).getByRole("button",{name:"Reintentar guardar"}));await waitFor(()=>expect(view.queryByRole("dialog",{name:/Confirmar preselección/})).toBeNull());expect(view.getByText("Cambios guardados")).not.toBeNull();expect(JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY)!).places["JP-001"].votes).toEqual({fernando:"yes",ella:"yes"});
    fireEvent.click(within(view.getByText("Cambios guardados").parentElement!).getByRole("button",{name:"Deshacer"}));expect(JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY)!).places["JP-001"].disposition).toBeUndefined();
  });
});
