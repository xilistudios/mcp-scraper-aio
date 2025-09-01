import { PageAnalyzer } from "../services/page_analyzer";
import { Logger } from "../logger";

describe("PageAnalyzer - selector uniqueness with hierarchical fallback", () => {
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
        if (name === 'class') return attributes.class ?? attributes.className ?? null;
        return (attributes as any)[name] ?? null;
      },
      getAttributeNames: () => attrNames,
      textContent: text,
      parentElement: attributes.parentElement ?? null,
      parentNode: attributes.parentNode ?? null
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

  it("builds hierarchical selector when class-based selector is provably non-unique", async () => {
    // Create elements with duplicate classes
    const mainContent = makeElement('div', { class: 'main-content' });
    const post = makeElement('article', { class: 'post' });
    const dupPara = makeElement('p', { class: 'dup' }, 'Duplicate content');
    const uniquePara = makeElement('p', { class: 'unique' }, 'Unique content');

    // Set up parent relationships
    dupPara.parentElement = post;
    post.parentElement = mainContent;

    const elements = [dupPara, uniquePara];

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': elements,
      '.dup': [dupPara, makeElement('p', { class: 'dup' }, 'Another dup')], // Non-unique
      'div.main-content > article.post > p.dup': [dupPara], // Unique hierarchical
      '.unique': [uniquePara] // Unique class
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // First element should use hierarchical selector due to non-unique class
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'Duplicate content',
      selector: 'div.main-content > article.post > p.dup',
      type: 'text',
      tag: 'p'
    }));

    // Second element should keep simple class selector since it's unique
    expect(result[1]).toEqual(expect.objectContaining({
      content: 'Unique content',
      selector: '.unique',
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("retains class-based selector when uniqueness cannot be determined", async () => {
    const para = makeElement('p', { class: 'ambiguous' }, 'Ambiguous content');

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': [para]
      // Note: no mapping for '.ambiguous', so uniqueness cannot be determined
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'Ambiguous content',
      selector: '.ambiguous', // Should retain class selector
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("uses id selector when present, regardless of uniqueness", async () => {
    const para = makeElement('p', { id: 'unique-id', class: 'dup' }, 'ID content');

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': [para],
      '.dup': [para, makeElement('p', { class: 'dup' }, 'Another dup')] // Non-unique class
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'ID content',
      selector: '#unique-id', // Should use ID, not hierarchical
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });
  // Additional edge-case tests: parentNode fallback and maxDepth behavior
  it("builds hierarchical selector when parentElement is missing but parentNode is provided", async () => {
    const wrapper = makeElement('div', { class: 'wrapper' });
    const para = makeElement('p', { class: 'dup' }, 'Fell back content');
    para.parentElement = null;
    para.parentNode = wrapper;

    const elements = [para];

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': elements,
      '.dup': [para, makeElement('p', { class: 'dup' }, 'Another dup')],
      'div.wrapper > p.dup': [para]
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'Fell back content',
      selector: 'div.wrapper > p.dup',
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("stops at maxDepth and falls back to class selector when deeper uniqueness requires more ancestors", async () => {
    // Build deep ancestor chain: div.a1 > div.a2 > div.a3 > div.a4 > div.a5 > article.post > p.dup
    const a1 = makeElement('div', { class: 'a1' });
    const a2 = makeElement('div', { class: 'a2' });
    const a3 = makeElement('div', { class: 'a3' });
    const a4 = makeElement('div', { class: 'a4' });
    const a5 = makeElement('div', { class: 'a5' });
    const article = makeElement('article', { class: 'post' });
    const dupPara = makeElement('p', { class: 'dup' }, 'Deep dup');
    const otherDup = makeElement('p', { class: 'dup' }, 'Another dup');

    // Link parents
    dupPara.parentElement = article;
    article.parentElement = a5;
    a5.parentElement = a4;
    a4.parentElement = a3;
    a3.parentElement = a2;
    a2.parentElement = a1;

    const elements = [dupPara];

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': elements,
      '.dup': [dupPara, otherDup], // class not unique
      'p.dup': [dupPara, otherDup], // tag+class not unique
      'article.post > p.dup': [dupPara, otherDup],
      'div.a5 > article.post > p.dup': [dupPara, otherDup],
      'div.a4 > div.a5 > article.post > p.dup': [dupPara, otherDup],
      // Full deep chain is unique but beyond maxDepth so should not be considered
      'div.a1 > div.a2 > div.a3 > div.a4 > div.a5 > article.post > p.dup': [dupPara]
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(result).toHaveLength(1);
    // Since uniqueness can only be proven with ancestors beyond maxDepth,
    // getUniqueSelector should fall back to the class-based candidate
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'Deep dup',
      selector: '.dup',
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("handles DOMTokenList-like classList (browser compatibility)", async () => {
    // Simulate browser DOMTokenList behavior
    const createDOMTokenList = (classes: string[]) => ({
      length: classes.length,
      [0]: classes[0] || undefined,
      [1]: classes[1] || undefined,
      [2]: classes[2] || undefined,
      item: (index: number) => classes[index] || null,
      contains: (className: string) => classes.includes(className),
      add: () => {},
      remove: () => {},
      toggle: () => false,
      toString: () => classes.join(' '),
      [Symbol.iterator]: function* () {
        for (const cls of classes) {
          yield cls;
        }
      }
    });

    const para = makeElement('p', { class: 'test-class' }, 'DOMTokenList content');
    // Override classList to simulate DOMTokenList
    para.classList = createDOMTokenList(['test-class']);

    const fakePage = makeFakePage({
      'p, h1, h2, h3, h4, h5, h6, span': [para],
      '.test-class': [para] // Unique class
    });

    const result = await analyzer.extractImportantElements(fakePage as any, 'text');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      content: 'DOMTokenList content',
      selector: '.test-class', // Should use class selector despite DOMTokenList
      type: 'text',
      tag: 'p'
    }));

    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});