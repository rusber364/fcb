import { syncHeroVideos } from "../utils/syncHeroVideos.mjs";

export function initHeroVideo(slider, swiper) {
  const getVideos = function () {
    return slider.querySelectorAll("[data-hero-video]");
  };

  if (!getVideos().length) {
    return;
  }

  const loadVideo = function (video, preloadMode) {
    const src = video.dataset.src || video.getAttribute("src");

    if (!src) {
      return;
    }

    if (video.getAttribute("src") !== src) {
      video.setAttribute("src", src);
    }

    if (preloadMode && video.preload !== preloadMode) {
      video.preload = preloadMode;
    }

    if (video.dataset.loaded === "true") {
      return;
    }

    video.dataset.loaded = "true";
    video.load();
    video.addEventListener(
      "loadedmetadata",
      function () {
        if (!video.closest(".swiper-slide-active") && video.currentTime === 0) {
          try {
            video.currentTime = 0.05;
          } catch (error) {}
        }
      },
      { once: true },
    );
    video.addEventListener(
      "canplay",
      function () {
        syncHeroVideos(slider);
      },
      { once: true },
    );
  };

  const loadAllVideos = function (preloadMode) {
    getVideos().forEach(function (video) {
      loadVideo(video, preloadMode);
    });
  };

  loadAllVideos("metadata");

  const scheduleFullPreload = function () {
    const run = function () {
      loadAllVideos("auto");
      syncHeroVideos(slider);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 800);
    }
  };

  if (document.readyState === "complete") {
    scheduleFullPreload();
  } else {
    window.addEventListener("load", scheduleFullPreload, { once: true });
  }

  if (swiper && typeof swiper.on === "function") {
    [
      "init",
      "loopFix",
      "slidesLengthChange",
      "slideChangeTransitionEnd",
    ].forEach(function (eventName) {
      swiper.on(eventName, function () {
        loadAllVideos("metadata");
        syncHeroVideos(slider);
      });
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      getVideos().forEach(function (video) {
        video.pause();
      });
    } else {
      syncHeroVideos(slider);
    }
  });
}
