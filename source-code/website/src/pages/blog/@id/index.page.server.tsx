import type { OnBeforeRender } from "@src/renderer/types.js";
import type { PageProps } from "./index.page.jsx";
import {
  tableOfContents,
  FrontmatterSchema,
} from "../../../../../../content/blog/tableOfContents.js";
import { parseMarkdown } from "@src/services/markdown/index.js";

/**
 * the table of contents without the html for each document
 * saving bandwith and speeding up the site
 */
export type ProcessedTableOfContents = Record<
  string,
  Awaited<ReturnType<typeof parseMarkdown>>["frontmatter"]
>;

/**
 * The index of documentation markdown files. The href's acts as id.
 *
 * @example
 * 	{
 * 		"/documentation/intro": document,
 * 	}
 */
const index: Record<string, Awaited<ReturnType<typeof parseMarkdown>>> = {};

/**
 * the table of contents without the html for each document
 * saving bandwith and speeding up the site)
 */
const processedTableOfContents: ProcessedTableOfContents = {};

await generateIndexAndTableOfContents();

// should only run server side
export const onBeforeRender: OnBeforeRender<PageProps> = async (
  pageContext
) => {
  // dirty way to get reload of markdown (not hot reload though)
  if (import.meta.env.DEV) {
    await generateIndexAndTableOfContents();
  }
  return {
    pageContext: {
      pageProps: {
        markdown: index[pageContext.urlPathname],
        processedTableOfContents: processedTableOfContents,
      },
    },
  };
};

/**
 * Generates the index and table of contents.
 */
async function generateIndexAndTableOfContents() {
  for (const document of tableOfContents) {
    const markdown = parseMarkdown({
      text: document,
      FrontmatterSchema,
    });
    // not pushing to processedTableOfContents directly in case
    // the category is undefined so far
    processedTableOfContents[markdown.frontmatter.href] = markdown.frontmatter;

    index[markdown.frontmatter.href] = markdown;
  }
}
