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
import type { AppleMusicServiceApi, AppleMusicClientOptions } from "./types";
export type { AppleMusicServiceApi };

const tokenProvider = new AppleMusicAuthorizationTokenProvider();

const api: AppleMusicServiceApi = {
  createClient(options) {
    return new AppleMusicClientImpl(options, tokenProvider);
  },

  async getDefaultOptions(): Promise<AppleMusicClientOptions> {
    return (await getServiceConfig("applemusic", "base")) as AppleMusicClientOptions;
  },
};

const applemusicService: MiokuService = {
  name: "applemusic",
  version: "1.0.0",
  description:
    "Apple Music service for song search/detail/album detail and AAC/cover downloads",
  api,
  async init() {
    await registerServiceConfig("applemusic", "base", {
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
