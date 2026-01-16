import { useAmountVisibility } from '@/contexts/AmountVisibilityContext';

export function formatAmount(amount: number, currency: string, isVisible: boolean): string {
  if (!isVisible) {
    return '••••••';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}







