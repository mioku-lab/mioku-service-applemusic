import type { MiokuService } from "mioku";
import {
  registerServiceConfig,
  getServiceConfig,
} from "mioku";
import { AppleMusicClientImpl } from "./client";
import {
  startDecryptorRuntime,
  stopDecryptorRuntime,
} from "./decryptor-runtime";
import { AppleMusicAuthorizationTokenProvider } from "./token-provider";
import type { AppleMusicServiceApi } from "./types";
export type { AppleMusicServiceApi };

const tokenProvider = new AppleMusicAuthorizationTokenProvider();

const api: AppleMusicServiceApi = {
  createClient(options) {
    return new AppleMusicClientImpl(options, tokenProvider);
  },

  getDefaultOptions() {
    return getServiceConfig("applemusic", "base");
  },
};

const applemusicService: MiokuService = {
  name: "applemusic",
  version: "1.0.0",
  description:
    "Apple Music service for song search/detail/album detail and AAC/cover downloads",
  api,
  async init() {
    registerServiceConfig("applemusic", "base", {
      mediaUserToken: "",
      storefront: "cn",
      language: "zh-CN",
    });
    await startDecryptorRuntime();
  },
  async dispose() {
    await stopDecryptorRuntime();
  },
};

export default applemusicService;
