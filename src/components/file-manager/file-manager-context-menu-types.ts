export interface FileManagerContextMenuPayload {
  event: MouseEvent;
  path: string;
  status: GitFileStatus | null;
  isDirectory: boolean;
}

export interface FileManagerContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus | null;
  isDirectory: boolean;
}
