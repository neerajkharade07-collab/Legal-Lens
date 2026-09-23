import { useRef, useState } from 'react';
import { Search, BookmarkPlus, NotebookPen, X } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal, ModalCloseButton } from '../common/Modal';
import { ToolLoading, ToolError, DemoNotice } from './IntelShared';
import { SourceNoticeModal } from './SourceNoticeModal';
import './ResearchTool.css';

function DetailsModal({ item, onClose, onAddNote, onSave }) {
  const closeRef = useRef(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  if (!item) return null;
  return (
    <>
      <Modal
        open
        size="md"
        onClose={onClose}
        labelledBy="research-detail-title"
        initialFocusRef={closeRef}
        className="research-modal"
      >
        <div className="research-modal__header">
          <div>
            <p className="eyebrow">{item.sourceType}</p>
            <h2 id="research-detail-title" className="research-modal__title">
              {item.title}
            </h2>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="research-modal__body">
          <div className="intel-card__badges">
            <Badge tone="outline">Unverified</Badge>
            <Badge tone="demo">Demo placeholder</Badge>
          </div>
          <p>{item.summary}</p>
          <p>{item.details}</p>
        </div>
        <div className="research-modal__footer">
          <Button variant="ghost" onClick={() => setSourceOpen(true)}>
            Open source
          </Button>
          <Button variant="secondary" icon={BookmarkPlus} onClick={() => onSave(item)}>
            Save for later
          </Button>
          <Button
            ref={closeRef}
            icon={NotebookPen}
            onClick={() => {
              onAddNote(item);
              onClose();
            }}
          >
            Add note to draft
          </Button>
        </div>
      </Modal>
      <SourceNoticeModal
        open={sourceOpen}
        subject={item.title}
        onClose={() => setSourceOpen(false)}
      />
    </>
  );
}

function ResultCard({ item, onView, onAddNote, onSave, saved }) {
  return (
    <li className="intel-card">
      <p className="intel-card__title">{item.title}</p>
      <p className="intel-card__meta">{item.sourceType}</p>
      <p className="intel-card__text">{item.summary}</p>
      <div className="intel-card__badges">
        <Badge tone="outline">Unverified</Badge>
        <Badge tone="demo">Demo</Badge>
      </div>
      <div className="intel-card__actions">
        <Button size="sm" variant="secondary" onClick={() => onView(item)}>
          View details
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAddNote(item)}>
          Add note to draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSave(item)} disabled={saved}>
          {saved ? 'Saved' : 'Save for later'}
        </Button>
      </div>
    </li>
  );
}

export function ResearchTool({ intel }) {
  const [query, setQuery] = useState(intel.research.query);
  const [viewing, setViewing] = useState(null);
  const { research, savedResearch } = intel;
  const savedIds = new Set(savedResearch.map((s) => s.id));

  const submit = (event) => {
    event.preventDefault();
    intel.searchResearch(query);
  };

  return (
    <div className="research">
      <form className="research__form" role="search" onSubmit={submit}>
        <label htmlFor="research-input" className="visually-hidden">
          Research a legal issue
        </label>
        <Search size={16} strokeWidth={1.75} aria-hidden="true" className="research__icon" />
        <input
          id="research-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Research a legal issue…"
          autoComplete="off"
        />
        <Button type="submit" size="sm" disabled={!query.trim() || research.status === 'loading'}>
          Search
        </Button>
      </form>

      <div>
        <p className="intel-section-title">Suggested topics</p>
        <div className="research__topics">
          {intel.suggestedTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="research__topic"
              onClick={() => {
                setQuery(topic);
                intel.searchResearch(topic);
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <DemoNotice>
        Demo research. Results are labelled placeholders — no research is performed and no sources
        or authorities are cited.
      </DemoNotice>

      {research.status === 'loading' && <ToolLoading />}
      {research.status === 'error' && (
        <ToolError message={research.error} onRetry={() => intel.searchResearch(research.query)} />
      )}
      {research.status === 'ready' && (
        <>
          <p className="intel-section-title">Results for “{research.query}”</p>
          <ul className="intel-list">
            {research.results.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                onView={setViewing}
                onAddNote={intel.addResearchNote}
                onSave={intel.saveResearch}
                saved={savedIds.has(item.id)}
              />
            ))}
          </ul>
        </>
      )}

      {savedResearch.length > 0 && (
        <div>
          <p className="intel-section-title">Saved for later ({savedResearch.length})</p>
          <ul className="research__saved">
            {savedResearch.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="research__saved-title"
                  onClick={() => setViewing(item)}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  className="panel-icon-btn"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => intel.removeResearch(item.id)}
                >
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DetailsModal
        item={viewing}
        onClose={() => setViewing(null)}
        onAddNote={intel.addResearchNote}
        onSave={intel.saveResearch}
      />
    </div>
  );
}
