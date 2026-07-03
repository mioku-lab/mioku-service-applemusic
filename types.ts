export type AppleMusicResourceType = "songs" | "albums" | "artists";

export interface AppleMusicClientOptions {
  mediaUserToken?: string;
  storefront?: string;
  language?: string;
  authorizationToken?: string;
  timeoutMs?: number;
  allowPreviewFallback?: boolean;
}

export interface AppleMusicSearchSongItem {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  artworkUrl?: string;
  previewUrl?: string;
  durationInMillis?: number;
  audioTraits?: string[];
  hasLyrics?: boolean;
}

export interface AppleMusicSearchResult {
  query: string;
  songs: AppleMusicSearchSongItem[];
  raw?: any;
}

export interface AppleMusicSongDetail {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  artworkUrl?: string;
  releaseDate?: string;
  durationInMillis?: number;
  audioTraits?: string[];
  hasLyrics?: boolean;
  url?: string;
  previewUrl?: string;
  enhancedHlsUrl?: string;
  raw?: any;
}

export interface AppleMusicAlbumTrack {
  id: string;
  name: string;
  artistName: string;
  durationInMillis?: number;
  trackNumber?: number;
  discNumber?: number;
  previewUrl?: string;
}

export interface AppleMusicAlbumDetail {
  id: string;
  name: string;
  artistName: string;
  artworkUrl?: string;
  trackCount?: number;
  releaseDate?: string;
  genres?: string[];
  tracks: AppleMusicAlbumTrack[];
  raw?: any;
}

export interface AppleMusicAacDownloadResult {
  songId: string;
  filePath: string;
  sourceType: "hls" | "preview";
  contentType?: string;
}

export interface AppleMusicCoverDownloadResult {
  filePath: string;
  contentType?: string;
}

export interface AppleMusicWebPlaybackResult {
  hlsPlaylistUrl?: string;
  fallbackAssetUrl?: string;
}

export interface AppleMusicClient {
  getAuthorizationToken(forceRefresh?: boolean): Promise<string>;
  searchSongs(options: {
    query: string;
    limit?: number;
    offset?: number;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicSearchResult>;
  getSongDetail(options: {
    songId: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicSongDetail>;
  getAlbumDetail(options: {
    albumId: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicAlbumDetail>;
  downloadSongAac(options: {
    songId: string;
    outputDir?: string;
    fileName?: string;
    storefront?: string;
    language?: string;
  }): Promise<AppleMusicAacDownloadResult>;
  downloadCover(options: {
    artworkUrl: string;
    outputDir?: string;
    fileName?: string;
    size?: string;
  }): Promise<AppleMusicCoverDownloadResult>;
}

export interface AppleMusicServiceApi {
  createClient(options?: AppleMusicClientOptions): AppleMusicClient;
  getDefaultOptions(): Promise<AppleMusicClientOptions>;
}

export interface CatalogSongAttributes {
  name?: string;
  artistName?: string;
  albumName?: string;
  url?: string;
  releaseDate?: string;
  durationInMillis?: number;
  audioTraits?: string[];
  hasLyrics?: boolean;
  previews?: Array<{ url?: string }>;
  artwork?: {
    url?: string;
    width?: number;
    height?: number;
  };
  extendedAssetUrls?: {
    enhancedHls?: string;
  };
}

export interface CatalogSongData {
  id: string;
  type: string;
  attributes?: CatalogSongAttributes;
}
