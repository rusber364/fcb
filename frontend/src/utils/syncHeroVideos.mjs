export function syncHeroVideos(slider) {
  const videos = slider.querySelectorAll("[data-hero-video]");

  videos.forEach(function (video) {
    if (video.closest(".swiper-slide-active")) {
      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    } else {
      video.pause();
    }
  });
}
