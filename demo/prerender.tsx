// Build-time rendering for crawlers and assistants that do not run
// JavaScript: each page's markup plus its head (description, canonical,
// Open Graph, JSON-LD). Loaded by scripts/prerender.mjs; never shipped.
import { renderToString } from "react-dom/server";
import pkg from "../package.json";
import { FAQ, Faq, plain } from "./Faq";
import { Landing } from "./Landing";
import { LEDE, LEDE_EN, REPO, SITE } from "./site-meta";

const IMAGE = `${SITE}social-preview.jpg`;
const AUTHOR = {
  "@type": "Person",
  name: "Shin",
  url: "https://github.com/shin4",
};

const attr = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const jsonLd = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;

const head = (
  page: { title: string; description: string; url: string },
  data: object,
) =>
  [
    `<meta name="description" content="${attr(page.description)}" />`,
    `<link rel="canonical" href="${page.url}" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}llms.txt" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="墨池 Inkpond" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${attr(page.title)}" />`,
    `<meta property="og:description" content="${attr(page.description)}" />`,
    `<meta property="og:url" content="${page.url}" />`,
    `<meta property="og:image" content="${IMAGE}" />`,
    `<meta property="og:image:width" content="1280" />`,
    `<meta property="og:image:height" content="640" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    jsonLd(data),
  ].join("\n    ");

const code = {
  "@id": `${SITE}#software`,
  "@type": "SoftwareSourceCode",
  alternateName: "Inkpond",
  author: AUTHOR,
  codeRepository: REPO,
  description: LEDE,
  disambiguatingDescription: LEDE_EN,
  image: IMAGE,
  keywords: pkg.keywords.join(", "),
  license: "https://opensource.org/licenses/MIT",
  name: "墨池 Inkpond",
  programmingLanguage: ["TypeScript", "JavaScript"],
  runtimePlatform: "Web browser",
  url: SITE,
  version: pkg.version,
};

export const render = (page: "index" | "faq") => {
  if (page === "faq") {
    const url = `${SITE}faq/`;
    return {
      head: head(
        {
          description: `墨池 Inkpond 常见问题：${plain(FAQ.map((f) => f.q).join(" "))}`,
          title: "常见问题 · 墨池 Inkpond",
          url,
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          about: { "@id": `${SITE}#software` },
          inLanguage: "zh-CN",
          mainEntity: FAQ.map(({ q, a }) => ({
            "@type": "Question",
            acceptedAnswer: { "@type": "Answer", text: plain(a) },
            name: q,
          })),
          url,
        },
      ),
      html: renderToString(<Faq />),
    };
  }
  return {
    head: head(
      {
        description: LEDE,
        title: "墨池 Inkpond · 网页水墨汉字背景库",
        url: SITE,
      },
      {
        "@context": "https://schema.org",
        "@graph": [
          code,
          {
            "@type": "WebSite",
            about: { "@id": `${SITE}#software` },
            author: AUTHOR,
            description: LEDE,
            inLanguage: "zh-CN",
            name: "墨池 Inkpond",
            url: SITE,
          },
        ],
      },
    ),
    html: renderToString(<Landing />),
  };
};
