#!/usr/bin/env node
/**
 * Purpose: read bounded text and page metadata from local PDF evidence, using local in-memory OCR only when embedded
 * text is absent. Caller: financial-records.command.mjs source-backed preparation operations.
 * Input/output: one absolute local PDF path plus an optional validated read plan; bounded normalized/compact text,
 * page count, optional plan-authorized layout tokens, and text-source provenance.
 * Effects: read-only; rendering and OCR remain in memory and never persist pages, crops, or recognized text.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import { genericReadPlan } from './read-plans/generic-read-plan.mjs';
import { boundedRenderDimensions, validatedReadPlan } from './read-plans/read-plan.mjs';

function boundedUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

class NapiCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(entry, width, height) { entry.canvas.width = width; entry.canvas.height = height; }
  destroy(entry) { entry.canvas.width = 0; entry.canvas.height = 0; entry.canvas = null; entry.context = null; }
}

export class PdfReader {
  constructor(options = {}) {
    const requestedTimeout = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 10000;
    if (requestedTimeout <= 0) {
      throw new Error('invalid-timeout');
    }
    this.timeoutMs = Math.min(15000, requestedTimeout);
  }

  async read(pdfPath, requestedReadPlan = genericReadPlan) {
    const readPlan = requestedReadPlan === genericReadPlan ? genericReadPlan : validatedReadPlan(requestedReadPlan);
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

    const maxPages = Math.min(pageCount, readPlan.maxPages);
    const textParts = [];
    const embeddedTextParts = [];
    const layoutTokens = [];

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

      const items = (content.items || []).slice(0, readPlan.maxTextItemsPerPage).filter((item) => 'str' in item);
      for (const item of items) {
        textParts.push(item.str);
        embeddedTextParts.push(item.str);
        const digits = String(item.str || '').replace(/[^0-9]/g, '');
        if (readPlan.layoutTokens.numeric && digits && digits.length <= readPlan.layoutTokens.maxDigits
          && layoutTokens.length < readPlan.layoutTokens.maxTokens && Array.isArray(item.transform)) {
          const width = Number(page.view?.[2] || 1);
          const height = Number(page.view?.[3] || 1);
          layoutTokens.push({ value: digits, page: pageNumber, source: 'embedded-layout', confidence: 1,
            bbox: { x: boundedUnit(item.transform[4] / width), y: boundedUnit(1 - (item.transform[5] / height)),
              width: boundedUnit(Number(item.width || 0) / width),
              height: boundedUnit(Number(item.height || 0) / height) } });
        }
      }
    }

    // Combine text and normalize
    let rawText = textParts.join(' ');
    let ocrRawText = '';
    let textSource = 'embedded-pdf-text';
    if (readPlan.ocr.enabled
      && rawText.replace(/\s+/g, '').length < readPlan.ocr.triggerBelowCompactChars) {
      const ocr = await this.#ocrPages(document, maxPages, require, readPlan);
      ocrRawText = ocr.text;
      rawText = `${rawText}\n${ocr.text}`;
      layoutTokens.push(...ocr.layoutTokens);
      textSource = 'embedded-pdf-text+local-ocr';
    }
    const normalizedText = this.#boundedText(rawText, readPlan.maxTextChars);

    // Compact text: normalize and remove non-alphanumeric chars
    const compactText = this.#compactText(normalizedText);

    return {
      pageCount,
      normalizedText,
      compactText,
      textSource,
      layoutTokens: layoutTokens.slice(0, readPlan.layoutTokens.maxTokens),
      evidenceChannels: {
        embeddedText: this.#boundedText(embeddedTextParts.join(' '), readPlan.maxTextChars),
        ocrText: this.#boundedText(ocrRawText, readPlan.maxTextChars),
      },
    };
  }

  async #ocrPages(document, maxPages, require, readPlan) {
    const languages = readPlan.ocr.languages.join('+');
    const primaryLanguage = readPlan.ocr.languages[0];
    const languagePath = path.dirname(require.resolve(
      `@tesseract.js-data/${primaryLanguage}/4.0.0_best_int/${primaryLanguage}.traineddata.gz`));
    let worker;
    try {
      worker = await this.#withTimeout(createWorker(languages, 1, {
        langPath: languagePath, gzip: true, cacheMethod: 'none', logger: () => undefined,
      }), this.timeoutMs);
      await this.#withTimeout(worker.setParameters({
        tessedit_pageseg_mode: readPlan.ocr.pageSegmentationMode,
      }), this.timeoutMs);
      const parts = [];
      const layoutTokens = [];
      let renderedPixels = 0;
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        const page = await this.#withTimeout(document.getPage(pageNumber), this.timeoutMs);
        const viewport = page.getViewport({ scale: readPlan.ocr.scale });
        const bounds = boundedRenderDimensions(viewport, renderedPixels, readPlan);
        renderedPixels = bounds.cumulativePixels;
        const canvas = createCanvas(bounds.width, bounds.height);
        await this.#withTimeout(page.render({
          canvasContext: canvas.getContext('2d'), viewport, canvasFactory: new NapiCanvasFactory(),
        }).promise, this.timeoutMs);
        const recognized = await this.#withTimeout(worker.recognize(
          canvas.toBuffer('image/png'), {}, { text: true, blocks: true }), this.timeoutMs);
        parts.push(String(recognized?.data?.text || ''));
        for (const block of recognized?.data?.blocks || []) {
          for (const paragraph of block.paragraphs || []) {
            for (const line of paragraph.lines || []) {
              for (const word of line.words || []) {
                const digits = String(word.text || '').replace(/[^0-9]/g, '');
                if (!readPlan.layoutTokens.numeric || !digits
                  || digits.length > readPlan.layoutTokens.maxDigits
                  || layoutTokens.length >= readPlan.layoutTokens.maxTokens || !word.bbox) continue;
                const confidence = Math.max(0, Math.min(1, Number(word.confidence || 0) / 100));
                layoutTokens.push({ value: digits, page: pageNumber, source: 'ocr-layout', confidence,
                  bbox: { x: boundedUnit(word.bbox.x0 / canvas.width),
                    y: boundedUnit(word.bbox.y0 / canvas.height),
                    width: boundedUnit((word.bbox.x1 - word.bbox.x0) / canvas.width),
                    height: boundedUnit((word.bbox.y1 - word.bbox.y0) / canvas.height) } });
              }
            }
          }
        }
      }
      return { text: parts.join(' '), layoutTokens };
    } catch {
      throw new Error('text-extraction-failed');
    } finally {
      if (worker) await worker.terminate().catch(() => undefined);
    }
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

  #boundedText(value, maxTextChars) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxTextChars);
  }

  #compactText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
}
