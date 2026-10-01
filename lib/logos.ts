import {
  siApple,
  siCrunchyroll,
  siDiscord,
  siDoordash,
  siEa,
  siGoogleplay,
  siMax,
  siNetflix,
  siParamountplus,
  siPlaystation,
  siRoblox,
  siSpotify,
  siSteam,
  siTwitch,
  siUber,
  siYoutube,
} from "simple-icons";

// The brands' own marks, as single 24x24 SVG paths (simple-icons). They are
// trademarks of their owners and are used only to say which card is which.
export const LOGO: Record<string, string> = {
  netflix: siNetflix.path,
  spotify: siSpotify.path,
  youtube: siYoutube.path,
  max: siMax.path,
  paramount: siParamountplus.path,
  playstation: siPlaystation.path,
  steam: siSteam.path,
  roblox: siRoblox.path,
  ea: siEa.path,
  twitch: siTwitch.path,
  apple: siApple.path,
  googleplay: siGoogleplay.path,
  discord: siDiscord.path,
  crunchyroll: siCrunchyroll.path,
  uber: siUber.path,
  doordash: siDoordash.path,
};

/** Logos that already spell the name: the card does not repeat it. */
export const WORDMARKS = new Set(["uber"]);
