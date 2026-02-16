# scrolling-video

A standalone web component that scrubs a video based on scroll position, with optional timed text overlays. No dependencies.

## Quickstart

```html
<script type="module" src="scrolling-video.js"></script>

<scrolling-video src="video.mp4">
  <p data-timestamp="0:05">Appears at 5 seconds</p>
  <p data-timestamp="0:12">Appears at 12 seconds</p>
</scrolling-video>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `src` | *(required)* | Video source URL |
| `portrait-src` | falls back to `src` | Alternate video for portrait viewports |
| `fps` | `30` | Frames per second (must match your video) |
| `pixels-per-second` | `600` | Scroll pixels mapped to one second of video |
| `interpolate` | off | Smooth frame interpolation (add attribute to enable) |
| `debug` | off | Show timestamp overlay |

## CSS Custom Properties

```css
scrolling-video {
  --scrolling-video-text-color: white;
  --scrolling-video-text-background: rgba(0, 0, 0, 0.7);
  --scrolling-video-text-font-family: sans-serif;
  --scrolling-video-text-font-size: 18px;
  --scrolling-video-text-max-width: 400px;
  --scrolling-video-text-alignment: start;       /* start | center | end */
  --scrolling-video-text-border: 1px solid #444;
  --scrolling-video-text-radius: 0px;
  --scrolling-video-text-padding: 20px;
  --scrolling-video-text-line-height: 1.5em;
  --scrolling-video-object-fit: cover;
  --scrolling-video-object-position: center;
}
```

## Encoding Videos for Scroll Scrubbing (HandBrake)

Scroll-driven playback seeks to arbitrary positions, so videos need frequent keyframes. Two HandBrake presets are included in `handbrake/`:

| Preset | Keyframe Interval | Quality | Best for |
|---|---|---|---|
| `scrolling-video-keyint-30-quality-22` | Every 30 frames (1s @ 30fps) | 22 (higher quality) | Standard use |
| `scrolling-video-keyint-3-quality-26` | Every 3 frames | 26 (smaller file) | Smoother scrubbing |

Import a preset in HandBrake via **Presets > Import from file**, then encode your video.

Key settings both presets share:
- **Encoder:** x264, `veryfast` preset, `fastdecode` tune
- **Framerate:** 30fps (peak)
- **Web optimized:** on (`Mp4HttpOptimize`)
- **Audio:** AAC stereo 160kbps

## Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; box-sizing: border-box; }
  </style>
</head>
<body>
  <script type="module" src="scrolling-video.js"></script>

  <scrolling-video src="video.mp4" portrait-src="video-portrait.mp4" pixels-per-second="500"
    style="--scrolling-video-text-alignment: end; --scrolling-video-text-radius: 8px;">
    <p data-timestamp="0:02">Welcome</p>
    <p data-timestamp="0:06">Keep scrolling...</p>
    <p data-timestamp="0:10">That's it!</p>
  </scrolling-video>
</body>
</html>
```

## License

MIT
