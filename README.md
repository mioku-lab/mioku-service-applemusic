# mioku-service-applemusic

## 依赖

- [Go](https://go.dev/) >= 1.23

- 通过 `createClient({ mediaUserToken })` 创建客户端
- 搜索歌曲
- 获取歌曲详情
- 获取专辑详情
- 下载 AAC 音频
- 下载封面

## API

```ts
const applemusic = ctx.services?.applemusic as AppleMusicServiceApi | undefined;
const client = applemusic?.createClient({
  mediaUserToken: "your-media-user-token",
  storefront: "cn",
  language: "zh-CN",
});
```

### `createClient(options?)`

- `mediaUserToken?: string` 由调用方传入，不走服务配置文件
- `storefront?: string` 默认 `cn`
- `language?: string` 默认 `zh-CN`
- `authorizationToken?: string` 可选，传入后优先使用
- `timeoutMs?: number` 请求超时

### `client.searchSongs({ query, limit, offset, storefront, language })`

返回歌曲数组，含名称、歌手、专辑、封面、预览地址等字段。

### `client.getSongDetail({ songId, storefront, language })`

返回歌曲详细信息，包括 `enhancedHlsUrl`、`previewUrl` 等。

### `client.getAlbumDetail({ albumId, storefront, language })`

返回专辑信息和曲目列表。

### `client.downloadSongAac({ songId, outputDir, fileName, storefront, language })`

返回：

- `filePath` 下载文件路径
- `sourceType` `hls` 或 `preview`

### `client.downloadCover({ artworkUrl, outputDir, fileName, size })`

下载封面文件并返回 `filePath`
