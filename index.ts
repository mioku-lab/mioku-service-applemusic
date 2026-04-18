import type { MiokuService } from "../../core/types";
import { AppleMusicClientImpl } from "./client";
import {
  startDecryptorRuntime,
  stopDecryptorRuntime,
} from "./decryptor-runtime";
import { AppleMusicAuthorizationTokenProvider } from "./token-provider";
import type { AppleMusicServiceApi } from "./types";

const tokenProvider = new AppleMusicAuthorizationTokenProvider();

const api: AppleMusicServiceApi = {
  createClient(options) {
    return new AppleMusicClientImpl(options, tokenProvider);
  },
};

const applemusicService: MiokuService = {
  name: "applemusic",
  version: "1.0.0",
  description:
    "Apple Music service for song search/detail/album detail and AAC/cover downloads",
  api,
  async init() {
    await startDecryptorRuntime();
  },
  async dispose() {
    await stopDecryptorRuntime();
  },
};

export default applemusicService;
