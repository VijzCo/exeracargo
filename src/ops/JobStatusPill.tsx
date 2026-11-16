import { JOB_STATUS_LABEL, type JobStatus } from './types';
import './ops.css';

export default function JobStatusPill({ status }: { status: JobStatus }) {
  return <span className={`jst jst-${status}`}>{JOB_STATUS_LABEL[status] ?? status}</span>;
}
