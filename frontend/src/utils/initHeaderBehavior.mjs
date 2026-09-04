(function () {
  const header = document.querySelector(".site-header");
  const burger = document.querySelector(".menu-toggle--burger");
  const nav = document.querySelector(".site-header__nav");
  const navLinks = document.querySelectorAll(".site-header__nav a");
  const navGroups = document.querySelectorAll("[data-nav-group]");
  const mobileQuery = window.matchMedia("(max-width: 991px)");

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

  function closeGroups() {
    navGroups.forEach(function (group) {
      group.classList.remove("is-open");

      const toggle = group.querySelector(".site-header__group-btn");

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function closeMenu() {
    burger.classList.remove("toggled");
    nav.classList.remove("is-active");
    document.body.classList.remove("menu-open");
    burger.setAttribute("aria-label", "Відкрити меню");
    burger.setAttribute("aria-expanded", "false");
    closeGroups();
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

  navGroups.forEach(function (group) {
    const toggle = group.querySelector(".site-header__group-btn");

    if (!toggle) {
      return;
    }

    // Below 992px the submenu is an accordion driven by this class; above it,
    // CSS :hover / :focus-within opens the panel and we only mirror the state
    // into aria-expanded.
    toggle.addEventListener("click", function () {
      if (!mobileQuery.matches) {
        return;
      }

      const shouldOpen = !group.classList.contains("is-open");

      closeGroups();
      group.classList.toggle("is-open", shouldOpen);
      toggle.setAttribute("aria-expanded", String(shouldOpen));
    });

    function syncExpanded(state) {
      if (!mobileQuery.matches) {
        toggle.setAttribute("aria-expanded", String(state));
      }
    }

    group.addEventListener("mouseenter", function () {
      syncExpanded(true);
    });

    group.addEventListener("mouseleave", function () {
      syncExpanded(false);
    });

    group.addEventListener("focusin", function () {
      syncExpanded(true);
    });

    group.addEventListener("focusout", function (event) {
      if (!group.contains(event.relatedTarget)) {
        syncExpanded(false);
      }
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    if (nav.classList.contains("is-active")) {
      closeMenu();
      burger.focus();
      return;
    }

    closeGroups();

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 991) {
      closeMenu();
    }
  });
})();
