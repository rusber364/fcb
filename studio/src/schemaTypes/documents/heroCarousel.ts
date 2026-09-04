import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'heroCarousel',
  title: 'Карусель на головній',
  type: 'document',
  fields: [
    defineField({
      name: 'slides',
      title: 'Слайди',
      type: 'array',
      description: 'Порядок слайдів міняється перетягуванням.',
      of: [
        defineArrayMember({
          name: 'imageSlide',
          title: 'Фото',
          type: 'object',
          fields: [
            defineField({
              name: 'image',
              title: 'Зображення',
              type: 'image',
              description: 'Слайд показується у форматі 1200x698, тому важлива частина кадру має бути в центрі. Точку фокуса можна задати кнопкою «Hotspot».',
              options: {hotspot: true},
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'alt',
              title: 'Опис зображення',
              type: 'string',
              description: 'Читається екранними читалками і показується, якщо фото не завантажилось.',
            }),
          ],
          preview: {
            select: {media: 'image', subtitle: 'alt'},
            prepare({media, subtitle}) {
              return {title: 'Фото', subtitle: subtitle || 'без опису', media}
            },
          },
        }),
        defineArrayMember({
          name: 'videoSlide',
          title: 'Відео',
          type: 'object',
          fields: [
            defineField({
              name: 'video',
              title: 'Відеофайл',
              type: 'file',
              description: 'Тільки MP4 (H.264) або WebM. Файли .MOV з айфона браузери відтворюють ненадійно — їх треба спершу перегнати в MP4.',
              options: {accept: 'video/mp4,video/webm'},
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'poster',
              title: 'Перший кадр',
              type: 'image',
              description: 'Необовʼязково. Показується, доки відео не завантажилось. Якщо не додати, браузер намалює перший кадр сам, але для цього йому доведеться підвантажити початок файлу — слайд трохи довше побуде порожнім, особливо на мобільному інтернеті.',
              options: {hotspot: true},
            }),
            defineField({
              name: 'alt',
              title: 'Опис відео',
              type: 'string',
            }),
          ],
          preview: {
            select: {media: 'poster', subtitle: 'alt'},
            prepare({media, subtitle}) {
              return {title: 'Відео', subtitle: subtitle || 'без опису', media}
            },
          },
        }),
      ],
      validation: (Rule) => Rule.min(1).error('Потрібен хоча б один слайд.'),
    }),
  ],
  preview: {
    select: {slides: 'slides'},
    prepare({slides}) {
      const count = Array.isArray(slides) ? slides.length : 0
      return {title: 'Карусель на головній', subtitle: `${count} слайдів`}
    },
  },
})
