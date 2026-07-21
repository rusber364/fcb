import { sanityClient } from "sanity:client";
import type { PortableTextBlock } from "@portabletext/types";
import type { Slug } from "@sanity/types";
import groq from "groq";

const visualEditingEnabled = import.meta.env.PUBLIC_SANITY_VISUAL_EDITING_ENABLED === "true";
const token = import.meta.env.SANITY_API_READ_TOKEN;

// visualEditingEnabled=true: fetch draft content with stega encoding (local/staging with Presentation tool)
// visualEditingEnabled=false: fetch published content from CDN (production)
async function loadQuery<T>(query: string, params: Record<string, any> = {}): Promise<T> {
  return sanityClient.fetch<T>(
    query,
    params,
    {
      perspective: visualEditingEnabled ? 'drafts' : 'published',
      useCdn: !visualEditingEnabled,
      ...(visualEditingEnabled && token ? { token, stega: true } : {}),
    }
  );
}

// Shared image projection — dereferences asset to include dimensions and LQIP
const imageProjection = `{
  ...,
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  "lqip": asset->metadata.lqip,
}`;

export async function getPosts(): Promise<Post[]> {
  return loadQuery<Post[]>(
    groq`*[_type == "post" && defined(slug.current)] | order(_createdAt desc) {
      ...,
      mainImage ${imageProjection}
    }`,
  );
}

export async function getPost(slug: string): Promise<Post> {
  return loadQuery<Post>(
    groq`*[_type == "post" && slug.current == $slug][0] {
      ...,
      mainImage ${imageProjection},
      seo {
        ...,
        ogImage ${imageProjection}
      }
    }`,
    { slug },
  );
}

export interface SanityImage {
  _type: "image";
  asset?: { _ref: string; _type: "reference" };
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; bottom: number; left: number; right: number };
  alt?: string;
  /** Original image width in pixels, from asset metadata */
  width: number;
  /** Original image height in pixels, from asset metadata */
  height: number;
  /** Low-quality image placeholder (base64 data URL) */
  lqip?: string;
}

export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: SanityImage;
}

export async function getEvents(): Promise<Event[]> {
  return loadQuery<Event[]>(
    groq`*[_type == "event"] | order(date asc) {
      _id,
      _type,
      title,
      slug,
      date,
      endDate,
      time,
      location,
      category,
      description,
    }`,
  );
}

export interface Event {
  _id: string;
  _type: "event";
  title: string;
  slug: Slug;
  date: string;
  endDate?: string;
  time?: string;
  location?: string;
  category?: "sunday" | "youth" | "other";
  description?: string;
}

export async function getPreachers(): Promise<Preacher[]> {
  return loadQuery<Preacher[]>(
    groq`*[_type == "preacher"] | order(sortOrder asc, name asc) {
      _id,
      _type,
      name,
      sortOrder,
    }`,
  );
}

export interface Preacher {
  _id: string;
  _type: "preacher";
  name: string;
  sortOrder?: number;
}

export async function getMonthlySchedule(month: number, year: number): Promise<MonthlySchedule | null> {
  return loadQuery<MonthlySchedule | null>(
    groq`*[_type == "monthlySchedule" && month == $month && year == $year][0] {
      _id,
      _type,
      month,
      year,
      assignments[] {
        _key,
        day,
        slot,
        preacher->{_id, name},
      },
    }`,
    { month, year },
  );
}

export interface MonthlySchedule {
  _id: string;
  _type: "monthlySchedule";
  month: number;
  year: number;
  assignments: PreacherAssignment[];
}

export interface PreacherAssignment {
  _key: string;
  day: number;
  slot: 1 | 2;
  preacher: {
    _id: string;
    name: string;
  };
}

export interface Post {
  _id: string;
  _type: "post";
  _createdAt: string;
  title?: string;
  slug: Slug;
  excerpt?: string;
  mainImage?: SanityImage;
  body: PortableTextBlock[];
  seo?: Seo;
}
