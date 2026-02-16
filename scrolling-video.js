/**
 * <scrolling-video> — A standalone web component that scrubs a video
 * based on scroll position, with optional text overlays.
 *
 * Usage:
 *   <scrolling-video src="video.mp4" portrait-src="video-portrait.mp4" fps="30" pixels-per-second="600">
 *     <p data-timestamp="0:05">Text appears at 5 seconds</p>
 *     <p data-timestamp="0:12.5">Text appears at 12.5 seconds</p>
 *   </scrolling-video>
 *
 * Attributes:
 *   src                — Video source URL (required)
 *   portrait-src       — Alternate video for portrait viewports (falls back to src)
 *   fps                — Frames per second for interpolation (default: 30)
 *   pixels-per-second  — Scroll pixels mapped to one second of video (default: 600)
 *   interpolate        — If present, enables smooth frame interpolation
 *   data-edit-mode     — If present, shows a time display overlay
 *   data-height-multiplier — Multiplier for the scroll height (default: 1)
 *
 * CSS Custom Properties:
 *   --scrolling-video-text-font-family   (default: sans-serif)
 *   --scrolling-video-text-font-size     (default: 18px)
 *   --scrolling-video-text-line-height   (default: 1.5em)
 *   --scrolling-video-text-color         (default: white)
 *   --scrolling-video-text-background    (default: rgba(0, 0, 0, 0.7))
 *   --scrolling-video-text-border        (default: 1px solid #444)
 *   --scrolling-video-text-max-width     (default: 400px)
 *   --scrolling-video-text-alignment     (default: start)
 *   --scrolling-video-text-radius        (default: 0px)
 *   --scrolling-video-text-padding       (default: 20px)
 *   --scrolling-video-object-fit         (default: cover)
 *   --scrolling-video-object-position    (default: center)
 */

class ScrollingVideo extends HTMLElement {

  /**
   * Shared IntersectionObserver — only one scroll-driven rAF loop
   * runs at a time across all instances.
   */

  static observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.intersecting = true;
        e.target._rafId = window.requestAnimationFrame(e.target.updateVideoCurrentTime);
      } else {
        e.target.intersecting = false;
      }
    });
  });

  static timestampToSeconds(ts) {
    if (!ts) return null;
    let [minutes, seconds] = ts.split(":");
    minutes = parseInt(minutes, 10);
    seconds = parseFloat(seconds, 10);
    return 60 * minutes + seconds;
  }

  static formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  static clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  /**
   * The Shadow DOM template
   */

  get template() {
    let t = document.createElement("template");
    t.innerHTML = `
    <style>
      :host {
        display: block;
        position: relative;

        --scrolling-video-text-font-family: sans-serif;
        --scrolling-video-text-font-size: 18px;
        --scrolling-video-text-line-height: 1.5em;
        --scrolling-video-text-color: white;
        --scrolling-video-text-background: rgba(0, 0, 0, 0.7);
        --scrolling-video-text-border: 1px solid #444;
        --scrolling-video-text-max-width: 400px;
        --scrolling-video-text-alignment: start;
        --scrolling-video-text-radius: 0px;
        --scrolling-video-text-padding: 20px;

        --scrolling-video-object-fit: cover;
        --scrolling-video-object-position: center;
      }

      .window {
        position: sticky;
        top: 0;
        height: 100vh;
        width: 100%;
        margin: 0;
      }

      video {
        object-fit: var(--scrolling-video-object-fit, cover);
        object-position: var(--scrolling-video-object-position, center);
        top: 0;
        height: 100%;
        width: -moz-available;
        width: -webkit-fill-available;
        box-sizing: border-box;
      }

      .time-display {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 6px 10px;
        font-size: 14px;
        background: rgba(0, 0, 0, 0.7);
        color: #0f0;
        display: none;
        font-family: monospace;
        border-radius: 3px;
        z-index: 1000;
        pointer-events: none;
      }

      .foreground {
        position: relative;
        display: grid;
        margin: 0 5vw;
      }

      ::slotted(p) {
        position: absolute;
        color: var(--scrolling-video-text-color);
        font-family: var(--scrolling-video-text-font-family);
        font-size: var(--scrolling-video-text-font-size);
        line-height: var(--scrolling-video-text-line-height);
        background: var(--scrolling-video-text-background);
        border: var(--scrolling-video-text-border);
        max-width: min(var(--scrolling-video-text-max-width), 100%);
        justify-self: var(--scrolling-video-text-alignment);
        border-radius: var(--scrolling-video-text-radius);
        margin: 15px;
        padding: var(--scrolling-video-text-padding);
        box-sizing: border-box;
      }

      @media only screen and (max-width: 650px) {
        .foreground {
          margin: 0;
        }
      }
    </style>

    <div class="window">
      <video type="video/mp4" preload="metadata" muted playsinline autoplay></video>
      <div class="time-display"></div>
    </div>

    <div class="foreground">
      <slot></slot>
    </div>
    `;
    return t;
  }

  /**
   * This will run before the element is added to the DOM
   */

  constructor() {
    super();

    // Hide until video metadata loads to prevent FOUC
    this.hidden = true;

    // Load up the ShadowDOM
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(this.template.content.cloneNode(true));

    // Set up some references for later
    this.video = this.shadowRoot.querySelector("video");
    this.foreground = this.shadowRoot.querySelector(".foreground");
    this.isVideoLoaded = false;
    this.timeDisplay = this.shadowRoot.querySelector(".time-display");
    this._rafId = null;
    this.debug = !!(this.dataset.editMode || this.hasAttribute("debug"));

    if (this.debug) {
      this.timeDisplay.style.display = "block";
    }

    // A little gnarly, but the idea is to set the src appropriately from the beginning
    // Otherwise, we could load the set src on mobile, then realize we need to swap to portrait mode
    this.landscapeSrc = this.getAttribute("src");
    this.portraitSrc = this.hasAttribute("portrait-src") ? this.getAttribute("portrait-src") : this.getAttribute("src");
    this.aspectRatio = window.innerWidth / window.innerHeight;
    this.portraitRatio = 0.8;
    this.aspectRatio < this.portraitRatio ? this.setAttribute("src", this.portraitSrc) : this.setAttribute("src", this.landscapeSrc);
    this.video.src = this.getAttribute("src");

    this.fps = parseInt(this.getAttribute("fps"), 10) || 30;
    this.pixelsPerSecond = parseInt(this.getAttribute("pixels-per-second"), 10) || 600;
    this.numFrames = null;
    this.previousFrame = 0;
    this.interpolate = this.hasAttribute("interpolate");
    this.heightMultiplier = parseFloat(this.dataset.heightMultiplier) || 1;

    this.video.addEventListener('loadedmetadata', () => {
      this.initializeVideo();
    });

    /**
     * Prevents seeking from piling up
     */

    this.seeking = false;

    this.video.addEventListener('seeking', () => {
      this.seeking = true;
    });

    this.video.addEventListener('seeked', () => {
      this.seeking = false;
    });

    this.updateVideoCurrentTime = this.updateVideoCurrentTime.bind(this);
  }

  /**
   * This will run when an element is added or moved in the DOM
   */

  connectedCallback() {
    ScrollingVideo.observer.observe(this);
  }

  /**
   * This will run when the element is removed from the DOM
   */

  disconnectedCallback() {
    ScrollingVideo.observer.unobserve(this);
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Initializes the video
   */

  initializeVideo() {
    /**
     * Autoplay seems to help load the video chunks further in advance
     * as you scroll through, and the pause prevents it from playing.
     */

    this.video.pause();
    this.video.currentTime = 0;
    this.isVideoLoaded = true;
    this.numFrames = this.video.duration * this.fps;

    /**
     * On mobile we can't autoplay without user interaction,
     * so we listen for a touchstart to do a quick play/pause.
     * Harmless on desktop (never fires).
     */

    this.addEventListener('touchstart', async () => {
      await this.video.play();
      this.video.pause();
    }, { once: true });

    /**
     * Foreground adjustments
     */

    let height = this.heightMultiplier * this.video.duration * this.pixelsPerSecond + window.innerHeight;
    this.foreground.style.setProperty("height", `${height}px`);

    const pElements = this.querySelectorAll("p");
    pElements.forEach((elem) => {
      let timestamp = ScrollingVideo.timestampToSeconds(elem.dataset.timestamp);
      if (timestamp) {
        let percentage = Math.round(timestamp / this.video.duration * 10000) / 100;
        elem.style.setProperty("top", `${percentage}%`);
      }
    });

    // Now we show because everything is ideally good.
    this.hidden = false;
  }

  setDebug(on) {
    this.debug = on;
    this.timeDisplay.style.display = on ? "block" : "none";
  }

  isBuffered(seconds) {
    let buffered = false;
    let bufferedTimeRanges = this.video.buffered;

    for (var i = bufferedTimeRanges.length - 1; i >= 0; i--) {
      let bufferStart = this.video.buffered.start(i);
      let bufferEnd = this.video.buffered.end(i);

      if (seconds >= bufferStart && seconds <= bufferEnd) {
        buffered = true;
        break;
      }
    }
    return buffered;
  }

  /**
   * Interpolates the progress of the video's currentTime and updates the time
   *
   * Requirements: Video duration and, more uniquely, the video FPS, must be known
   * to make use of this method. FPS does not appear extractable from the video
   * metadata itself at runtime. So that must be manually known and added to video-scroller
   * element as an attribute in the light DOM.
   *
   * Advantage: Might be a better user experience, particularly when scrolling through
   * a physical space. The scroll more smoothly starts and tapers (like an easing animation).
   *
   * Note: Maybe the same effect could be achieved without frame-by-frame calculation?
   * Instead just try the same thing with time interpolation?
   */

  interpolateUpdate(progress) {
    // This is the frame that matches the scroll progress
    let progressFrame = this.numFrames * progress;

    // This limits the jump in frames to 1/6th the difference b/t the progress frame and previous frame
    let interpolation = (progressFrame - this.previousFrame) / 6;

    // Sets a limit to interpolation and let the value settle down and stop within epsilon (e.g. 1 frame)
    let boundInterpolation = Math.abs(interpolation) < 1 ? 0 : interpolation;

    // Calculate the desired, interpolated frame
    let frame = this.previousFrame + boundInterpolation;

    // This bounds the interpolated frame to have a min/max
    let boundFrame = ScrollingVideo.clamp(frame, 0, this.numFrames);

    // Get time from the FPS and frame number
    let time = boundFrame / this.fps;

    // This bounds the time to have a min/max
    let boundTime = ScrollingVideo.clamp(time, 0, this.video.duration);

    // Set the video currentTime
    if (isFinite(boundTime)) {
      this.video.currentTime = boundTime;
      this.previousFrame = boundFrame;
    }
  }

  /**
   * Updates the current time of the video based on progress
   *
   * Note:
   * "this" is bound to the element in the constructor.
   */

  updateVideoCurrentTime() {
    if (!this.seeking && this.isVideoLoaded) {
      let bbox = this.getBoundingClientRect();
      let progress = (-1 * bbox.y) / (bbox.height - window.innerHeight);
      let boundProgress = ScrollingVideo.clamp(progress, 0, 1);
      if (this.interpolate) {
        this.interpolateUpdate(boundProgress);
      } else {
        this.video.currentTime = this.video.duration * boundProgress;
      }

      if (!this.video.paused) {
        this.video.pause();
      }
    }

    if (this.debug) {
      this.timeDisplay.textContent = ScrollingVideo.formatTime(this.video.currentTime);
    }

    if (this.intersecting) {
      this._rafId = window.requestAnimationFrame(this.updateVideoCurrentTime);
    }
  }
}

/**
 * Register the element
 */

customElements.get("scrolling-video") || customElements.define("scrolling-video", ScrollingVideo);
