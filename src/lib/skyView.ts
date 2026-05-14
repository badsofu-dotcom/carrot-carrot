/**
 * Sky-view asset picker.
 *
 * The farm card uses landscape-format bg images (mushroom house, plots,
 * fence). The sky-view fullscreen overlay uses the *sky-only* variants
 * extracted from the bunny_assets pack — sky_dawn / sky_noon / sky_night
 * etc. Falls back to a corresponding farm bg jpeg when the sky variant
 * is unavailable for a slot.
 */

import type { FarmBgSlot } from "./farmBackground";

const BASE = import.meta.env.BASE_URL;
const sky = (filename: string) => `${BASE}assets/farm/sky/${filename}`;
const bgFile = (filename: string) => `${BASE}assets/farm/bg/${filename}`;
const bgDay = `${BASE}assets/farm/bg_day.webp`;

/**
 * Slot → sky asset URL. Where no dedicated sky asset exists for a
 * weather/season slot we reuse the farm bg jpeg so the overlay still
 * matches the player's expectation (rain card → rain sky).
 */
export function skyImageFor(slot: FarmBgSlot): string {
  switch (slot) {
    case "sky_dawn":
      return sky("sky_dawn.jpeg");
    case "bg_morning":
      // No sky_morning asset shipped — sky_noon reads close enough
      // (clear blue with soft clouds).
      return sky("sky_noon.jpeg");
    case "bg_day":
      return sky("sky_noon.jpeg");
    case "bg_evening":
      return sky("sky_sunset.jpeg");
    case "bg_night":
      // The night sky gets a shooting-star variant — feels magical.
      return sky("sky_shooting_star.jpeg");
    case "bg_rainy":
      return sky("sky_rainy.png");
    case "bg_snowy":
      // Snow sky isn't in the pack — reuse the farm snow jpeg.
      return bgFile("bg_snowy.jpeg");
    case "bg_cherry":
      return bgFile("bg_cherry.jpeg");
    case "bg_autumn":
      return bgFile("bg_autumn.jpeg");
    default:
      return bgDay;
  }
}

/** Soft palette token used as the SkyView fallback while the image loads. */
export function skyTintFor(slot: FarmBgSlot): string {
  switch (slot) {
    case "sky_dawn":
      return "#f8c7b0";
    case "bg_morning":
      return "#cfe7ff";
    case "bg_day":
      return "#b9defa";
    case "bg_evening":
      return "#f7a76a";
    case "bg_night":
      return "#1c233a";
    case "bg_rainy":
      return "#7e8896";
    case "bg_snowy":
      return "#dde7f0";
    case "bg_cherry":
      return "#f7c5d4";
    case "bg_autumn":
      return "#d68a4a";
    default:
      return "#cfe7ff";
  }
}
