#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export class PdfReader {
  constructor(options = {}) {
    const requestedTimeout = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 10000;
    if (requestedTimeout <= 0) {
      throw new Error('invalid-timeout');
    }
    this.timeoutMs = Math.min(15000, requestedTimeout);
  }

  async read(pdfPath) {
    // Validate path: must be absolute, exist, and be a regular file
    if (!path.isAbsolute(pdfPath)) {
      throw new Error('invalid-path');
    }
    if (!fs.existsSync(pdfPath)) {
      throw new Error('invalid-path');
    }
    const stat = fs.statSync(pdfPath);
    if (!stat.isFile()) {
      throw new Error('invalid-path');
    }

    // Validate file size: max 25 MiB
    if (stat.size > 25 * 1024 * 1024) {
      throw new Error('file-too-large');
    }

    // Resolve pdfjs-dist via Node.js require resolve to get the correct ESM path
    const scriptDir = path.dirname(pathToFileURL(import.meta.url).pathname);
    const require = createRequire(import.meta.url);
    const pdfJsResolved = require.resolve('pdfjs-dist/legacy/build/pdf.js');

    let pdfjs;
    try {
      pdfjs = await import(pathToFileURL(pdfJsResolved).href);
    } catch {
      throw new Error('pdf-engine-unavailable');
    }

    const bytes = new Uint8Array(fs.readFileSync(pdfPath));
    let document;

    try {
      document = await this.#withTimeout(
        pdfjs.getDocument({
          data: bytes,
          disableWorker: true,
          isEvalSupported: false,
          useSystemFonts: false,
          verbosity: 0,
        }).promise,
        this.timeoutMs
      );
    } catch (error) {
      if (error?.message === 'timeout') {
        throw new Error('timeout');
      }
      throw new Error('malformed-pdf');
    }

    const pageCount = Number(document.numPages || 0);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 25) {
      throw new Error('malformed-pdf');
    }

    // Read first max 5 pages
    const maxPages = Math.min(pageCount, 5);
    const textParts = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      let page;
      try {
        page = await this.#withTimeout(document.getPage(pageNumber), this.timeoutMs);
      } catch (error) {
        if (error?.message === 'timeout') {
          throw new Error('timeout');
        }
        throw new Error('render-failed');
      }

      let content;
      try {
        content = await this.#withTimeout(page.getTextContent(), this.timeoutMs);
      } catch (error) {
        if (error?.message === 'timeout') {
          throw new Error('timeout');
        }
        throw new Error('text-extraction-failed');
      }

      // Limit to max 10000 text items per page
      const items = (content.items || []).slice(0, 10000).filter((item) => 'str' in item);
      for (const item of items) {
        textParts.push(item.str);
      }
    }

    // Combine text and normalize
    const rawText = textParts.join(' ');
    const normalizedText = this.#boundedText(rawText);

    // Compact text: normalize and remove non-alphanumeric chars
    const compactText = this.#compactText(normalizedText);

    return {
      pageCount,
      normalizedText,
      compactText,
    };
  }

  #withTimeout(promise, timeoutMs) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]).finally(() => {
      clearTimeout(timer);
    });
  }

  #boundedText(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32 * 1024);
  }

  #compactText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
}
