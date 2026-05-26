import type { FitValidationResult } from '../types';
import { formatNumber } from '../utils/unitConversion';

interface StatusPanelProps {
  validation: FitValidationResult;
}

export function StatusPanel({ validation }: StatusPanelProps) {
  return (
    <footer className="status-panel">
      <div className={validation.fits ? 'status-pill positive' : 'status-pill negative'}>
        Fits: {validation.fits ? 'Yes' : 'No'}
      </div>
      <div>
        <span>Volume utilization</span>
        <strong>{formatNumber(validation.volumeUtilizationPercent)}%</strong>
      </div>
      <div>
        <span>Total object weight</span>
        <strong>{formatNumber(validation.totalObjectWeightKg)} kg</strong>
      </div>
      <div>
        <span>Remaining payload</span>
        <strong>{formatNumber(validation.remainingPayloadKg)} kg</strong>
      </div>
      <div>
        <span>Objects</span>
        <strong>{validation.objectCount}</strong>
      </div>
      <div className="warnings">
        <span>Active warnings</span>
        {validation.warnings.length === 0 ? (
          <strong>None</strong>
        ) : (
          <ul>
            {validation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
