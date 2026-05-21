import { createFileRoute } from "@tanstack/react-router";
import { DocumentsView } from "@/components/DocumentsView";

export const Route = createFileRoute("/documentos/")({
  component: DocumentosIndex,
});

function DocumentosIndex() {
  return (
    <DocumentsView
      breadcrumb={
        <>
          <span className="font-semibold">Documentos</span>
          <span className="mx-2 text-[#b89968]">/</span>
          <span className="font-semibold">Pasta Raiz</span>
        </>
      }
      folders={[
        { label: "Jurisprudência", to: "/documentos/jurisprudencia" },
        { label: "Transcrições", to: "/documentos/transcricoes" },
      ]}
    />
  );
}
