// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, act, renderHook, cleanup, waitFor } from "@testing-library/react";
import { useSavedPlaces, readMemberInterests } from "../useSavedPlaces";
import { PlaceCard } from "./PlaceCard";
import App from "../App";
import { getPlaceById } from "../data/store";

describe("Astra Night UI PR #135 Comprehensive Corrections & Component Tests", () => {
  let scrollToDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    location.hash = "#/explorar";
    scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    if (scrollToDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollToDescriptor);
    else delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    vi.restoreAllMocks();
  });

  describe("1. Unión e Intereses Independientes (useSavedPlaces Hook)", () => {
    it("manages independent member interests and computes coincidences without mutating legacy saves", () => {
      const { result } = renderHook(() => useSavedPlaces());

      act(() => {
        result.current.toggleSaved("JP-001");
        result.current.toggleInterest("fernando", "JP-002");
        result.current.toggleInterest("lorena", "JP-002");
        result.current.toggleInterest("lorena", "JP-003");
      });

      expect(result.current.savedIds).toEqual(["JP-001"]);
      expect(result.current.getInterestsForMember("fernando")).toEqual(["JP-002"]);
      expect(result.current.getInterestsForMember("lorena")).toEqual(["JP-002", "JP-003"]);
      expect(result.current.getCoincidences()).toEqual(["JP-002"]);

      // Unmarking Fernando interest
      act(() => {
        result.current.toggleInterest("fernando", "JP-002");
      });

      expect(result.current.getInterestsForMember("fernando")).toEqual([]);
      expect(result.current.getInterestsForMember("lorena")).toEqual(["JP-002", "JP-003"]); // Lorena intact
      expect(result.current.getCoincidences()).toEqual([]);
      expect(result.current.savedIds).toEqual(["JP-001"]); // Legacy save intact
    });
  });

  describe("2. Persistencia Fallida, Aviso Accesible y Reintento", () => {
    it("handles storage write failure, displays alert in UI, and recovers on retrySave", () => {
      const { result } = renderHook(() => useSavedPlaces());
      expect(result.current.syncState).toBe("local-only");

      // Spy on Storage.prototype.setItem
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError: LocalStorage limit reached");
      });

      act(() => {
        result.current.toggleSaved("JP-002");
      });

      expect(result.current.syncState).toBe("error");
      expect(result.current.saveError).toContain("QuotaExceededError");

      // Restore setItem and call retrySave
      spy.mockRestore();
      act(() => {
        result.current.retrySave();
      });

      expect(result.current.syncState).toBe("local-only");
      expect(result.current.saveError).toBeNull();
    });

    it.each(["explore", "detail", "trip"] as const)("shows one reachable notice and recovers after saving from %s", async surface => {
      location.hash = surface === "trip" ? "#/viaje" : "#/explorar?q=Shibuya%20Crossing";
      if (surface === "trip") localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(["JP-001"]));
      const view = render(React.createElement(App));
      if (surface === "detail") {
        fireEvent.click(view.getByRole("link", { name: "Shibuya Crossing" }));
        await view.findByRole("dialog", { name: "Detalles de Shibuya Crossing" });
      }
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage quota exceeded"); });
      const action = surface === "trip" ? view.getByRole("button", { name: "☆ Lorena" }) : view.getByRole("button", { name: surface === "detail" ? "Quiero ir" : "Me gustaría ir" });
      fireEvent.click(action);
      const alert = await view.findByRole("alert");
      expect(alert.textContent).toContain("No se pudieron guardar los cambios en este dispositivo");
      expect(alert.textContent).toContain("Tus cambios siguen disponibles en esta sesión");
      expect(view.getAllByRole("alert")).toHaveLength(1);
      if (surface === "detail") expect(alert.closest('[role="dialog"]')).not.toBeNull();
      if (surface === "trip") expect(view.queryByText(/^Guardados en este dispositivo/)).toBeNull();
      expect(action.getAttribute("aria-pressed")).toBe("true");
      spy.mockRestore();
      fireEvent.click(view.getByRole("button", { name: "Reintentar guardar" }));
      await waitFor(() => expect(view.queryByRole("alert")).toBeNull());
    });
  });

  describe("3. Registros Inválidos y Aislamiento por Viaje", () => {
    it("filters out invalid place IDs, unknown members, and corrupt dates while preserving other trips", () => {
      const otherTripRecord = {
        tripId: "trip-2028",
        memberId: "fernando",
        placeId: "JP-001",
        interested: true,
        updatedAt: "2027-01-01T10:00:00.000Z"
      };

      const rawInterests = [
        otherTripRecord, // Other trip record to preserve
        null,
        "bad-string",
        { tripId: "trip-2027", memberId: "invalid-member", placeId: "JP-001", interested: true, updatedAt: "2027-01-01T10:00:00.000Z" },
        { tripId: "trip-2027", memberId: "fernando", placeId: "NON_EXISTENT_PLACE_999", interested: true, updatedAt: "2027-01-01T10:00:00.000Z" },
        { tripId: "trip-2027", memberId: "fernando", placeId: "JP-001", interested: true, updatedAt: "invalid-date" },
        { tripId: "trip-2027", memberId: "lorena", placeId: "JP-001", interested: true, updatedAt: "2027-01-01T10:00:00.000Z" }
      ];

      localStorage.setItem("nihon.memberInterests.v1", JSON.stringify(rawInterests));

      const loadedInterests = readMemberInterests();
      expect(loadedInterests).toHaveLength(1);
      expect(loadedInterests[0].memberId).toBe("lorena");
      expect(loadedInterests[0].placeId).toBe("JP-001");

      // Save a new interest via hook and verify other trip record is preserved in localStorage
      const { result } = renderHook(() => useSavedPlaces());
      act(() => {
        result.current.toggleInterest("fernando", "JP-002");
      });

      const storedRaw = JSON.parse(localStorage.getItem("nihon.memberInterests.v1") ?? "[]");
      const preservedOtherTrip = storedRaw.find((r: any) => r.tripId === "trip-2028");
      expect(preservedOtherTrip).toBeDefined();
      expect(preservedOtherTrip.placeId).toBe("JP-001");
    });
  });

  describe("4. Reactividad del Planificador", () => {
    it("reloads persisted itinerary places and activities when the planner is reopened", async () => {
      location.hash = "#/viaje";
      localStorage.setItem("nihon.savedPlaceIds", JSON.stringify(["JP-001"]));
      const view = render(React.createElement(App));
      const draft = { version: 7, routeIds: ["JP-001", "JP-002"], days: null, startDate: "2027-02-19", endDate: "2027-02-20", visitStartTimes: { "JP-001": "09:30" }, accommodations: [], accommodationLegs: [], interHubSegments: [] };
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(draft));
      const planButton = view.getByRole("button", { name: "Planificar con mis guardados" });
      fireEvent.click(planButton);
      let planner = await view.findByRole("dialog", { name: "Construir recorrido" });
      expect(planner.textContent).toContain("Shibuya Crossing");
      expect(planner.textContent).toContain("SHIBUYA SKY");
      expect(JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "{}").visitStartTimes).toEqual({ "JP-001": "09:30" });
      fireEvent.click(view.getByRole("button", { name: "Cerrar el constructor de recorrido" }));
      await waitFor(() => expect(view.queryByRole("dialog", { name: "Construir recorrido" })).toBeNull());
      const edited = { ...JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "{}"), routeIds: ["JP-001", "JP-003"] };
      localStorage.setItem("nihon.manualPlanningDraft", JSON.stringify(edited));
      fireEvent.click(planButton);
      planner = await view.findByRole("dialog", { name: "Construir recorrido" });
      expect(planner.textContent).toContain("Shibuya Crossing");
      expect(planner.textContent).toContain("Meiji Jingu");
      expect(planner.textContent).not.toContain("SHIBUYA SKY");
      expect(JSON.parse(localStorage.getItem("nihon.manualPlanningDraft") ?? "{}").visitStartTimes).toEqual({ "JP-001": "09:30" });
    });
  });

  describe("5. Galería con Error, Cambio de Imagen y Reintento (PlaceCard)", () => {
    it("keeps gallery controls accessible on image load error, allowing image switching and retry", () => {
      const basePlace = getPlaceById("JP-001");
      if (!basePlace) throw new Error("Place JP-001 not found in test data");

      const place = {
        ...basePlace,
        images: [
          { url: "/images/places/JP-001/shibuya-1.webp", alt: "Shibuya 1", source: "Wikimedia" },
          { url: "/images/places/JP-001/shibuya-2.webp", alt: "Shibuya 2", source: "Wikimedia" }
        ]
      };

      const onToggle = vi.fn();
      const onOpen = vi.fn();

      const { getByRole, getByText } = render(React.createElement(PlaceCard, { place, saved: false, onToggle, onOpen }));

      const img = getByRole("img");
      // Simulate image load error
      fireEvent.error(img);

      // Verify error message is visible
      expect(getByText("No se pudo cargar la fotografía")).not.toBeNull();

      // Verify Retry button is present and works
      const retryBtn = getByRole("button", { name: "Reintentar" });
      expect(retryBtn).not.toBeNull();
      fireEvent.click(retryBtn);
      expect(getByText("Cargando fotografía…")).not.toBeNull();

      // Error again
      const img2 = getByRole("img");
      fireEvent.error(img2);

      // Verify gallery controls (next photo button) are STILL rendered and accessible during error
      const nextBtn = getByRole("button", { name: "Fotografía siguiente" });
      expect(nextBtn).not.toBeNull();

      // Switch to next photo
      fireEvent.click(nextBtn);

      // Verify load state resets to loading for photo 2
      expect(getByText("Cargando fotografía…")).not.toBeNull();
    });
  });

  describe("6. Nombres Accesibles y Estados Seleccionados", () => {
    it("exposes visible text in accessible name and reports aria-pressed state", () => {
      const place = getPlaceById("JP-001");
      if (!place) throw new Error("Place JP-001 not found");

      const { getByRole, unmount } = render(
        React.createElement(PlaceCard, { place, saved: false, onToggle: vi.fn(), onOpen: vi.fn() })
      );

      const wantBtn = getByRole("button", { name: "Me gustaría ir" });
      expect(wantBtn.getAttribute("aria-pressed")).toBe("false");
      unmount();

      // Rerender as saved
      const { getByRole: getByRoleSaved } = render(
        React.createElement(PlaceCard, { place, saved: true, onToggle: vi.fn(), onOpen: vi.fn() })
      );
      const savedBtn = getByRoleSaved("button", { name: "Me gustaría ir ✓" });
      expect(savedBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
