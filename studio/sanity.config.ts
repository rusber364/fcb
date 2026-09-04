import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {codeInput} from '@sanity/code-input'
import {defineDocuments, defineLocations, presentationTool} from 'sanity/presentation'
import {schemaTypes} from './src/schemaTypes'

// Environment variables for project configuration
const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'your-projectID'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

// Presentation Preview URL
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL || 'http://localhost:4321'

export default defineConfig({
  name: 'fcb-studio',
  title: 'First Cherkasy Baptist',
  projectId,
  dataset,
  plugins: [
    structureTool({
      // Карусель — один-єдиний документ із фіксованим id, тому вона відкривається
      // напряму зі списку, а не як тип, у якому можна наплодити копій.
      structure: (S) =>
        S.list()
          .title('Контент')
          .items([
            S.listItem()
              .title('Карусель на головній')
              .id('heroCarousel')
              .child(S.document().schemaType('heroCarousel').documentId('heroCarousel')),
            S.divider(),
            ...S.documentTypeListItems().filter((item) => item.getId() !== 'heroCarousel'),
          ]),
    }),
    presentationTool({
      previewUrl,
      resolve: {
        // Maps a URL in the preview to the corresponding Sanity document,
        // so opening /post/my-slug in Presentation opens that post in the sidebar.
        mainDocuments: defineDocuments([
          {
            route: '/post/:slug',
            filter: ({params}) => `_type == "post" && slug.current == "${params.slug}"`,
          },
        ]),
        // Maps a post document to its preview URL,
        // so editors can jump straight to the preview from any post in the Studio.
        locations: {
          post: defineLocations({
            select: {title: 'title', slug: 'slug.current'},
            resolve: (doc) => ({
              locations: doc?.slug
                ? [{title: doc?.title || 'Untitled', href: `/post/${doc.slug}`}]
                : [],
            }),
          }),
          // Карусель живе тільки на головній, тож адреса фіксована й
          // від вмісту документа не залежить.
          heroCarousel: defineLocations({
            locations: [{title: 'Головна', href: '/'}],
          }),
        },
      },
    }),
    visionTool(),
    codeInput(),
  ],
  schema: {types: schemaTypes},
})
