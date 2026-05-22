import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/AppLayout';
import { BankingHistory } from '@/components/banking/BankingHistory';
import { BankingUploadForm } from '@/components/banking/BankingUploadForm';

export const Route = createFileRoute('/conciliacao-bancaria/')({
  component: ConciliacaoBancariaIndex,
});

function ConciliacaoBancariaIndex() {
  return (
    <AppLayout>
      <BankingUploadForm />
      <BankingHistory />
    </AppLayout>
  );
}
