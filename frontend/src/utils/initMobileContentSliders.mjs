import { Swiper } from "swiper";
import { Navigation } from "swiper/modules";

export async function initMobileContentSliders() {
  const featuresSlider = document.querySelector(".features__slider");
  const newsSlider = document.querySelector(".news__slider");

  if (!featuresSlider && !newsSlider) {
    return;
  }

  try {
    const mediaQuery = window.matchMedia("(max-width: 991px)");
    const tabletQuery = window.matchMedia("(min-width: 768px)");
    let featuresSwiper;
    let newsSwiper;
    let resizeTimer;

    const getSlidesPerView = function () {
      return tabletQuery.matches ? 2 : 1;
    };

    const createSlider = function (element, prevEl, nextEl) {
      return new Swiper(element, {
        modules: [Navigation],
        loop: true,
        loopAddBlankSlides: false,
        centeredSlides: false,
        slidesPerView: getSlidesPerView(),
        spaceBetween: 18,
        speed: 420,
        updateOnWindowResize: false,
        resizeObserver: false,
        observer: false,
        navigation: {
          prevEl,
          nextEl,
        },
      });
    };

    const refreshSlider = function (swiperInstance) {
      if (!swiperInstance || swiperInstance.destroyed) {
        return;
      }

      swiperInstance.params.slidesPerView = getSlidesPerView();
      swiperInstance.update();
    };

    const refreshActiveSliders = function () {
      refreshSlider(featuresSwiper);
      refreshSlider(newsSwiper);
    };

    const scheduleRefresh = function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (mediaQuery.matches) {
          refreshActiveSliders();
        }
      }, 140);
    };

    const updateSliders = function () {
      if (mediaQuery.matches) {
        if (featuresSlider && !featuresSwiper) {
          featuresSwiper = createSlider(
            featuresSlider,
            ".features__arrow_prev",
            ".features__arrow_next",
          );
        }

        if (newsSlider && !newsSwiper) {
          newsSwiper = createSlider(
            newsSlider,
            ".news__arrow_prev",
            ".news__arrow_next",
          );
        }

        refreshActiveSliders();
        return;
      }

      if (featuresSwiper) {
        featuresSwiper.destroy(true, true);
        featuresSwiper = null;
      }

      if (newsSwiper) {
        newsSwiper.destroy(true, true);
        newsSwiper = null;
      }
    };

    updateSliders();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateSliders);
      tabletQuery.addEventListener("change", updateSliders);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updateSliders);
      tabletQuery.addListener(updateSliders);
    }

    window.addEventListener("resize", scheduleRefresh, { passive: true });
  } catch (error) {
    document.documentElement.classList.add("content-sliders-fallback");
  }
}
