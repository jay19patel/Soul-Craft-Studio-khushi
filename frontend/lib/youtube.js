/**
 * YouTube helpers shared by server (validation) and client (rendering).
 * We only ever store the 11-character video id + the original URL, and the
 * page renders a thumbnail until the visitor taps play — so no heavy iframe
 * (or uploaded video file) slows the page down.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeId(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (ID_PATTERN.test(value)) return value;

  let url;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');
  let candidate = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const [, kind, id] = url.pathname.split('/');
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) candidate = id;
    }
  }

  return candidate && ID_PATTERN.test(candidate) ? candidate : null;
}

export function isYouTubeShortUrl(input) {
  return /youtube\.com\/shorts\//i.test(String(input || ''));
}

export function youTubeThumbnail(id, quality = 'hqdefault') {
  return id ? `https://i.ytimg.com/vi/${id}/${quality}.jpg` : null;
}

export function youTubeEmbedUrl(id, { autoplay = true } = {}) {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

/**
 * Normalises an admin-entered list of videos into the stored shape.
 * Throws a readable message for the first invalid URL so the admin knows
 * exactly which one to fix.
 */
export function normalizeVideoList(list, { max = 10 } = {}) {
  if (!Array.isArray(list)) return [];
  const result = [];
  for (const raw of list) {
    const url = String(raw?.url || '').trim();
    if (!url) continue;
    const youtubeId = getYouTubeId(url);
    if (!youtubeId) {
      throw new Error(`"${url}" is not a valid YouTube link.`);
    }
    result.push({
      id: String(raw.id || youtubeId),
      url,
      youtube_id: youtubeId,
      title: String(raw.title || '').trim().slice(0, 120),
      is_short: raw.is_short !== undefined ? !!raw.is_short : isYouTubeShortUrl(url),
    });
    if (result.length >= max) break;
  }
  return result;
}
