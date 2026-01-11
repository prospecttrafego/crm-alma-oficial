/**
 * Factory de Schemas Zod para Validacao
 *
 * Configura createSchemaFactory do drizzle-zod com opcoes otimizadas para Zod v4.
 * Centraliza a criacao de schemas para garantir consistencia em todo o projeto.
 */

import { createSchemaFactory } from 'drizzle-zod';

/**
 * Factory configurada para gerar schemas Zod a partir de tabelas Drizzle.
 *
 * Configuracoes:
 * - coerce.date: true - Converte strings ISO para Date automaticamente
 */
export const { createInsertSchema, createUpdateSchema, createSelectSchema } = createSchemaFactory({
  coerce: {
    date: true
  }
});
