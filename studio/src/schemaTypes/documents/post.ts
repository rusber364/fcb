import {defineField, defineType} from 'sanity'

/**
 * Новина — те, що показується на /news і на головній.
 * Learn more: https://www.sanity.io/docs/schema-types
 */

export default defineType({
  name: 'post',
  title: 'Новини',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Заголовок',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Адреса сторінки',
      type: 'slug',
      description: 'Частина посилання після /post/. Заповнюється автоматично із заголовка.',
      validation: (Rule) => Rule.required(),
      options: {
        source: 'title',
        maxLength: 96,
      },
    }),
    defineField({
      name: 'excerpt',
      title: 'Короткий опис',
      type: 'text',
      description: 'Показується в картці новини у списку та в соцмережах.',
      rows: 4,
    }),
    defineField({
      name: 'mainImage',
      title: 'Головне зображення',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Опис зображення',
          type: 'string',
          description: 'Читається екранними читалками і показується, якщо фото не завантажилось.',
          validation: (Rule) => Rule.required(),
        }),
      ],
    }),
    defineField({
      name: 'body',
      title: 'Текст новини',
      type: 'blockContent',
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'excerpt',
      media: 'mainImage',
    },
  },
})
