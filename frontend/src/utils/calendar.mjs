const MONTHS_UK = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

const DAYS_UK_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

const CATEGORY_COLORS = {
  sunday: "#ff3432",
  youth: "#22c8ad",
  prayer: "#7b4dff",
  family: "#ff6501",
  bible: "#22c878",
  baptism: "#14a7c9",
  other: "#6f777b",
};

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getMonthCells(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrevMonth - startOffset + i + 1, monthOffset: -1 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, monthOffset: 0 });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const nextDays = 7 - remainder;
    for (let d = 1; d <= nextDays; d++) {
      cells.push({ day: d, monthOffset: 1 });
    }
  }
  return cells;
}

function groupEventsByDate(events) {
  const map = {};
  for (const ev of events) {
    const key = formatDateKey(parseDate(ev.date));
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  }
  return map;
}

export function initCalendar(containerEl, titleEl, monthSelect, yearSelect, events) {
  const daysContainer = containerEl.querySelector(".calendar-grid__days");
  const weekdaysRow = containerEl.querySelector(".calendar-grid__weekdays");
  let currentYear, currentMonth;
  let tooltipEl = null;

  function initWeekdays() {
    const frag = document.createDocumentFragment();
    for (const d of DAYS_UK_SHORT) {
      const span = document.createElement("span");
      span.className = "calendar-grid__weekday";
      span.textContent = d;
      frag.appendChild(span);
    }
    weekdaysRow.appendChild(frag);
  }

  function render(year, month) {
    currentYear = year;
    currentMonth = month;

    titleEl.textContent = `${MONTHS_UK[month]} ${year}`;
    monthSelect.value = month;
    yearSelect.value = year;

    const cells = getMonthCells(year, month);
    const eventsByDate = groupEventsByDate(events);

    daysContainer.innerHTML = "";

    for (const cellDate of cells) {
      const cell = document.createElement("div");
      cell.className = "calendar-grid__cell";
      if (cellDate.monthOffset !== 0) {
        cell.classList.add("calendar-grid__cell--outside");
      }

      const dateObj = new Date(year, month + cellDate.monthOffset, cellDate.day);
      const dateKey = formatDateKey(dateObj);
      const dayEvents = eventsByDate[dateKey] || [];

      const num = document.createElement("span");
      num.className = "calendar-grid__day-num";
      num.textContent = cellDate.day;
      cell.appendChild(num);

      if (dayEvents.length > 0) {
        cell.classList.add("calendar-grid__cell--has-events");
        const today = new Date();
        const todayKey = formatDateKey(today);
        if (dateKey < todayKey) {
          cell.classList.add("calendar-grid__cell--past");
        }

        const chipContainer = document.createElement("div");
        chipContainer.className = "calendar-grid__chips";

        const maxChips = 3;
        const visibleEvents = dayEvents.slice(0, maxChips);
        const overflow = dayEvents.length - maxChips;

        for (const ev of visibleEvents) {
          const chip = document.createElement("span");
          chip.className = "calendar-grid__chip";
          chip.dataset.eventId = ev._id || "";
          const color = getCategoryColor(ev.category);
          chip.style.setProperty("--event-color", color);
          chip.style.setProperty("--event-bg", hexToRgba(color, 0.14));
          const dot = document.createElement("span");
          dot.className = "calendar-grid__chip-dot";
          dot.style.background = color;
          chip.appendChild(dot);
          const label = document.createElement("span");
          label.className = "calendar-grid__chip-label";
          label.textContent = ev.title;
          chip.appendChild(label);
          chipContainer.appendChild(chip);
        }

        if (overflow > 0) {
          const more = document.createElement("span");
          more.className = "calendar-grid__chip calendar-grid__chip--more";
          more.textContent = `+${overflow}`;
          chipContainer.appendChild(more);
        }

        cell.appendChild(chipContainer);

        cell.addEventListener("mouseenter", () => {
          showTooltip(cell, dayEvents, dateKey);
        });
        cell.addEventListener("mouseleave", () => {
          scheduleHideTooltip();
        });
      }

      daysContainer.appendChild(cell);
    }
  }

  let hideTimeout = null;
  let isTooltipHovered = false;

  function scheduleHideTooltip() {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!isTooltipHovered) {
        hideTooltip();
      }
    }, 200);
  }

  function showTooltip(cell, dayEvents, dateKey) {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTooltip();

    tooltipEl = document.createElement("div");
    tooltipEl.className = "calendar-tooltip";
    tooltipEl.dataset.date = dateKey;

    tooltipEl.addEventListener("mouseenter", () => {
      isTooltipHovered = true;
      if (hideTimeout) clearTimeout(hideTimeout);
    });
    tooltipEl.addEventListener("mouseleave", () => {
      isTooltipHovered = false;
      scheduleHideTooltip();
    });

    const header = document.createElement("div");
    header.className = "calendar-tooltip__header";
    const title = document.createElement("span");
    title.textContent = dayEvents.length === 1 ? "1 подія" : `${dayEvents.length} події`;
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "calendar-tooltip__close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Закрити");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideTooltip();
    });
    header.appendChild(closeBtn);
    tooltipEl.appendChild(header);

    const list = document.createElement("div");
    list.className = "calendar-tooltip__list";
    for (const ev of dayEvents) {
      const item = document.createElement("div");
      item.className = "calendar-tooltip__event";
      item.style.borderLeftColor = getCategoryColor(ev.category);
      const catDot = document.createElement("span");
      catDot.className = "calendar-tooltip__event-color";
      catDot.style.background = getCategoryColor(ev.category);
      item.appendChild(catDot);
      const info = document.createElement("div");
      info.className = "calendar-tooltip__event-info";
      const evTitle = document.createElement("div");
      evTitle.className = "calendar-tooltip__event-title";
      evTitle.textContent = ev.title;
      info.appendChild(evTitle);
      if (ev.time || ev.location) {
        const meta = document.createElement("div");
        meta.className = "calendar-tooltip__event-meta";
        const parts = [];
        if (ev.time) parts.push(ev.time);
        if (ev.location) parts.push(ev.location);
        meta.textContent = parts.join(" · ");
        info.appendChild(meta);
      }
      if (ev.description) {
        const desc = document.createElement("p");
        desc.className = "calendar-tooltip__event-description";
        desc.textContent = ev.description;
        info.appendChild(desc);
      }
      item.appendChild(info);
      list.appendChild(item);
    }
    tooltipEl.appendChild(list);

    document.body.appendChild(tooltipEl);

    const rect = cell.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX + rect.width / 2 - tooltipRect.width / 2;

    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.scrollY + window.innerHeight) {
      top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    tooltipEl.style.top = top + "px";
    tooltipEl.style.left = left + "px";
    tooltipEl.classList.add("calendar-tooltip--visible");
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.remove("calendar-tooltip--visible");
      tooltipEl.remove();
      tooltipEl = null;
    }
    isTooltipHovered = false;
  }

  function navigate(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    } else if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    render(currentYear, currentMonth);
  }

  let navButtons = document.querySelectorAll("[data-calendar-nav]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate(parseInt(btn.dataset.calendarNav, 10));
    });
  });

  monthSelect.addEventListener("change", () => {
    render(currentYear, parseInt(monthSelect.value, 10));
  });

  yearSelect.addEventListener("change", () => {
    render(parseInt(yearSelect.value, 10), currentMonth);
  });

  document.addEventListener("click", (e) => {
    if (tooltipEl && !tooltipEl.contains(e.target) && !e.target.closest(".calendar-grid__cell--has-events")) {
      hideTooltip();
    }
  });

  const today = new Date();
  initWeekdays();
  render(today.getFullYear(), today.getMonth());
}
