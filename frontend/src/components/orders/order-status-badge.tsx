import { Badge } from '@/components/ui/badge';
import { OrderStatus } from '@/types';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">PENDING</Badge>;
    case 'PAID':
      return <Badge variant="success">PAID</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger">CANCELLED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
