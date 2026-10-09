# Demo videos

Drop a file named **`demo.mp4`** in this folder and the landing page picks it
up automatically:

- The landing page probes `HEAD /videos/demo.mp4` on load.
- While the file is missing, the section shows the animated product mock and a
  "Product tour — coming soon" chip (no broken play button).
- The moment `demo.mp4` exists (any web browser can play H.264 MP4), a pulsing
  play button appears and clicking it plays the video inline.

Tips:

- Keep it short (30–90 s) and under ~20 MB so Vercel serves it fast.
- Export at 1920×1080, H.264, AAC audio.
- Compress with e.g. `ffmpeg -i in.mov -c:v libx264 -crf 24 -preset slow -movflags +faststart demo.mp4`
  (`+faststart` matters — it lets playback begin before the file finishes downloading).
- The content type of the response is what the probe trusts, so the SPA
  fallback (`index.html`) can never be mistaken for a video.

More files (`demo-ar.mp4`, product clips, …) can be added here too; wiring extra
players is a small change in `client/src/pages/LandingPage.jsx`
(`DEMO_VIDEO_SRC`).
