import { execFileSync } from "node:child_process";
import { join } from "node:path";

export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const rcedit = join(context.packager.info.projectDir, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
  const exe = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icon = join(context.packager.info.projectDir, "electron", "assets", "icon.ico");

  execFileSync(rcedit, [exe, "--set-icon", icon]);
}
