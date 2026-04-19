import { addCollection } from "@iconify/vue/offline";
import type { IconifyJSON } from "@iconify/types";
import vscodeIcons from "@iconify-json/vscode-icons/icons.json";
import { getIconForFile, getIconForFolder, getIconForOpenFolder } from "vscode-icons-js";

addCollection(vscodeIcons as IconifyJSON);

const toIconifyName = (svgFilename: string): string =>
  `vscode-icons:${svgFilename.replace(/\.svg$/, "").replace(/_/g, "-")}`;

export const getFileIconName = (filename: string): string =>
  toIconifyName(getIconForFile(filename) ?? "default_file.svg");

export const getFolderIconName = (folderName: string, isOpen: boolean): string =>
  toIconifyName(isOpen ? getIconForOpenFolder(folderName) : getIconForFolder(folderName));
