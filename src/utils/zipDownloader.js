// The backend builds the ZIP from the stored originals and streams it back.
// (Doing it server-side avoids cross-origin fetch/canvas hacks against /media.)
import { api } from '../api';

export async function downloadPhotosAsZip(eventId, photos, zipName, onProgress) {
  if (!photos.length) return;
  const filename = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;

  if (onProgress) onProgress(20, 'Building archive on the server…');
  const photoIds = photos.map((p) => p.id);
  const res = await api.downloadZip(eventId, photoIds, filename);

  if (onProgress) onProgress(75, 'Downloading archive…');
  const blob = await res.blob();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  if (onProgress) onProgress(100, 'Complete');
}
