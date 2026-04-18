import * as path from "path";

export function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

export function normalizeArtworkUrl(
  url: string | undefined,
  size: string = "500x500",
): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace("{w}x{h}", size);
}

export function ensureSafeFileName(value: string, fallback: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();

  return normalized || fallback;
}

export function resolveOutputPath(options: {
  outputDir?: string;
  fileName?: string;
  defaultFileName: string;
  ext: string;
}): string {
  const outputDir = options.outputDir || path.join(process.cwd(), "temp", "music");
  const fileName = ensureSafeFileName(
    options.fileName || options.defaultFileName,
    options.defaultFileName,
  );
  return path.join(outputDir, `${fileName}.${options.ext}`);
}
