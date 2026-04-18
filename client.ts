import * as path from "path";
import {
  APPLE_MUSIC_CATALOG_BASE_URL,
  DEFAULT_LANGUAGE,
  DEFAULT_STOREFRONT,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import { AppleMusicHttpClient } from "./http";
import { decryptSongByRuntimeApi } from "./decryptor-runtime";
import { downloadAacFromHls } from "./hls";
import { mapAlbumDetail, mapSearchResult, mapSongDetail } from "./mappers";
import { AppleMusicAuthorizationTokenProvider } from "./token-provider";
import type {
  AppleMusicAacDownloadResult,
  AppleMusicAlbumDetail,
  AppleMusicClient,
  AppleMusicClientOptions,
  AppleMusicCoverDownloadResult,
  AppleMusicSearchResult,
  AppleMusicSongDetail,
} from "./types";
import { normalizeArtworkUrl, resolveOutputPath } from "./utils";
import { fetchWebPlayback } from "./webplayback";

function buildCatalogUrl(
  storefront: string,
  endpoint: string,
  query: Record<string, string | number | undefined>,
): string {
  const url = new URL(
    `${APPLE_MUSIC_CATALOG_BASE_URL}/${storefront}/${endpoint.replace(/^\//, "")}`,
  );

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export class AppleMusicClientImpl implements AppleMusicClient {
  private readonly tokenProvider: AppleMusicAuthorizationTokenProvider;
  private readonly http: AppleMusicHttpClient;
  private readonly defaultStorefront: string;
  private readonly defaultLanguage: string;
  private readonly mediaUserToken?: string;
  private readonly allowPreviewFallback: boolean;
  private initialAuthorizationToken?: string;

  constructor(
    options: AppleMusicClientOptions | undefined,
    tokenProvider: AppleMusicAuthorizationTokenProvider,
  ) {
    this.tokenProvider = tokenProvider;
    this.defaultStorefront = options?.storefront || DEFAULT_STOREFRONT;
    this.defaultLanguage = options?.language || DEFAULT_LANGUAGE;
    this.mediaUserToken = options?.mediaUserToken;
    this.allowPreviewFallback = options?.allowPreviewFallback ?? false;
    this.initialAuthorizationToken = options?.authorizationToken;
    this.http = new AppleMusicHttpClient(
      options?.timeoutMs || DEFAULT_TIMEOUT_MS,
    );
  }

  async getAuthorizationToken(forceRefresh: boolean = false): Promise<string> {
    if (this.initialAuthorizationToken && !forceRefresh) {
      return this.initialAuthorizationToken;
    }
    const token = await this.tokenProvider.getToken(forceRefresh);
    this.initialAuthorizationToken = token;
    return token;
  }

  async searchSongs(options: {
    query: string;
    limit?: number;
    offset?: number;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicSearchResult> {
    const query = String(options.query || "").trim();
    if (!query) {
      return { query, songs: [] };
    }

    const storefront = options.storefront || this.defaultStorefront;
    const language = options.language || this.defaultLanguage;
    const authorizationToken = await this.getAuthorizationToken(false);

    const url = buildCatalogUrl(storefront, "search", {
      term: query,
      types: "songs",
      limit: options.limit || 30,
      offset: options.offset || 0,
      l: language,
    });

    const payload = await this.http.getJson<any>(url, {
      headers: {
        Authorization: `Bearer ${authorizationToken}`,
      },
    });

    return mapSearchResult(payload, query);
  }

  async getSongDetail(options: {
    songId: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicSongDetail> {
    const songId = String(options.songId || "").trim();
    if (!songId) {
      throw new Error("songId 不能为空");
    }

    const storefront = options.storefront || this.defaultStorefront;
    const language = options.language || this.defaultLanguage;
    const authorizationToken = await this.getAuthorizationToken(false);

    const url = buildCatalogUrl(storefront, `songs/${songId}`, {
      include: "albums,artists",
      extend: "extendedAssetUrls",
      l: language,
    });

    const payload = await this.http.getJson<any>(url, {
      headers: {
        Authorization: `Bearer ${authorizationToken}`,
      },
    });

    return mapSongDetail(payload);
  }

  async getAlbumDetail(options: {
    albumId: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicAlbumDetail> {
    const albumId = String(options.albumId || "").trim();
    if (!albumId) {
      throw new Error("albumId 不能为空");
    }

    const storefront = options.storefront || this.defaultStorefront;
    const language = options.language || this.defaultLanguage;
    const authorizationToken = await this.getAuthorizationToken(false);

    const url = buildCatalogUrl(storefront, `albums/${albumId}`, {
      include: "tracks,artists,record-labels",
      extend: "editorialVideo,extendedAssetUrls",
      l: language,
    });

    const payload = await this.http.getJson<any>(url, {
      headers: {
        Authorization: `Bearer ${authorizationToken}`,
      },
    });

    return mapAlbumDetail(payload);
  }

  async downloadSongAac(options: {
    songId: string;
    outputDir?: string;
    fileName?: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicAacDownloadResult> {
    const fs = await import("fs/promises");
    const detail = await this.getSongDetail({
      songId: options.songId,
      storefront: options.storefront,
      language: options.language,
    });

    const outputPath = resolveOutputPath({
      outputDir:
        options.outputDir ||
        path.join(process.cwd(), "temp", "music", "applemusic"),
      fileName: options.fileName,
      defaultFileName: `${detail.artistName}-${detail.name}`,
      ext: "m4a",
    });

    const hasLocalFile = await fs
      .stat(outputPath)
      .then((state) => state.isFile() && state.size > 0)
      .catch(() => false);
    if (hasLocalFile) {
      return {
        songId: detail.id,
        filePath: outputPath,
        sourceType: "hls",
        contentType: "audio/mp4",
      };
    }

    if (this.mediaUserToken) {
      const authorizationToken = await this.getAuthorizationToken(false);
      const playback = await fetchWebPlayback({
        http: this.http,
        songId: detail.id,
        authorizationToken,
        mediaUserToken: this.mediaUserToken,
      });

      if (!playback.hlsPlaylistUrl) {
        throw new Error(
          "WebPlayback 未返回可用 HLS 地址，请检查 media user token",
        );
      }

      try {
        await downloadAacFromHls({
          httpGetText: (url) =>
            this.http.getText(url, {
              headers: {
                Authorization: `Bearer ${authorizationToken}`,
                "x-apple-music-user-token": this.mediaUserToken!,
              },
            }),
          playlistUrl: playback.hlsPlaylistUrl,
          outputFilePath: outputPath,
          requestHeaders: {
            Authorization: `Bearer ${authorizationToken}`,
            "x-apple-music-user-token": this.mediaUserToken,
          },
        });
      } catch (error) {
        const message = String(error || "");
        if (!message.includes("不支持的加密方式")) {
          throw error;
        }

        await decryptSongByRuntimeApi({
          adamId: detail.id,
          authorizationToken,
          mediaUserToken: this.mediaUserToken,
          outputPath,
        });
      }
      return {
        songId: detail.id,
        filePath: outputPath,
        sourceType: "hls",
        contentType: "audio/mp4",
      };
    }

    if (!this.allowPreviewFallback) {
      throw new Error(
        "当前下载策略已禁用 preview 回退。请设置可用 media user token 后重试。",
      );
    }

    if (!detail.previewUrl) {
      throw new Error("无法下载 AAC：需要 media user token 或可用 previewUrl");
    }

    const downloadInfo = await this.http.downloadFile(
      detail.previewUrl,
      outputPath,
    );
    return {
      songId: detail.id,
      filePath: outputPath,
      sourceType: "preview",
      contentType: downloadInfo.contentType,
    };
  }

  async downloadCover(options: {
    artworkUrl: string;
    outputDir?: string;
    fileName?: string;
    size?: string;
  }): Promise<AppleMusicCoverDownloadResult> {
    const coverUrl = normalizeArtworkUrl(
      options.artworkUrl,
      options.size || "1200x1200",
    );
    if (!coverUrl) {
      throw new Error("artworkUrl 不能为空");
    }

    const outputPath = resolveOutputPath({
      outputDir:
        options.outputDir ||
        path.join(process.cwd(), "temp", "music", "applemusic", "covers"),
      fileName: options.fileName || "cover",
      defaultFileName: "cover",
      ext: "jpg",
    });

    const downloadInfo = await this.http.downloadFile(coverUrl, outputPath);
    return {
      filePath: outputPath,
      contentType: downloadInfo.contentType,
    };
  }
}
