import { createFileRoute } from "@tanstack/react-router";
import { DocumentsView } from "@/components/DocumentsView";

export const Route = createFileRoute("/documentos/jurisprudencia")({
  component: Jurisprudencia,
});

function Jurisprudencia() {
  return (
    <DocumentsView
      breadcrumb={
        <>
          <span className="font-semibold">Documentos</span>
          <span className="mx-2 text-[#b89968]">/</span>
          <span className="font-semibold">Jurisprudência</span>
        </>
      }
      folders={[]}
    />
  );
}
