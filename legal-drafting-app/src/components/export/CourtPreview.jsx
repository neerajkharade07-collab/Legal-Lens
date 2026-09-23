import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileDown, FileText, Info, Printer, Settings2 } from 'lucide-react';
import { exportService } from '../../services';
import { paginateBlocks } from '../../utils/paginate';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { Button } from '../common/Button';
import { DemoBadge } from '../common/Badge';
import { DocBlocks } from './DocRenderer';
import './CourtPreview.css';

const BODY_CLASS = 'has-court-preview';
const SAFETY_PX = 6;

const plainText = (node) =>
  node.type === 'text'
    ? node.text
    : node.type === 'fieldToken'
      ? node.attrs?.value || node.attrs?.label || ''
      : (node.content ?? []).map(plainText).join('');

/** Headings — and short all-bold paragraphs used as headings — stay with the next block. */
function keepsWithNext(node) {
  if (node.type === 'heading') return true;
  if (node.type !== 'paragraph' || !node.content?.length) return false;
  const texts = node.content.filter((c) => c.type === 'text');
  return (
    texts.length > 0 &&
    texts.every((t) => t.marks?.some((m) => m.type === 'bold')) &&
    plainText(node).length <= 90
  );
}

/**
 * Court-ready preview: the document laid out on A4 pages with margins, page
 * numbers and an optional footer. Print / “Save as PDF” use the browser's print
 * dialog; the print stylesheet hides every piece of application chrome.
 */
export function CourtPreview({ title, content, onClose, onDownloadWord, autoPrint = false }) {
  const [options, setOptions] = useState(() => exportService.loadPrintOptions());
  const [pages, setPages] = useState(null);
  const [scale, setScale] = useState(1);
  const [notice, setNotice] = useState(null);
  const measureRef = useRef(null);
  const scrollRef = useRef(null);
  const backRef = useRef(null);
  const printedRef = useRef(false);

  const blocks = useMemo(() => content?.content ?? [], [content]);
  const geometry = exportService.pageGeometry(options.margins);
  const fontSize = exportService.FONT_SIZES.find((f) => f.id === options.fontSize).value;
  const lineSpacing = exportService.LINE_SPACINGS.find((l) => l.id === options.lineSpacing).value;

  useLockBodyScroll(true);

  // Body class drives the print stylesheet (print only the pages).
  useEffect(() => {
    document.body.classList.add(BODY_CLASS);
    backRef.current?.focus();
    return () => document.body.classList.remove(BODY_CLASS);
  }, []);

  const updateOption = (key, value) =>
    setOptions((current) => {
      const next = { ...current, [key]: value };
      exportService.savePrintOptions(next);
      return next;
    });

  // Measure every block at page width, then paginate.
  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll(':scope > .cr-block')];
    const heights = nodes.map((el, i) => ({
      height: el.getBoundingClientRect().height,
      keepWithNext: keepsWithNext(blocks[i]),
    }));
    setPages(paginateBlocks(heights, geometry.contentHeight - SAFETY_PX));
  }, [blocks, geometry.contentHeight]);

  useLayoutEffect(() => {
    measure();
  }, [measure, options.fontSize, options.lineSpacing, options.margins, options.placeholders]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready?.then(() => !cancelled && measure());
    return () => {
      cancelled = true;
    };
  }, [measure]);

  // Fit pages to narrow screens (screen only; print is always 1:1).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => {
      const available = el.clientWidth - 32;
      setScale(Math.min(1, available / geometry.width));
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [geometry.width]);

  const handlePrint = useCallback(
    (kind = 'print') => {
      setNotice(
        kind === 'pdf'
          ? 'In the print dialog, choose “Save as PDF” as the destination. The app does not create the PDF itself.'
          : null,
      );
      exportService.printDocument({ title, bodyClass: 'is-printing-document' });
    },
    [title],
  );

  // Header “Print…” opens the preview and prints once pages are laid out.
  useEffect(() => {
    if (!autoPrint || !pages || printedRef.current) return undefined;
    printedRef.current = true;
    const timer = setTimeout(() => handlePrint('print'), 150);
    return () => clearTimeout(timer);
  }, [autoPrint, pages, handlePrint]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  const m = geometry.margins;
  const cssVars = {
    '--cr-page-w': `${geometry.width}px`,
    '--cr-page-h': `${geometry.height}px`,
    '--cr-m-top': `${m.top}mm`,
    '--cr-m-right': `${m.right}mm`,
    '--cr-m-bottom': `${m.bottom}mm`,
    '--cr-m-left': `${m.left}mm`,
    '--cr-content-w': `${geometry.contentWidth}px`,
    '--cr-font-size': `${fontSize}pt`,
    '--cr-line': lineSpacing,
    '--cr-scale': scale,
  };
  const total = pages?.length ?? 0;
  const docx = exportService.EXPORT_CAPABILITIES.docx;

  return createPortal(
    <div
      className="court-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="court-preview-title"
      style={cssVars}
      onKeyDown={onKeyDown}
    >
      <header className="court-preview__bar">
        <Button ref={backRef} variant="secondary" size="sm" icon={ArrowLeft} onClick={onClose}>
          Back to Editor
        </Button>
        <div className="court-preview__heading">
          <h2 id="court-preview-title">Court-ready preview</h2>
          <p>
            {title} · A4 · {total} page{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="court-preview__actions">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => handlePrint('print')}>
            Print
          </Button>
          <Button variant="secondary" size="sm" icon={FileDown} onClick={() => handlePrint('pdf')}>
            Export PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            disabled
            aria-describedby="cr-docx-note"
            title={docx.reason}
          >
            Export DOCX
          </Button>
          <Button size="sm" icon={FileDown} onClick={onDownloadWord}>
            Word (.doc)
          </Button>
        </div>
      </header>

      <div className="court-preview__layout">
        <aside className="court-preview__options" aria-label="Page layout options">
          <h3>
            <Settings2 size={15} strokeWidth={1.75} aria-hidden="true" /> Page layout
          </h3>
          <div className="form-field">
            <label className="form-label" htmlFor="cr-margins">
              Margins
            </label>
            <select
              id="cr-margins"
              className="form-select"
              value={options.margins}
              onChange={(e) => updateOption('margins', e.target.value)}
            >
              {exportService.MARGIN_PRESETS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="cr-font">
              Font size
            </label>
            <select
              id="cr-font"
              className="form-select"
              value={options.fontSize}
              onChange={(e) => updateOption('fontSize', e.target.value)}
            >
              {exportService.FONT_SIZES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="cr-line">
              Line spacing
            </label>
            <select
              id="cr-line"
              className="form-select"
              value={options.lineSpacing}
              onChange={(e) => updateOption('lineSpacing', e.target.value)}
            >
              {exportService.LINE_SPACINGS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="cr-placeholders">
              Unfilled fields
            </label>
            <select
              id="cr-placeholders"
              className="form-select"
              value={options.placeholders}
              onChange={(e) => updateOption('placeholders', e.target.value)}
            >
              <option value="blank">Blank lines</option>
              <option value="label">Show field labels</option>
            </select>
          </div>
          <label className="court-preview__check">
            <input
              type="checkbox"
              checked={options.pageNumbers}
              onChange={(e) => updateOption('pageNumbers', e.target.checked)}
            />
            Page numbers
          </label>
          <label className="court-preview__check">
            <input
              type="checkbox"
              checked={options.footerTitle}
              onChange={(e) => updateOption('footerTitle', e.target.checked)}
            />
            Title in footer
          </label>

          <div className="court-preview__notes">
            <p id="cr-docx-note">
              <Info size={14} strokeWidth={1.75} aria-hidden="true" />
              {docx.reason}
            </p>
            <p>
              <Info size={14} strokeWidth={1.75} aria-hidden="true" />
              {exportService.EXPORT_CAPABILITIES.pdf.note}
            </p>
            <p>
              <Info size={14} strokeWidth={1.75} aria-hidden="true" />
              Layout preferences only. Check the formatting requirements of the court or authority
              where the document will be filed.
            </p>
            <DemoBadge>Preliminary demo draft — review before use</DemoBadge>
          </div>
        </aside>

        <div ref={scrollRef} className="court-preview__scroll">
          {notice && (
            <p className="court-preview__notice" role="status">
              <Info size={15} strokeWidth={1.75} aria-hidden="true" />
              {notice}
            </p>
          )}
          <div className="court-preview__pages">
            {(pages ?? []).map((indices, pageIndex) => (
              <div className="cr-page-frame" key={pageIndex}>
                <article
                  className="cr-page"
                  aria-label={`Page ${pageIndex + 1} of ${total}`}
                  data-page={pageIndex + 1}
                >
                  <div className="cr-page__content cr-doc">
                    <DocBlocks
                      blocks={indices.map((i) => blocks[i])}
                      startIndex={indices[0] ?? 0}
                      placeholders={options.placeholders}
                    />
                  </div>
                  {(options.pageNumbers || options.footerTitle) && (
                    <footer className="cr-page__footer">
                      <span className="cr-page__footer-title">
                        {options.footerTitle ? title : ''}
                      </span>
                      {options.pageNumbers && (
                        <span className="cr-page__number">
                          Page {pageIndex + 1} of {total}
                        </span>
                      )}
                    </footer>
                  )}
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Off-screen measurer at exact page-content width. */}
      <div ref={measureRef} className="cr-measure cr-doc" aria-hidden="true">
        <DocBlocks blocks={blocks} placeholders={options.placeholders} />
      </div>
    </div>,
    document.body,
  );
}
