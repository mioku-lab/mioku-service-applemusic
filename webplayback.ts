import { APPLE_MUSIC_WEB_PLAYBACK_URL } from "./constants";
import { AppleMusicHttpClient } from "./http";
import type { AppleMusicWebPlaybackResult } from "./types";

const ASSET_FLAVOR_PRIORITY = [
  "28:ctrp256",
  "37:ibhp256",
  "30:cbcp256",
  "32:ctrp64",
  "38:ibhp64",
  "34:cbcp64",
];

function normalizeAssetUrl(asset: any): string | undefined {
  const value = asset?.URL || asset?.url;
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

function extractAssetEntries(payload: any): Array<{ flavor?: string; url: string }> {
  const assets = payload?.songList?.[0]?.assets;
  if (!Array.isArray(assets)) {
    return [];
  }

  const entries: Array<{ flavor?: string; url: string }> = [];
  for (const item of assets) {
    const url = normalizeAssetUrl(item);
    if (!url) {
      continue;
    }
    entries.push({
      flavor: item?.flavor ? String(item.flavor) : undefined,
      url,
    });
  }
  return entries;
}

function pickPreferredAssetUrl(entries: Array<{ flavor?: string; url: string }>): string | undefined {
  for (const flavor of ASSET_FLAVOR_PRIORITY) {
    const hit = entries.find((entry) => entry.flavor === flavor);
    if (hit?.url) {
      return hit.url;
    }
  }
  return entries[0]?.url;
}

function extractFallbackAssetUrl(payload: any): string | undefined {
  const entries = extractAssetEntries(payload);
  const hit = entries.find((item) => item.flavor === "28:ctrp256");
  return hit?.url || entries[0]?.url;
}

export async function fetchWebPlayback(options: {
  http: AppleMusicHttpClient;
  songId: string;
  authorizationToken: string;
  mediaUserToken: string;
}): Promise<AppleMusicWebPlaybackResult> {
  const payload = await options.http.postJson<any>(
    APPLE_MUSIC_WEB_PLAYBACK_URL,
    {
      salableAdamId: options.songId,
    },
    {
      headers: {
        Authorization: `Bearer ${options.authorizationToken}`,
        "x-apple-music-user-token": options.mediaUserToken,
      },
    },
  );

  const entries = extractAssetEntries(payload);
  const legacyHlsUrl = String(payload?.songList?.[0]?.["hls-playlist-url"] || "").trim();
  const assetHlsUrl = pickPreferredAssetUrl(entries);

  return {
    hlsPlaylistUrl: legacyHlsUrl || assetHlsUrl,
    fallbackAssetUrl: extractFallbackAssetUrl(payload),
  };
}
