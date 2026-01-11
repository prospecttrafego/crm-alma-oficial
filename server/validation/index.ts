/**
 * Modulo Central de Validacao
 *
 * Exporta todos os schemas e helpers de validacao.
 * Usar este modulo em vez de importar diretamente de shared/schema.ts
 *
 * Exemplo de uso:
 * ```typescript
 * import { insertContactSchema, updateContactSchema, idParamSchema } from '../validation';
 * ```
 */

// Factory functions (para criar novos schemas se necessario)
export { createInsertSchema, createUpdateSchema, createSelectSchema } from './factory';

// Todos os schemas de validacao
export * from './schemas';
