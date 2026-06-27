import { spawn, spawnSync, type ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "mioki";
import { freePort } from "./port-utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DECRYPTOR_PORT = 19123;
const HEALTH_URL = `http://127.0.0.1:${DECRYPTOR_PORT}/health`;
const DECRYPT_URL = `http://127.0.0.1:${DECRYPTOR_PORT}/decrypt/song`;

let processRef: ChildProcess | null = null;
let started = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGoAvailable(): boolean {
  try {
    const result = spawnSync("go", ["version"], { stdio: "ignore" });
    if (result.error) {
      return false;
    }
    return result.status === 0;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await sleep(300);
  }
  throw new Error("decryptor health check timeout");
}

export async function startDecryptorRuntime(): Promise<void> {
  if (started) {
    return;
  }

  if (!isGoAvailable()) {
    logger.warn(
      "未检测到 go 可执行文件，applemusic 服务无法启动 decryptor，请安装 go 后重启",
    );
    throw new Error("go is not installed");
  }

  const freed = await freePort(DECRYPTOR_PORT);
  if (freed.remainingPids.length > 0) {
    throw new Error(
      `applemusic decryptor 端口 ${DECRYPTOR_PORT} 被占用且无法结束 (PID: ${freed.remainingPids.join(", ")})`,
    );
  }

  const serviceRoot = __dirname;
  const cwd = path.join(serviceRoot, "decryptor-go");
  const goPath = path.join(serviceRoot, "temp", "go");
  await fs.mkdir(goPath, { recursive: true });
  const child = spawn("go", ["run", "./cmd/server", "--port", String(DECRYPTOR_PORT)], {
    cwd,
    env: {
      ...process.env,
      GOPATH: process.env.GOPATH || goPath,
      GOSUMDB: process.env.GOSUMDB || "off",
      GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processRef = child;

  child.stdout?.on("data", (chunk) => {
    const msg = String(chunk || "").trim();
    if (msg) {
      logger.info(`[applemusic-decryptor] ${msg}`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const msg = String(chunk || "").trim();
    if (msg) {
      logger.warn(`[applemusic-decryptor] ${msg}`);
    }
  });

  child.on("exit", () => {
    started = false;
    processRef = null;
  });

  await waitForHealth(25_000);
  started = true;
}

export async function stopDecryptorRuntime(): Promise<void> {
  if (!processRef) {
    started = false;
    return;
  }
  processRef.kill("SIGTERM");
  processRef = null;
  started = false;
}

export async function decryptSongByRuntimeApi(options: {
  adamId: string;
  authorizationToken: string;
  mediaUserToken: string;
  outputPath: string;
}): Promise<void> {
  if (!started) {
    throw new Error("applemusic decryptor 未启动");
  }

  const response = await fetch(DECRYPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `decrypt api failed with status ${response.status}`);
  }
}
