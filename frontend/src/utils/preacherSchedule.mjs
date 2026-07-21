import { sanityClient } from 'sanity:client'

const DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const PREACHING_DAYS = [0, 3, 5, 6]

function getMonthDays(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function isPreachingDay(year, month, day) {
  return PREACHING_DAYS.includes(new Date(year, month, day).getDay())
}

function formatDateKey(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function getScheduleKey(year, month, day, preacherId) {
  return `${formatDateKey(year, month, day)}_${preacherId}`
}

async function loadSchedule(month, year) {
  const data = await sanityClient.fetch(
    `*[_type == "monthlySchedule" && month == $month && year == $year][0]{
      _id,
      assignments[] {
        _key,
        day,
        slot,
        preacher->{_id, name}
      }
    }`,
    { month: month + 1, year },
  )
  return data || null
}

function buildScheduleMap(schedule, year, month) {
  const map = {}
  if (!schedule || !schedule.assignments) return map
  for (const a of schedule.assignments) {
    map[getScheduleKey(year, month, a.day, a.preacher._id)] = a.slot
  }
  return map
}

export function initPreacherSchedule(wrap, titleEl, monthSelect, yearSelect) {
  const ms = monthSelect
  const ys = yearSelect
  const table = wrap.querySelector('.preachers-table')
  const thead = table.querySelector('thead')
  const tbody = table.querySelector('tbody')
  const preachers = JSON.parse(wrap.dataset.preachers || '[]')

  let currentYear
  let currentMonth

  function render(year, month) {
    currentYear = year
    currentMonth = month

    titleEl.textContent = `${MONTHS_UK[month]} ${year}`
    ms.value = String(month)
    ys.value = String(year)

    const daysInMonth = getMonthDays(year, month)
    const days = []
    for (let d = 1; d <= daysInMonth; d++) {
      if (isPreachingDay(year, month, d)) {
        days.push(d)
      }
    }

    wrap.style.minHeight = `${wrap.offsetHeight}px`
    thead.innerHTML = ''
    tbody.innerHTML = ''
    table.style.opacity = '0'

    const headRow = document.createElement('tr')
    const nameTh = document.createElement('th')
    nameTh.textContent = 'Проповідник'
    headRow.appendChild(nameTh)

    for (let ci = 0; ci < days.length; ci++) {
      const d = days[ci]
      const th = document.createElement('th')
      th.dataset.colIndex = String(ci + 1)
      const dayName = DAY_NAMES[new Date(year, month, d).getDay()]
      th.innerHTML = `${d}<br><span class="th--day-name">${dayName}</span>`
      if (new Date(year, month, d).getDay() === 0) {
        th.classList.add('th--sunday')
      }
      headRow.appendChild(th)
    }
    thead.appendChild(headRow)

    loadSchedule(month, year).then((schedule) => {
      const scheduleMap = buildScheduleMap(schedule, year, month)

      for (const preacher of preachers) {
        const tr = document.createElement('tr')

        const nameTd = document.createElement('td')
        nameTd.textContent = preacher.name
        tr.appendChild(nameTd)

        for (let ci = 0; ci < days.length; ci++) {
          const d = days[ci]
          const td = document.createElement('td')
          td.dataset.colIndex = String(ci + 1)
          if (new Date(year, month, d).getDay() === 0) {
            td.classList.add('td--sunday')
          }
          const key = getScheduleKey(year, month, d, preacher._id)
          const slot = scheduleMap[key]
          if (slot) {
            const badge = document.createElement('span')
            badge.className = slot === 1 ? 'preachers-cell--slot1' : 'preachers-cell--slot2'
            badge.textContent = String(slot)
            td.appendChild(badge)
          }
          tr.appendChild(td)
        }

        tbody.appendChild(tr)
      }
      table.style.opacity = '1'
      wrap.style.minHeight = ''
      initHover()
    })
  }

  function initHover() {
    const cells = tbody.querySelectorAll('td')
    const headers = thead.querySelectorAll('th')

    function toggleCol(index, add) {
      const action = add ? 'add' : 'remove'
      for (const h of headers) {
        if (h.dataset.colIndex === index) h.classList[action]('col--hover')
      }
      for (const c of cells) {
        if (c.dataset.colIndex === index) c.classList[action]('col--hover')
      }
    }

    for (const cell of cells) {
      cell.addEventListener('mouseenter', () => {
        const tr = cell.closest('tr')
        tr.classList.add('row--hover')
        const prev = tr.querySelector('td:first-child')
        if (prev) prev.classList.add('row--hover')
        if (cell.dataset.colIndex) toggleCol(cell.dataset.colIndex, true)
      })
      cell.addEventListener('mouseleave', () => {
        const tr = cell.closest('tr')
        tr.classList.remove('row--hover')
        const prev = tr.querySelector('td:first-child')
        if (prev) prev.classList.remove('row--hover')
        if (cell.dataset.colIndex) toggleCol(cell.dataset.colIndex, false)
      })
    }
  }

  function navigate(delta) {
    currentMonth += delta
    if (currentMonth > 11) {
      currentMonth = 0
      currentYear++
    } else if (currentMonth < 0) {
      currentMonth = 11
      currentYear--
    }
    render(currentYear, currentMonth)
  }

  document.querySelectorAll('[data-preachers-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate(parseInt(btn.dataset.preachersNav, 10))
    })
  })

  ms.addEventListener('change', () => {
    render(currentYear, parseInt(ms.value, 10))
  })

  ys.addEventListener('change', () => {
    render(parseInt(ys.value, 10), currentMonth)
  })

  const today = new Date()
  render(today.getFullYear(), today.getMonth())
}

const MONTHS_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]
