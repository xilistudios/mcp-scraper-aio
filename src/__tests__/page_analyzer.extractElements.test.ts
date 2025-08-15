import { PageAnalyzer } from "../services/page_analyzer";
import { Logger } from "../logger";

describe("PageAnalyzer - extractImportantElements", () => {
  let analyzer: PageAnalyzer;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new PageAnalyzer(mockLogger as any);
  });

  function makeElement(tag: string, attributes: Record<string, string> = {}, text = '') {
    const classAttr = attributes.class ?? attributes.className ?? '';
    const attrNames = Object.keys(attributes);
    return {
      tagName: tag.toUpperCase(),
      id: attributes.id ?? '',
      classList: classAttr ? classAttr.split(/\s+/) : [],
      getAttribute: (name: string) => {
        // Return attribute value when present, otherwise null so the production code
        // can use nullish checks to fall back to other sources (e.g. script textContent).
        if (name === 'class') return attributes.class ?? attributes.className ?? null;
        return (attributes as any)[name] ?? null;
      },
      getAttributeNames: () => attrNames,
      textContent: text
    };
  }

  function makeFakePage(elementsBySelector: Record<string, any[]>) {
    const evaluate = jest.fn().mockImplementation(async (fn: any, type: string) => {
      const fakeDocument = {
        querySelectorAll: (selector: string) => {
          return elementsBySelector[selector] ?? [];
        }
      } as any;

      // Temporarily expose global.document so the evaluate function can access it
      (global as any).document = fakeDocument;
      try {
        // Call the page.evaluate callback with the provided type
        const res = (fn as any)(type);
        return res;
      } finally {
        delete (global as any).document;
      }
    });
    return { evaluate };
  }

  it("extracts text elements and generates selectors (id > class > tag) with attributes", async () => {
    const els = [
      makeElement('p', { id: 'intro', class: 'lead', 'data-test': 'x' }, ' Hello world '),
      makeElement('h1', { class: 'title main' }, 'Title here'),
      makeElement('span', {}, 'inline text'),
    ];

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': els
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);

    expect(result[0]).toEqual(expect.objectContaining({
      content: 'Hello world',
      selector: '#intro',
      type: 'text',
      tag: 'p',
      attributes: expect.any(Object)
    }));
    expect(result[0]!.attributes).toHaveProperty('id', 'intro');
    expect(result[0]!.attributes).toHaveProperty('data-test', 'x');
    
    expect(result[1]!.selector).toBe('.title.main');
    expect(result[1]!.content).toBe('Title here');
    
    expect(result[2]!.selector).toBe('span');
    expect(result[2]!.content).toBe('inline text');

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("extracts image elements using src as content and selector priority", async () => {
    const els = [
      makeElement('img', { src: '/img1.png', id: 'img1', alt: 'first' }, ''),
      makeElement('img', { src: '/img2.jpg', class: 'responsive' }, ''),
      makeElement('img', { src: '', title: 'no-src' }, ''),
    ];

    const fakePage = makeFakePage({ 'img': els });

    const result = await analyzer.extractImportantElements(fakePage as any, 'image');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({
      content: '/img1.png',
      selector: '#img1',
      type: 'image',
      tag: 'img',
      attributes: expect.any(Object),
    }));
    expect(result[0]!.attributes).toHaveProperty('src', '/img1.png');
    
    expect(result[1]!.selector).toBe('.responsive');
    expect(result[1]!.content).toBe('/img2.jpg');
    
    expect(result[2]!.selector).toBe('img');
    
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("extracts link elements using href as content and selector priority", async () => {
    const els = [
      makeElement('a', { href: 'https://example.com', id: 'link1' }, 'Example'),
      makeElement('a', { href: '/about', class: 'nav link' }, 'About'),
      makeElement('a', { href: '' }, 'Empty'),
    ];

    const fakePage = makeFakePage({ 'a': els });

    const result = await analyzer.extractImportantElements(fakePage as any, 'link');

    expect(result).toHaveLength(3);

    expect(result[0]).toEqual(expect.objectContaining({
      content: 'https://example.com',
      selector: '#link1',
      type: 'link',
      tag: 'a',
      attributes: expect.any(Object),
    }));

    expect(result[1]!.selector).toBe('.nav.link');
    expect(result[1]!.content).toBe('/about');
    
    expect(result[2]!.selector).toBe('a');
    
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("extracts script elements using src if present otherwise textContent, with attributes and selectors", async () => {
    const els = [
      makeElement('script', { src: 'https://cdn/script.js', id: 's1' }, ''),
      makeElement('script', {}, 'console.log("hello");'),
    ];

    const fakePage = makeFakePage({ 'script': els });

    const result = await analyzer.extractImportantElements(fakePage as any, 'script');
    
    // debug output for unexpected script content behavior
    // eslint-disable-next-line no-console
    console.log("DEBUG script extraction result:", JSON.stringify(result, null, 2));
    
    expect(result).toHaveLength(2);

    expect(result[0]).toEqual(expect.objectContaining({
      content: 'https://cdn/script.js',
      selector: '#s1',
      type: 'script',
      tag: 'script',
      attributes: expect.any(Object),
    }));

    expect(result[1]).toEqual(expect.objectContaining({
      content: 'console.log("hello");',
      selector: 'script',
      type: 'script',
      tag: 'script',
      attributes: expect.any(Object),
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});