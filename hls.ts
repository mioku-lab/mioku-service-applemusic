import * as crypto from "crypto";

function resolveRelativeUrl(baseUrl: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

function parseM3u8Lines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickBestStreamFromMaster(lines: string[]): string | null {
  let bestScore = -1;
  let bestUrl: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("#EXT-X-STREAM-INF")) {
      continue;
    }

    const next = lines[i + 1];
    if (!next || next.startsWith("#")) {
      continue;
    }

    const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
    const bandwidth = bandwidthMatch ? Number(bandwidthMatch[1]) : 0;
    if (bandwidth > bestScore) {
      bestScore = bandwidth;
      bestUrl = next;
    }
  }

  return bestUrl;
}

interface HlsKeyInfo {
  method: string;
  uri?: string;
  iv?: Buffer;
}

interface HlsSegmentEntry {
  uri: string;
  key?: HlsKeyInfo;
  sequence: number;
}

function parseAttributeList(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const raw = line.slice(line.indexOf(":") + 1);
  const regex = /([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/gi;
  let match: RegExpExecArray | null = regex.exec(raw);

  while (match) {
    const key = String(match[1] || "").trim();
    const value = String(match[2] || "").trim().replace(/^"(.*)"$/, "$1");
    if (key) {
      attrs[key] = value;
    }
    match = regex.exec(raw);
  }

  return attrs;
}

function parseIvHex(value?: string): Buffer | undefined {
  const raw = String(value || "").trim();
  if (!raw) {
    return undefined;
  }
  const hex = raw.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return undefined;
  }
  const iv = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, "hex");
  if (iv.length === 16) {
    return iv;
  }
  if (iv.length > 16) {
    return iv.subarray(iv.length - 16);
  }
  return Buffer.concat([Buffer.alloc(16 - iv.length, 0), iv]);
}

function buildSequenceIv(sequence: number): Buffer {
  const iv = Buffer.alloc(16, 0);
  iv.writeUInt32BE(sequence >>> 0, 12);
  return iv;
}

function parseSegmentsWithKeys(lines: string[]): HlsSegmentEntry[] {
  const entries: HlsSegmentEntry[] = [];
  let mediaSequence = 0;
  let nextSequence = 0;
  let activeKey: HlsKeyInfo | undefined;

  for (const line of lines) {
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE")) {
      const value = Number(line.split(":")[1] || "0");
      if (Number.isFinite(value) && value >= 0) {
        mediaSequence = value;
        nextSequence = value;
      }
      continue;
    }

    if (line.startsWith("#EXT-X-KEY")) {
      const attrs = parseAttributeList(line);
      activeKey = {
        method: String(attrs.METHOD || "NONE").toUpperCase(),
        uri: attrs.URI,
        iv: parseIvHex(attrs.IV),
      };
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    entries.push({
      uri: line,
      key: activeKey,
      sequence: nextSequence,
    });
    nextSequence += 1;
  }

  if (!entries.length && mediaSequence > 0) {
    nextSequence = mediaSequence;
  }
  return entries;
}

async function fetchKey(
  keyUrl: string,
  requestHeaders?: Record<string, string>,
): Promise<Buffer> {
  const response = await fetch(keyUrl, {
    method: "GET",
    headers: requestHeaders,
  });
  if (!response.ok) {
    throw new Error(`下载密钥失败: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function decryptAes128Cbc(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

export async function downloadAacFromHls(options: {
  httpGetText?: (url: string) => Promise<string>;
  playlistUrl: string;
  outputFilePath: string;
  requestHeaders?: Record<string, string>;
}): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const masterText = options.httpGetText
    ? await options.httpGetText(options.playlistUrl)
    : await fetch(options.playlistUrl, {
        method: "GET",
        headers: options.requestHeaders,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `获取 HLS 播放列表失败: ${response.status} ${response.statusText}`,
          );
        }
        return response.text();
      });
  const masterLines = parseM3u8Lines(masterText);
  let mediaPlaylistUrl = options.playlistUrl;

  if (masterLines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) {
    const picked = pickBestStreamFromMaster(masterLines);
    if (!picked) {
      throw new Error("未能从 master m3u8 中解析音频流");
    }
    mediaPlaylistUrl = resolveRelativeUrl(options.playlistUrl, picked);
  }

  const mediaText = options.httpGetText
    ? await options.httpGetText(mediaPlaylistUrl)
    : await fetch(mediaPlaylistUrl, {
        method: "GET",
        headers: options.requestHeaders,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `获取媒体 m3u8 失败: ${response.status} ${response.statusText}`,
          );
        }
        return response.text();
      });
  const mediaLines = parseM3u8Lines(mediaText);
  const entries = parseSegmentsWithKeys(mediaLines);
  if (entries.length === 0) {
    throw new Error("媒体 m3u8 中未发现可下载分片");
  }

  await fs.mkdir(path.dirname(options.outputFilePath), { recursive: true });
  const chunks: Uint8Array[] = [];
  const keyCache = new Map<string, Buffer>();

  for (const segment of entries) {
    const url = resolveRelativeUrl(mediaPlaylistUrl, segment.uri);
    const response = await fetch(url, {
      method: "GET",
      headers: options.requestHeaders,
    });
    if (!response.ok) {
      throw new Error(`下载分片失败: ${response.status} ${response.statusText}`);
    }
    let data: Uint8Array = new Uint8Array(await response.arrayBuffer());

    const key = segment.key;
    if (key && key.method !== "NONE") {
      if (key.method !== "AES-128" || !key.uri) {
        throw new Error(`不支持的加密方式: ${key.method || "UNKNOWN"}`);
      }

      const keyUrl = resolveRelativeUrl(mediaPlaylistUrl, key.uri);
      let keyBytes = keyCache.get(keyUrl);
      if (!keyBytes) {
        keyBytes = await fetchKey(keyUrl, options.requestHeaders);
        keyCache.set(keyUrl, keyBytes);
      }
      if (keyBytes.length !== 16) {
        throw new Error(`无效 AES-128 密钥长度: ${keyBytes.length}`);
      }

      const iv = key.iv || buildSequenceIv(segment.sequence);
      data = decryptAes128Cbc(data, keyBytes, iv);
    }

    chunks.push(data);
  }

  await fs.writeFile(
    options.outputFilePath,
    Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  );
}
