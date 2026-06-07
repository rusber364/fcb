import { Swiper } from "swiper";
import { Navigation, Pagination } from "swiper/modules";
import { initHeroVideo } from "../utils/initHeroVideo.mjs";
import { createPanoramaEffect } from "../utils/createPanoramaEffect.mjs";

export async function initHeroSlider() {
  const slider = document.querySelector(".hero__slider");

  if (!slider) {
    return;
  }

  try {
    const EffectPanorama = createPanoramaEffect();

    const heroSwiper = new Swiper(slider, {
      modules: [Navigation, Pagination, EffectPanorama],
      effect: "panorama",
      loop: true,
      loopAddBlankSlides: false,
      loopPreventsSliding: false,
      initialSlide: 0,
      centeredSlides: true,
      slidesPerView: "auto",
      slidesPerGroup: 1,
      spaceBetween: 32,
      speed: 560,
      navigation: {
        prevEl: ".hero__arrow_prev",
        nextEl: ".hero__arrow_next",
      },
      pagination: {
        el: ".hero__pagination",
        clickable: true,
        bulletClass: "hero__dot",
        bulletActiveClass: "hero__dot_active",
      },
      breakpoints: {
        0: {
          spaceBetween: 10,
        },
        768: {
          spaceBetween: 10,
        },
        1200: {
          spaceBetween: 32,
        },
      },
    });
    initHeroVideo(slider, heroSwiper);
  } catch (error) {
    slider.classList.add("hero__slider_static");
    initHeroVideo(slider);
  }
}
