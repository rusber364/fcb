import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { sanityClient } from "sanity:client";

const builder = createImageUrlBuilder(sanityClient);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}

/**
 * Generates a responsive srcset string using Sanity's image CDN.
 * Widths should be in ascending order.
 */
export function buildSrcSet(
  source: SanityImageSource,
  widths: number[],
  quality = 80,
): string {
  return widths
    .map(
      (w) =>
        `${builder.image(source).width(w).auto("format").quality(quality).url()} ${w}w`,
    )
    .join(", ");
}

/**
 * Inline style for news cards, whose art is a CSS background-image
 * (the hover zoom animates background-size, so an <img> won't do).
 * Falls back to a flat tint when the post has no image.
 */
export function cardBackground(
  source: SanityImageSource | undefined,
  width = 660,
  height = 358,
): string {
  if (!source) return "background-color: #e9efef;";

  const url = builder
    .image(source)
    .width(width)
    .height(height)
    .fit("crop")
    .auto("format")
    .quality(80)
    .url();

  return `background-image: url('${url}');`;
}
