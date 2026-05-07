const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const globalAttributes = new Set(["class", "title"]);
const attributesByTag: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

const urlAttributes = new Set(["href", "src"]);
const allowedHrefProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
const allowedSrcProtocols = new Set(["http:", "https:"]);

const getParserDocument = (html: string): Document | null => {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
};

const isAllowedAttribute = (tagName: string, attrName: string) => {
  return globalAttributes.has(attrName) || attributesByTag[tagName]?.has(attrName);
};

const getSafeUrl = (rawUrl: string, attrName: string): string | null => {
  if (!rawUrl.trim()) return null;

  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const parsed = new URL(rawUrl, baseUrl);
    const allowedProtocols = attrName === "src" ? allowedSrcProtocols : allowedHrefProtocols;

    if (!allowedProtocols.has(parsed.protocol)) return null;

    if (parsed.origin === baseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(rawUrl.trim())) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.href;
  } catch {
    return null;
  }
};

const cleanNode = (node: Node, ownerDocument: Document): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return ownerDocument.createTextNode(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (!allowedTags.has(tagName)) {
    const fragment = ownerDocument.createDocumentFragment();
    element.childNodes.forEach((child) => {
      const cleanChild = cleanNode(child, ownerDocument);
      if (cleanChild) fragment.appendChild(cleanChild);
    });
    return fragment;
  }

  const cleanElement = ownerDocument.createElement(tagName);

  Array.from(element.attributes).forEach((attr) => {
    const attrName = attr.name.toLowerCase();
    if (attrName.startsWith("on") || !isAllowedAttribute(tagName, attrName)) return;

    if (urlAttributes.has(attrName)) {
      const safeUrl = getSafeUrl(attr.value, attrName);
      if (safeUrl) cleanElement.setAttribute(attrName, safeUrl);
      return;
    }

    cleanElement.setAttribute(attrName, attr.value);
  });

  if (tagName === "a") {
    cleanElement.setAttribute("rel", "noopener noreferrer");
  }

  element.childNodes.forEach((child) => {
    const cleanChild = cleanNode(child, ownerDocument);
    if (cleanChild) cleanElement.appendChild(cleanChild);
  });

  return cleanElement;
};

export const sanitizeRichText = (html?: string | null): string => {
  if (!html?.trim()) return "";

  const parsedDocument = getParserDocument(html);
  if (!parsedDocument || typeof document === "undefined") return "";

  const cleanDocument = document.implementation.createHTMLDocument("");
  const container = cleanDocument.createElement("div");

  parsedDocument.body.childNodes.forEach((node) => {
    const cleanChild = cleanNode(node, cleanDocument);
    if (cleanChild) container.appendChild(cleanChild);
  });

  return container.innerHTML;
};

export const richTextToPlainText = (html?: string | null): string => {
  if (!html?.trim()) return "";

  const parsedDocument = getParserDocument(html);
  if (!parsedDocument) return html;

  return parsedDocument.body.textContent?.trim() || "";
};

export const isRichTextEmpty = (html?: string | null): boolean => {
  if (!html?.trim()) return true;

  const parsedDocument = getParserDocument(html);
  if (!parsedDocument) return !html.trim();

  return !parsedDocument.body.textContent?.trim() && !parsedDocument.body.querySelector("img");
};
