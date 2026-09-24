// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import App from "../App";

vi.mock("../components/PlaceMap", async () => {
  const ReactModule = await import("react");
  return { PlaceMap: () => ReactModule.createElement("div", { "data-testid": "map-placeholder" }) };
});

describe("Astra editorial completion behavior", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    location.hash = "#/explorar";
  });

  afterEach(cleanup);

  it.each(["summary", "filter panel"] as const)("clears filters through %s while keeping destination and mode", async access => {
    location.hash = "#/explorar?hub=Tokio&q=Shibuya&page=4&mode=mapa&reservation=required";
    const view = render(React.createElement(App));

    expect((view.getByLabelText("Destino") as HTMLSelectElement).value).toBe("Tokio");

    if (access === "summary") {
      fireEvent.click(view.getByRole("button", { name: "Limpiar filtros" }));
    } else {
      fireEvent.click(view.getByRole("button", { name: /Filtros/ }));
      const dialog = await view.findByRole("dialog", { name: "Filtros avanzados" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Limpiar (1)" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar filtros" }));
      await waitFor(() => expect(view.queryByRole("dialog", { name: "Filtros avanzados" })).toBeNull());
    }

    await waitFor(() => {
      const params = new URLSearchParams(location.hash.split("?")[1]);
      expect(params.get("hub")).toBe("Tokio");
      expect(params.get("mode")).toBe("mapa");
      expect(params.has("q")).toBe(false);
      expect(params.has("reservation")).toBe(false);
      expect(params.has("page")).toBe(false);
    });
    expect((view.getByLabelText("Destino") as HTMLSelectElement).value).toBe("Tokio");
    expect(view.getByRole("button", { name: "Mapa" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("prioritizes exploration when there are no interests, saves, or itinerary", () => {
    location.hash = "#/viaje";
    const view = render(React.createElement(App));

    expect(view.getByRole("link", { name: "Explorar lugares" }).closest(".astra-empty")).not.toBeNull();
    const planButton = view.getByRole("button", { name: "Planificar con mis guardados" });
    expect(planButton.className).toContain("astra-trip__planner-action");
    expect(planButton.className).not.toContain("astra-trip__planner-action--primary");
  });

  it("keeps an authored itinerary reachable and primary when all saved places were removed", async () => {
    const draft = {
      version: 7,
      routeIds: ["JP-001", "JP-002"],
      days: null,
      startDate: "2027-02-19",
      endDate: "2027-02-20",
      visitStartTimes: { "JP-001": "09:30" },
      accommodations: [],
      accommodationLegs: [],
      interHubSegments: [],
    };
    localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
    location.hash = "#/viaje";
    const view = render(React.createElement(App));

    const planButton = view.getByRole("button", { name: "Planificar con mis guardados" });
    expect(planButton.className).toContain("astra-trip__planner-action--primary");
    fireEvent.click(planButton);

    const planner = await view.findByRole("dialog", { name: "Construir recorrido" });
    expect(planner.textContent).toContain("Shibuya Crossing");
    expect(planner.textContent).toContain("SHIBUYA SKY");
    expect(localStorage.getItem("nihon.manualPlanningDraft")).toBe(JSON.stringify(draft));
  });
});