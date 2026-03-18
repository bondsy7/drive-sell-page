export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });

  // Download the file
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  // Also open in a new browser tab for instant preview
  const previewUrl = URL.createObjectURL(blob);
  window.open(previewUrl, '_blank');
  // Revoke after a short delay so the tab can load
  setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);
}
