import type {
  AppleMusicAlbumDetail,
  AppleMusicAlbumTrack,
  AppleMusicSearchResult,
  AppleMusicSearchSongItem,
  AppleMusicSongDetail,
  CatalogSongData,
} from "./types";
import { normalizeArtworkUrl } from "./utils";

function toSongItem(song: CatalogSongData): AppleMusicSearchSongItem {
  return {
    id: String(song.id || ""),
    name: String(song.attributes?.name || "未知歌曲"),
    artistName: String(song.attributes?.artistName || "未知歌手"),
    albumName: String(song.attributes?.albumName || "未知专辑"),
    artworkUrl: normalizeArtworkUrl(song.attributes?.artwork?.url),
    previewUrl: song.attributes?.previews?.[0]?.url,
    durationInMillis: song.attributes?.durationInMillis,
    audioTraits: song.attributes?.audioTraits || [],
    hasLyrics: Boolean(song.attributes?.hasLyrics),
  };
}

export function mapSearchResult(payload: any, query: string): AppleMusicSearchResult {
  const songs = Array.isArray(payload?.results?.songs?.data)
    ? (payload.results.songs.data as CatalogSongData[])
    : [];

  return {
    query,
    songs: songs.map(toSongItem),
    raw: payload,
  };
}

export function mapSongDetail(payload: any): AppleMusicSongDetail {
  const item = (Array.isArray(payload?.data) ? payload.data[0] : null) as
    | CatalogSongData
    | undefined;

  if (!item) {
    throw new Error("未找到歌曲详情");
  }

  return {
    id: String(item.id || ""),
    name: String(item.attributes?.name || "未知歌曲"),
    artistName: String(item.attributes?.artistName || "未知歌手"),
    albumName: String(item.attributes?.albumName || "未知专辑"),
    artworkUrl: normalizeArtworkUrl(item.attributes?.artwork?.url),
    releaseDate: item.attributes?.releaseDate,
    durationInMillis: item.attributes?.durationInMillis,
    audioTraits: item.attributes?.audioTraits || [],
    hasLyrics: Boolean(item.attributes?.hasLyrics),
    url: item.attributes?.url,
    previewUrl: item.attributes?.previews?.[0]?.url,
    enhancedHlsUrl: item.attributes?.extendedAssetUrls?.enhancedHls,
    raw: payload,
  };
}

function toAlbumTrack(track: any): AppleMusicAlbumTrack {
  return {
    id: String(track?.id || ""),
    name: String(track?.attributes?.name || "未知曲目"),
    artistName: String(track?.attributes?.artistName || "未知歌手"),
    durationInMillis: track?.attributes?.durationInMillis,
    trackNumber: track?.attributes?.trackNumber,
    discNumber: track?.attributes?.discNumber,
    previewUrl: track?.attributes?.previews?.[0]?.url,
  };
}

export function mapAlbumDetail(payload: any): AppleMusicAlbumDetail {
  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!item) {
    throw new Error("未找到专辑详情");
  }

  const tracks = Array.isArray(item?.relationships?.tracks?.data)
    ? item.relationships.tracks.data.map(toAlbumTrack)
    : [];

  return {
    id: String(item.id || ""),
    name: String(item?.attributes?.name || "未知专辑"),
    artistName: String(item?.attributes?.artistName || "未知歌手"),
    artworkUrl: normalizeArtworkUrl(item?.attributes?.artwork?.url),
    trackCount: item?.attributes?.trackCount,
    releaseDate: item?.attributes?.releaseDate,
    genres: Array.isArray(item?.attributes?.genreNames)
      ? item.attributes.genreNames
      : [],
    tracks,
    raw: payload,
  };
}
