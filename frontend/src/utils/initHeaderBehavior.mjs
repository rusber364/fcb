(function () {
  const header = document.querySelector(".site-header");
  const burger = document.querySelector(".menu-toggle--burger");
  const nav = document.querySelector(".site-header__nav");
  const navLinks = document.querySelectorAll(".site-header__nav a");

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
    header.classList.toggle("is-scrolled", isScrolled);
  }

  function requestHeaderUpdate() {
    if (isTicking) {
      return;
    }

    isTicking = true;

    const requestFrame =
      window.requestAnimationFrame ||
      function (callback) {
        return window.setTimeout(callback, 16);
      };

    requestFrame(function () {
      updateHeader();
      isTicking = false;
    });
  }

  function closeMenu() {
    burger.classList.remove("toggled");
    nav.classList.remove("is-active");
    document.body.classList.remove("menu-open");
    burger.setAttribute("aria-label", "Відкрити меню");
    burger.setAttribute("aria-expanded", "false");
  }

  header.classList.toggle("is-scrolled", isScrolled);
  window.addEventListener("scroll", requestHeaderUpdate, { passive: true });

  burger.addEventListener("click", function () {
    const isOpen = burger.classList.toggle("toggled");

    nav.classList.toggle("is-active", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    burger.setAttribute("aria-label", isOpen ? "Закрити меню" : "Відкрити меню");
    burger.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 991) {
      closeMenu();
    }
  });
})();
