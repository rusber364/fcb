import {defineField, defineType} from 'sanity'

/**
 * Подія — те, що показується в календарі на /calendar.
 * Значення category мають збігатися з CATEGORIES у frontend/src/utils/eventCalendar.mjs
 * (там же кольори категорій).
 */

const TIME_RE = /^([01]?\d|2[0-3])[:.][0-5]\d$/

const COLORS = [
  {title: 'Червоний', value: '#FF3B30'},
  {title: 'Помаранчевий', value: '#FF9500'},
  {title: 'Жовтий', value: '#FFCC00'},
  {title: 'Зелений', value: '#34C759'},
  {title: 'Бірюзовий', value: '#00C7BE'},
  {title: 'Блакитний', value: '#32ADE6'},
  {title: 'Синій', value: '#007AFF'},
  {title: 'Індиго', value: '#5856D6'},
  {title: 'Фіолетовий', value: '#AF52DE'},
  {title: 'Рожевий', value: '#FF2D55'},
  {title: 'Коричневий', value: '#A2845E'},
  {title: 'Сірий', value: '#8E8E93'},
]

export default defineType({
  name: 'event',
  title: 'Події',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Назва',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Адреса сторінки',
      type: 'slug',
      description: 'Заповнюється автоматично з назви.',
      validation: (Rule) => Rule.required(),
      options: {
        source: 'title',
        maxLength: 96,
      },
    }),
    defineField({
      name: 'category',
      title: 'Категорія',
      type: 'string',
      description: 'Визначає колір події в календарі.',
      initialValue: 'sunday',
      options: {
        list: [
          {title: 'Недільне служіння', value: 'sunday'},
          {title: 'Вечір хвали', value: 'worship'},
          {title: 'Молодіжне служіння', value: 'youth'},
          {title: 'Молитва', value: 'prayer'},
          {title: 'Вивчення Біблії', value: 'bible'},
          {title: 'Сімейне', value: 'family'},
          {title: 'Дитяче', value: 'kids'},
          {title: 'Хрещення', value: 'baptism'},
          {title: 'Зустріч', value: 'meeting'},
          {title: 'Свято', value: 'holiday'},
          {title: 'Інше', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'date',
      title: 'Дата',
      type: 'datetime',
      description: 'Для подій, що повторюються, — дата першого разу.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'endDate',
      title: 'Дата завершення',
      type: 'datetime',
      description: 'Тільки для подій, що тривають кілька днів. Необовʼязково.',
    }),
    defineField({
      name: 'time',
      title: 'Час початку',
      type: 'string',
      description: 'Наприклад: 10:00. Порожньо — подія на весь день.',
      validation: (Rule) =>
        Rule.custom((v) => !v || TIME_RE.test(v.trim()) || 'Формат ГГ:ХХ, наприклад 18:30'),
    }),
    defineField({
      name: 'endTime',
      title: 'Час завершення',
      type: 'string',
      description: 'Наприклад: 12:00. Необовʼязково.',
      validation: (Rule) =>
        Rule.custom((v) => !v || TIME_RE.test(v.trim()) || 'Формат ГГ:ХХ, наприклад 20:00'),
    }),
    defineField({
      name: 'repeat',
      title: 'Повторювати',
      type: 'string',
      initialValue: 'none',
      options: {
        list: [
          {title: 'Не повторюється', value: 'none'},
          {title: 'Щотижня', value: 'weekly'},
          {title: 'Раз на 2 тижні', value: 'biweekly'},
          {title: 'Щомісяця', value: 'monthly'},
          {title: 'Щороку', value: 'yearly'},
        ],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'repeatUntil',
      title: 'Повторювати до',
      type: 'date',
      description: 'Порожньо — без кінця.',
      hidden: ({document}) => !document?.repeat || document.repeat === 'none',
    }),
    defineField({
      name: 'location',
      title: 'Місце',
      type: 'string',
    }),
    defineField({
      name: 'description',
      title: 'Опис',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'color',
      title: 'Свій колір',
      type: 'string',
      description: 'Необовʼязково. Порожньо — колір категорії.',
      options: {list: COLORS},
    }),
    defineField({
      name: 'highlightDay',
      title: 'Підсвітити день',
      type: 'boolean',
      description: 'Фон дня в календарі стане кольором події — для свят і особливих подій.',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      date: 'date',
      time: 'time',
      repeat: 'repeat',
    },
    prepare({title, date, time, repeat}) {
      const d = date ? new Date(date).toLocaleDateString('uk-UA', {timeZone: 'Europe/Kyiv'}) : ''
      const rep = repeat && repeat !== 'none' ? ' · повторюється' : ''
      return {title, subtitle: [d, time].filter(Boolean).join(', ') + rep}
    },
  },
})
