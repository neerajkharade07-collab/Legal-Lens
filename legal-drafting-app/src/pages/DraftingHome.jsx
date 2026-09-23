import { useCallback } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDraftSetup } from '../hooks/useDraftSetup';
import { HeroSection } from '../components/dashboard/HeroSection';
import { WorkflowSteps } from '../components/dashboard/WorkflowSteps';
import { DocumentTypeGrid } from '../components/dashboard/DocumentTypeGrid';
import { DocumentsOverview } from '../components/dashboard/DocumentsOverview';
import { TemplatesPanel } from '../components/dashboard/TemplatesPanel';
import { ToolShortcuts } from '../components/dashboard/ToolShortcuts';
import { SectionHeader } from '../components/common/SectionHeader';
import './DraftingHome.css';

export default function DraftingHome() {
  useDocumentTitle('Drafting Dashboard');
  const { openDraftSetup } = useDraftSetup();

  /** No type preselected — the setup modal asks for one. */
  const handleCreateNew = useCallback(
    () => openDraftSetup({ source: 'create-new' }),
    [openDraftSetup],
  );

  const handleCreateFromCard = useCallback(
    (type) => openDraftSetup({ typeId: type.id, source: 'document-card' }),
    [openDraftSetup],
  );

  const handleUseTemplate = useCallback(
    (template) => openDraftSetup({ typeId: template.id, source: 'template' }),
    [openDraftSetup],
  );

  return (
    <div className="drafting-home">
      <HeroSection onCreateNew={handleCreateNew} />
      <WorkflowSteps />
      <DocumentTypeGrid onCreate={handleCreateFromCard} />

      <section className="drafting-home__workspace" aria-labelledby="workspace-title">
        <div className="container">
          <SectionHeader
            id="workspace-title"
            eyebrow="Workspace"
            title="Pick up where you left off"
          />
          <div className="drafting-home__grid">
            <DocumentsOverview onCreateNew={handleCreateNew} />
            <TemplatesPanel onUseTemplate={handleUseTemplate} />
          </div>
        </div>
      </section>

      <ToolShortcuts />
    </div>
  );
}
