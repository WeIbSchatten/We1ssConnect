import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

// Every page needs a description (search results and link previews use it).
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      description: z.string().min(1, 'Every doc page needs a frontmatter `description`.'),
    }),
  },
  meta: { schema: metaSchema },
});

export default defineConfig();
