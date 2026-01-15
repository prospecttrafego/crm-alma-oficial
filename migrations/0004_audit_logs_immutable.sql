-- Make audit_logs table immutable (append-only)
-- Prevents UPDATE and DELETE operations to maintain audit integrity

-- Create function to prevent modifications
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs são imutáveis. Operações UPDATE e DELETE não são permitidas.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Trigger to prevent UPDATE
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();--> statement-breakpoint

-- Trigger to prevent DELETE
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
