import { syncHeroVideos } from "../utils/syncHeroVideos.mjs";

export function initHeroVideo(slider, swiper) {
  const getVideos = function () {
    return slider.querySelectorAll("[data-hero-video]");
  };

  if (!getVideos().length) {
    return;
  }

  // Кожен ролик важить кілька мегабайт, тому src підставляється лише тому
  // відео, що зараз на активному слайді. Решта слайдів показує poster, доки
  // користувач до них не долистає.
  const loadVideo = function (video) {
    const src = video.dataset.src;

    if (!src || video.dataset.loaded === "true") {
      return;
    }

    video.dataset.loaded = "true";
    video.preload = "auto";
    video.setAttribute("src", src);
    video.load();
    video.addEventListener(
      "canplay",
      function () {
        syncHeroVideos(slider);
      },
      { once: true },
    );
  };

  const loadActiveVideo = function () {
    const videos = getVideos();
    let hasActive = false;

    videos.forEach(function (video) {
      if (video.closest(".swiper-slide-active")) {
        hasActive = true;
        loadVideo(video);
      }
    });

    // Слайдер не піднявся (hero__slider_static) — активного слайда немає,
    // тож вантажимо тільки перший ролик, а не всі одразу.
    if (!hasActive && !swiper && videos.length) {
      loadVideo(videos[0]);
    }
  };

  loadActiveVideo();

  if (swiper && typeof swiper.on === "function") {
    ["init", "loopFix", "slidesLengthChange", "slideChangeTransitionEnd"].forEach(function (eventName) {
      swiper.on(eventName, function () {
        loadActiveVideo();
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
