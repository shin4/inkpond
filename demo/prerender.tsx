// Build-time rendering for crawlers and assistants that do not run
// JavaScript: each page's markup plus its head (description, canonical,
// language alternates, Open Graph, JSON-LD), and llms-full.txt. Loaded by
// scripts/prerender.mjs; never shipped.
import { renderToString } from "react-dom/server";
import pkg from "../package.json";
import type { Lang } from "./copy";
import { FAQ, Faq, plain } from "./Faq";
import { Landing } from "./Landing";
import { LEDE, LEDE_EN, REPO, SITE, UPDATED } from "./site-meta";

export type Page = "home" | "faq";

const IMAGE = `${SITE}social-preview.jpg`;
const AUTHOR = {
  "@type": "Person",
  name: "Shin",
  url: "https://github.com/shin4",
};
const SOFTWARE = `${SITE}#software`;
const LOCALE = { en: "en_US", zh: "zh_CN" } as const;
const IN_LANGUAGE = { en: "en", zh: "zh-CN" } as const;

const urlOf = (lang: Lang, page: Page) =>
  `${SITE}${lang === "en" ? "en/" : ""}${page === "faq" ? "faq/" : ""}`;

const attr = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const jsonLd = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;

const META = {
  en: {
    faqDescription: `Inkpond FAQ: ${FAQ.en.map((f) => f.q).join(" ")}`,
    faqTitle: "FAQ · Inkpond",
    homeDescription: LEDE_EN,
    homeTitle: "Inkpond · an ink-wash background of Chinese glyphs for the web",
  },
  zh: {
    faqDescription: `墨池 Inkpond 常见问题：${FAQ.zh.map((f) => f.q).join(" ")}`,
    faqTitle: "常见问题 · 墨池 Inkpond",
    homeDescription: LEDE,
    homeTitle: "墨池 Inkpond · 网页水墨汉字背景库",
  },
} as const;

const head = (lang: Lang, page: Page, data: object) => {
  const meta = META[lang];
  const title = page === "faq" ? meta.faqTitle : meta.homeTitle;
  const description =
    page === "faq" ? meta.faqDescription : meta.homeDescription;
  const url = urlOf(lang, page);
  return [
    `<meta name="description" content="${attr(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="zh-CN" href="${urlOf("zh", page)}" />`,
    `<link rel="alternate" hreflang="en" href="${urlOf("en", page)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${urlOf("zh", page)}" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}llms.txt" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="墨池 Inkpond" />`,
    `<meta property="og:locale" content="${LOCALE[lang]}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${IMAGE}" />`,
    `<meta property="og:image:width" content="1280" />`,
    `<meta property="og:image:height" content="640" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    jsonLd(data),
  ].join("\n    ");
};

const software = {
  "@id": SOFTWARE,
  "@type": "SoftwareSourceCode",
  alternateName: ["Inkpond", "墨池"],
  author: AUTHOR,
  codeRepository: REPO,
  dateModified: UPDATED,
  description: LEDE_EN,
  disambiguatingDescription: LEDE,
  image: IMAGE,
  keywords: pkg.keywords.join(", "),
  license: "https://opensource.org/licenses/MIT",
  name: "墨池 Inkpond",
  programmingLanguage: ["TypeScript", "JavaScript"],
  runtimePlatform: "Web browser",
  url: SITE,
  version: pkg.version,
};

const data = (lang: Lang, page: Page) => {
  const url = urlOf(lang, page);
  if (page === "faq") {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      about: { "@id": SOFTWARE },
      dateModified: UPDATED,
      inLanguage: IN_LANGUAGE[lang],
      mainEntity: FAQ[lang].map(({ q, a, example }) => ({
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: example ? `${plain(a)}\n\n${example}` : plain(a),
        },
        name: q,
      })),
      url,
    };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      software,
      {
        "@type": "WebPage",
        about: { "@id": SOFTWARE },
        author: AUTHOR,
        dateModified: UPDATED,
        description: META[lang].homeDescription,
        inLanguage: IN_LANGUAGE[lang],
        name: META[lang].homeTitle,
        url,
      },
    ],
  };
};

export const render = (lang: Lang, page: Page) => ({
  head: head(lang, page, data(lang, page)),
  html: renderToString(
    page === "faq" ? <Faq lang={lang} /> : <Landing lang={lang} />,
  ),
});

/**
 * llms-full.txt: the English README (passed in by the script, which reads
 * it) followed by both FAQs with their examples, as one Markdown file.
 */
export const llmsFull = (readme: string) => {
  const faq = (lang: Lang, heading: string) =>
    [
      `## ${heading}`,
      ...FAQ[lang].map(({ q, a, example }) =>
        [`### ${q}`, a, example ? `\`\`\`\n${example}\n\`\`\`` : ""]
          .filter(Boolean)
          .join("\n\n"),
      ),
    ].join("\n\n");
  // The README's centred header and hero picture are GitHub HTML; its
  // relative links only resolve inside the repository.
  const body = readme
    .replace(/<div align="center">[\s\S]*?<\/div>/, "")
    .replace(/<picture>[\s\S]*?<\/picture>/, "")
    .replace(/(src|href)="(docs\/[^"]+)"/g, `$1="${REPO}/raw/main/$2"`)
    .replace(/\]\((?!https?:|#)([^)]+)\)/g, `](${REPO}/blob/main/$1)`)
    .trim();
  return [
    `# 墨池 Inkpond\n\n> ${LEDE_EN}\n\n${LEDE}\n\nVersion ${pkg.version}, updated ${UPDATED}. Source: ${REPO}. Site: ${SITE}`,
    body,
    faq("en", "FAQ"),
    faq("zh", "常见问题（中文）"),
  ].join("\n\n");
};
