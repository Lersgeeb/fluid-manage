export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Deferred so the browser has started the download before the URL dies.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function datedFileName(extension: string): string {
  return `fluidmanage-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
