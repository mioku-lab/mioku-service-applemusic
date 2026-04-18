import {
  APPLE_MUSIC_WEB_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants";
import { createTimeoutSignal } from "./utils";

export class AppleMusicHttpClient {
  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {}

  async getJson<T>(url: string, options?: { headers?: Record<string, string> }): Promise<T> {
    const response = await this.request(url, {
      method: "GET",
      headers: options?.headers,
    });
    return (await response.json()) as T;
  }

  async getText(url: string, options?: { headers?: Record<string, string> }): Promise<string> {
    const response = await this.request(url, {
      method: "GET",
      headers: options?.headers,
    });
    return response.text();
  }

  async postJson<T>(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    const response = await this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  }

  async downloadFile(
    url: string,
    filePath: string,
    options?: { headers?: Record<string, string> },
  ): Promise<{ contentType?: string }> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const response = await this.request(url, {
      method: "GET",
      headers: options?.headers,
    });
    const arrayBuffer = await response.arrayBuffer();

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    return {
      contentType: response.headers.get("content-type") || undefined,
    };
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const { signal, cancel } = createTimeoutSignal(this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Origin: APPLE_MUSIC_WEB_URL,
          Referer: `${APPLE_MUSIC_WEB_URL}/`,
          ...init.headers,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Apple Music 请求失败: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      return response;
    } finally {
      cancel();
    }
  }
}
