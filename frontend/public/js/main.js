(function() {
	const header = document.querySelector('.site-header');
	const burger = document.querySelector('.menu-toggle--burger');
	const nav = document.querySelector('.site-header__nav');
	const navLinks = document.querySelectorAll('.site-header__nav a');

	if (!header || !burger || !nav) {
		return;
	}

	let isScrolled = window.scrollY > 96;
	let isTicking = false;

	function updateHeader() {
		const scrollTop = window.scrollY;
		const shouldBeScrolled = isScrolled ? scrollTop > 40 : scrollTop > 96;

		if (shouldBeScrolled === isScrolled) {
			return;
		}

		isScrolled = shouldBeScrolled;
		header.classList.toggle('is-scrolled', isScrolled);
	}

	function requestHeaderUpdate() {
		if (isTicking) {
			return;
		}

		isTicking = true;

		const requestFrame = window.requestAnimationFrame || function(callback) {
			return window.setTimeout(callback, 16);
		};

		requestFrame(function() {
			updateHeader();
			isTicking = false;
		});
	}

	function closeMenu() {
		burger.classList.remove('toggled');
		nav.classList.remove('is-active');
		document.body.classList.remove('menu-open');
		burger.setAttribute('aria-label', 'Відкрити меню');
		burger.setAttribute('aria-expanded', 'false');
	}

	header.classList.toggle('is-scrolled', isScrolled);
	window.addEventListener('scroll', requestHeaderUpdate, { passive: true });

	burger.addEventListener('click', function() {
		const isOpen = burger.classList.toggle('toggled');

		nav.classList.toggle('is-active', isOpen);
		document.body.classList.toggle('menu-open', isOpen);
		burger.setAttribute('aria-label', isOpen ? 'Закрити меню' : 'Відкрити меню');
		burger.setAttribute('aria-expanded', String(isOpen));
	});

	navLinks.forEach(function(link) {
		link.addEventListener('click', closeMenu);
	});

	window.addEventListener('resize', function() {
		if (window.innerWidth > 991) {
			closeMenu();
		}
	});
})();

function createPanoramaEffect() {
	return function EffectPanorama({ swiper, extendParams, on }) {
		extendParams({
			panoramaEffect: {
				depth: 0,
				rotate: 20,
				stretch: 1.18
			}
		});

		on('beforeInit', function() {
			if (swiper.params.effect !== 'panorama') {
				return;
			}

			swiper.classNames.push(`${swiper.params.containerModifierClass}panorama`);
			swiper.classNames.push(`${swiper.params.containerModifierClass}3d`);

			Object.assign(swiper.params, {
				watchSlidesProgress: true
			});
			Object.assign(swiper.originalParams, {
				watchSlidesProgress: true
			});
		});

		on('progress', function() {
			if (swiper.params.effect !== 'panorama') {
				return;
			}

			const { depth, rotate, stretch } = swiper.params.panoramaEffect;
			const halfAngle = (rotate * Math.PI) / 360;
			const angleModifier = 1 / (180 / rotate);
			const realSlidesCount = new Set(
				[...swiper.slides].map(function(slideEl) {
					return slideEl.getAttribute('data-swiper-slide-index');
				})
			).size || swiper.slides.length;

			swiper.slides.forEach(function(slideEl, index) {
				let slideProgress = slideEl.progress;
				const slideSize = swiper.slidesSizesGrid[index];
				const progressModifier = swiper.params.centeredSlides ? 0 : (swiper.params.slidesPerView - 1) * .5;

				if (swiper.params.loop && realSlidesCount > 0) {
					const halfSlidesCount = realSlidesCount / 2;

					slideProgress = ((slideProgress + halfSlidesCount) % realSlidesCount + realSlidesCount) % realSlidesCount - halfSlidesCount;
				}

				const progress = slideProgress + progressModifier;
				const angleCos = 1 - Math.cos(progress * angleModifier * Math.PI);
				const translateX = progress * ((stretch * slideSize) / 3) * angleCos;
				const rotateY = progress * rotate;
				const radius = (slideSize * .5) / Math.sin(halfAngle);
				const translateZ = radius * angleCos - depth;

				slideEl.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`;
			});
		});

		on('setTransition', function(swiperInstance, duration) {
			if (swiperInstance.params.effect !== 'panorama') {
				return;
			}

			swiperInstance.slides.forEach(function(slideEl) {
				slideEl.style.transitionDuration = `${duration}ms`;
			});
		});
	};
}

async function loadModule(specifier, fallbackUrl) {
	try {
		return await import(specifier);
	} catch (error) {
		return import(fallbackUrl);
	}
}

async function initIcons() {
	try {
		const { createIcons, icons } = await loadModule('lucide', 'https://esm.sh/lucide@0.468.0');

		createIcons({ icons });
	} catch (error) {
		document.documentElement.classList.add('icons-fallback');
	}
}


function syncHeroVideos(slider) {
	const videos = slider.querySelectorAll('[data-hero-video]');

	videos.forEach(function(video) {
		if (video.closest('.swiper-slide-active')) {
			const playPromise = video.play();

			if (playPromise && typeof playPromise.catch === 'function') {
				playPromise.catch(function() {});
			}
		} else {
			video.pause();
		}
	});
}

function initHeroVideo(slider, swiper) {
	const getVideos = function() {
		return slider.querySelectorAll('[data-hero-video]');
	};

	if (!getVideos().length) {
		return;
	}

	const loadVideo = function(video, preloadMode) {
		const src = video.dataset.src || video.getAttribute('src');

		if (!src) {
			return;
		}

		if (video.getAttribute('src') !== src) {
			video.setAttribute('src', src);
		}

		if (preloadMode && video.preload !== preloadMode) {
			video.preload = preloadMode;
		}

		if (video.dataset.loaded === 'true') {
			return;
		}

		video.dataset.loaded = 'true';
		video.load();
		video.addEventListener('loadedmetadata', function() {
			if (!video.closest('.swiper-slide-active') && video.currentTime === 0) {
				try {
					video.currentTime = 0.05;
				} catch (error) {}
			}
		}, { once: true });
		video.addEventListener('canplay', function() {
			syncHeroVideos(slider);
		}, { once: true });
	};

	const loadAllVideos = function(preloadMode) {
		getVideos().forEach(function(video) {
			loadVideo(video, preloadMode);
		});
	};

	loadAllVideos('metadata');

	const scheduleFullPreload = function() {
		const run = function() {
			loadAllVideos('auto');
			syncHeroVideos(slider);
		};

		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(run, { timeout: 1500 });
		} else {
			window.setTimeout(run, 800);
		}
	};

	if (document.readyState === 'complete') {
		scheduleFullPreload();
	} else {
		window.addEventListener('load', scheduleFullPreload, { once: true });
	}

	if (swiper && typeof swiper.on === 'function') {
		['init', 'loopFix', 'slidesLengthChange', 'slideChangeTransitionEnd'].forEach(function(eventName) {
			swiper.on(eventName, function() {
				loadAllVideos('metadata');
				syncHeroVideos(slider);
			});
		});
	}

	document.addEventListener('visibilitychange', function() {
		if (document.hidden) {
			getVideos().forEach(function(video) {
				video.pause();
			});
		} else {
			syncHeroVideos(slider);
		}
	});
}
async function initHeroSlider() {
	const slider = document.querySelector('.hero__slider');

	if (!slider) {
		return;
	}

	try {
		const [{ default: Swiper }, { Navigation, Pagination }] = await Promise.all([
			loadModule('swiper', 'https://esm.sh/swiper@11'),
			loadModule('swiper/modules', 'https://esm.sh/swiper@11/modules')
		]);
		const EffectPanorama = createPanoramaEffect();

		const heroSwiper = new Swiper(slider, {
			modules: [Navigation, Pagination, EffectPanorama],
			effect: 'panorama',
			loop: true,
			loopAddBlankSlides: false,
			loopPreventsSliding: false,
			initialSlide: 0,
			centeredSlides: true,
			slidesPerView: 'auto',
			slidesPerGroup: 1,
			spaceBetween: 32,
			speed: 560,
			navigation: {
				prevEl: '.hero__arrow_prev',
				nextEl: '.hero__arrow_next'
			},
			pagination: {
				el: '.hero__pagination',
				clickable: true,
				bulletClass: 'hero__dot',
				bulletActiveClass: 'hero__dot_active'
			},
			breakpoints: {
				0: {
					spaceBetween: 10
				},
				768: {
					spaceBetween: 10
				},
				1200: {
					spaceBetween: 32
				}
			}
		});
		initHeroVideo(slider, heroSwiper);
	} catch (error) {
		slider.classList.add('hero__slider_static');
		initHeroVideo(slider);
	}
}



async function initMobileContentSliders() {
	const featuresSlider = document.querySelector('.features__slider');
	const newsSlider = document.querySelector('.news__slider');

	if (!featuresSlider && !newsSlider) {
		return;
	}

	try {
		const [{ default: Swiper }, { Navigation }] = await Promise.all([
			loadModule('swiper', 'https://esm.sh/swiper@11'),
			loadModule('swiper/modules', 'https://esm.sh/swiper@11/modules')
		]);
		const mediaQuery = window.matchMedia('(max-width: 991px)');
		const tabletQuery = window.matchMedia('(min-width: 768px)');
		let featuresSwiper;
		let newsSwiper;
		let resizeTimer;

		const getSlidesPerView = function() {
			return tabletQuery.matches ? 2 : 1;
		};

		const createSlider = function(element, prevEl, nextEl) {
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
					nextEl
				}
			});
		};

		const refreshSlider = function(swiperInstance) {
			if (!swiperInstance || swiperInstance.destroyed) {
				return;
			}

			swiperInstance.params.slidesPerView = getSlidesPerView();
			swiperInstance.update();
		};

		const refreshActiveSliders = function() {
			refreshSlider(featuresSwiper);
			refreshSlider(newsSwiper);
		};

		const scheduleRefresh = function() {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function() {
				if (mediaQuery.matches) {
					refreshActiveSliders();
				}
			}, 140);
		};

		const updateSliders = function() {
			if (mediaQuery.matches) {
				if (featuresSlider && !featuresSwiper) {
					featuresSwiper = createSlider(featuresSlider, '.features__arrow_prev', '.features__arrow_next');
				}

				if (newsSlider && !newsSwiper) {
					newsSwiper = createSlider(newsSlider, '.news__arrow_prev', '.news__arrow_next');
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

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', updateSliders);
			tabletQuery.addEventListener('change', updateSliders);
		} else if (typeof mediaQuery.addListener === 'function') {
			mediaQuery.addListener(updateSliders);
			tabletQuery.addListener(updateSliders);
		}

		window.addEventListener('resize', scheduleRefresh, { passive: true });
	} catch (error) {
		document.documentElement.classList.add('content-sliders-fallback');
	}
}
initIcons();
initHeroSlider();
initMobileContentSliders();

















