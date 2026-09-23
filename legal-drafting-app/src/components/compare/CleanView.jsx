import { Copy, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { useToast } from '../../hooks/useToast';
import { copyText } from '../../utils/clipboard';
import { splitParagraphs } from '../../utils/textDiff';
import { isHeadingText } from './compareText';
import { cn } from '../../utils/cn';

/** The document with current decisions applied (pending changes shown as revised). */
export function CleanView({ compare }) {
  const { toast } = useToast();
  const { counts } = compare;

  const handleCopy = async () => {
    const ok = await copyText(compare.cleanText);
    toast(
      ok
        ? { title: 'Clean version copied', variant: 'success', duration: 2000 }
        : {
            title: 'Copy failed',
            description: 'Select the text and copy it manually.',
            variant: 'error',
          },
    );
  };

  return (
    <div className="clean">
      <div className="clean__bar">
        <p className="clean__status">
          {counts.accepted} accepted · {counts.rejected} rejected · {counts.pending} pending
          {counts.pending > 0 && <span> — pending changes are shown as revised text</span>}
        </p>
        <div className="clean__actions">
          <Button size="sm" variant="secondary" icon={Copy} onClick={handleCopy}>
            Copy
          </Button>
          <Button size="sm" iconRight={ArrowRight} onClick={compare.openInEditor}>
            Open in Editor
          </Button>
        </div>
      </div>
      <article className="rl-page" aria-label="Clean version">
        {splitParagraphs(compare.cleanText).map((line, n) => (
          <p key={n} className={cn('rl-p', isHeadingText(line) && 'rl-h')}>
            {line}
          </p>
        ))}
      </article>
    </div>
  );
}
