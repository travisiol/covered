import { stringToHex, type Hex } from "viem";

export type Category = "Streaming" | "Music" | "Gaming" | "Apps" | "Food & rides";

export type Brand = {
  id: string;
  name: string;
  category: Category;
  /** Card face colours (background, text). */
  bg: string;
  fg: string;
  /** Colour the brand's logo is drawn in on that card. */
  mark: string;
  /** Gift card face values in USD. */
  amounts: number[];
  /** What the card is usually bought for, with a typical US monthly price. */
  covers: string;
  monthly: number;
};

// Typical US list prices at the time of writing. They only feed the "what does
// my coin cover" estimate; a card is always sold at its face value.
export const CATALOG: Brand[] = [
  { id: "netflix", name: "Netflix", category: "Streaming", bg: "#0B0B0B", fg: "#FFFFFF", mark: "#E50914", amounts: [25, 50, 100], covers: "Netflix Standard", monthly: 17.99 },
  { id: "spotify", name: "Spotify", category: "Music", bg: "#1ED760", fg: "#0B0D12", mark: "#0B0D12", amounts: [10, 30, 60], covers: "Spotify Premium", monthly: 11.99 },
  { id: "youtube", name: "YouTube", category: "Streaming", bg: "#FFFFFF", fg: "#0B0D12", mark: "#FF0000", amounts: [15, 25, 50], covers: "YouTube Premium", monthly: 13.99 },
  { id: "max", name: "Max", category: "Streaming", bg: "#002BE7", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [25, 50, 100], covers: "Max Basic", monthly: 10.99 },
  { id: "paramount", name: "Paramount+", category: "Streaming", bg: "#0064FF", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [25, 50], covers: "Paramount+ Essential", monthly: 7.99 },
  { id: "playstation", name: "PlayStation", category: "Gaming", bg: "#00439C", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [10, 25, 50, 100], covers: "PlayStation Plus Essential", monthly: 9.99 },
  { id: "steam", name: "Steam", category: "Gaming", bg: "#171A21", fg: "#C7D5E0", mark: "#FFFFFF", amounts: [20, 50, 100], covers: "Steam Wallet", monthly: 20 },
  { id: "roblox", name: "Roblox", category: "Gaming", bg: "#E9EAEC", fg: "#0B0D12", mark: "#0B0D12", amounts: [10, 25, 50], covers: "Roblox Premium", monthly: 4.99 },
  { id: "ea", name: "EA", category: "Gaming", bg: "#FF4747", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [15, 25, 50], covers: "EA Play", monthly: 5.99 },
  { id: "twitch", name: "Twitch", category: "Gaming", bg: "#9146FF", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [15, 25, 50], covers: "Twitch Turbo", monthly: 11.99 },
  { id: "apple", name: "Apple", category: "Apps", bg: "#F2F2F4", fg: "#0B0D12", mark: "#0B0D12", amounts: [10, 25, 50, 100], covers: "iCloud+, Apple Music, Apple TV+", monthly: 9.99 },
  { id: "googleplay", name: "Google Play", category: "Apps", bg: "#FFFFFF", fg: "#0B0D12", mark: "#01875F", amounts: [10, 25, 50], covers: "Google One 2TB", monthly: 9.99 },
  { id: "discord", name: "Discord", category: "Apps", bg: "#5865F2", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [10, 25], covers: "Discord Nitro", monthly: 9.99 },
  { id: "crunchyroll", name: "Crunchyroll", category: "Streaming", bg: "#FF5E00", fg: "#0B0D12", mark: "#0B0D12", amounts: [10, 25], covers: "Crunchyroll Fan", monthly: 7.99 },
  { id: "uber", name: "Uber", category: "Food & rides", bg: "#000000", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [25, 50, 100], covers: "Uber One", monthly: 9.99 },
  { id: "doordash", name: "DoorDash", category: "Food & rides", bg: "#FF3008", fg: "#FFFFFF", mark: "#FFFFFF", amounts: [25, 50, 100], covers: "DashPass", monthly: 9.99 },
];

export const brandById = (id: string) => CATALOG.find((b) => b.id === id);

/** On-chain sku: "<brand>-<face value>", e.g. "netflix-25", as bytes32. */
export const skuOf = (brandId: string, amount: number): Hex => stringToHex(`${brandId}-${amount}`, { size: 32 });

export function parseSku(sku: Hex): { brand: Brand; amount: number } | null {
  let text = "";
  for (let i = 2; i < sku.length; i += 2) {
    const c = parseInt(sku.slice(i, i + 2), 16);
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  const cut = text.lastIndexOf("-");
  const brand = brandById(text.slice(0, cut));
  const amount = Number(text.slice(cut + 1));
  if (!brand || !brand.amounts.includes(amount)) return null;
  return { brand, amount };
}

/** The smallest card that pays for a month of the subscription. */
export const monthlyCard = (b: Brand) => b.amounts.find((a) => a >= b.monthly) ?? b.amounts[b.amounts.length - 1];
