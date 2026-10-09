import sanitizeHtml from 'sanitize-html';

// Module content is admin-authored Tiptap HTML but rendered to students as HTML, so it's sanitised before it's stored: an allow-list,
// everything else (script, style, img, iframe, on* handlers, style attributes, javascript: URLs) is dropped.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's',
    'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // Only target=_blank survives, and always with noopener: a new tab without it can navigate ours (reverse tabnabbing).
    a: (tagName, { target, ...attribs }) => ({
      tagName,
      attribs: target === '_blank' ? { ...attribs, target, rel: 'noopener noreferrer' } : attribs,
    }),
  },
};

export const sanitizeContent = (html: string): string => sanitizeHtml(html, OPTIONS);
