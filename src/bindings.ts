// Hand-maintained Tauri command bridge.
// Uses dynamic import so this file works in both the desktop app (Tauri) and CI (no runtime).
// Do NOT delete or auto-generate this file.

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _invoke: InvokeFn | null = null;

async function inv<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!_invoke) {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const mod = await import("@tauri-apps/api/core");
      _invoke = mod.invoke as InvokeFn;
    } else {
      _invoke = async () => { throw new Error("Not in Tauri"); };
    }
  }
  return _invoke(cmd, args) as Promise<T>;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface AppInfo {
  name: string;
  version: string;
  mode: string;
  isElevated: boolean;
}

export interface SystemMetrics {
  cpuUsage: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  ramUsagePercent: number;
  gpuUsage: number | null;
  gpuTemp: number | null;
  diskFreeBytes: number;
  diskTotalBytes: number;
  diskUsagePercent: number;
  dockerContainers: number;
}

export const commands = {
  async getAppInfo(): Promise<AppInfo> {
    if (isTauri()) return inv<AppInfo>("get_app_info");
    return { name: "NetScope", version: "0.2.3", mode: "simulator", isElevated: false };
  },

  async getSystemMetrics(): Promise<SystemMetrics> {
    if (isTauri()) return inv<SystemMetrics>("get_system_metrics");
    return {
      cpuUsage: 6.4, ramUsedBytes: 78_600_000_000, ramTotalBytes: 121_700_000_000,
      ramUsagePercent: 66.6, gpuUsage: 2.0, gpuTemp: 49.0,
      diskFreeBytes: 1_571_100_000_000, diskTotalBytes: 3_560_000_000_000,
      diskUsagePercent: 55.9, dockerContainers: 17,
    };
  },

  async triggerSimulation(scenario: string): Promise<string> {
    if (isTauri()) return inv<string>("trigger_simulation", { scenario });
    return `Simulation '${scenario}' triggered`;
  },

  async cleanSimulations(): Promise<string> {
    if (isTauri()) return inv<string>("clean_simulations");
    return "All simulations cleaned";
  },

  async setTrafficMode(mode: string): Promise<string> {
    if (isTauri()) return inv<string>("set_traffic_mode", { mode });
    return `Mode switched to ${mode}`;
  },

  async getSocketDelta(): Promise<unknown> {
    if (isTauri()) return inv<unknown>("get_socket_delta");
    return { t: Date.now(), addNodes: [], updateNodes: [], removeNodeIds: [], addLinks: [], updateLinks: [], removeLinkIds: [] };
  },

  async getSocketSnapshot(): Promise<{ nodes: unknown[]; links: unknown[] }> {
    if (isTauri()) return inv<{ nodes: unknown[]; links: unknown[] }>("get_socket_snapshot");
    const now = Date.now();
    return {
      nodes: [{ id: "host:local", kind: "host", label: "This PC", ip: "127.0.0.1", hostname: "localhost", firstSeen: now - 3600000, lastSeen: now, bytesIn: 45_200_000, bytesOut: 98_400_000, rateIn: 0, rateOut: 0 }],
      links: [],
    };
  },

  async getCaptureStatus(): Promise<{ isAvailable: boolean; isActive: boolean; driverName: string; error: string | null; interfaces: string[] }> {
    if (isTauri()) return inv<{ isAvailable: boolean; isActive: boolean; driverName: string; error: string | null; interfaces: string[] }>("get_capture_status");
    return { isAvailable: false, isActive: false, driverName: "None", error: "Npcap required for packet capture", interfaces: ["Ethernet", "Wi-Fi"] };
  },

  async startCapture(interfaceName?: string): Promise<string> {
    if (isTauri()) return inv<string>("start_capture", { interfaceName });
    return `Capture started on ${interfaceName ?? "Default"}`;
  },

  async stopCapture(): Promise<string> {
    if (isTauri()) return inv<string>("stop_capture");
    return "Capture stopped";
  },

  async blockRemoteIp(ip: string): Promise<string> {
    if (isTauri()) return inv<string>("block_remote_ip", { ip });
    return `Firewall rule for ${ip} staged`;
  },

  async unblockRemoteIp(ip: string): Promise<string> {
    if (isTauri()) return inv<string>("unblock_remote_ip", { ip });
    return `Firewall rule for ${ip} removed`;
  },

  async openExternalUrl(url: string): Promise<string> {
    if (isTauri()) return inv<string>("open_external_url", { url });
    window.open(url, "_blank");
    return `Opened ${url}`;
  },
};
