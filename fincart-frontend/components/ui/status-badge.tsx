import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Truck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types/order';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors',
  {
    variants: {
      status: {
        [OrderStatus.CONFIRMED]: 'bg-green-50 text-green-700 ring-green-600/20',
        [OrderStatus.SHIPPED]: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        [OrderStatus.PENDING]: 'bg-orange-50 text-orange-800 ring-orange-600/20',
        [OrderStatus.CANCELLED]: 'bg-red-50 text-red-700 ring-red-600/10',
      },
    },
    defaultVariants: {
      status: OrderStatus.PENDING,
    },
  }
);

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  status: OrderStatus;
}

export function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  const iconMap = {
    [OrderStatus.CONFIRMED]: Check,
    [OrderStatus.SHIPPED]: Truck,
    [OrderStatus.PENDING]: Clock,
    [OrderStatus.CANCELLED]: X,
  };
  
  const IconComponent = iconMap[status] || Clock;

  return (
    <span className={cn(badgeVariants({ status }), className)} {...props}>
      <IconComponent className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}
