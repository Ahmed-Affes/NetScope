export interface UpdateInfo {
  version: string;
  tagName: string;
  name: string;
  notes: string;
  publishedAt: string;
  downloadUrl: string;
  hasUpdate: boolean;
}

export const CURRENT_VERSION = "0.2.1";
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
    // Cache check for 10 minutes unless forced
    if (!force && this.cachedUpdate && now - this.lastCheckTime < 10 * 60 * 1000) {
      return this.cachedUpdate;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          // No releases published yet
          return null;
        }
        throw new Error(`GitHub Releases API returned status ${res.status}`);
      }

      const data = await res.json();
      const tagName = data.tag_name || "";
      const isNewer = compareVersions(tagName, CURRENT_VERSION) > 0;

      // Find Windows .exe asset if available
      let exeDownloadUrl = data.html_url;
      if (Array.isArray(data.assets)) {
        const exeAsset = data.assets.find(
          (a: any) =>
            typeof a.name === "string" &&
            (a.name.endsWith(".exe") || a.name.includes("Setup") || a.name.includes("x64"))
        );
        if (exeAsset && exeAsset.browser_download_url) {
          exeDownloadUrl = exeAsset.browser_download_url;
        }
      }

      const updateInfo: UpdateInfo = {
        version: tagName.replace(/^v/, ""),
        tagName,
        name: data.name || `NetScope ${tagName}`,
        notes: data.body || "Performance enhancements, live PC monitoring, and security stability updates.",
        publishedAt: data.published_at || new Date().toISOString(),
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

  public openDownload(url: string): void {
    try {
      window.open(url, "_blank");
    } catch {
      window.location.href = url;
    }
  }
}

export const updateService = new UpdateService();
