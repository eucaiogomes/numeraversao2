import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/AppLayout';
import { BankingChat } from '@/components/banking/BankingChat';

export const Route = createFileRoute('/conciliacao-bancaria/')({
  component: ConciliacaoBancariaIndex,
});

function ConciliacaoBancariaIndex() {
  return (
    <AppLayout>
      <BankingChat />
    </AppLayout>
  );
}
