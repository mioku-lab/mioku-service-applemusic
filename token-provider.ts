import {
  APPLE_MUSIC_WEB_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants";
import { createTimeoutSignal } from "./utils";

const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;

export class AppleMusicAuthorizationTokenProvider {
  private cachedToken: string | null = null;
  private expiresAt = 0;

  async getToken(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && now < this.expiresAt) {
      return this.cachedToken;
    }

    const token = await this.fetchTokenFromWeb();
    this.cachedToken = token;
    this.expiresAt = now + TOKEN_CACHE_TTL_MS;
    return token;
  }

  private async fetchTokenFromWeb(): Promise<string> {
    const homeHtml = await this.fetchText(APPLE_MUSIC_WEB_URL);
    const indexScriptPath = this.extractIndexScriptPath(homeHtml);
    if (!indexScriptPath) {
      throw new Error("未能从 Apple Music 首页提取 index 脚本路径");
    }

    const scriptUrl = new URL(indexScriptPath, APPLE_MUSIC_WEB_URL).toString();
    const scriptText = await this.fetchText(scriptUrl);
    const token = this.extractAuthorizationToken(scriptText);
    if (!token) {
      throw new Error("未能从 Apple Music 脚本中提取 Authorization Token");
    }

    return token;
  }

  private extractIndexScriptPath(html: string): string | null {
    const patterns = [
      /\/assets\/index~[^"'\s>]+\.js/g,
      /\/assets\/index[^"'\s>]+\.js/g,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[0]) {
        return match[0];
      }
    }

    return null;
  }

  private extractAuthorizationToken(scriptText: string): string | null {
    const jwtMatch = scriptText.match(
      /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{10,}/,
    );
    if (jwtMatch?.[0]) {
      return jwtMatch[0];
    }

    const looseMatch = scriptText.match(/eyJh[^"'\s]{40,}/);
    if (looseMatch?.[0]) {
      return looseMatch[0];
    }

    return null;
  }

  private async fetchText(url: string): Promise<string> {
    const { signal, cancel } = createTimeoutSignal(DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Origin: APPLE_MUSIC_WEB_URL,
          Referer: `${APPLE_MUSIC_WEB_URL}/`,
        },
        signal,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return text;
    } finally {
      cancel();
    }
  }
}
