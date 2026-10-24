import { describe, expect, it } from "vitest";
import { morePhotosUrl, morePhotosVariant } from "./more-photos";

describe("morePhotosUrl", () => {
  it("busca por nombre y municipio en Google Maps", () => {
    expect(morePhotosUrl({ name: "Murin-an", municipality: "Kioto", coordinates: { lat: 35, lng: 135 } })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Murin-an%2C%20Kioto%2C%20Japan"
    );
  });
  it("usa coordenadas si no hay nombre", () => {
    expect(morePhotosUrl({ coordinates: { lat: 35.5, lng: 139.7 } })).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.5%2C139.7"
    );
  });
  it("devuelve null sin datos", () => {
    expect(morePhotosUrl({})).toBeNull();
  });
});

describe("morePhotosVariant", () => {
  it("destaca con menos de 4 fotos y queda discreto con 4", () => {
    expect(morePhotosVariant(0)).toBe("prominent");
    expect(morePhotosVariant(3)).toBe("prominent");
    expect(morePhotosVariant(4)).toBe("subtle");
  });
});
