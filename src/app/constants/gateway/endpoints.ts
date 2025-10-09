import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const GATEWAY_ENDPOINTS = {
  QUEUE_CONTROL: {
    ENABLE: buildApiPath('queue-control', 'enable'),
    DISABLE: buildApiPath('queue-control', 'disable'),
    TOGGLE: buildApiPath('queue-control', 'toggle'),
    STATUS: buildApiPath('queue-control', 'status'),
    EXCLUSIONS: buildApiPath('queue-control', 'exclusions'),
    EXCLUSIONS_DELETE: buildApiPath('queue-control', 'exclusions'),
    TEST_JOB: (queueType: Identifier) => buildApiPath('queue-control', 'test-job', String(queueType)),
    CLEAR_EXCLUSIONS: buildApiPath('queue-control', 'clear-exclusions')
  },
  QUEUES: {
    JOB_STATUS: (jobId: Identifier) => buildApiPath('queues', 'job', String(jobId), 'status'),
    COMPLETED: buildApiPath('queues', 'completed'),
    FAILED: buildApiPath('queues', 'failed')
  }
} as const;
