import { Plus, Upload } from 'lucide-react';
import { Button } from '../common/Button';
import { HeroPreview } from './HeroPreview';
import './HeroSection.css';

export function HeroSection({ onCreateNew }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__content">
          <p className="eyebrow">Legal Drafting Assistant</p>
          <h1 id="hero-title" className="hero__title">
            Draft legal documents with confidence.
          </h1>
          <p className="hero__lead">
            Create, review, improve and format legal documents in one structured workspace. Describe
            the matter, fill in the particulars, and refine a live draft with review tools built for
            Indian legal practice.
          </p>
          <div className="hero__actions">
            <Button size="lg" icon={Plus} onClick={onCreateNew}>
              Create New Draft
            </Button>
            <Button size="lg" variant="secondary" icon={Upload} to="/review">
              Upload Existing Document
            </Button>
          </div>
          <dl className="hero__facts">
            <div>
              <dt>Document types</dt>
              <dd>4 to start</dd>
            </div>
            <div>
              <dt>Draft languages</dt>
              <dd>English · Hindi · Marathi</dd>
            </div>
            <div>
              <dt>Demo storage</dt>
              <dd>This browser only</dd>
            </div>
          </dl>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}
