import { DRAFTING_STEPS } from '../../data/dashboardTools';
import './WorkflowSteps.css';

export function WorkflowSteps() {
  return (
    <section className="workflow" aria-label="How drafting works">
      <div className="container">
        <ol className="workflow__list">
          {DRAFTING_STEPS.map((step, index) => (
            <li key={step.id} className="workflow__step">
              <span className="workflow__num">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p className="workflow__title">{step.title}</p>
                <p className="workflow__text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
