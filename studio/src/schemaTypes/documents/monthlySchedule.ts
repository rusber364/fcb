import {defineField, defineType} from 'sanity'

const MONTHS_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]

export default defineType({
  name: 'monthlySchedule',
  title: 'Графік проповідей на місяць',
  type: 'document',
  fields: [
    defineField({
      name: 'month',
      title: 'Місяць',
      type: 'number',
      validation: (Rule) => Rule.required().min(1).max(12),
      options: {
        list: MONTHS_UK.map((name, i) => ({title: name, value: i + 1})),
      },
    }),
    defineField({
      name: 'year',
      title: 'Рік',
      type: 'number',
      validation: (Rule) => Rule.required().min(2020).max(2100),
    }),
    defineField({
      name: 'assignments',
      title: 'Призначення',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'preacher',
              title: 'Проповідник',
              type: 'reference',
              to: [{type: 'preacher'}],
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'day',
              title: 'День',
              type: 'number',
              validation: (Rule) => Rule.required().min(1).max(31),
            }),
            defineField({
              name: 'slot',
              title: 'Черга проповіді',
              type: 'number',
              validation: (Rule) => Rule.required(),
              options: {
                list: [
                  {title: '1-ша', value: 1},
                  {title: '2-га', value: 2},
                ],
                layout: 'radio',
              },
            }),
          ],
          preview: {
            select: {
              preacherName: 'preacher.name',
              day: 'day',
              slot: 'slot',
            },
            prepare({preacherName, day, slot}) {
              return {
                title: preacherName || 'Невідомий',
                subtitle: `День ${day}, ${slot || '?'}-ша служба`,
              }
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: {
      month: 'month',
      year: 'year',
    },
    prepare({month, year}) {
      return {
        title: month ? `${MONTHS_UK[month - 1]} ${year}` : 'Без дати',
      }
    },
  },
})
