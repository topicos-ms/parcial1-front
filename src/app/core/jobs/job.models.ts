export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'progress'
  | 'delayed';

export interface JobUpdate {
  jobId: string;
  status: JobStatus;
  result?: unknown;
  error?: unknown;
  queueName?: string;
  progress?: number;
  estimatedTimeRemaining?: number;
  timestamp: number;
}

export interface JobAckMetadata {
  timeout: number;
  priority: number;
  retryCount: number;
}

export interface JobAck {
  jobId: string;
  status: JobStatus;
  estimatedTime?: string;
  checkStatusUrl?: string;
  queueType?: string;
  timestamp: string;
  metadata?: JobAckMetadata;
}
