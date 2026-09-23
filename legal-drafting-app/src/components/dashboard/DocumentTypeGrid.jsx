import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { SectionHeader } from '../common/SectionHeader';
import { DocumentTypeCard } from './DocumentTypeCard';
import './DocumentTypeGrid.css';

export function DocumentTypeGrid({ onCreate }) {
  return (
    <section className="doc-types" id="document-types" aria-labelledby="doc-types-title">
      <div className="container">
        <SectionHeader
          id="doc-types-title"
          eyebrow="Start a new draft"
          title="What would you like to draft?"
          description="Choose a document type. You will describe the matter next and get a structured preliminary draft to refine."
        />
        <div className="doc-types__grid">
          {DOCUMENT_TYPES.map((type) => (
            <DocumentTypeCard key={type.id} type={type} onCreate={onCreate} />
          ))}
        </div>
      </div>
    </section>
  );
}
