import { DocumentViewer, documentDescriptorForPath } from "./DocumentViewer";

type MarkdownDocumentProps = {
  content: string;
};

export function MarkdownDocument({ content }: MarkdownDocumentProps) {
  return (
    <DocumentViewer
      descriptor={documentDescriptorForPath("document.md")}
      content={content}
    />
  );
}
