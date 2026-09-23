import { Badge } from '../common/Badge';
import './FrameworkOption.css';

/** FIR / Police Complaint only — a drafting preference, not a compliance check. */
export function FrameworkOption({ checked, onChange }) {
  return (
    <div className="framework">
      <span className="setup-label" aria-hidden="true">
        Legal framework
      </span>
      <label className="framework__row">
        <input
          type="checkbox"
          className="framework__checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby="framework-help"
        />
        <span className="framework__text">
          <span className="framework__title">Use applicable BNS/BNSS framework</span>
          <span id="framework-help" className="framework__help">
            Structure the complaint with reference to the Bharatiya Nyaya Sanhita and Bharatiya
            Nagarik Suraksha Sanhita where relevant. Any provisions suggested later are unverified.
          </span>
        </span>
      </label>
      <Badge tone="demo" className="framework__badge">
        Requires verification
      </Badge>
    </div>
  );
}
