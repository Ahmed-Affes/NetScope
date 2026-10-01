import { commands } from "../bindings";

export interface UpdateInfo {
  version: string;
  tagName: string;
  name: string;
  notes: string;
  publishedAt: string;
  downloadUrl: string;
  hasUpdate: boolean;
}

import packageJson from "../../package.json";

export const CURRENT_VERSION = packageJson.version;
const REPO = "Ahmed-Affes/NetScope";

/**
 * Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim();
  const clean2 = v2.replace(/^v/, "").trim();

  const parts1 = clean1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split(".").map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

class UpdateService {
  private cachedUpdate: UpdateInfo | null = null;
  private lastCheckTime: number = 0;

  public async checkForUpdates(force: boolean = false): Promise<UpdateInfo | null> {
    const now = Date.now();
    // Cache check for 3 minutes unless forced
    if (!force && this.cachedUpdate && now - this.lastCheckTime < 3 * 60 * 1000) {
      return this.cachedUpdate;
    }

    try {
      let releaseData: any = null;

      // 1. Try latest release endpoint
      const resLatest = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (resLatest.ok) {
        releaseData = await resLatest.json();
      } else {
        // 2. Fallback to releases list (captures prereleases and recent tags)
        const resList = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (resList.ok) {
          const list = await resList.json();
          if (Array.isArray(list) && list.length > 0) {
            releaseData = list[0];
          }
        }
      }

      if (!releaseData) {
        return null;
      }

      const tagName = releaseData.tag_name || "";
      const isNewer = compareVersions(tagName, CURRENT_VERSION) > 0;

      // Find Windows .exe asset if available
      let exeDownloadUrl = releaseData.html_url || `https://github.com/${REPO}/releases`;
      if (Array.isArray(releaseData.assets)) {
        const exeAsset = releaseData.assets.find(
          (a: any) =>
            typeof a.name === "string" &&
            (a.name.endsWith(".exe") ||
              a.name.includes("Setup") ||
              a.name.includes("x64") ||
              a.name.endsWith(".msi"))
        );
        if (exeAsset && exeAsset.browser_download_url) {
          exeDownloadUrl = exeAsset.browser_download_url;
        }
      }

      const updateInfo: UpdateInfo = {
        version: tagName.replace(/^v/, ""),
        tagName,
        name: releaseData.name || `NetScope ${tagName}`,
        notes:
          releaseData.body ||
          "Performance improvements, enhanced network socket telemetry, and bug fixes.",
        publishedAt: releaseData.published_at || new Date().toISOString(),
        downloadUrl: exeDownloadUrl,
        hasUpdate: isNewer,
      };

      this.cachedUpdate = updateInfo;
      this.lastCheckTime = now;
      return updateInfo;
    } catch (err) {
      console.warn("Update check failed:", err);
      return null;
    }
  }

  public getMockUpdate(): UpdateInfo {
    return {
      version: "0.2.7",
      tagName: "v0.2.7",
      name: "NetScope v0.2.7",
      notes:
        "• Real-time socket polling performance improvements\n• Windows ARP network discovery stability\n• UI polish and dark mode refinements",
      publishedAt: new Date().toISOString(),
      downloadUrl: `https://github.com/${REPO}/releases`,
      hasUpdate: true,
    };
  }

  public isDismissed(version: string): boolean {
    try {
      return localStorage.getItem(`netscope_dismissed_update_${version}`) === "true";
    } catch {
      return false;
    }
  }

  public dismissUpdate(version: string): void {
    try {
      localStorage.setItem(`netscope_dismissed_update_${version}`, "true");
    } catch (e) {
      console.warn("Failed to store dismissed update", e);
    }
  }

  public resetDismissed(version: string): void {
    try {
      localStorage.removeItem(`netscope_dismissed_update_${version}`);
    } catch (e) {
      console.warn("Failed to clear dismissed update", e);
    }
  }

  public async openDownload(url: string): Promise<void> {
    try {
      await commands.openExternalUrl(url);
      return;
    } catch (err) {
      console.warn("commands.openExternalUrl failed:", err);
    }
    try {
      window.open(url, "_blank");
    } catch {
      window.location.href = url;
    }
  }
}

export const updateService = new UpdateService();
