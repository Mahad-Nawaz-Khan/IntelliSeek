import { Inngest } from "inngest";

export type IndexDocumentEvent = {
  name: "document/index.requested";
  data: {
    userId: string;
    documentId: string;
    storagePath: string;
    filename: string;
    fileType: string;
  };
};

export const inngest = new Inngest({ id: "intelliseek" });
