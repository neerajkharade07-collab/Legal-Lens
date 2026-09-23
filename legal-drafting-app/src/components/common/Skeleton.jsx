import { cn } from '../../utils/cn';
import './Skeleton.css';

export function Skeleton({ className, width, height }) {
  return (
    <span className={cn('skeleton', className)} style={{ width, height }} aria-hidden="true" />
  );
}
