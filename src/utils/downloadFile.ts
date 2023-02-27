export function downloadFile(name: string, data: any): void {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.style.display = 'none';
  a.click();
  a.remove();
}
