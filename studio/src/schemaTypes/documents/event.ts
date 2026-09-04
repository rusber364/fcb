import {defineField, defineType} from 'sanity'

/**
 * Подія — те, що показується в календарі на /calendar.
 */

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
      name: 'date',
      title: 'Дата',
      type: 'datetime',
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
      title: 'Час',
      type: 'string',
      description: 'Наприклад: 10:00',
    }),
    defineField({
      name: 'location',
      title: 'Місце',
      type: 'string',
    }),
    defineField({
      name: 'category',
      title: 'Категорія',
      type: 'string',
      description: 'Визначає колір позначки в календарі.',
      options: {
        list: [
          {title: 'Недільне служіння', value: 'sunday'},
          {title: 'Молодіжне служіння', value: 'youth'},
          {title: 'Інше', value: 'other'},
        ],
      },
    }),
    defineField({
      name: 'description',
      title: 'Опис',
      type: 'text',
      rows: 4,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'date',
    },
  },
})
