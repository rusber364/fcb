import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'preacher',
  title: 'Проповідник',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: "Ім'я",
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Порядок сортування',
      type: 'number',
      description: 'Чим менше число, тим вище в таблиці',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'sortOrder',
    },
    prepare({title, subtitle}) {
      return {
        title,
        subtitle: subtitle ? `Порядок: ${subtitle}` : '',
      }
    },
  },
})
