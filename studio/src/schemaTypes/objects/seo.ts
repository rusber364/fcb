import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'metaTitle',
      title: 'Заголовок для пошуку',
      type: 'string',
      description:
        'Замінює заголовок новини у результатах пошуку та у вкладці браузера. Рекомендовано 50–60 символів.',
      validation: (Rule) =>
        Rule.max(60).warning('Довші за 60 символів заголовки пошук може обрізати.'),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Опис для пошуку',
      type: 'text',
      rows: 3,
      description:
        'Замінює короткий опис у результатах пошуку та при поширенні в соцмережах. Рекомендовано 120–160 символів.',
      validation: (Rule) =>
        Rule.max(160).warning('Довші за 160 символів описи пошук може обрізати.'),
    }),
    defineField({
      name: 'ogImage',
      title: 'Зображення для соцмереж',
      type: 'image',
      description:
        'Замінює головне зображення при поширенні посилання. Рекомендований розмір: 1200×630 пікселів.',
      options: {
        hotspot: true,
      },
    }),
  ],
  options: {
    collapsible: true,
    collapsed: true,
  },
})
