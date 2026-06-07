export function createPanoramaEffect() {
  return function EffectPanorama({ swiper, extendParams, on }) {
    extendParams({
      panoramaEffect: {
        depth: 0,
        rotate: 20,
        stretch: 1.18,
      },
    });

    on("beforeInit", function () {
      if (swiper.params.effect !== "panorama") {
        return;
      }

      swiper.classNames.push(`${swiper.params.containerModifierClass}panorama`);
      swiper.classNames.push(`${swiper.params.containerModifierClass}3d`);

      Object.assign(swiper.params, {
        watchSlidesProgress: true,
      });
      Object.assign(swiper.originalParams, {
        watchSlidesProgress: true,
      });
    });

    on("progress", function () {
      if (swiper.params.effect !== "panorama") {
        return;
      }

      const { depth, rotate, stretch } = swiper.params.panoramaEffect;
      const halfAngle = (rotate * Math.PI) / 360;
      const angleModifier = 1 / (180 / rotate);
      const realSlidesCount =
        new Set(
          [...swiper.slides].map(function (slideEl) {
            return slideEl.getAttribute("data-swiper-slide-index");
          }),
        ).size || swiper.slides.length;

      swiper.slides.forEach(function (slideEl, index) {
        let slideProgress = slideEl.progress;
        const slideSize = swiper.slidesSizesGrid[index];
        const progressModifier = swiper.params.centeredSlides
          ? 0
          : (swiper.params.slidesPerView - 1) * 0.5;

        if (swiper.params.loop && realSlidesCount > 0) {
          const halfSlidesCount = realSlidesCount / 2;

          slideProgress =
            ((((slideProgress + halfSlidesCount) % realSlidesCount) +
              realSlidesCount) %
              realSlidesCount) -
            halfSlidesCount;
        }

        const progress = slideProgress + progressModifier;
        const angleCos = 1 - Math.cos(progress * angleModifier * Math.PI);
        const translateX = progress * ((stretch * slideSize) / 3) * angleCos;
        const rotateY = progress * rotate;
        const radius = (slideSize * 0.5) / Math.sin(halfAngle);
        const translateZ = radius * angleCos - depth;

        slideEl.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`;
      });
    });

    on("setTransition", function (swiperInstance, duration) {
      if (swiperInstance.params.effect !== "panorama") {
        return;
      }

      swiperInstance.slides.forEach(function (slideEl) {
        slideEl.style.transitionDuration = `${duration}ms`;
      });
    });
  };
}
