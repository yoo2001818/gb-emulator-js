export interface CPULog {
  type: 'op' | 'event';
  address?: number;
  data: string;
  comment?: string;
}
