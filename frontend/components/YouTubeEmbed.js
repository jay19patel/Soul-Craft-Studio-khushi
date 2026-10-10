"use client";

import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { youTubeThumbnail, youTubeEmbedUrl } from '../lib/youtube';

/**
 * "Lite" YouTube player: renders only a thumbnail + play button. The real
 * YouTube iframe (~1MB of JS) loads only after the visitor taps play, so a
 * page with many videos stays fast on mobile data.
 */
export default function YouTubeEmbed({ videoId, title = 'Video', vertical = false, className = '', rounded = 'rounded-3xl' }) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(() => youTubeThumbnail(videoId, vertical ? 'hq720' : 'maxresdefault'));
  if (!videoId) return null;

  const aspect = vertical ? 'aspect-[9/16]' : 'aspect-video';

  return (
    <div className={`relative w-full ${aspect} overflow-hidden bg-slate-900 ${rounded} ${className}`}>
      {playing ? (
        <iframe
          src={youTubeEmbedUrl(videoId)}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 w-full h-full"
          aria-label={`Play video: ${title}`}
        >
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              // YouTube serves a 120px grey placeholder when a size doesn't exist.
              if (e.currentTarget.naturalWidth <= 120) setThumb(youTubeThumbnail(videoId, 'hqdefault'));
            }}
            onError={() => setThumb(youTubeThumbnail(videoId, 'hqdefault'))}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/95 text-orange-600 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110">
              <Play className="w-7 h-7 md:w-8 md:h-8 ml-1 fill-orange-600" />
            </span>
          </span>
          {title && (
            <span className="absolute left-4 right-4 bottom-4 text-left text-white text-sm md:text-base font-bold drop-shadow line-clamp-2">
              {title}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
