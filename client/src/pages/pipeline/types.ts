import type { Company, Contact, Deal, PipelineStage } from "@shared/schema";

export interface DealWithRelations extends Deal {
  contact?: Contact;
  company?: Company;
  stage?: PipelineStage;
}

